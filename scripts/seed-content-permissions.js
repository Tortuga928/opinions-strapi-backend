/**
 * Seed Content-Type Permissions
 * Configures Strapi role permissions for custom content types
 *
 * This script sets up permissions for:
 * - quote-draft (authenticated users)
 * - user-activity-log (authenticated users)
 *
 * This script is called by seed-master.js during bootstrap
 *
 * Usage:
 *   - Via Bootstrap: Automatically runs on every startup
 *   - Via Node: node scripts/seed-content-permissions.js (requires Strapi instance)
 */

module.exports = async function seedContentPermissions() {
  console.log('🔐 Configuring content-type permissions...');

  try {
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const authenticatedRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: 'authenticated' } });

    if (!authenticatedRole) {
      console.log('  ⚠️  Authenticated role not found, skipping');
      return;
    }

    const currentPermissions = await pluginStore.get({ key: 'grant' });

    // Initialize authenticated permissions if not exists
    if (!currentPermissions.authenticated) {
      currentPermissions.authenticated = {};
    }

    // Configure quote-draft permissions
    const quoteDraftPermissions = {
      controllers: {
        'quote-draft': {
          find: { enabled: true },
          findOne: { enabled: true },
          create: { enabled: true },
          update: { enabled: true },
          delete: { enabled: true },
          generateQuote: { enabled: true },
          deleteAllUserDrafts: { enabled: true },
          publish: { enabled: true }
        }
      }
    };

    if (!currentPermissions.authenticated['api::quote-draft']) {
      currentPermissions.authenticated['api::quote-draft'] = {};
    }
    currentPermissions.authenticated['api::quote-draft'] = quoteDraftPermissions;
    console.log('  ✓ Quote-draft permissions configured');

    // Configure user-activity-log permissions
    const activityLogPermissions = {
      controllers: {
        'user-activity-log': {
          find: { enabled: true },
          findOne: { enabled: true },
          update: { enabled: true },
          count: { enabled: true },
          markAllAsRead: { enabled: true }
        }
      }
    };

    if (!currentPermissions.authenticated['api::user-activity-log']) {
      currentPermissions.authenticated['api::user-activity-log'] = {};
    }
    currentPermissions.authenticated['api::user-activity-log'] = activityLogPermissions;
    console.log('  ✓ User-activity-log permissions configured');

    // Save permissions
    await pluginStore.set({ key: 'grant', value: currentPermissions });

    console.log('✅ Content-type permissions configured\n');
  } catch (error) {
    console.error('❌ Error configuring content-type permissions:', error);
    throw error;
  }
};

// Allow standalone execution for testing
if (require.main === module) {
  console.log('⚠️  This script requires a running Strapi instance');
  console.log('    Run via: npm run strapi script scripts/seed-content-permissions.js');
  process.exit(1);
}
