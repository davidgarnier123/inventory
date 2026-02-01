import { useState } from 'react';
import EquipmentCard from './EquipmentCard';
import { getEquipmentTypeIcon, getEquipmentTypeName } from '../services/csvParser';
import BarcodeScanner from './BarcodeScanner';
import EquipmentDetailsModal from './EquipmentDetailsModal';
import './WorkstationView.css';

export default function WorkstationView({
    mainEquipment,
    linkedEquipment = [],
    onEquipmentValidate,
    onScan,
    lastScanResult,
    scanError: parentScanError,
    unexpectedScans = []
}) {
    const [showScanner, setShowScanner] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState(null);

    const allItems = [mainEquipment, ...linkedEquipment];
    // Use validatedItems from main equipment loop (passed as prop or derived)
    const validatedItems = new Set(allItems.filter(eq => eq.inventoryStatus === 'found').map(eq => eq.serialNumber));
    const agentMismatch = allItems.some(eq => eq.attributionError);
    // Unexpected items are handled by parent session's unexpectedScans

    const isComplete = validatedItems.size === allItems.length;
    const progress = (validatedItems.size / allItems.length) * 100;

    const toggleValidation = (serialNumber) => {
        const item = allItems.find(eq => eq.serialNumber === serialNumber);
        const newStatus = validatedItems.has(serialNumber) ? 'pending' : 'found';
        onEquipmentValidate(serialNumber, newStatus, agentMismatch);
    };

    const toggleAgentMismatch = (checked) => {
        allItems.forEach(eq => {
            onEquipmentValidate(eq.serialNumber, eq.inventoryStatus, checked);
        });
    };

    const confirmWorkstation = () => {
        // Update inventory status for all items
        allItems.forEach(eq => {
            const status = validatedItems.has(eq.serialNumber) ? 'found' : 'missing';
            onEquipmentValidate(eq.serialNumber, status, agentMismatch);
        });
        onClose();
    };

    return (
        <div className="workstation-view">
            <div className="workstation-header">
                <button className="back-btn" onClick={onClose}>
                    ← Retour
                </button>
                <h2>Poste de {mainEquipment.agent || 'Travail'}</h2>
                <button
                    className={`scan-toggle-btn ${showScanner ? 'active' : ''}`}
                    onClick={() => setShowScanner(!showScanner)}
                >
                    {showScanner ? '❌ Fermer Scanner' : '📷 Scanner'}
                </button>
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

                    {currentAgent && mainEquipment.agent &&
                        currentAgent.toLowerCase() !== mainEquipment.agent.toLowerCase() && (
                            <div className="agent-warning">
                                <span className="warning-icon">⚠️</span>
                                <span>Agent attendu: {currentAgent}</span>
                            </div>
                        )}

                    <label className="agent-mismatch-check">
                        <input
                            type="checkbox"
                            checked={agentMismatch}
                            onChange={(e) => toggleAgentMismatch(e.target.checked)}
                        />
                        <span>Signaler erreur d'attribution</span>
                    </label>
                </div>
            </div>

            <div className="workstation-categories">
                {/* ABSENTS */}
                {allItems.some(eq => !validatedItems.has(eq.serialNumber)) && (
                    <div className="workstation-category absent">
                        <h3 className="category-title">⭕ Équipements manquants</h3>
                        <div className="linked-list">
                            {allItems.filter(eq => !validatedItems.has(eq.serialNumber)).map(eq => (
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

                {/* PRÉSENTS */}
                {validatedItems.size > 0 && (
                    <div className="workstation-category present">
                        <h3 className="category-title">✅ Équipements validés</h3>
                        <div className="linked-list">
                            {allItems.filter(eq => validatedItems.has(eq.serialNumber)).map(eq => (
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
                    {validatedItems.size} / {allItems.length} validés
                </span>

                <button
                    className={`confirm-btn ${isComplete ? 'complete' : ''}`}
                    onClick={confirmWorkstation}
                >
                    {isComplete ? '✓ Valider le poste complet' : 'Valider le poste'}
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
