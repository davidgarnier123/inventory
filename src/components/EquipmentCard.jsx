import { getEquipmentTypeIcon, getEquipmentTypeName } from '../services/csvParser';
import './EquipmentCard.css';

export default function EquipmentCard({
    equipment,
    onClick,
    showStatus = true,
    compact = false,
    isHighlighted = false,
    showAgent = false
}) {
    const statusClasses = {
        pending: 'status-pending',
        found: 'status-found',
        missing: 'status-missing',
        error: 'status-error'
    };

    const statusLabels = {
        pending: 'En attente',
        found: 'Trouvé',
        missing: 'Manquant',
        error: 'Erreur attribution'
    };

    return (
        <div
            className={`equipment-card ${compact ? 'compact' : ''} ${isHighlighted ? 'highlighted' : ''} ${statusClasses[equipment.inventoryStatus] || ''}`}
            onClick={() => onClick?.(equipment)}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <div className="card-icon">
                <span className="type-icon">{getEquipmentTypeIcon(equipment.type)}</span>
            </div>

            <div className="card-content">
                <div className="card-header">
                    <span className="equipment-type">{getEquipmentTypeName(equipment.type)}</span>
                    {showStatus && (
                        <span className={`status-badge ${statusClasses[equipment.inventoryStatus]}`}>
                            {statusLabels[equipment.inventoryStatus]}
                        </span>
                    )}
                </div>

                <div className="card-title">
                    <span className="brand">{equipment.brand}</span>
                    <span className="model">{equipment.model}</span>
                </div>

                <div className="card-serial">
                    <span className="serial-label">S/N:</span>
                    <span className="serial-value">{equipment.serialNumber}</span>
                </div>

                {(showAgent || !compact) && (
                    <>
                        <div className="card-agent">
                            <span className="agent-icon">👤</span>
                            <span className="agent-name">{equipment.agent || 'Non attribué'}</span>
                        </div>

                        {equipment.linkedPcId && (
                            <div className="card-linked">
                                <span className="linked-icon">🔗</span>
                                <span className="linked-label">Poste:</span>
                                <span className="linked-value">{equipment.linkedPcId}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
