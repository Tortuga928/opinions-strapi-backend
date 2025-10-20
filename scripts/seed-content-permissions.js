/**
 * Seed Content-Type Permissions
 * Configures Strapi role permissions for all content types
 *
 * This script sets up permissions for:
 * - category (authenticated users - find, findOne)
 * - opinion (authenticated users - find, findOne, create, update)
 * - user-rating (authenticated users - find, findOne, create, update, delete)
 * - quote-draft (authenticated users - full CRUD + custom actions)
 * - user-activity-log (authenticated users - find, findOne, update, count, markAllAsRead)
 * - menu-permission (authenticated users - find, findOne)
 *
 * This script is called by bootstrap on EVERY startup (not just empty database)
 * because content-type permissions are Strapi configuration, not database records
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

    // Configure category permissions (read-only)
    if (!currentPermissions.authenticated['api::category']) {
      currentPermissions.authenticated['api::category'] = {};
    }
    currentPermissions.authenticated['api::category'] = {
      controllers: {
        'category': {
          find: { enabled: true },
          findOne: { enabled: true }
        }
      }
    };
    console.log('  ✓ Category permissions configured');

    // Configure opinion permissions
    if (!currentPermissions.authenticated['api::opinion']) {
      currentPermissions.authenticated['api::opinion'] = {};
    }
    currentPermissions.authenticated['api::opinion'] = {
      controllers: {
        'opinion': {
          find: { enabled: true },
          findOne: { enabled: true },
          create: { enabled: true },
          update: { enabled: true }
        }
      }
    };
    console.log('  ✓ Opinion permissions configured');

    // Configure user-rating permissions
    if (!currentPermissions.authenticated['api::user-rating']) {
      currentPermissions.authenticated['api::user-rating'] = {};
    }
    currentPermissions.authenticated['api::user-rating'] = {
      controllers: {
        'user-rating': {
          find: { enabled: true },
          findOne: { enabled: true },
          create: { enabled: true },
          update: { enabled: true },
          delete: { enabled: true }
        }
      }
    };
    console.log('  ✓ User-rating permissions configured');

    // Configure quote-draft permissions
    if (!currentPermissions.authenticated['api::quote-draft']) {
      currentPermissions.authenticated['api::quote-draft'] = {};
    }
    currentPermissions.authenticated['api::quote-draft'] = {
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
    console.log('  ✓ Quote-draft permissions configured');

    // Configure user-activity-log permissions
    if (!currentPermissions.authenticated['api::user-activity-log']) {
      currentPermissions.authenticated['api::user-activity-log'] = {};
    }
    currentPermissions.authenticated['api::user-activity-log'] = {
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
    console.log('  ✓ User-activity-log permissions configured');

    // Configure menu-permission permissions (read-only)
    if (!currentPermissions.authenticated['api::menu-permission']) {
      currentPermissions.authenticated['api::menu-permission'] = {};
    }
    currentPermissions.authenticated['api::menu-permission'] = {
      controllers: {
        'menu-permission': {
          find: { enabled: true },
          findOne: { enabled: true }
        }
      }
    };
    console.log('  ✓ Menu-permission permissions configured');

    // Save permissions
    await pluginStore.set({ key: 'grant', value: currentPermissions });

    console.log('✅ All content-type permissions configured\n');
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
