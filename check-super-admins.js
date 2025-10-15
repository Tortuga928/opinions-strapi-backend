const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '.tmp', 'data.db');
const db = new Database(dbPath);

console.log('Super Admin Users:');
const users = db.prepare('SELECT id, username, email, is_super_admin FROM up_users WHERE is_super_admin = 1').all();
users.forEach(u => {
  console.log(`  ID: ${u.id}, Username: ${u.username}, Email: ${u.email}`);
});

console.log('\nAll Users with Roles:');
const allUsers = db.prepare('SELECT id, username, email, user_role, is_super_admin FROM up_users ORDER BY id').all();
allUsers.forEach(u => {
  const superAdminFlag = u.is_super_admin ? ' ⭐' : '';
  console.log(`  ID: ${u.id}, Username: ${u.username}, Role: ${u.user_role || 'none'}${superAdminFlag}`);
});

db.close();
