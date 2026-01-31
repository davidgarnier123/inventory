import { getEquipmentTypeIcon, getEquipmentTypeName } from '../services/csvParser';
import './EquipmentDetailsModal.css';

export default function EquipmentDetailsModal({ equipment, onClose }) {
    if (!equipment) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="modal-icon-large">
                        {getEquipmentTypeIcon(equipment.type)}
                    </div>
                    <div className="modal-title-area">
                        <h2>{getEquipmentTypeName(equipment.type)}</h2>
                        <p>{equipment.brand} {equipment.model}</p>
                    </div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </header>

                <div className="modal-body">
                    <div className="detail-row">
                        <span className="detail-label">Numéro de série</span>
                        <span className="detail-value highlighted">{equipment.serialNumber}</span>
                    </div>

                    <div className="detail-row">
                        <span className="detail-label">Service / Localisation</span>
                        <span className="detail-value">{equipment.service || 'Non spécifié'}</span>
                    </div>

                    <div className="detail-row">
                        <span className="detail-label">Utilisateur / Agent</span>
                        <span className="detail-value">{equipment.agent || 'Non attribué'}</span>
                    </div>

                    {equipment.linkedPcId && (
                        <div className="detail-row">
                            <span className="detail-label">Relié au PC (S/N)</span>
                            <span className="detail-value">{equipment.linkedPcId}</span>
                        </div>
                    )}

                    {equipment.comment && (
                        <div className="detail-row">
                            <span className="detail-label">Commentaire</span>
                            <span className="detail-value italic">{equipment.comment}</span>
                        </div>
                    )}

                    <div className="detail-row">
                        <span className="detail-label">Dernier scan</span>
                        <span className="detail-value">
                            {equipment.lastScannedAt
                                ? new Date(equipment.lastScannedAt).toLocaleString('fr-FR')
                                : 'Jamais scanné'}
                        </span>
                    </div>
                </div>

                <footer className="modal-footer">
                    <button className="modal-action-btn" onClick={onClose}>Fermer</button>
                </footer>
            </div>
        </div>
    );
}
