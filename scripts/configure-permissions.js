/**
 * Script to configure permissions for user-activity-log content type
 * Run with: node scripts/configure-permissions.js
 */

const axios = require('axios');

const PORT = process.env.PORT || 1341;
const BASE_URL = `http://localhost:${PORT}`;

async function configurePermissions() {
  try {
    console.log('🔧 Configuring user-activity-log permissions...\n');

    // Get admin JWT token from environment (must be set manually)
    const token = process.env.TOKEN;

    if (!token) {
      console.error('❌ ERROR: TOKEN environment variable not set');
      console.log('\nTo get a token:');
      console.log('1. Login to admin panel: http://localhost:1341/admin');
      console.log('2. Open browser DevTools → Network tab');
      console.log('3. Refresh page and find any API request');
      console.log('4. Copy Authorization header token');
      console.log('5. Run: export TOKEN="your-token-here"');
      console.log('6. Then run this script again\n');
      process.exit(1);
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 1: Get authenticated role
    console.log('📋 Step 1: Getting authenticated role...');
    const rolesResponse = await axios.get(`${BASE_URL}/admin/users-permissions/roles`, { headers });
    const authenticatedRole = rolesResponse.data.roles.find(r => r.type === 'authenticated');

    if (!authenticatedRole) {
      console.error('❌ Authenticated role not found');
      process.exit(1);
    }

    console.log(`✅ Found authenticated role (ID: ${authenticatedRole.id})\n`);

    // Step 2: Update permissions
    console.log('📋 Step 2: Updating permissions for user-activity-log...');

    // Get current permissions
    const currentPermissions = authenticatedRole.permissions || {};

    // Add user-activity-log permissions
    const updatedPermissions = {
      ...currentPermissions,
      'api::user-activity-log': {
        'user-activity-log': {
          'find': { enabled: true },
          'findOne': { enabled: true },
          'update': { enabled: true },
          'count': { enabled: true },
          'markAllAsRead': { enabled: true }
        }
      }
    };

    // Update role with new permissions
    const updateResponse = await axios.put(
      `${BASE_URL}/admin/users-permissions/roles/${authenticatedRole.id}`,
      {
        name: authenticatedRole.name,
        description: authenticatedRole.description,
        permissions: updatedPermissions
      },
      { headers }
    );

    console.log('✅ Permissions updated successfully!\n');

    // Step 3: Verify permissions
    console.log('📋 Step 3: Verifying permissions...');
    const verifyResponse = await axios.get(`${BASE_URL}/admin/users-permissions/roles/${authenticatedRole.id}`, { headers });
    const activityLogPerms = verifyResponse.data.role?.permissions?.['api::user-activity-log'];

    if (activityLogPerms) {
      console.log('✅ Verified permissions:');
      console.log('   - find:', activityLogPerms['user-activity-log']?.find?.enabled ? '✓' : '✗');
      console.log('   - findOne:', activityLogPerms['user-activity-log']?.findOne?.enabled ? '✓' : '✗');
      console.log('   - update:', activityLogPerms['user-activity-log']?.update?.enabled ? '✓' : '✗');
      console.log('   - count:', activityLogPerms['user-activity-log']?.count?.enabled ? '✓' : '✗');
      console.log('   - markAllAsRead:', activityLogPerms['user-activity-log']?.markAllAsRead?.enabled ? '✓' : '✗');
    } else {
      console.warn('⚠️  Could not verify permissions');
    }

    console.log('\n🎉 Permission configuration complete!');
    console.log('\nNext steps:');
    console.log('1. Test endpoint: curl -H "Authorization: Bearer $TOKEN" http://localhost:1341/api/user-activity-logs');
    console.log('2. Check frontend notification center');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

configurePermissions();
