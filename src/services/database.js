import { openDB } from 'idb';

const DB_NAME = 'inventory-db';
const DB_VERSION = 4;

const STORES = {
    EQUIPMENT: 'equipment',
    SERVICES: 'services',
    SESSIONS: 'sessions',
    PLANS: 'plans'
};

async function getDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            // Equipment store
            if (!db.objectStoreNames.contains(STORES.EQUIPMENT)) {
                const equipmentStore = db.createObjectStore(STORES.EQUIPMENT, { keyPath: 'serialNumber' });
                equipmentStore.createIndex('service', 'service');
                equipmentStore.createIndex('agent', 'agent');
                equipmentStore.createIndex('type', 'type');
                equipmentStore.createIndex('linkedPcId', 'linkedPcId');
                equipmentStore.createIndex('equipmentId', 'equipmentId');
            }

            // Services store
            if (!db.objectStoreNames.contains(STORES.SERVICES)) {
                db.createObjectStore(STORES.SERVICES, { keyPath: 'path' });
            }

            // Inventory sessions store
            if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
                const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
                sessionStore.createIndex('status', 'status');
                sessionStore.createIndex('startDate', 'startDate');
            }

            // Inventory plans store
            if (!db.objectStoreNames.contains(STORES.PLANS)) {
                db.createObjectStore(STORES.PLANS, { keyPath: 'id' });
            }
        }
    });
}


// Equipment operations
export async function getAllEquipment() {
    const db = await getDB();
    return db.getAll(STORES.EQUIPMENT);
}

export async function getEquipmentByIdentifier(code) {
    if (!code) return null;
    const db = await getDB();
    const normalizedCode = String(code).trim();
    const upperCode = normalizedCode.toUpperCase();

    // 1. Precise match by Serial (Primary Key)
    let equipment = await db.get(STORES.EQUIPMENT, normalizedCode);
    if (!equipment) equipment = await db.get(STORES.EQUIPMENT, upperCode);
    if (equipment) return equipment;

    // 2. Precise match by index: equipmentId (the 7-digit ID)
    try {
        equipment = await db.getFromIndex(STORES.EQUIPMENT, 'equipmentId', normalizedCode);
        if (!equipment) equipment = await db.getFromIndex(STORES.EQUIPMENT, 'equipmentId', upperCode);
        if (equipment) return equipment;
    } catch (e) {
        console.warn("Index equipmentId failed", e);
    }

    // 3. Fail-safe: Full scan of the database on specific fields only
    // Restricted to: Serial, Equipment ID (7 digits), and Comment
    const all = await db.getAll(STORES.EQUIPMENT);
    return all.find(eq =>
        (eq.serialNumber && eq.serialNumber.trim().toUpperCase() === upperCode) ||
        (eq.equipmentId && String(eq.equipmentId).trim().toUpperCase() === upperCode) ||
        (eq.comment && String(eq.comment).trim().toUpperCase() === upperCode)
    );
}

export async function getEquipmentByService(servicePath) {
    const db = await getDB();
    const all = await db.getAll(STORES.EQUIPMENT);
    return all.filter(eq => eq.service && eq.service.startsWith(servicePath));
}

export async function getEquipmentByLinkedPc(pcId) {
    const db = await getDB();
    const all = await db.getAll(STORES.EQUIPMENT);
    return all.filter(eq => eq.linkedPcId === pcId);
}

export async function saveEquipment(equipment) {
    const db = await getDB();
    return db.put(STORES.EQUIPMENT, equipment);
}

export async function saveAllEquipment(equipmentList) {
    const db = await getDB();
    const tx = db.transaction(STORES.EQUIPMENT, 'readwrite');
    await Promise.all([
        ...equipmentList.map(eq => tx.store.put(eq)),
        tx.done
    ]);
}

export async function clearAllEquipment() {
    const db = await getDB();
    return db.clear(STORES.EQUIPMENT);
}

export async function getEquipmentCount() {
    const db = await getDB();
    return db.count(STORES.EQUIPMENT);
}

// Services operations
export async function getAllServices() {
    const db = await getDB();
    return db.getAll(STORES.SERVICES);
}

export async function saveAllServices(services) {
    const db = await getDB();
    const tx = db.transaction(STORES.SERVICES, 'readwrite');
    await Promise.all([
        ...services.map(svc => tx.store.put(svc)),
        tx.done
    ]);
}

export async function clearAllServices() {
    const db = await getDB();
    return db.clear(STORES.SERVICES);
}

// Session operations
export async function getAllSessions() {
    const db = await getDB();
    return db.getAll(STORES.SESSIONS);
}

export async function getSession(id) {
    const db = await getDB();
    return db.get(STORES.SESSIONS, id);
}

export async function saveSession(session) {
    const db = await getDB();
    return db.put(STORES.SESSIONS, session);
}

export async function deleteSession(id) {
    const db = await getDB();
    return db.delete(STORES.SESSIONS, id);
}

export async function clearAllData() {
    const db = await getDB();
    await db.clear(STORES.EQUIPMENT);
    await db.clear(STORES.SERVICES);
    await db.clear(STORES.SESSIONS);
    await db.clear(STORES.PLANS);
}

// Plan operations
export async function getAllPlans() {
    const db = await getDB();
    return db.getAll(STORES.PLANS);
}

export async function savePlan(plan) {
    const db = await getDB();
    return db.put(STORES.PLANS, plan);
}

export async function deletePlan(id) {
    const db = await getDB();
    return db.delete(STORES.PLANS, id);
}


export { STORES };
