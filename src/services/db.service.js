const fs = require('fs/promises');
const path = require('path');

const dbPath = path.join(__dirname, '../../db.json');

// Initialize DB file if not exists
async function initDb() {
  const defaultDb = { 
    users: [
      {
        id: "user-admin-01",
        username: "admin",
        password: "$2b$10$qAqsmCekNhGFxsV/DXFFe.YfOX3I9CAMnOWXc2B0bPOCzzcJ2jKUm",
        role: "Admin",
        department: "IT"
      },
      {
        id: "user-emp-01",
        username: "employee1",
        password: "$2b$10$r0KrG7Ktt.Mm83Gh5k7QVuis6jX5HddKsVfElLEa8DF0w4nKPBkyW",
        role: "Employee",
        department: "HR"
      }
    ], 
    documents: [], 
    chunks: [], 
    summaries: [], 
    shared_access: [], 
    audit_logs: [] 
  };
  try {
    await fs.access(dbPath);
    // Merge existing with defaults to ensure all collections exist
    const data = await fs.readFile(dbPath, 'utf8');
    const existing = JSON.parse(data);
    const merged = { ...defaultDb, ...existing };
    if (Object.keys(merged).length !== Object.keys(existing).length) {
      await saveDb(merged);
    }
  } catch {
    await saveDb(defaultDb);
  }
}

async function getDb() {
  await initDb();
  const data = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(data);
}

async function saveDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
}

// Collections: 'documents', 'chunks', 'summaries'
exports.insert = async (collection, item) => {
  const db = await getDb();
  db[collection].push(item);
  await saveDb(db);
  return item;
};

exports.findOne = async (collection, query) => {
  const db = await getDb();
  if (!db[collection]) return null;
  return db[collection].find(item => {
    return Object.keys(query).every(k => item[k] === query[k]);
  });
};

exports.find = async (collection, query) => {
  const db = await getDb();
  if (!db[collection]) return [];
  if (!query) return db[collection];
  return db[collection].filter(item => {
    return Object.keys(query).every(k => item[k] === query[k]);
  });
};

exports.update = async (collection, query, updateData) => {
  const db = await getDb();
  let updated = null;
  db[collection] = db[collection].map(item => {
    const match = Object.keys(query).every(k => item[k] === query[k]);
    if (match) {
      updated = { ...item, ...updateData };
      return updated;
    }
    return item;
  });
  await saveDb(db);
  return updated;
};

exports.remove = async (collection, query) => {
  const db = await getDb();
  if (!db[collection]) return false;
  const initialLength = db[collection].length;
  db[collection] = db[collection].filter(item => {
    return !Object.keys(query).every(k => item[k] === query[k]);
  });
  if (db[collection].length !== initialLength) {
    await saveDb(db);
    return true;
  }
  return false;
};
