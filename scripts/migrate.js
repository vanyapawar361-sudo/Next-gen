const fs = require('fs/promises');
const path = require('path');

const dbPath = path.join(__dirname, '../db.json');

async function migrate() {
  console.log('Starting DB migration...');
  try {
    const data = await fs.readFile(dbPath, 'utf8');
    const db = JSON.parse(data);
    
    let count = 0;
    db.documents = db.documents.map(doc => {
      if (!doc.ownerId) {
        doc.ownerId = 'user-admin-01';
        count++;
      }
      return doc;
    });
    
    await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
    console.log(`Migration complete. Assigned ownerId to ${count} documents.`);
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

migrate();
