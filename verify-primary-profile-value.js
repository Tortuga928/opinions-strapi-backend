/**
 * Verify that primary_profile_id was actually set in the database
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '.tmp', 'data.db');
const db = new Database(dbPath, { readonly: true });

console.log('Checking primary_profile_id values in up_users table...\n');

const query = `
  SELECT
    id,
    username,
    primary_profile_id
  FROM up_users
  WHERE id IN (2, 3, 16, 17)
  ORDER BY id
`;

const rows = db.prepare(query).all();

console.log('User ID | Username          | Primary Profile ID');
console.log('--------|-------------------|-------------------');
rows.forEach(row => {
  console.log(`${row.id.toString().padEnd(7)} | ${row.username.padEnd(17)} | ${row.primary_profile_id !== null ? row.primary_profile_id : 'NULL'}`);
});

console.log('\n');

// Check if user 16 has profile ID 9
const user16 = rows.find(r => r.id === 16);
if (user16) {
  if (user16.primary_profile_id === 9) {
    console.log('✅ SUCCESS: User 16 (testreguser) has primary_profile_id = 9');
  } else if (user16.primary_profile_id === null) {
    console.log('❌ PROBLEM: User 16 (testreguser) has primary_profile_id = NULL (not set)');
  } else {
    console.log(`⚠️  User 16 (testreguser) has primary_profile_id = ${user16.primary_profile_id} (unexpected value)`);
  }
}

db.close();
