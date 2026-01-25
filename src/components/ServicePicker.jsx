import { useState, useCallback, useMemo } from 'react';
import './ServicePicker.css';

export default function ServicePicker({ services, selectedServices, onSelectionChange, equipmentCounts = {} }) {
    // Current path in the navigation (array of service paths)
    const [navigationStack, setNavigationStack] = useState([]);

    // Build a map for quick access to services by path
    const serviceMap = useMemo(() => {
        const map = new Map();
        services.forEach(svc => map.set(svc.path, svc));
        return map;
    }, [services]);

    // Build tree structure from flat services list
    const buildTree = useCallback(() => {
        const nodeMap = new Map();
        const rootNodes = [];

        // Create node objects
        services.forEach(svc => {
            nodeMap.set(svc.path, {
                ...svc,
                children: [],
                equipmentCount: equipmentCounts[svc.path] || 0
            });
        });

        // Build parent-child relationships
        services.forEach(svc => {
            const node = nodeMap.get(svc.path);
            if (svc.parent && nodeMap.has(svc.parent)) {
                nodeMap.get(svc.parent).children.push(node);
            } else if (!svc.parent) {
                rootNodes.push(node);
            } else {
                rootNodes.push(node);
            }
        });

        return { rootNodes, nodeMap };
    }, [services, equipmentCounts]);

    const { rootNodes, nodeMap } = buildTree();

    // Get current visible nodes based on navigation stack
    const getCurrentNodes = () => {
        if (navigationStack.length === 0) {
            return rootNodes;
        }
        const currentPath = navigationStack[navigationStack.length - 1];
        const currentNode = nodeMap.get(currentPath);
        return currentNode?.children || [];
    };

    // Check if a service (and all its descendants) is selected
    const isFullySelected = (node) => {
        if (!selectedServices.has(node.path)) return false;
        return node.children.every(child => isFullySelected(child));
    };

    // Check if a service or any of its descendants is selected
    const isPartiallySelected = (node) => {
        if (selectedServices.has(node.path)) return true;
        return node.children.some(child => isPartiallySelected(child));
    };

    // Get all descendant paths of a node
    const getDescendants = (node) => {
        let paths = [node.path];
        node.children.forEach(child => {
            paths = paths.concat(getDescendants(child));
        });
        return paths;
    };

    // Toggle selection for a single node and its descendants
    const toggleSelection = (node) => {
        const newSelection = new Set(selectedServices);
        const descendants = getDescendants(node);

        if (isFullySelected(node)) {
            // Deselect this node and all descendants
            descendants.forEach(p => newSelection.delete(p));
        } else {
            // Select this node and all descendants
            descendants.forEach(p => newSelection.add(p));
        }

        onSelectionChange(newSelection);
    };

    // Navigate into a service's children
    const navigateInto = (servicePath) => {
        setNavigationStack([...navigationStack, servicePath]);
    };

    // Navigate back one level
    const navigateBack = () => {
        setNavigationStack(navigationStack.slice(0, -1));
    };

    // Navigate to a specific level in the breadcrumb
    const navigateToLevel = (index) => {
        if (index < 0) {
            setNavigationStack([]);
        } else {
            setNavigationStack(navigationStack.slice(0, index + 1));
        }
    };

    // Get current parent name for display
    const getCurrentParentName = () => {
        if (navigationStack.length === 0) return null;
        const currentPath = navigationStack[navigationStack.length - 1];
        return serviceMap.get(currentPath)?.name || '';
    };

    // Select all visible services
    const selectAll = () => {
        const newSelection = new Set(selectedServices);
        getCurrentNodes().forEach(node => {
            getDescendants(node).forEach(p => newSelection.add(p));
        });
        onSelectionChange(newSelection);
    };

    // Deselect all visible services
    const deselectAll = () => {
        const newSelection = new Set(selectedServices);
        getCurrentNodes().forEach(node => {
            getDescendants(node).forEach(p => newSelection.delete(p));
        });
        onSelectionChange(newSelection);
    };

    const currentNodes = getCurrentNodes();

    if (services.length === 0) {
        return (
            <div className="service-picker empty">
                <p>Aucun service disponible. Importez d'abord un fichier CSV.</p>
            </div>
        );
    }

    return (
        <div className="service-picker">
            {/* Breadcrumb Navigation */}
            <div className="picker-breadcrumb">
                <button
                    className={`breadcrumb-item ${navigationStack.length === 0 ? 'active' : ''}`}
                    onClick={() => navigateToLevel(-1)}
                >
                    🏠 Racine
                </button>
                {navigationStack.map((path, index) => (
                    <button
                        key={path}
                        className={`breadcrumb-item ${index === navigationStack.length - 1 ? 'active' : ''}`}
                        onClick={() => navigateToLevel(index)}
                    >
                        <span className="breadcrumb-separator">›</span>
                        {serviceMap.get(path)?.name}
                    </button>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="picker-actions">
                <button className="picker-action-btn" onClick={selectAll}>
                    ✓ Tout sélectionner
                </button>
                <button className="picker-action-btn" onClick={deselectAll}>
                    ✗ Tout désélectionner
                </button>
                <span className="selected-count">
                    {selectedServices.size} sélectionné(s)
                </span>
            </div>

            {/* Back Button (when navigated into a folder) */}
            {navigationStack.length > 0 && (
                <button className="picker-back-btn" onClick={navigateBack}>
                    <span className="back-icon">←</span>
                    <span className="back-text">Retour</span>
                    <span className="current-folder">{getCurrentParentName()}</span>
                </button>
            )}

            {/* Service List */}
            <div className="picker-list">
                {currentNodes.length === 0 ? (
                    <div className="picker-empty-folder">
                        <span className="empty-icon">📄</span>
                        <span>Aucun sous-service</span>
                    </div>
                ) : (
                    currentNodes.map(node => {
                        const hasChildren = node.children.length > 0;
                        const fullySelected = isFullySelected(node);
                        const partiallySelected = !fullySelected && isPartiallySelected(node);

                        return (
                            <div
                                key={node.path}
                                className={`picker-item ${fullySelected ? 'selected' : ''} ${partiallySelected ? 'partial' : ''}`}
                            >
                                {/* Selection Checkbox */}
                                <button
                                    className="item-checkbox"
                                    onClick={() => toggleSelection(node)}
                                    aria-label={fullySelected ? 'Désélectionner' : 'Sélectionner'}
                                >
                                    {fullySelected ? (
                                        <span className="check-icon checked">✓</span>
                                    ) : partiallySelected ? (
                                        <span className="check-icon partial">−</span>
                                    ) : (
                                        <span className="check-icon"></span>
                                    )}
                                </button>

                                {/* Service Info */}
                                <div className="item-content" onClick={() => hasChildren && navigateInto(node.path)}>
                                    <div className="item-header">
                                        <span className="item-icon">{hasChildren ? '📁' : '📄'}</span>
                                        <span className="item-name">{node.name}</span>
                                    </div>
                                    {node.equipmentCount > 0 && (
                                        <span className="item-count">{node.equipmentCount} équip.</span>
                                    )}
                                </div>

                                {/* Navigate Button (if has children) */}
                                {hasChildren && (
                                    <button
                                        className="item-navigate"
                                        onClick={() => navigateInto(node.path)}
                                        aria-label="Voir les sous-services"
                                    >
                                        <span className="navigate-count">{node.children.length}</span>
                                        <span className="navigate-icon">›</span>
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
