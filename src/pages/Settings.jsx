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
    getEquipmentCount,
    getAllPlans,
    savePlan,
    deletePlan
} from '../services/database';
import { parseCSV, exportToCSV, getEquipmentTypeIcon } from '../services/csvParser';
import ServicePicker from '../components/ServicePicker';
import './Settings.css';

export default function Settings() {
    const navigate = useNavigate();
    const [equipment, setEquipment] = useState([]);
    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [importStatus, setImportStatus] = useState(null);
    const [showConfirmClear, setShowConfirmClear] = useState(false);
    const [stats, setStats] = useState({ byType: {} });
    const [selectedServices, setSelectedServices] = useState(new Set());
    const [planName, setPlanName] = useState('');
    const [plans, setPlans] = useState([]);
    const [equipmentCounts, setEquipmentCounts] = useState({});
    const [isSavingPlan, setIsSavingPlan] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [eq, svc, pl] = await Promise.all([
                getAllEquipment(),
                getAllServices(),
                getAllPlans()
            ]);

            setEquipment(eq);
            setServices(svc);
            setPlans(pl);

            // Calculate stats
            const byType = {};
            eq.forEach(e => {
                byType[e.type] = (byType[e.type] || 0) + 1;
            });
            setStats({ byType });

            // Calculate equipment counts per service
            const counts = {};
            svc.forEach(s => {
                counts[s.path] = eq.filter(e =>
                    e.service && e.service.startsWith(s.path)
                ).length;
            });
            setEquipmentCounts(counts);
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

            // Clear existing data to prevent mixing/pollution
            await clearAllEquipment();
            await clearAllServices();

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
        setSelectedServices(new Set());
        setPlanName('');
        await loadData();
    };

    const handleSavePlan = async () => {
        if (selectedServices.size === 0) return;

        setIsSavingPlan(true);
        try {
            const finalName = planName.trim() || `Inventaire ${new Date().toLocaleDateString()}`;
            const plan = {
                id: Date.now().toString(),
                name: finalName,
                services: Array.from(selectedServices),
                createdAt: new Date().toISOString()
            };
            await savePlan(plan);
            setPlanName('');
            setSelectedServices(new Set());
            await loadData();
            setImportStatus({ type: 'success', message: 'Plan d\'inventaire sauvegardé' });
        } catch (err) {
            console.error('Save plan error:', err);
            setImportStatus({ type: 'error', message: 'Erreur lors de la sauvegarde du plan' });
        }
        setIsSavingPlan(false);
    };

    const handleSaveAndStartPlan = async () => {
        if (selectedServices.size === 0) return;

        setIsSavingPlan(true);
        try {
            const finalName = planName.trim() || `Inventaire ${new Date().toLocaleDateString()}`;
            const plan = {
                id: Date.now().toString(),
                name: finalName,
                services: Array.from(selectedServices),
                createdAt: new Date().toISOString()
            };
            await savePlan(plan);

            navigate('/inventory', {
                state: {
                    selectedServices: plan.services,
                    planId: plan.id,
                    planName: plan.name
                }
            });
        } catch (err) {
            console.error('Save and start plan error:', err);
            setImportStatus({ type: 'error', message: 'Erreur lors de la sauvegarde du plan' });
            setIsSavingPlan(false);
        }
    };

    const handleDeletePlan = async (id) => {
        try {
            await deletePlan(id);
            await loadData();
        } catch (err) {
            console.error('Delete plan error:', err);
        }
    };

    const handleExportPlan = (plan) => {
        const data = JSON.stringify(plan, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `plan_${plan.name.replace(/\s+/g, '_')}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImportPlan = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const content = await file.text();
            const plan = JSON.parse(content);

            if (!plan.name || !Array.isArray(plan.services)) {
                throw new Error('Format de plan invalide');
            }

            // Generate new ID to avoid collisions
            plan.id = Date.now().toString();
            await savePlan(plan);
            await loadData();
            setImportStatus({ type: 'success', message: 'Plan importé avec succès' });
        } catch (err) {
            console.error('Import plan error:', err);
            setImportStatus({ type: 'error', message: 'Erreur lors de l\'import du plan' });
        }
        event.target.value = '';
    };

    const getSelectedEquipmentCount = () => {
        let count = 0;
        selectedServices.forEach(path => {
            const hasSelectedChild = services.some(
                svc => svc.parent === path && selectedServices.has(svc.path)
            );
            if (!hasSelectedChild) {
                count += equipmentCounts[path] || 0;
            }
        });
        return count;
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
                    <h2>📋 Préparation d'inventaire</h2>
                    <p className="section-desc">
                        Créez des plans d'inventaire en sélectionnant des services spécifiques.
                    </p>

                    <div className="plan-creation">
                        <input
                            type="text"
                            placeholder="Nom du plan (ex: Inventaire Bureau 101)"
                            value={planName}
                            onChange={(e) => setPlanName(e.target.value)}
                            className="plan-name-input"
                        />

                        <div className="plan-service-picker">
                            <ServicePicker
                                services={services}
                                selectedServices={selectedServices}
                                onSelectionChange={setSelectedServices}
                                equipmentCounts={equipmentCounts}
                            />
                        </div>

                        <div className="plan-summary">
                            <span>{getSelectedEquipmentCount()} équipements dans ce plan</span>
                        </div>

                        <div className="plan-creation-actions">
                            <button
                                className="action-btn"
                                onClick={handleSavePlan}
                                disabled={selectedServices.size === 0 || isSavingPlan}
                            >
                                {isSavingPlan ? '...' : '💾 Sauvegarder'}
                            </button>
                            <button
                                className="action-btn primary"
                                onClick={handleSaveAndStartPlan}
                                disabled={selectedServices.size === 0 || isSavingPlan}
                            >
                                {isSavingPlan ? '...' : '🚀 Sauvegarder & Lancer'}
                            </button>
                        </div>
                    </div>

                    {plans.length > 0 && (
                        <div className="saved-plans">
                            <h3>Plans sauvegardés</h3>
                            <div className="plans-list">
                                {plans.map(plan => (
                                    <div key={plan.id} className="plan-item">
                                        <div className="plan-info">
                                            <span className="plan-name">{plan.name}</span>
                                            <span className="plan-meta">{plan.services.length} services sélectionnés</span>
                                        </div>
                                        <div className="plan-actions">
                                            <button
                                                className="plan-action-btn primary"
                                                onClick={() => navigate('/inventory', {
                                                    state: {
                                                        selectedServices: plan.services,
                                                        planId: plan.id,
                                                        planName: plan.name
                                                    }
                                                })}
                                                title="Démarrer l'inventaire"
                                            >
                                                ▶
                                            </button>
                                            <button
                                                className="plan-action-btn"
                                                onClick={() => handleExportPlan(plan)}
                                                title="Exporter"
                                            >
                                                📥
                                            </button>
                                            <button
                                                className="plan-action-btn danger"
                                                onClick={() => handleDeletePlan(plan.id)}
                                                title="Supprimer"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="import-plan-zone">
                        <input
                            type="file"
                            id="plan-import"
                            accept=".json"
                            onChange={handleImportPlan}
                            className="file-input"
                        />
                        <label htmlFor="plan-import" className="import-plan-btn">
                            📥 Importer un plan (.json)
                        </label>
                    </div>
                </section>
            </div>

            {
                showConfirmClear && (
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
                )
            }

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
        </div >
    );
}
