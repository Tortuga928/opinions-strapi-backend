const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '.tmp', 'data.db');
const db = new Database(dbPath);

try {
  // First, let's see the table structure
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%activity%'").all();
  console.log('📋 Activity tables:', tables);

  // Delete all user_activity_logs
  const result = db.prepare('DELETE FROM user_activity_logs').run();
  console.log(`✅ Deleted ${result.changes} notification(s)`);

  // Verify deletion
  const count = db.prepare('SELECT COUNT(*) as count FROM user_activity_logs').get();
  console.log(`✅ Remaining notifications: ${count.count}`);
} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  db.close();
}
