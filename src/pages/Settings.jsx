import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getAllEquipment,
    getAllServices,
    saveAllEquipment,
    saveAllServices,
    clearAllEquipment,
    clearAllServices,
    clearAllData,
    getEquipmentCount
} from '../services/database';
import { parseCSV, exportToCSV, getEquipmentTypeIcon } from '../services/csvParser';
import './Settings.css';

export default function Settings() {
    const navigate = useNavigate();
    const [equipment, setEquipment] = useState([]);
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [importStatus, setImportStatus] = useState(null);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [stats, setStats] = useState({ byType: {} });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [eq, svc] = await Promise.all([
                getAllEquipment(),
                getAllServices()
            ]);

            setEquipment(eq);
            setServices(svc);

            // Calculate stats
            const byType = {};
            eq.forEach(e => {
                byType[e.type] = (byType[e.type] || 0) + 1;
            });
            setStats({ byType });
        } catch (err) {
            console.error('Error loading data:', err);
        }
        setIsLoading(false);
    };

    const handleFileImport = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImportStatus({ type: 'loading', message: 'Import en cours...' });

        try {
            const content = await file.text();
            const { equipment: newEquipment, services: newServices } = parseCSV(content);

            if (newEquipment.length === 0) {
                setImportStatus({
                    type: 'error',
                    message: 'Aucun équipement trouvé dans le fichier'
                });
                return;
            }

            await saveAllEquipment(newEquipment);
            await saveAllServices(newServices);

            setImportStatus({
                type: 'success',
                message: `${newEquipment.length} équipements importés, ${newServices.length} services créés`
            });

            await loadData();
        } catch (err) {
            console.error('Import error:', err);
            setImportStatus({
                type: 'error',
                message: 'Erreur lors de l\'import: ' + err.message
            });
        }

        // Clear file input
        event.target.value = '';
    };

    const handleExport = () => {
        const csv = exportToCSV(equipment);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventaire_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleClearData = async () => {
        await clearAllData();
        setShowConfirmClear(false);
        setImportStatus({ type: 'success', message: 'Données supprimées' });
        await loadData();
    };

    return (
        <div className="settings-page">
            <header className="settings-header">
                <button className="back-btn" onClick={() => navigate('/')}>
                    ← Retour
                </button>
                <h1>Paramètres</h1>
            </header>

            <div className="settings-content">
                <section className="settings-section">
                    <h2>📂 Import de données</h2>
                    <p className="section-desc">
                        Importez un fichier CSV contenant les équipements du parc informatique.
                    </p>

                    <div className="import-zone">
                        <input
                            type="file"
                            id="csv-import"
                            accept=".csv"
                            onChange={handleFileImport}
                            className="file-input"
                        />
                        <label htmlFor="csv-import" className="import-btn">
                            <span className="import-icon">📄</span>
                            <span className="import-text">Sélectionner un fichier CSV</span>
                        </label>
                    </div>

                    {importStatus && (
                        <div className={`import-status ${importStatus.type}`}>
                            {importStatus.type === 'loading' && <div className="mini-spinner"></div>}
                            {importStatus.type === 'success' && <span>✓</span>}
                            {importStatus.type === 'error' && <span>✕</span>}
                            <span>{importStatus.message}</span>
                        </div>
                    )}

                    <div className="csv-format-hint">
                        <h4>Format attendu (séparateur: ;)</h4>
                        <code>
                            Marque;Type;Modèle;N°Série;Service;Agent;Date;;MAC;Info;ID;Commentaire;ID_PC_lié
                        </code>
                    </div>
                </section>

                <section className="settings-section">
                    <h2>📊 Données stockées</h2>

                    {isLoading ? (
                        <div className="loading">
                            <div className="mini-spinner"></div>
                            <span>Chargement...</span>
                        </div>
                    ) : equipment.length === 0 ? (
                        <p className="empty-message">Aucune donnée stockée</p>
                    ) : (
                        <>
                            <div className="data-summary">
                                <div className="summary-card">
                                    <span className="summary-value">{equipment.length}</span>
                                    <span className="summary-label">Équipements</span>
                                </div>
                                <div className="summary-card">
                                    <span className="summary-value">{services.length}</span>
                                    <span className="summary-label">Services</span>
                                </div>
                            </div>

                            <div className="type-breakdown">
                                {Object.entries(stats.byType).map(([type, count]) => (
                                    <div key={type} className="type-item">
                                        <span className="type-icon">{getEquipmentTypeIcon(type)}</span>
                                        <span className="type-name">{type}</span>
                                        <span className="type-count">{count}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="data-actions">
                                <button className="action-btn export" onClick={handleExport}>
                                    📥 Exporter en CSV
                                </button>
                                <button
                                    className="action-btn danger"
                                    onClick={() => setShowConfirmClear(true)}
                                >
                                    🗑️ Supprimer toutes les données
                                </button>
                            </div>
                        </>
                    )}
                </section>

                <section className="settings-section">
                    <h2>📷 Scanner</h2>
                    <p className="section-desc">
                        Configuration du scanner de codes-barres Dynamsoft.
                    </p>

                    <div className="scanner-info">
                        <div className="info-row">
                            <span className="info-label">Format supporté:</span>
                            <span className="info-value">Code 128</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Licence:</span>
                            <span className="info-value trial">Version d'essai</span>
                        </div>
                    </div>
                </section>

                <section className="settings-section">
                    <h2>ℹ️ À propos</h2>
                    <div className="about-info">
                        <p><strong>Inventaire Parc Informatique</strong></p>
                        <p className="version">Version 1.0.0</p>
                        <p className="desc">
                            Application PWA de gestion d'inventaire avec scan de codes-barres Code 128.
                        </p>
                    </div>
                </section>
            </div>

            {showConfirmClear && (
                <div className="modal-overlay" onClick={() => setShowConfirmClear(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>⚠️ Confirmer la suppression</h3>
                        <p>
                            Cette action supprimera définitivement tous les équipements,
                            services et sessions d'inventaire.
                        </p>
                        <div className="modal-actions">
                            <button
                                className="modal-btn cancel"
                                onClick={() => setShowConfirmClear(false)}
                            >
                                Annuler
                            </button>
                            <button
                                className="modal-btn confirm"
                                onClick={handleClearData}
                            >
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <nav className="bottom-nav">
                <button className="nav-btn" onClick={() => navigate('/')}>
                    <span className="nav-icon">🏠</span>
                    <span className="nav-label">Accueil</span>
                </button>
                <button className="nav-btn active">
                    <span className="nav-icon">⚙️</span>
                    <span className="nav-label">Paramètres</span>
                </button>
            </nav>
        </div>
    );
}
