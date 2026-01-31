import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    getAllEquipment,
    getEquipmentBySerial,
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
    const [showWorkstation, setShowWorkstation] = useState(null);
    const [linkedEquipment, setLinkedEquipment] = useState([]);
    const [scanError, setScanError] = useState(null);
    const [viewMode, setViewMode] = useState('scanner'); // scanner, list, stats
    const [selectedEquipment, setSelectedEquipment] = useState(null);

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

        // If workstation view is open, handle scan there
        if (showWorkstation) {
            // Check if item is in linked equipment OR is the main equipment
            const allItems = [showWorkstation, ...linkedEquipment];
            const foundInWorkstation = allItems.find(eq => eq.serialNumber === code);

            if (foundInWorkstation) {
                handleEquipmentValidate(code, 'found', false);
                return;
            } else {
                // Unexpected item found on this workstation
                setLastScanResult({
                    type: 'unknown_at_workstation',
                    code,
                    message: "Équipement non attendu sur ce poste"
                });
                return;
            }
        }

        // Find equipment by serial number
        const found = await getEquipmentBySerial(code);

        if (!found) {
            setLastScanResult({
                type: 'unknown',
                code,
                message: 'Équipement non trouvé dans la base'
            });
            // Track unknown item
            const newSession = {
                ...session,
                unexpectedScans: [...(session.unexpectedScans || []), { code, type: 'unknown', date: new Date().toISOString() }]
            };
            setSession(newSession);
            await saveSession(newSession);
            return;
        }

        // Check if in selected services
        const inScope = (session.services || []).some(path =>
            found.service?.startsWith(path)
        );

        // Update equipment status
        const updatedEquipment = {
            ...found,
            inventoryStatus: inScope ? 'found' : 'error',
            lastScannedAt: new Date().toISOString()
        };

        await saveEquipment(updatedEquipment);

        // Update session
        const newUnexpected = !inScope ? [...(session.unexpectedScans || []), { code, type: 'outOfScope', equipment: updatedEquipment, date: new Date().toISOString() }] : (session.unexpectedScans || []);

        const newSession = {
            ...session,
            scannedItems: [...new Set([...(session.scannedItems || []), code])],
            unexpectedScans: newUnexpected
        };
        setSession(newSession);
        await saveSession(newSession);

        setLastScanResult({
            type: inScope ? 'success' : 'outOfScope',
            equipment: updatedEquipment,
            message: inScope ? 'Équipement trouvé' : 'Hors périmètre'
        });

        // Refresh list
        await loadEquipment();

        // If PC or Dock, offer workstation sub-inventory
        if (found.type === 'pc' || found.type === 'dock') {
            // Find linked equipment
            const linked = await getEquipmentByLinkedPc(found.equipmentId || found.serialNumber);
            if (linked.length > 0) {
                setLinkedEquipment(linked);
                setShowWorkstation(updatedEquipment);
                // We keep scanner active now to allow scanning workstation items
            }
        }
    }, [session, showWorkstation, linkedEquipment]);

    const handleScanError = useCallback((error) => {
        setScanError(error);
    }, []);

    const handleEquipmentValidate = async (serialNumber, status, hasError) => {
        const eq = await getEquipmentBySerial(serialNumber);
        if (eq) {
            await saveEquipment({
                ...eq,
                inventoryStatus: hasError ? 'error' : status,
                attributionError: hasError,
                lastScannedAt: new Date().toISOString()
            });
            await loadEquipment();
        }
    };

    const closeWorkstation = () => {
        setShowWorkstation(null);
        setLinkedEquipment([]);
        setScannerActive(true);
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
                mainEquipment={showWorkstation}
                linkedEquipment={linkedEquipment}
                onEquipmentValidate={handleEquipmentValidate}
                onClose={closeWorkstation}
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
                                />
                            )}
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
                                                <EquipmentCard equipment={scan.equipment} compact />
                                            ) : (
                                                <div className="unknown-scanned-code">
                                                    <span className="code">{scan.code}</span>
                                                    <span className="label">Code inconnu</span>
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
