/**
 * Migration Script: Add primary_profile_id column to up_users table
 *
 * This script manually adds the missing primary_profile_id foreign key column
 * that should have been created by Strapi when the primaryProfile relation
 * was defined in the user schema.
 *
 * Run this script ONCE with Strapi stopped.
 */

const path = require('path');
const fs = require('fs');

// Use Strapi's database configuration
const dbPath = path.join(__dirname, '.tmp', 'data.db');

// Check if database file exists
if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database file not found at: ${dbPath}`);
  process.exit(1);
}

console.log(`Found database at: ${dbPath}`);
console.log('Loading better-sqlite3...');

const Database = require('better-sqlite3');
const db = new Database(dbPath);

console.log('\nStep 1: Checking current schema...');

// Check current schema
const pragma = db.prepare('PRAGMA table_info(up_users)').all();
const hasColumn = pragma.some(col => col.name === 'primary_profile_id');

console.log(`Current column count: ${pragma.length}`);
console.log(`primary_profile_id exists: ${hasColumn ? 'YES' : 'NO'}`);

if (hasColumn) {
  console.log('\n✓ Column already exists! No migration needed.');
  db.close();
  process.exit(0);
}

console.log('\nStep 2: Adding primary_profile_id column...');

try {
  // Add the foreign key column
  // This matches the Strapi convention for manyToOne relations
  db.prepare('ALTER TABLE up_users ADD COLUMN primary_profile_id INTEGER').run();

  console.log('✓ Column added successfully');

  // Verify the column was added
  console.log('\nStep 3: Verifying column...');
  const newPragma = db.prepare('PRAGMA table_info(up_users)').all();
  const verified = newPragma.some(col => col.name === 'primary_profile_id');

  if (verified) {
    console.log('✓ Column verified in schema');
    console.log(`New column count: ${newPragma.length}`);
    console.log('\n✅ Migration completed successfully!');
    console.log('\nYou can now restart Strapi and the setPrimaryProfile endpoint should work.');
  } else {
    console.error('✗ Column verification failed');
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
