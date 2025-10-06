/**
 * Script to create a sysadmin user for testing
 * Run with: node scripts/create-sysadmin.js
 */

const Strapi = require('@strapi/strapi');

async function createSysadmin() {
  const appContext = await Strapi().load();
  const app = appContext.start();

  try {
    // Check if testsysadmin already exists
    const existing = await strapi.query('plugin::users-permissions.user').findOne({
      where: { username: 'testsysadmin' }
    });

    if (existing) {
      console.log('✅ testsysadmin user already exists');

      // Generate JWT token
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      const token = jwtService.issue({ id: existing.id });

      console.log('\n📝 JWT Token for testsysadmin:');
      console.log(token);
      console.log('\n💡 Use this token in your curl commands:');
      console.log(`export TOKEN='${token}'`);
      console.log(`curl -H "Authorization: Bearer $TOKEN" http://localhost:1341/api/permission-profiles\n`);

      await app.destroy();
      return;
    }

    // Create testsysadmin user
    const user = await strapi.query('plugin::users-permissions.user').create({
      data: {
        username: 'testsysadmin',
        email: 'testsysadmin@test.com',
        password: await strapi.plugin('users-permissions').service('user').hashPassword('TestAdmin123!'),
        confirmed: true,
        blocked: false,
        userRole: 'sysadmin'
      }
    });

    console.log('✅ Created testsysadmin user:', user.id);

    // Generate JWT token
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const token = jwtService.issue({ id: user.id });

    console.log('\n📝 JWT Token for testsysadmin:');
    console.log(token);
    console.log('\n💡 Use this token in your curl commands:');
    console.log(`export TOKEN='${token}'`);
    console.log(`curl -H "Authorization: Bearer $TOKEN" http://localhost:1341/api/permission-profiles\n`);

    await app.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    await app.destroy();
    process.exit(1);
  }
}

createSysadmin();
