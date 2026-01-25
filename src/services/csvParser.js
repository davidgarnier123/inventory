/**
 * Parse CSV content and extract equipment and services
 * CSV format: Marque;Type;Modèle;N°Série;Service;Agent;Date;?;MAC;Info;ID;Commentaire;LinkedPcId
 */

export function parseCSV(csvContent, delimiter = ';') {
    const lines = csvContent.trim().split('\n');
    const equipment = [];
    const servicesSet = new Set();

    for (const line of lines) {
        if (!line.trim()) continue;

        const columns = parseCSVLine(line, delimiter);
        if (columns.length < 6) continue;

        const [
            brand,
            type,
            model,
            serialNumber,
            service,
            agent,
            attributionDate,
            _empty,
            macAddress,
            info,
            equipmentId,
            comment,
            linkedPcId
        ] = columns.map(c => c.trim());

        // Skip if no serial number
        if (!serialNumber) continue;

        // Normalize type for easier processing
        const normalizedType = normalizeType(type);

        equipment.push({
            serialNumber,
            brand: brand || '',
            type: normalizedType,
            rawType: type || '',
            model: model || '',
            service: service || '',
            agent: agent || '',
            attributionDate: attributionDate || '',
            macAddress: macAddress || '',
            info: info || '',
            equipmentId: equipmentId || '',
            comment: comment || '',
            linkedPcId: linkedPcId || '',
            inventoryStatus: 'pending' // pending, found, missing, error
        });

        // Extract service hierarchy
        if (service) {
            extractServiceHierarchy(service, servicesSet);
        }
    }

    const services = buildServiceTree(servicesSet);

    return { equipment, services };
}

function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current);
    return result;
}

function normalizeType(type) {
    if (!type) return 'other';

    const lowerType = type.toLowerCase();

    if (lowerType.includes('ordinateur') || lowerType.includes('pc') || lowerType.includes('thinkpad') || lowerType.includes('laptop')) {
        return 'pc';
    }
    if (lowerType.includes('station') || lowerType.includes('dock') || lowerType.includes('périphérique')) {
        return 'dock';
    }
    if (lowerType.includes('moniteur') || lowerType.includes('ecran') || lowerType.includes('écran')) {
        return 'monitor';
    }
    if (lowerType.includes('téléphone') || lowerType.includes('telephone') || lowerType.includes('phone')) {
        return 'phone';
    }
    if (lowerType.includes('imprimante') || lowerType.includes('printer')) {
        return 'printer';
    }

    return 'other';
}

function extractServiceHierarchy(servicePath, servicesSet) {
    const parts = servicePath.split('/').filter(p => p);
    let currentPath = '';

    for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
        servicesSet.add(currentPath);
    }
}

function buildServiceTree(servicesSet) {
    const services = [];
    const sortedPaths = Array.from(servicesSet).sort();

    for (const path of sortedPaths) {
        const parts = path.split('/').filter(p => p);
        const name = parts[parts.length - 1];
        const level = parts.length;
        const parentParts = parts.slice(0, -1);
        const parent = parentParts.length > 0 ? '/' + parentParts.join('/') : null;

        services.push({
            path,
            name,
            level,
            parent
        });
    }

    return services;
}

export function exportToCSV(equipment, delimiter = ';') {
    const lines = equipment.map(eq => [
        eq.brand,
        eq.rawType || eq.type,
        eq.model,
        eq.serialNumber,
        eq.service,
        eq.agent,
        eq.attributionDate,
        '',
        eq.macAddress,
        eq.info,
        eq.equipmentId,
        eq.comment,
        eq.linkedPcId
    ].map(field => {
        const str = String(field || '');
        if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(delimiter));

    return lines.join('\n');
}

export function getEquipmentTypeIcon(type) {
    const icons = {
        pc: '💻',
        dock: '🔌',
        monitor: '🖥️',
        phone: '📱',
        printer: '🖨️',
        other: '📦'
    };
    return icons[type] || icons.other;
}

export function getEquipmentTypeName(type) {
    const names = {
        pc: 'Ordinateur',
        dock: 'Station d\'accueil',
        monitor: 'Écran',
        phone: 'Téléphone',
        printer: 'Imprimante',
        other: 'Autre'
    };
    return names[type] || names.other;
}
