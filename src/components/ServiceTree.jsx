import { useState, useEffect, useCallback } from 'react';
import './ServiceTree.css';

export default function ServiceTree({ services, selectedServices, onSelectionChange, equipmentCounts = {} }) {
    const [expandedNodes, setExpandedNodes] = useState(new Set());

    // Build tree structure from flat services list
    const buildTree = useCallback(() => {
        const nodeMap = new Map();
        const rootNodes = [];

        // Create node objects
        services.forEach(svc => {
            nodeMap.set(svc.path, {
                ...svc,
                children: [],
                isSelected: selectedServices.has(svc.path),
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
                // Parent not found, treat as root
                rootNodes.push(node);
            }
        });

        return rootNodes;
    }, [services, selectedServices, equipmentCounts]);

    const tree = buildTree();

    const toggleExpand = (path) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedNodes(newExpanded);
    };

    const toggleSelection = (path, node) => {
        const newSelection = new Set(selectedServices);

        // Get all descendant paths
        const getDescendants = (n) => {
            let paths = [n.path];
            n.children.forEach(child => {
                paths = paths.concat(getDescendants(child));
            });
            return paths;
        };

        const descendants = getDescendants(node);

        if (newSelection.has(path)) {
            // Deselect this node and all descendants
            descendants.forEach(p => newSelection.delete(p));
        } else {
            // Select this node and all descendants
            descendants.forEach(p => newSelection.add(p));
            // Also expand this node
            setExpandedNodes(prev => new Set([...prev, path]));
        }

        onSelectionChange(newSelection);
    };

    const expandAll = () => {
        const allPaths = services.map(s => s.path);
        setExpandedNodes(new Set(allPaths));
    };

    const collapseAll = () => {
        setExpandedNodes(new Set());
    };

    const renderNode = (node, depth = 0) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedNodes.has(node.path);
        const isSelected = selectedServices.has(node.path);

        return (
            <div key={node.path} className="service-node" style={{ '--depth': depth }}>
                <div className={`node-row ${isSelected ? 'selected' : ''}`}>
                    {hasChildren ? (
                        <button
                            className="expand-btn"
                            onClick={() => toggleExpand(node.path)}
                            aria-label={isExpanded ? 'Réduire' : 'Développer'}
                        >
                            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
                        </button>
                    ) : (
                        <span className="expand-placeholder"></span>
                    )}

                    <label className="node-label">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(node.path, node)}
                            className="node-checkbox"
                        />
                        <span className="node-name">{node.name}</span>
                        {node.equipmentCount > 0 && (
                            <span className="equipment-count">{node.equipmentCount}</span>
                        )}
                    </label>
                </div>

                {hasChildren && isExpanded && (
                    <div className="node-children">
                        {node.children.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (services.length === 0) {
        return (
            <div className="service-tree empty">
                <p>Aucun service disponible. Importez d'abord un fichier CSV.</p>
            </div>
        );
    }

    return (
        <div className="service-tree">
            <div className="tree-toolbar">
                <button onClick={expandAll} className="toolbar-btn">
                    <span>📂</span> Tout développer
                </button>
                <button onClick={collapseAll} className="toolbar-btn">
                    <span>📁</span> Tout réduire
                </button>
                <span className="selection-count">
                    {selectedServices.size} service(s) sélectionné(s)
                </span>
            </div>
            <div className="tree-content">
                {tree.map(node => renderNode(node))}
            </div>
        </div>
    );
}
