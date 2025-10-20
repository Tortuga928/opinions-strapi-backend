/**
 * Master Seed Script - Orchestrator
 *
 * Runs all database seed scripts in the correct dependency order
 * Called by bootstrap (src/index.ts) when database is empty
 *
 * Seed Order (dependency-aware):
 * 1. Categories - No dependencies
 * 2. Menu Permissions - No dependencies
 * 3. Permission Profiles - Depends on menu permissions
 * 4. Content-Type Permissions - Depends on roles
 * 5. Test Users - Depends on permission profiles (dev only)
 *
 * Usage:
 *   - Via Bootstrap: Automatically runs on empty database
 *   - Via Strapi CLI: npm run strapi script scripts/seed-master.js
 *   - Via Node: node scripts/seed-master.js (not recommended, requires Strapi)
 */

module.exports = async function seedMaster() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🌱 Running Master Seed Script');
  console.log('═══════════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  try {
    // Step 1: Seed Categories (no dependencies)
    await require('./seed-categories')();

    // Step 2: Seed Menu Permissions (no dependencies)
    // Note: This is handled by seed-production-permission-system.js
    // which also creates permission profiles

    // Step 3: Seed Permission System (menus + profiles)
    await require('./seed-production-permission-system')();

    // Step 4: Configure Content-Type Permissions
    await require('./seed-content-permissions')();

    // Step 5: Seed Test Users (dev only)
    await require('./seed-test-users')();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Master seed completed successfully in ${elapsed}s`);
    console.log('═══════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ Master seed failed:', error.message);
    console.error('═══════════════════════════════════════════════════════════\n');
    throw error;
  }
};

// Allow standalone execution (not recommended - use Strapi CLI instead)
if (require.main === module) {
  console.log('⚠️  This script requires a running Strapi instance');
  console.log('');
  console.log('Recommended usage:');
  console.log('  npm run strapi script scripts/seed-master.js');
  console.log('');
  console.log('Or let bootstrap run it automatically on empty database');
  process.exit(1);
}
