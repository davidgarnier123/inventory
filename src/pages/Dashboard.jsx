import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEquipment, getAllServices, getAllSessions, getAllPlans } from '../services/database';
import { getEquipmentTypeIcon } from '../services/csvParser';
import './Dashboard.css';

export default function Dashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalEquipment: 0,
        byType: {},
        services: [],
        recentSessions: [],
        plans: []
    });
    const [equipmentCounts, setEquipmentCounts] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [equipment, services, sessions, plans] = await Promise.all([
                getAllEquipment(),
                getAllServices(),
                getAllSessions(),
                getAllPlans()
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
                recentSessions: sortedSessions,
                plans
            });
        } catch (err) {
            console.error('Error loading data:', err);
        }
        setIsLoading(false);
    };

    const startInventoryFromPlan = (plan) => {
        navigate('/inventory', {
            state: {
                selectedServices: plan.services,
                planId: plan.id,
                planName: plan.name,
                isNewSession: true
            }
        });
    };

    const resumeSession = (session) => {
        navigate('/inventory', {
            state: {
                sessionId: session.id,
                selectedServices: session.services,
                planId: session.planId,
                planName: session.planName,
                isResume: true
            }
        });
    };

    const handleDeleteSession = async (e, sessionId) => {
        e.stopPropagation();
        if (confirm('Supprimer cette session ?')) {
            const { deleteSession } = await import('../services/database');
            await deleteSession(sessionId);
            loadData();
        }
    };

    const handleDeletePlan = async (e, planId) => {
        e.stopPropagation();
        if (confirm('Supprimer ce plan d\'inventaire ?')) {
            const { deletePlan } = await import('../services/database');
            await deletePlan(planId);
            loadData();
        }
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
                        <h2>🚀 Démarrer un inventaire</h2>

                        {stats.plans.length === 0 ? (
                            <div className="no-plans">
                                <p>Aucun plan d'inventaire prêt.</p>
                                <button
                                    className="action-btn secondary"
                                    onClick={() => navigate('/settings')}
                                >
                                    ⚙️ Créer une préparation dans les paramètres
                                </button>
                            </div>
                        ) : (
                            <div className="plans-grid">
                                {stats.plans.map(plan => {
                                    // Calculate total equipment in this plan
                                    let planEquipmentCount = 0;
                                    plan.services.forEach(path => {
                                        const hasSelectedChild = plan.services.some(
                                            p => p !== path && p.startsWith(path + ' /')
                                        );
                                        if (!hasSelectedChild) {
                                            planEquipmentCount += equipmentCounts[path] || 0;
                                        }
                                    });

                                    return (
                                        <div key={plan.id} className="plan-card">
                                            <div className="plan-card-info">
                                                <div className="plan-card-header">
                                                    <span className="plan-card-name">{plan.name}</span>
                                                    <button
                                                        className="plan-delete-btn"
                                                        onClick={(e) => handleDeletePlan(e, plan.id)}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                                <span className="plan-card-meta">
                                                    {planEquipmentCount} équipements • {plan.services.length} services
                                                </span>
                                            </div>
                                            <button
                                                className="plan-start-btn"
                                                onClick={() => startInventoryFromPlan(plan)}
                                            >
                                                Démarrer
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>


                    {stats.recentSessions.length > 0 && (
                        <section className="history-section">
                            <div className="section-header-row">
                                <h2>Historique récent</h2>
                            </div>
                            <div className="sessions-list">
                                {stats.recentSessions.map(session => (
                                    <div key={session.id} className="session-item" onClick={() => session.status === 'active' ? resumeSession(session) : null}>
                                        <div className="session-main">
                                            <div className="session-date">
                                                {new Date(session.startDate).toLocaleDateString('fr-FR', {
                                                    day: 'numeric',
                                                    month: 'short'
                                                })}
                                            </div>
                                            <div className="session-info">
                                                <span className="session-title">{session.planName || 'Inventaire Manuel'}</span>
                                                <div className="session-meta">
                                                    <span className="session-count">
                                                        {session.scannedItems?.length || 0} scannés
                                                    </span>
                                                    <span className={`session-status ${session.status}`}>
                                                        {session.status === 'completed' ? 'Terminé' : 'En cours'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="session-actions">
                                            {session.status === 'active' && (
                                                <button className="resume-btn" onClick={() => resumeSession(session)}>
                                                    Reprendre
                                                </button>
                                            )}
                                            <button className="delete-btn" onClick={(e) => handleDeleteSession(e, session.id)}>
                                                🗑️
                                            </button>
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
