/**
 * Seed Test Users
 * Creates default test users for development and testing
 *
 * This script is called by seed-master.js during bootstrap
 * ONLY in non-production environments
 *
 * Default Users:
 * - testsysadmin (sysadmin role) - TestAdmin123!
 *
 * Usage:
 *   - Via Bootstrap: Automatically runs in dev/test environments
 *   - Via Node: node scripts/seed-test-users.js (requires Strapi instance)
 */

module.exports = async function seedTestUsers() {
  console.log('👤 Seeding test users...');

  // Skip in production
  if (process.env.NODE_ENV === 'production') {
    console.log('  ⏭️  Skipped (production environment)');
    console.log('✅ Test users seeding skipped\n');
    return;
  }

  const bcrypt = require('bcryptjs');

  const testUsers = [
    {
      username: 'testsysadmin',
      email: 'testsysadmin@test.com',
      password: 'TestAdmin123!',
      userRole: 'sysadmin',
      confirmed: true,
      blocked: false
    }
  ];

  try {
    for (const userData of testUsers) {
      // Check if user already exists
      const existing = await strapi.query('plugin::users-permissions.user').findOne({
        where: { username: userData.username }
      });

      if (existing) {
        console.log(`  ✓ User already exists: ${userData.username}`);

        // Generate token for existing user (useful for testing)
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const token = jwtService.issue({ id: existing.id });
        console.log(`    JWT Token: ${token}`);
      } else {
        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Create user
        const user = await strapi.query('plugin::users-permissions.user').create({
          data: {
            username: userData.username,
            email: userData.email,
            password: hashedPassword,
            confirmed: userData.confirmed,
            blocked: userData.blocked,
            userRole: userData.userRole
          }
        });

        // Generate JWT token
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const token = jwtService.issue({ id: user.id });

        console.log(`  + Created user: ${userData.username} (${userData.userRole})`);
        console.log(`    Email: ${userData.email}`);
        console.log(`    Password: ${userData.password}`);
        console.log(`    JWT Token: ${token}`);
      }
    }

    console.log('✅ Test users seeded\n');
  } catch (error) {
    console.error('❌ Error seeding test users:', error);
    throw error;
  }
};

// Allow standalone execution for testing
if (require.main === module) {
  console.log('⚠️  This script requires a running Strapi instance');
  console.log('    Run via: npm run strapi script scripts/seed-test-users.js');
  process.exit(1);
}
