const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '.tmp', 'data.db');
const db = new Database(dbPath);

console.log('Updating profile ID 10 name to "Test Profile Name"...');

const result = db.prepare('UPDATE permission_profiles SET name = ? WHERE id = ?')
  .run('Test Profile Name', 10);

console.log(`✓ Updated ${result.changes} row(s)`);

// Verify the update
const profile = db.prepare('SELECT id, name FROM permission_profiles WHERE id = ?').get(10);
console.log('Current profile:', profile);

db.close();
