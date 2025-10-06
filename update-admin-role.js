// Run this with: node update-admin-role.js
const path = require('path');

async function updateUserRole() {
  // Bootstrap Strapi
  const strapi = await require('@strapi/strapi')({
    distDir: path.join(__dirname, 'dist'),
  }).load();

  try {
    // Find steven.banke@gmail.com user
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email: 'steven.banke@gmail.com' }
    });

    if (!user) {
      console.error('❌ User steven.banke@gmail.com not found');
      process.exit(1);
    }

    console.log('\n📋 Current user details:');
    console.log(`ID: ${user.id}`);
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Current Role: ${user.userRole || 'null'}`);

    // Update to sysadmin
    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { userRole: 'sysadmin' }
    });

    console.log('\n✅ Successfully updated userRole to: sysadmin');
    console.log('\n🔄 Please logout and login again to see the changes');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await strapi.destroy();
    process.exit(0);
  }
}

updateUserRole();
