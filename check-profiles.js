const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '.tmp', 'data.db');
const db = new Database(dbPath);

console.log('Available Permission Profiles:');
const profiles = db.prepare('SELECT id, document_id, name FROM permission_profiles ORDER BY id').all();
profiles.forEach(p => {
  console.log(`ID: ${p.id}, Name: ${p.name}, DocumentId: ${p.document_id}`);
});

console.log('\nCurrent primary_profile_id for users:');
const users = db.prepare('SELECT id, username, primary_profile_id FROM up_users WHERE id IN (2, 3, 16, 17)').all();
users.forEach(u => {
  console.log(`User ${u.id} (${u.username}): primary_profile_id = ${u.primary_profile_id || 'NULL'}`);
});

db.close();
