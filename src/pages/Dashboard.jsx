import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEquipment, getAllServices, getAllSessions, getEquipmentCount } from '../services/database';
import { getEquipmentTypeIcon } from '../services/csvParser';
import ServicePicker from '../components/ServicePicker';
import './Dashboard.css';

export default function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalEquipment: 0,
        byType: {},
        services: [],
        recentSessions: []
    });
    const [selectedServices, setSelectedServices] = useState(new Set());
    const [equipmentCounts, setEquipmentCounts] = useState({});
    const [showServiceSelector, setShowServiceSelector] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [equipment, services, sessions] = await Promise.all([
                getAllEquipment(),
                getAllServices(),
                getAllSessions()
            ]);

            // Calculate stats by type
            const byType = {};
            equipment.forEach(eq => {
                byType[eq.type] = (byType[eq.type] || 0) + 1;
            });

            // Calculate equipment counts per service
            const counts = {};
            services.forEach(svc => {
                counts[svc.path] = equipment.filter(eq =>
                    eq.service && eq.service.startsWith(svc.path)
                ).length;
            });
            setEquipmentCounts(counts);

            // Sort sessions by date
            const sortedSessions = sessions
                .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
                .slice(0, 5);

            setStats({
                totalEquipment: equipment.length,
                byType,
                services,
                recentSessions: sortedSessions
            });
        } catch (err) {
            console.error('Error loading data:', err);
        }
        setIsLoading(false);
    };

    const startInventory = () => {
        if (selectedServices.size === 0) {
            setShowServiceSelector(true);
            return;
        }

        // Navigate to inventory session with selected services
        navigate('/inventory', {
            state: {
                selectedServices: Array.from(selectedServices)
            }
        });
    };

    const getSelectedEquipmentCount = () => {
        let count = 0;
        selectedServices.forEach(path => {
            // Count only for leaf services or when no child is selected
            const hasSelectedChild = stats.services.some(
                svc => svc.parent === path && selectedServices.has(svc.path)
            );
            if (!hasSelectedChild) {
                count += equipmentCounts[path] || 0;
            }
        });
        return count;
    };

    if (isLoading) {
        return (
            <div className="dashboard loading">
                <div className="loading-spinner"></div>
                <p>Chargement...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>📦 Inventaire</h1>
                <p>Gestion du parc informatique</p>
            </header>

            {stats.totalEquipment === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📂</div>
                    <h2>Aucune donnée</h2>
                    <p>Commencez par importer un fichier CSV dans les paramètres.</p>
                    <button className="action-btn" onClick={() => navigate('/settings')}>
                        ⚙️ Aller aux paramètres
                    </button>
                </div>
            ) : (
                <>
                    <section className="stats-section">
                        <h2>Vue d'ensemble</h2>
                        <div className="stats-grid">
                            <div className="stat-card total">
                                <span className="stat-value">{stats.totalEquipment}</span>
                                <span className="stat-label">Équipements</span>
                            </div>
                            {Object.entries(stats.byType).map(([type, count]) => (
                                <div key={type} className="stat-card">
                                    <span className="stat-icon">{getEquipmentTypeIcon(type)}</span>
                                    <span className="stat-value">{count}</span>
                                    <span className="stat-label">{type}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="inventory-section">
                        <h2>Nouvel inventaire</h2>

                        {showServiceSelector ? (
                            <div className="service-selection">
                                <p className="selection-hint">
                                    Sélectionnez les services à inclure dans l'inventaire:
                                </p>

                                <ServicePicker
                                    services={stats.services}
                                    selectedServices={selectedServices}
                                    onSelectionChange={setSelectedServices}
                                    equipmentCounts={equipmentCounts}
                                />

                                <div className="selection-summary">
                                    <span className="count">
                                        {getSelectedEquipmentCount()} équipement(s) sélectionné(s)
                                    </span>
                                </div>

                                <div className="selection-actions">
                                    <button
                                        className="cancel-btn"
                                        onClick={() => {
                                            setShowServiceSelector(false);
                                            setSelectedServices(new Set());
                                        }}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        className="start-btn"
                                        onClick={startInventory}
                                        disabled={selectedServices.size === 0}
                                    >
                                        🚀 Démarrer l'inventaire
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button className="start-inventory-btn" onClick={() => setShowServiceSelector(true)}>
                                <span className="btn-icon">📋</span>
                                <span className="btn-text">Démarrer un nouvel inventaire</span>
                                <span className="btn-arrow">→</span>
                            </button>
                        )}
                    </section>

                    {stats.recentSessions.length > 0 && (
                        <section className="history-section">
                            <h2>Historique récent</h2>
                            <div className="sessions-list">
                                {stats.recentSessions.map(session => (
                                    <div key={session.id} className="session-item">
                                        <div className="session-date">
                                            {new Date(session.startDate).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </div>
                                        <div className="session-info">
                                            <span className="session-count">
                                                {session.scannedItems?.length || 0} scannés
                                            </span>
                                            <span className={`session-status ${session.status}`}>
                                                {session.status === 'completed' ? 'Terminé' : 'En cours'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}

            <nav className="bottom-nav">
                <button className="nav-btn active">
                    <span className="nav-icon">🏠</span>
                    <span className="nav-label">Accueil</span>
                </button>
                <button className="nav-btn" onClick={() => navigate('/settings')}>
                    <span className="nav-icon">⚙️</span>
                    <span className="nav-label">Paramètres</span>
                </button>
            </nav>
        </div>
    );
}
