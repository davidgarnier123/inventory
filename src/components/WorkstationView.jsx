import { useState } from 'react';
import EquipmentCard from './EquipmentCard';
import { getEquipmentTypeIcon, getEquipmentTypeName } from '../services/csvParser';
import BarcodeScanner from './BarcodeScanner';
import './WorkstationView.css';

export default function WorkstationView({
    mainEquipment,
    linkedEquipment = [],
    onEquipmentValidate,
    onClose,
    currentAgent
}) {
    const [validatedItems, setValidatedItems] = useState(new Set());
    const [agentMismatch, setAgentMismatch] = useState(false);
    const [unexpectedItems, setUnexpectedItems] = useState([]);
    const [showScanner, setShowScanner] = useState(false);
    const [scanError, setScanError] = useState(null);

    const allItems = [mainEquipment, ...linkedEquipment];
    const progress = (validatedItems.size / allItems.length) * 100;
    const isComplete = validatedItems.size === allItems.length;

    const toggleValidation = (serialNumber) => {
        const newValidated = new Set(validatedItems);
        if (newValidated.has(serialNumber)) {
            newValidated.delete(serialNumber);
        } else {
            newValidated.add(serialNumber);
        }
        setValidatedItems(newValidated);
    };

    const handleScan = (code) => {
        setScanError(null);
        const allItems = [mainEquipment, ...linkedEquipment];
        const found = allItems.find(eq => eq.serialNumber === code);

        if (found) {
            const newValidated = new Set(validatedItems);
            newValidated.add(code);
            setValidatedItems(newValidated);
            // Visual feedback or sound could go here
        } else {
            // Check if it's already in unexpected
            if (!unexpectedItems.find(item => item.code === code)) {
                setUnexpectedItems(prev => [...prev, {
                    code,
                    timestamp: new Date().toISOString()
                }]);
            }
            setScanError("Équipement non attendu sur ce poste");
        }
    };

    const validateAll = () => {
        const allSerials = allItems.map(eq => eq.serialNumber);
        setValidatedItems(new Set(allSerials));
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
                    <BarcodeScanner onScan={handleScan} onError={setScanError} />
                    {scanError && <div className="scan-error-msg">{scanError}</div>}
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
                            onChange={(e) => setAgentMismatch(e.target.checked)}
                        />
                        <span>Signaler erreur d'attribution</span>
                    </label>
                </div>
            </div>

            <div className="linked-section">
                <div className="section-header">
                    <h3>Périphériques liés ({linkedEquipment.length})</h3>
                    <button className="validate-all-btn" onClick={validateAll}>
                        Tout valider
                    </button>
                </div>

                <div className="linked-list">
                    {linkedEquipment.length === 0 ? (
                        <p className="no-linked">Aucun périphérique lié trouvé</p>
                    ) : (
                        linkedEquipment.map(eq => (
                            <div
                                key={eq.serialNumber}
                                className={`linked-item ${validatedItems.has(eq.serialNumber) ? 'validated' : ''}`}
                                onClick={() => toggleValidation(eq.serialNumber)}
                            >
                                <div className="item-icon">{getEquipmentTypeIcon(eq.type)}</div>
                                <div className="item-details">
                                    <span className="item-type">{getEquipmentTypeName(eq.type)}</span>
                                    <span className="item-model">{eq.brand} {eq.model}</span>
                                    <span className="item-serial">{eq.serialNumber}</span>
                                </div>
                                <div className="item-check">
                                    {validatedItems.has(eq.serialNumber) ? '✓' : '○'}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {unexpectedItems.length > 0 && (
                    <div className="unexpected-section">
                        <h3>⚠️ Équipements imprévus ({unexpectedItems.length})</h3>
                        <div className="unexpected-list">
                            {unexpectedItems.map((item, idx) => (
                                <div key={idx} className="unexpected-item">
                                    <span className="item-code">{item.code}</span>
                                    <button
                                        className="remove-unexpected"
                                        onClick={() => setUnexpectedItems(prev => prev.filter((_, i) => i !== idx))}
                                    >
                                        ✕
                                    </button>
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
        </div >
    );
}
