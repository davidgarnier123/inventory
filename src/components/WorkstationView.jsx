import { useState } from 'react';
import EquipmentCard from './EquipmentCard';
import { getEquipmentTypeIcon, getEquipmentTypeName } from '../services/csvParser';
import BarcodeScanner from './BarcodeScanner';
import EquipmentDetailsModal from './EquipmentDetailsModal';
import './WorkstationView.css';

export default function WorkstationView({
    mainEquipment, // Can be null for "New Ad-hoc Workstation"
    linkedEquipment = [],
    onEquipmentValidate,
    onClose,
    onScan,
    lastScanResult,
    scanError: parentScanError,
    unexpectedScans = [],
    isAdHoc = false, // True if creating a new post from scratch
    initialComment = '',
    currentAgent
}) {
    const [showScanner, setShowScanner] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [workstationComment, setWorkstationComment] = useState(initialComment);

    // Internal state to track what was scanned EXCLUSIVELY during this workstation inventory session
    const [sessionValidated, setSessionValidated] = useState(new Set());
    const [adHocItems, setAdHocItems] = useState([]); // For items scanned into a new ad-hoc post

    const allItems = isAdHoc ? adHocItems : [mainEquipment, ...linkedEquipment].filter(Boolean);
    const progress = allItems.length > 0 ? (sessionValidated.size / allItems.length) * 100 : 0;
    const isComplete = allItems.length > 0 && sessionValidated.size === allItems.length;

    const toggleValidation = (serialNumber) => {
        const newValidated = new Set(sessionValidated);
        if (newValidated.has(serialNumber)) {
            newValidated.delete(serialNumber);
        } else {
            newValidated.add(serialNumber);
        }
        setSessionValidated(newValidated);
    };

    const handleInternalScan = async (code) => {
        // We use the parent's onScan logic to get the equipment object
        // but we manage the "validated in this session" locally
        await onScan(code);

        // The parent will update current search result. We check if it matches something
        // Note: This is a bit reactive. We'll rely on the fact that if it's found, 
        // we can identify it in the next render cycle or via a callback.
        // For simplicity, let's just listen to lastScanResult changes if they match our items
    };

    // Auto-validate if a scan happens while this view is open
    useEffect(() => {
        if (lastScanResult?.equipment) {
            const sn = lastScanResult.equipment.serialNumber;
            // If it's an ad-hoc post, add it to our list if not already there
            if (isAdHoc && !adHocItems.find(eq => eq.serialNumber === sn)) {
                setAdHocItems(prev => [...prev, lastScanResult.equipment]);
                setSessionValidated(prev => new Set(prev).add(sn));
            } else if (!isAdHoc && allItems.find(eq => eq.serialNumber === sn)) {
                setSessionValidated(prev => new Set(prev).add(sn));
            }
        }
    }, [lastScanResult]);

    const confirmWorkstation = () => {
        // When confirming, we apply the validation to the global session
        allItems.forEach(eq => {
            const status = sessionValidated.has(eq.serialNumber) ? 'found' : 'missing';
            onEquipmentValidate(eq.serialNumber, status, false, workstationComment);
        });

        // If ad-hoc, we might need a specific callback to save the "Poste" as a new entity
        // For now, validating individual items is enough.
        onClose();
    };

    return (
        <div className="workstation-view">
            <div className="workstation-header">
                <button className="back-btn" onClick={onClose}>
                    ← Retour
                </button>
                <h2>{isAdHoc ? 'Nouveau Poste de Travail' : `Poste de ${mainEquipment.agent || 'Travail'}`}</h2>
                <div className="header-actions">
                    <button
                        className={`scan-toggle-btn ${showScanner ? 'active' : ''}`}
                        onClick={() => setShowScanner(!showScanner)}
                    >
                        {showScanner ? '❌ Fermer' : '📷 Scanner'}
                    </button>
                    <button className="confirm-btn-header" onClick={confirmWorkstation}>
                        Valider
                    </button>
                </div>
            </div>

            <div className="workstation-info-row">
                <div className="comment-field">
                    <label>📝 Note / Commentaire pour ce poste</label>
                    <input
                        type="text"
                        placeholder="R.A.S, écran manquant, déménagement..."
                        value={workstationComment}
                        onChange={(e) => setWorkstationComment(e.target.value)}
                    />
                </div>
            </div>

            {showScanner && (
                <div className="workstation-scanner-overlay">
                    <BarcodeScanner onScan={onScan} onError={() => { }} />

                    {lastScanResult && (
                        <div className={`workstation-scan-feedback ${lastScanResult.type}`}>
                            {lastScanResult.equipment ? (
                                <div className="feedback-content">
                                    <span className="icon">{getEquipmentTypeIcon(lastScanResult.equipment.type)}</span>
                                    <span className="text">{lastScanResult.message}</span>
                                </div>
                            ) : (
                                <div className="feedback-content unknown">
                                    <span className="icon">❓</span>
                                    <span className="text">{lastScanResult.code} non trouvé</span>
                                </div>
                            )}
                        </div>
                    )}

                    {parentScanError && <div className="scan-error-msg">{parentScanError}</div>}
                    <div className="scanner-hint">Scannez les équipements du poste</div>
                </div>
            )}

            {!isAdHoc && mainEquipment && (
                <div className="workstation-main">
                    <div className="main-equipment">
                        <div className="equipment-icon-large">
                            {getEquipmentTypeIcon(mainEquipment.type)}
                        </div>
                        <div className="equipment-details">
                            <span className="equipment-type-label">
                                {getEquipmentTypeName(mainEquipment.type)}
                            </span>
                            <h3>{mainEquipment.brand} {mainEquipment.model}</h3>
                            <p className="serial">S/N: {mainEquipment.serialNumber}</p>
                        </div>
                    </div>

                    <div className="agent-check">
                        <div className="agent-info">
                            <span className="agent-label">Attribué à :</span>
                            <span className="agent-name">{mainEquipment.agent || 'Non attribué'}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="workstation-categories">
                {/* ABSENTS (Seulement pour postes existants) */}
                {!isAdHoc && allItems.some(eq => !sessionValidated.has(eq.serialNumber)) && (
                    <div className="workstation-category absent">
                        <h3 className="category-title">⭕ Équipements non encore scannés</h3>
                        <div className="linked-list">
                            {allItems.filter(eq => !sessionValidated.has(eq.serialNumber)).map(eq => (
                                <div key={eq.serialNumber} className="linked-item absent" onClick={() => setSelectedEquipment(eq)}>
                                    <div className="item-icon">{getEquipmentTypeIcon(eq.type)}</div>
                                    <div className="item-details">
                                        <span className="item-type">{getEquipmentTypeName(eq.type)}</span>
                                        <span className="item-model">{eq.brand} {eq.model}</span>
                                        <span className="item-serial">{eq.serialNumber}</span>
                                    </div>
                                    <div className="item-check" onClick={(e) => { e.stopPropagation(); toggleValidation(eq.serialNumber); }}>○</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* IMPRÉVUS SUR CE POSTE */}
                {unexpectedScans.filter(s => s.equipment && s.equipment.linkedPcId !== (mainEquipment.equipmentId || mainEquipment.serialNumber)).length > 0 && (
                    <div className="workstation-category unexpected">
                        <h3 className="category-title">❓ Matériel imprévu sur ce poste</h3>
                        <div className="linked-list">
                            {unexpectedScans.filter(s => s.equipment && s.equipment.linkedPcId !== (mainEquipment.equipmentId || mainEquipment.serialNumber)).map((scan, idx) => (
                                <div
                                    key={idx}
                                    className="linked-item unexpected"
                                    onClick={() => scan.equipment && setSelectedEquipment(scan.equipment)}
                                >
                                    <div className="item-icon">{scan.equipment ? getEquipmentTypeIcon(scan.equipment.type) : '❓'}</div>
                                    <div className="item-details">
                                        <span className="item-type">{scan.equipment ? getEquipmentTypeName(scan.equipment.type) : 'HORS INVENTAIRE POSTE'}</span>
                                        <span className="item-model">{scan.equipment ? `${scan.equipment.brand} ${scan.equipment.model}` : scan.code}</span>
                                        {scan.equipment && <span className="item-serial">{scan.equipment.serialNumber}</span>}
                                        {scan.equipment && <span className="item-agent" style={{ fontSize: '0.8rem', opacity: 0.7 }}>👤 {scan.equipment.agent || 'Sans agent'}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PRÉSENTS / SCANNÉS ICI */}
                {sessionValidated.size > 0 && (
                    <div className="workstation-category present">
                        <h3 className="category-title">✅ Validés sur ce poste</h3>
                        <div className="linked-list">
                            {allItems.filter(eq => sessionValidated.has(eq.serialNumber)).map(eq => (
                                <div key={eq.serialNumber} className="linked-item validated" onClick={() => setSelectedEquipment(eq)}>
                                    <div className="item-icon">{getEquipmentTypeIcon(eq.type)}</div>
                                    <div className="item-details">
                                        <span className="item-type">{getEquipmentTypeName(eq.type)}</span>
                                        <span className="item-model">{eq.brand} {eq.model}</span>
                                        <span className="item-serial">{eq.serialNumber}</span>
                                    </div>
                                    <div className="item-check" onClick={(e) => { e.stopPropagation(); toggleValidation(eq.serialNumber); }}>✓</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="workstation-footer">
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="progress-text">
                    {sessionValidated.size} / {isAdHoc ? '?' : allItems.length} identifiés
                </span>

                <button
                    className={`confirm-btn ${isComplete || isAdHoc ? 'complete' : ''}`}
                    onClick={confirmWorkstation}
                >
                    {isAdHoc ? 'Terminer ce Poste' : (isComplete ? '✓ Valider le poste complet' : 'Valider partiellement')}
                </button>
            </div>

            {selectedEquipment && (
                <EquipmentDetailsModal
                    equipment={selectedEquipment}
                    onClose={() => setSelectedEquipment(null)}
                />
            )}
        </div >
    );
}
