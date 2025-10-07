// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    console.log('[index.ts register] Extending users-permissions plugin');

    // Extend users-permissions plugin auth controller
    const originalRegister = strapi.plugins['users-permissions'].controllers.auth.register;
    const originalLogin = strapi.plugins['users-permissions'].controllers.auth.login;
    const originalCallback = strapi.plugins['users-permissions'].controllers.auth.callback;

    // Override register to add activity logging and include custom fields
    strapi.plugins['users-permissions'].controllers.auth.register = async (ctx) => {
      console.log('[Auth Extension] register() called');
      await originalRegister(ctx);

      if (ctx.response.body && ctx.response.body.user) {
        const userId = ctx.response.body.user.id;

        // Log user creation activity
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        if (activityLogger) {
          console.log('[Auth Extension] Logging user_created for user', userId);
          await activityLogger.logActivity(userId, 'user_created', {
            username: ctx.response.body.user.username,
            email: ctx.response.body.user.email
          }, ctx);
        }

        // Fetch full user object with custom fields to include in response
        const fullUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id: userId }
        });

        // Add custom fields to response (userRole, accountStatus, etc.)
        if (fullUser) {
          ctx.response.body.user = {
            ...ctx.response.body.user,
            userRole: fullUser.userRole,
            accountStatus: fullUser.accountStatus,
            displayName: fullUser.displayName,
            bio: fullUser.bio,
            avatarUrl: fullUser.avatarUrl
          };
        }
      }
    };

    // Override login to track login activity and include custom user fields
    strapi.plugins['users-permissions'].controllers.auth.login = async (ctx) => {
      console.log('[Auth Extension] login() called');
      await originalLogin(ctx);

      if (ctx.response.body && ctx.response.body.user) {
        await handleSuccessfulLogin(ctx.response.body.user.id, ctx, strapi);

        // Fetch full user object with custom fields to include in response
        const fullUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id: ctx.response.body.user.id }
        });

        // Add custom fields to response (userRole, accountStatus, etc.)
        if (fullUser) {
          ctx.response.body.user = {
            ...ctx.response.body.user,
            userRole: fullUser.userRole,
            accountStatus: fullUser.accountStatus,
            displayName: fullUser.displayName,
            bio: fullUser.bio,
            avatarUrl: fullUser.avatarUrl
          };
        }
      }
    };

    // Override callback for OAuth logins
    strapi.plugins['users-permissions'].controllers.auth.callback = async (ctx) => {
      await originalCallback(ctx);

      if (ctx.response.body && ctx.response.body.user) {
        await handleSuccessfulLogin(ctx.response.body.user.id, ctx, strapi);

        // Fetch full user object with custom fields to include in response
        const fullUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id: ctx.response.body.user.id }
        });

        // Add custom fields to response (userRole, accountStatus, etc.)
        if (fullUser) {
          ctx.response.body.user = {
            ...ctx.response.body.user,
            userRole: fullUser.userRole,
            accountStatus: fullUser.accountStatus,
            displayName: fullUser.displayName,
            bio: fullUser.bio,
            avatarUrl: fullUser.avatarUrl
          };
        }
      }
    };

    console.log('[index.ts register] Auth controller extended successfully');

    // Helper function for login tracking
    async function handleSuccessfulLogin(userId: number, ctx: any, strapi: any) {
      try {
        const user = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id: userId }
        });

        // Update login count and last login time
        await strapi.query('plugin::users-permissions.user').update({
          where: { id: userId },
          data: {
            lastLoginAt: new Date(),
            loginCount: (user.loginCount || 0) + 1
          }
        });

        // Log login activity and history
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        if (activityLogger) {
          await activityLogger.logActivity(userId, 'login', {
            username: user.username
          }, ctx);

          await activityLogger.logLogin(userId, { success: true }, ctx);
        }
      } catch (error) {
        console.error('[Auth Extension] Error tracking login activity:', error);
      }
    }
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
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
      console.log('🌱 Seeding predefined categories...');

      for (const category of predefinedCategories) {
        await strapi.entityService.create('api::category.category', {
          data: category
        });
      }

      console.log('✅ Categories seeded successfully');
    } else {
      console.log('📋 Categories already exist, skipping seed');
    }

    // Create default sysadmin user for testing
    try {
      const existing = await strapi.query('plugin::users-permissions.user').findOne({
        where: { username: 'testsysadmin' }
      });

      if (!existing) {
        console.log('🔧 Creating default testsysadmin user...');
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

        console.log('✅ testsysadmin user created');
        console.log('📝 JWT Token:', token);
        console.log('💡 Use this in your tests:');
        console.log(`   export TOKEN='${token}'`);
      } else {
        console.log('👤 testsysadmin user already exists');

        // Generate token for existing user too
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const token = jwtService.issue({ id: existing.id });
        console.log('📝 JWT Token for existing user:', token);
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
        console.log('✅ Quote-draft permissions configured');
        console.log('✅ User-activity-log permissions configured');
      }
    } catch (error) {
      console.error('❌ Error configuring quote-draft permissions:', error);
    }
  },
};
