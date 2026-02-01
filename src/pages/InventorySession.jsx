import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    getAllEquipment,
    getEquipmentByIdentifier,
    getEquipmentByLinkedPc,
    saveEquipment,
    saveSession
} from '../services/database';
import BarcodeScanner from '../components/BarcodeScanner';
import EquipmentCard from '../components/EquipmentCard';
import WorkstationView from '../components/WorkstationView';
import EquipmentDetailsModal from '../components/EquipmentDetailsModal';
import { getEquipmentTypeIcon } from '../services/csvParser';
import './InventorySession.css';

export default function InventorySession() {
    const location = useLocation();
    const navigate = useNavigate();
    const selectedServicePaths = location.state?.selectedServices || [];
    const planName = location.state?.planName || '';
    const planId = location.state?.planId || null;

    const [session, setSession] = useState({
        id: location.state?.sessionId || `session-${Date.now()}`,
        startDate: new Date().toISOString(),
        services: selectedServicePaths,
        planId: planId,
        planName: planName,
        scannedItems: [],
        unexpectedScans: [], // Track unknown or out-of-scope items
        status: 'active'
    });

    const [isLoaded, setIsLoaded] = useState(false);


    const [equipment, setEquipment] = useState([]);
    const [filteredEquipment, setFilteredEquipment] = useState([]);
    const [scannerActive, setScannerActive] = useState(true);
    const [lastScanResult, setLastScanResult] = useState(null);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [isAdHocMode, setIsAdHocMode] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (location.state?.isResume && location.state?.sessionId) {
                const { getSession } = await import('../services/database');
                const existingSession = await getSession(location.state.sessionId);
                if (existingSession) {
                    setSession({
                        ...existingSession,
                        unexpectedScans: existingSession.unexpectedScans || []
                    });
                }
            }
            await loadEquipment();
            setIsLoaded(true);
        };
        init();
    }, []);

    const loadEquipment = async () => {
        const allEquipment = await getAllEquipment();

        // Filter by selected services
        const filtered = allEquipment.filter(eq =>
            selectedServicePaths.some(path => eq.service?.startsWith(path))
        );

        setEquipment(allEquipment);
        setFilteredEquipment(filtered);
    };

    const handleScan = useCallback(async (code, result) => {
        setScanError(null);

        // 1. Identify what was scanned (Exhaustive DB search)
        const foundInDb = await getEquipmentByIdentifier(code);

        let processedEquipment = foundInDb;
        let isRedirection = false;
        let parentPc = null;

        // Auto-Workstation logic: if peripheral linked to a PC, redirect to that PC
        if (foundInDb && foundInDb.linkedPcId && foundInDb.type !== 'pc') {
            parentPc = await getEquipmentByIdentifier(foundInDb.linkedPcId);
            if (parentPc) {
                processedEquipment = parentPc;
                isRedirection = true;
            }
        }

        // 2. Local variables for state calculation to avoid side-effects in setter
        const uniqueId = foundInDb ? foundInDb.serialNumber : code;
        let scanType = 'success';
        let scanMessage = '';

        // 3. Update Session state
        setSession(current => {
            // Check for duplicates
            if (current.scannedItems?.includes(uniqueId)) {
                scanType = 'already_scanned';
                scanMessage = 'Déjà scanné';
                return current;
            }

            // Handle Workstation specific scan within session
            if (showWorkstation) {
                const allWorkstationItems = [showWorkstation, ...linkedEquipment];
                const workstationMatch = foundInDb ? allWorkstationItems.find(eq => eq.serialNumber === foundInDb.serialNumber) : null;

                if (workstationMatch) {
                    scanType = 'success';
                    scanMessage = 'Équipement validé sur le poste';
                } else {
                    scanType = foundInDb ? 'unknown_at_workstation' : 'unknown';
                    scanMessage = foundInDb ? `Trouvé en base : ${foundInDb.agent || 'Sans agent'}` : "Équipement non attendu sur ce poste";
                }
            } else if (!foundInDb) {
                scanType = 'unknown';
                scanMessage = 'Non trouvé en base (S/N, ID...)';
            } else {
                const inScope = (current.services || []).some(path => foundInDb.service?.startsWith(path));
                scanType = inScope ? 'success' : 'outOfScope';
                scanMessage = isRedirection ? `Lié au poste de ${parentPc.agent || 'inconnu'}` : (inScope ? 'Trouvé' : 'Hors périmètre');
            }

            // Construct new session state
            const newScanned = [...new Set([...(current.scannedItems || []), uniqueId])];
            let newUnexpected = [...(current.unexpectedScans || [])];

            if (scanType === 'unknown' || scanType === 'unknown_at_workstation' || scanType === 'outOfScope') {
                // Avoid redundant unexpected scans
                if (!newUnexpected.some(s => s.code === code)) {
                    newUnexpected.push({ code, type: scanType, equipment: foundInDb || null, date: new Date().toISOString() });
                }
            }

            const updatedSession = { ...current, scannedItems: newScanned, unexpectedScans: newUnexpected };

            // Queue async save (non-blocking)
            saveSession(updatedSession).catch(console.error);

            return updatedSession;
        });

        // 4. Handle Side Effects (Database updates & UI state)
        // Set result for UI feedback
        setLastScanResult({
            type: scanType,
            code,
            equipment: foundInDb,
            message: scanMessage
        });

        if (foundInDb) {
            // Update individual equipment inventory status in DB
            const inScope = (session.services || []).some(path => foundInDb.service?.startsWith(path));
            await saveEquipment({
                ...foundInDb,
                inventoryStatus: inScope ? 'found' : 'error',
                lastScannedAt: new Date().toISOString()
            });
            await loadEquipment();
        }

        // If we found a workstation core (PC or Dock), and not yet in workstation view, open it
        if (processedEquipment && !showWorkstation) {
            if (processedEquipment.type === 'pc' || processedEquipment.type === 'dock') {
                const linked = await getEquipmentByLinkedPc(processedEquipment.equipmentId || processedEquipment.serialNumber);
                if (linked.length > 0) {
                    setLinkedEquipment(linked);
                    setShowWorkstation(processedEquipment);
                }
            }
        }
    }, [session.services, session.id, showWorkstation, linkedEquipment]);
    // Minimize dependencies

    const handleScanError = useCallback((error) => {
        setScanError(error);
    }, []);

    const handleEquipmentValidate = async (serialNumber, status, hasError, comment = '') => {
        const eq = await getEquipmentByIdentifier(serialNumber);
        if (eq) {
            await saveEquipment({
                ...eq,
                inventoryStatus: hasError ? 'error' : status,
                attributionError: hasError,
                lastScannedAt: new Date().toISOString(),
                comment: comment || eq.comment // Persist the workstation/manual comment
            });
            await loadEquipment();
        }
    };

    const closeWorkstation = () => {
        setShowWorkstation(null);
        setIsAdHocMode(false);
        setLinkedEquipment([]);
        setScannerActive(true);
    };

    const startAdHocWorkstation = () => {
        setIsAdHocMode(true);
        setShowWorkstation({ type: 'workstation', agent: 'Nouveau Poste' }); // Dummy object
        setLinkedEquipment([]);
    };

    const exportToCSV = () => {
        const headers = ['S/N', 'ID', 'Marque', 'Modele', 'Agent', 'Service', 'Statut', 'Commentaire', 'Date Scan'];
        const dataRows = equipment.map(eq => [
            eq.serialNumber || '',
            eq.equipmentId || '',
            eq.brand || '',
            eq.model || '',
            eq.agent || '',
            eq.service || '',
            eq.inventoryStatus || 'non-scanné',
            eq.comment || '',
            eq.lastScannedAt || ''
        ]);

        // Add unexpected scans too
        session.unexpectedScans.forEach(s => {
            if (s.equipment) {
                dataRows.push([
                    s.equipment.serialNumber,
                    s.equipment.equipmentId,
                    s.equipment.brand,
                    s.equipment.model,
                    s.equipment.agent,
                    s.equipment.service,
                    'Hors périmètre',
                    'Scan imprévu',
                    s.date
                ]);
            } else {
                dataRows.push([s.code, '', '', '', '', '', 'Inconnu', 'Non trouvé en base', s.date]);
            }
        });

        const csvContent = [headers, ...dataRows].map(e => e.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `inventaire_${session.planName || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const pauseInventory = async () => {
        const pausedSession = {
            ...session,
            status: 'active', // Stays active to be resumed
            lastUpdated: new Date().toISOString()
        };
        await saveSession(pausedSession);
        navigate('/');
    };

    const finishInventory = async () => {
        if (!confirm('Terminer cet inventaire ?')) return;
        const finalSession = {
            ...session,
            endDate: new Date().toISOString(),
            status: 'completed'
        };
        await saveSession(finalSession);
        navigate('/');
    };

    const getStats = () => {
        const stats = {
            total: filteredEquipment.length,
            found: filteredEquipment.filter(eq => eq.inventoryStatus === 'found').length,
            missing: filteredEquipment.filter(eq => eq.inventoryStatus === 'pending').length,
            errors: filteredEquipment.filter(eq => eq.inventoryStatus === 'error').length
        };
        stats.progress = stats.total > 0 ? Math.round((stats.found / stats.total) * 100) : 0;
        return stats;
    };

    const stats = getStats();

    if (showWorkstation) {
        return (
            <WorkstationView
                mainEquipment={isAdHocMode ? null : showWorkstation}
                linkedEquipment={linkedEquipment}
                onEquipmentValidate={handleEquipmentValidate}
                onClose={closeWorkstation}
                onScan={handleScan}
                lastScanResult={lastScanResult}
                scanError={scanError}
                unexpectedScans={session.unexpectedScans || []}
                isAdHoc={isAdHocMode}
            />
        );
    }

    return (
        <div className="inventory-session">
            <header className="session-header">
                <button className="back-btn" onClick={() => navigate('/')}>
                    ← Retour
                </button>
                <div className="session-info">
                    <h1>{planName || 'Inventaire en cours'}</h1>
                    <span className="session-services">
                        {planName ? `${selectedServicePaths.length} services` : `${selectedServicePaths.length} service(s) sélectionné(s)`}
                    </span>
                </div>

                <div className="session-actions-top">
                    <button className="export-btn" onClick={exportToCSV}>
                        📥 Exporter
                    </button>
                    <button className="pause-btn" onClick={pauseInventory}>
                        ⏸ Pause
                    </button>
                    <button className="finish-btn" onClick={finishInventory}>
                        Terminer
                    </button>
                </div>
            </header>

            <div className="progress-section">
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${stats.progress}%` }}
                    ></div>
                </div>
                <div className="progress-stats">
                    <span className="stat found">✓ {stats.found}</span>
                    <span className="stat pending">○ {stats.missing}</span>
                    <span className="stat error">⚠ {stats.errors}</span>
                    <span className="stat total">{stats.progress}%</span>
                </div>
            </div>

            <div className="view-tabs">
                <button
                    className={`tab ${viewMode === 'scanner' ? 'active' : ''}`}
                    onClick={() => setViewMode('scanner')}
                >
                    📷 Scanner
                </button>
                <button
                    className={`tab ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                >
                    📋 Liste
                </button>
                <button
                    className={`tab ${viewMode === 'stats' ? 'active' : ''}`}
                    onClick={() => setViewMode('stats')}
                >
                    📊 Stats
                </button>
            </div>

            <div className="session-content">
                <div className="scanner-section" style={{ display: viewMode === 'scanner' ? 'flex' : 'none' }}>
                    <BarcodeScanner
                        onScan={handleScan}
                        onError={handleScanError}
                        isActive={scannerActive && viewMode === 'scanner'}
                    />

                    <div className="scanner-controls">
                        <button className="ad-hoc-btn" onClick={startAdHocWorkstation}>
                            🆕 Créer un Poste
                        </button>
                    </div>

                    {scanError && (
                        <div className="scan-error">
                            <span className="error-icon">⚠️</span>
                            <span>{scanError}</span>
                        </div>
                    )}

                    {lastScanResult && (
                        <div
                            className={`last-scan ${lastScanResult.type}`}
                            onClick={() => lastScanResult.equipment && setSelectedEquipment(lastScanResult.equipment)}
                        >
                            {lastScanResult.type === 'unknown' ? (
                                <div className="unknown-scan">
                                    <span className="scan-icon">❓</span>
                                    <span className="scan-code">{lastScanResult.code}</span>
                                    <span className="scan-message">{lastScanResult.message}</span>
                                </div>
                            ) : (
                                <EquipmentCard
                                    equipment={lastScanResult.equipment}
                                    compact
                                    isHighlighted
                                    showAgent={true}
                                />
                            )}
                        </div>
                    )}

                    {/* RECENT SCANS LIST */}
                    {session.scannedItems?.length > 0 && (
                        <div className="recent-scans-container">
                            <h3 className="section-title">Derniers scans ({session.scannedItems.length})</h3>
                            <div className="recent-scans-list">
                                {[...session.scannedItems].reverse().map(code => {
                                    // Find if it was an unexpected scan with equipment
                                    const unexpected = session.unexpectedScans?.find(s => s.code === code);
                                    // Find it in filteredEquipment or equipment
                                    const inEquipment = equipment.find(e => e.serialNumber === code || e.equipmentId === code);

                                    const displayEquipment = inEquipment || unexpected?.equipment;

                                    return (
                                        <div key={code} className="history-item">
                                            {displayEquipment ? (
                                                <EquipmentCard
                                                    equipment={displayEquipment}
                                                    compact
                                                    showAgent={true}
                                                    onClick={() => setSelectedEquipment(displayEquipment)}
                                                />
                                            ) : (
                                                <div className="history-unknown-card">
                                                    <span className="icon">❓</span>
                                                    <div className="details">
                                                        <span className="code">{code}</span>
                                                        <span className="label">Code inconnu</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {viewMode === 'list' && (
                    <div className="list-section">
                        <div className="list-categories">
                            {/* ABSENTS */}
                            <div className="list-category absent">
                                <h3 className="category-title">
                                    <span className="icon">⭕</span> Absents ({filteredEquipment.filter(e => e.inventoryStatus === 'pending').length})
                                </h3>
                                <div className="equipment-list">
                                    {filteredEquipment.filter(e => e.inventoryStatus === 'pending').map(eq => (
                                        <EquipmentCard
                                            key={eq.serialNumber}
                                            equipment={eq}
                                            compact
                                            onClick={(e) => setSelectedEquipment(e)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* ERREURS D'ATTRIBUTION */}
                            <div className="list-category errors">
                                <h3 className="category-title">
                                    <span className="icon">⚠️</span> Erreurs attribution ({filteredEquipment.filter(e => e.attributionError).length})
                                </h3>
                                <div className="equipment-list">
                                    {filteredEquipment.filter(e => e.attributionError).map(eq => (
                                        <EquipmentCard
                                            key={eq.serialNumber}
                                            equipment={eq}
                                            compact
                                            isHighlighted
                                            onClick={(e) => setSelectedEquipment(e)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* IMPRÉVUS / NON ATTENDUS */}
                            <div className="list-category unexpected">
                                <h3 className="category-title">
                                    <span className="icon">❓</span> Imprévus ({session.unexpectedScans?.length || 0})
                                </h3>
                                <div className="equipment-list">
                                    {(session.unexpectedScans || []).map((scan, idx) => (
                                        <div
                                            key={idx}
                                            className="unexpected-item-card"
                                            onClick={() => scan.equipment && setSelectedEquipment(scan.equipment)}
                                        >
                                            {scan.equipment ? (
                                                <EquipmentCard
                                                    equipment={scan.equipment}
                                                    compact
                                                    showAgent={true}
                                                />
                                            ) : (
                                                <div className="unknown-scanned-code">
                                                    <span className="code">{scan.code}</span>
                                                    <span className="label">Code inconnu (non trouvé en base)</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* TROUVÉS */}
                            <div className="list-category found">
                                <h3 className="category-title">
                                    <span className="icon">✅</span> Présents ({filteredEquipment.filter(e => e.inventoryStatus === 'found' && !e.attributionError).length})
                                </h3>
                                <div className="equipment-list">
                                    {filteredEquipment.filter(e => e.inventoryStatus === 'found' && !e.attributionError).map(eq => (
                                        <EquipmentCard
                                            key={eq.serialNumber}
                                            equipment={eq}
                                            compact
                                            onClick={(e) => setSelectedEquipment(e)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'stats' && (
                    <div className="stats-section">
                        <div className="stats-cards">
                            <div className="stat-card total">
                                <span className="stat-value">{stats.total}</span>
                                <span className="stat-label">Total</span>
                            </div>
                            <div className="stat-card found">
                                <span className="stat-value">{stats.found}</span>
                                <span className="stat-label">Trouvés</span>
                            </div>
                            <div className="stat-card pending">
                                <span className="stat-value">{stats.missing}</span>
                                <span className="stat-label">En attente</span>
                            </div>
                            <div className="stat-card error">
                                <span className="stat-value">{stats.errors}</span>
                                <span className="stat-label">Erreurs</span>
                            </div>
                        </div>

                        <div className="type-breakdown">
                            <h3>Par type d'équipement</h3>
                            {['pc', 'dock', 'monitor', 'phone', 'printer', 'other'].map(type => {
                                const typeCount = filteredEquipment.filter(e => e.type === type).length;
                                const typeFound = filteredEquipment.filter(e => e.type === type && e.inventoryStatus === 'found').length;
                                if (typeCount === 0) return null;

                                return (
                                    <div key={type} className="type-row">
                                        <span className="type-icon">{getEquipmentTypeIcon(type)}</span>
                                        <span className="type-name">{type}</span>
                                        <div className="type-progress">
                                            <div
                                                className="type-fill"
                                                style={{ width: `${(typeFound / typeCount) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="type-count">{typeFound}/{typeCount}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {selectedEquipment && (
                <EquipmentDetailsModal
                    equipment={selectedEquipment}
                    onClose={() => setSelectedEquipment(null)}
                />
            )}
        </div>
    );
}
