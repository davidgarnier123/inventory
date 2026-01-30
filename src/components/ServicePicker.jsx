import { useState, useMemo } from 'react';
import './ServicePicker.css';

export default function ServicePicker({ services, selectedServices, onSelectionChange, equipmentCounts = {} }) {
    const [navigationStack, setNavigationStack] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    // --- Data Preparation ---

    const serviceMap = useMemo(() => {
        const map = new Map();
        services.forEach(svc => map.set(svc.path, svc));
        return map;
    }, [services]);

    const { rootNodes, nodeMap } = useMemo(() => {
        const nMap = new Map();
        const rNodes = [];

        services.forEach(svc => {
            nMap.set(svc.path, {
                ...svc,
                children: [],
                equipmentCount: equipmentCounts[svc.path] || 0
            });
        });

        services.forEach(svc => {
            const node = nMap.get(svc.path);
            if (svc.parent && nMap.has(svc.parent)) {
                nMap.get(svc.parent).children.push(node);
            } else {
                rNodes.push(node);
            }
        });

        return { rootNodes: rNodes, nodeMap: nMap };
    }, [services, equipmentCounts]);

    // --- Helpers ---

    const getDescendants = (node) => {
        let paths = [node.path];
        node.children.forEach(child => {
            paths = paths.concat(getDescendants(child));
        });
        return paths;
    };

    const isSelectable = (node) => true; // All nodes are selectable

    // Helper: count how many *selectable* descendants are currently selected
    const getSelectedCountInBranch = (node) => {
        const descendants = getDescendants(node);
        return descendants.filter(path => selectedServices.has(path)).length;
    };

    // Helper: Check if fully selected (visual helper for leaf nodes)
    const isSelected = (node) => selectedServices.has(node.path);

    // --- Actions ---

    const toggleSelection = (node) => {
        const newSelection = new Set(selectedServices);

        if (newSelection.has(node.path)) {
            newSelection.delete(node.path);
            // Also deselect descendants if we want cascade behavior?
            // Let's keep it simple: Select strictly the node.
            // But usually, selecting a folder selects context.
            // Let's implement cascade toggle for better UX.
            getDescendants(node).forEach(p => newSelection.delete(p));
        } else {
            newSelection.add(node.path);
            getDescendants(node).forEach(p => newSelection.add(p));
        }

        onSelectionChange(newSelection);
    };

    const navigateInto = (node) => {
        setNavigationStack([...navigationStack, node.path]);
        setSearchQuery(''); // Clear search when navigating deep
    };

    const navigateBack = () => {
        setNavigationStack(prev => prev.slice(0, -1));
    };

    const clearSelection = () => {
        onSelectionChange(new Set());
    };

    // --- Filtering & View Logic ---

    // 1. Search Mode: Flatten everything, only show matching nodes (prefer selectable ones?)
    // Let's show ANY matching node, but if it's a folder, they can click to jump to it?
    // Actually, simple fit: Show matching SELECTABLE services directly.
    const searchResults = useMemo(() => {
        if (!searchQuery) return [];
        const lowerQ = searchQuery.toLowerCase();
        return services
            .filter(svc =>
                (svc.name.toLowerCase().includes(lowerQ) || svc.path.toLowerCase().includes(lowerQ))
            )
            .map(svc => nodeMap.get(svc.path));
    }, [searchQuery, services, nodeMap]);

    // 2. Navigation Mode: Show children of current stack
    const currentNodes = useMemo(() => {
        if (searchQuery) return searchResults;

        if (navigationStack.length === 0) {
            return rootNodes;
        }
        const currentPath = navigationStack[navigationStack.length - 1];
        return nodeMap.get(currentPath)?.children || [];
    }, [navigationStack, rootNodes, nodeMap, searchQuery, searchResults]);

    const currentParentTitle = useMemo(() => {
        if (navigationStack.length === 0) return 'Services';
        const currentPath = navigationStack[navigationStack.length - 1];
        return serviceMap.get(currentPath)?.name || 'Dossier';
    }, [navigationStack, serviceMap]);


    // --- Render ---

    if (services.length === 0) {
        return (
            <div className="service-picker empty">
                <div className="empty-state-icon">📂</div>
                <p>Aucun service disponible. Importez d'abord un fichier CSV.</p>
            </div>
        );
    }

    return (
        <div className="service-picker">
            {/* Header */}
            <div className="picker-header">
                <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Rechercher un service..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
                    )}
                </div>

                {!searchQuery && navigationStack.length > 0 && (
                    <div className="nav-bar">
                        <button className="nav-back-button" onClick={navigateBack}>
                            ← Retour
                        </button>
                        <span className="current-path">{currentParentTitle}</span>
                    </div>
                )}
            </div>

            {/* List */}
            <div className="picker-content">
                {currentNodes.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">👻</div>
                        <p>{searchQuery ? "Aucun résultat trouvé" : "Ce dossier est vide"}</p>
                    </div>
                ) : (
                    currentNodes.map(node => {
                        const selectable = isSelectable(node);
                        const selected = selectable ? isSelected(node) : false;
                        const hasChildren = node.children.length > 0;
                        const selectedCount = !selectable ? getSelectedCountInBranch(node) : 0;

                        return (
                            <div
                                key={node.path}
                                className={`service-item ${selectable ? 'selectable' : 'folder'} ${selected ? 'selected' : ''}`}
                                onClick={() => {
                                    if (selectable) {
                                        toggleSelection(node);
                                    } else if (hasChildren) {
                                        navigateInto(node);
                                    }
                                }}
                            >
                                {/* Left: Icon + Info */}
                                <div className="item-left">
                                    <div className="item-icon-box">
                                        {selectable ? (
                                            <div className="custom-checkbox">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            </div>
                                        ) : (
                                            <span>{hasChildren ? '📁' : '📄'}</span>
                                        )}
                                    </div>
                                    <div className="item-info">
                                        <span className="item-name">{node.name}</span>
                                        {/* Show parent path in search results so user knows context */}
                                        {searchQuery && (
                                            <span className="item-meta">{node.path.split('/').slice(0, -1).join(' / ')}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Action / Meta */}
                                <div className="item-right">
                                    {!selectable && selectedCount > 0 && (
                                        <span className="selection-badge">{selectedCount}</span>
                                    )}
                                    {!selectable && (
                                        <span className="chevron-icon">›</span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="picker-footer">
                <div className="selection-summary">
                    <span className="selection-count">{selectedServices.size}</span>
                    <span className="selection-label">sélectionnés</span>
                </div>
                <div className="footer-actions">
                    {selectedServices.size > 0 && (
                        <button className="footer-btn clear" onClick={clearSelection}>
                            Tout effacer
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

