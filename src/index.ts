// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    strapi.log.info('[index.ts register] REGISTER FUNCTION CALLED - Installing auth login override');

    // WORKAROUND for Strapi 5.0.3+ bug: Override auth controllers in register()
    // This MUST be in register() not bootstrap() because routes are bound before bootstrap runs
    const originalLogin = strapi.plugins['users-permissions'].controllers.auth.login;

    strapi.plugins['users-permissions'].controllers.auth.login = async (ctx) => {
      strapi.log.info('[Auth Login REGISTER] Login override called');
      await originalLogin(ctx);

      if (ctx.response.body && ctx.response.body.user) {
        const userId = ctx.response.body.user.id;
        strapi.log.info(`[Auth Login REGISTER] Processing user ${userId}`);

        // CRITICAL FIX: Populate primaryProfile relation for frontend
        // WORKAROUND for Strapi 5 Bug #20330: Use direct SQL to fetch from join table
        try {
          // Use direct SQL to fetch primary_profile from join table (PostgreSQL schema)
          const sqlResult = await strapi.db.connection.raw(
            'SELECT permission_profile_id FROM up_users_primary_profile_lnk WHERE user_id = ?',
            [userId]
          );

          // Handle PostgreSQL .rows format
          const rows = sqlResult.rows || sqlResult;
          const primaryProfileId = rows && rows[0] && rows[0].permission_profile_id;
          strapi.log.info(`[Auth Login REGISTER] primary_profile_id from join table: ${primaryProfileId}`);

          // Fetch primary profile separately if exists
          let primaryProfile = null;
          if (primaryProfileId) {
            // Use direct SQL to fetch profile details (avoid Strapi 5 bug)
            const profileSqlResult = await strapi.db.connection.raw(
              'SELECT id, name, description FROM permission_profiles WHERE id = ?',
              [primaryProfileId]
            );

            primaryProfile = profileSqlResult && profileSqlResult[0] ? {
              id: profileSqlResult[0].id,
              name: profileSqlResult[0].name,
              description: profileSqlResult[0].description
            } : null;

            strapi.log.info(`[Auth Login REGISTER] Profile fetched: ${primaryProfile?.name || 'none'}`);
          }

          // Add primaryProfile to response
          ctx.response.body.user.primaryProfile = primaryProfile;
          strapi.log.info(`[Auth Login REGISTER] FINAL primaryProfile: ${ctx.response.body.user.primaryProfile?.name || 'none'}`);
        } catch (error) {
          strapi.log.error('[Auth Login REGISTER] ERROR:', error);
        }
      }
    };

    strapi.log.info('[index.ts register] Auth login override installed successfully!');
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    strapi.log.info('[index.ts bootstrap] BOOTSTRAP FUNCTION CALLED');

    // Seed predefined categories
    const predefinedCategories = [
      { name: 'Technology', color: '#3B82F6', description: 'Technology and software opinions' },
      { name: 'Politics', color: '#EF4444', description: 'Political and social issues' },
      { name: 'Entertainment', color: '#8B5CF6', description: 'Movies, TV, music, and entertainment' },
      { name: 'Sports', color: '#10B981', description: 'Sports and athletics' },
      { name: 'Health', color: '#06B6D4', description: 'Health and wellness topics' },
      { name: 'Business', color: '#F59E0B', description: 'Business and finance' },
      { name: 'Education', color: '#84CC16', description: 'Education and learning' },
      { name: 'Environment', color: '#22C55E', description: 'Environmental and climate issues' },
      { name: 'Food', color: '#F97316', description: 'Food and dining' },
      { name: 'Travel', color: '#14B8A6', description: 'Travel and tourism' }
    ];

    // Check if categories already exist
    const existingCategories = await strapi.entityService.findMany('api::category.category');

    if (existingCategories.length === 0) {
      // REMOVED FOR PRODUCTION: console.log('🌱 Seeding predefined categories...');

      for (const category of predefinedCategories) {
        await strapi.entityService.create('api::category.category', {
          data: category
        });
      }

      // REMOVED FOR PRODUCTION: console.log('✅ Categories seeded successfully');
    } else {
      // REMOVED FOR PRODUCTION: console.log('📋 Categories already exist, skipping seed');
    }

    // Create default sysadmin user for testing
    try {
      const existing = await strapi.query('plugin::users-permissions.user').findOne({
        where: { username: 'testsysadmin' }
      });

      if (!existing) {
        // REMOVED FOR PRODUCTION: console.log('🔧 Creating default testsysadmin user...');
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('TestAdmin123!', 10);

        const user = await strapi.query('plugin::users-permissions.user').create({
          data: {
            username: 'testsysadmin',
            email: 'testsysadmin@test.com',
            password: hashedPassword,
            confirmed: true,
            blocked: false,
            userRole: 'sysadmin'
          }
        });

        // Generate JWT token for testing
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const token = jwtService.issue({ id: user.id });

        // REMOVED FOR PRODUCTION: console.log('✅ testsysadmin user created');
        // REMOVED FOR PRODUCTION: console.log('📝 JWT Token:', token);
        // REMOVED FOR PRODUCTION: console.log('💡 Use this in your tests:');
        // REMOVED FOR PRODUCTION: console.log(`   export TOKEN='${token}'`);
      } else {
        // REMOVED FOR PRODUCTION: console.log('👤 testsysadmin user already exists');

        // Generate token for existing user too
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const token = jwtService.issue({ id: existing.id });
        // REMOVED FOR PRODUCTION: console.log('📝 JWT Token for existing user:', token);
      }
    } catch (error) {
      console.error('❌ Error creating testsysadmin:', error);
    }

    // Configure quote-draft permissions for authenticated users
    try {
      const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
      const authenticatedRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'authenticated' } });

      if (authenticatedRole) {
        const currentPermissions = await pluginStore.get({ key: 'grant' });

        // Set quote-draft permissions
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

        // Merge with existing permissions
        if (!currentPermissions.authenticated) {
          currentPermissions.authenticated = {};
        }
        if (!currentPermissions.authenticated['api::quote-draft']) {
          currentPermissions.authenticated['api::quote-draft'] = {};
        }

        currentPermissions.authenticated['api::quote-draft'] = quoteDraftPermissions;

        // Set user-activity-log permissions
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

        // Merge with existing permissions
        if (!currentPermissions.authenticated['api::user-activity-log']) {
          currentPermissions.authenticated['api::user-activity-log'] = {};
        }

        currentPermissions.authenticated['api::user-activity-log'] = activityLogPermissions;

        await pluginStore.set({ key: 'grant', value: currentPermissions });
        // REMOVED FOR PRODUCTION: console.log('✅ Quote-draft permissions configured');
        // REMOVED FOR PRODUCTION: console.log('✅ User-activity-log permissions configured');
      }
    } catch (error) {
      console.error('❌ Error configuring quote-draft permissions:', error);
    }

    // AUTO-SEED PERMISSION SYSTEM (Production Fix)
    // This runs automatically on startup if database is empty
    try {
      const profileCount = await strapi.db.query('api::permission-profile.permission-profile').count();

      if (profileCount === 0) {
        strapi.log.info('📋 Permission system database is empty, running auto-seeding...');
        const seedScript = require('../scripts/seed-production-permission-system.js');
        await seedScript();
        strapi.log.info('✅ Permission system auto-seeding complete!');
      } else {
        strapi.log.info(`✅ Permission system already seeded (${profileCount} profiles found)`);
      }
    } catch (error) {
      console.error('❌ Error auto-seeding permission system:', error);
    }
  },
};
