/**
 * Strapi Bootstrap
 * Runs once when Strapi starts
 */

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // One-time migration: Set all existing users to sysadmin role
    try {
      const users = await strapi.query('plugin::users-permissions.user').findMany({
        where: {
          $or: [
            { userRole: null },
            { userRole: '' }
          ]
        }
      });

      if (users.length > 0) {
        strapi.log.info(`🔄 Migrating ${users.length} existing users to sysadmin role...`);

        for (const user of users) {
          await strapi.query('plugin::users-permissions.user').update({
            where: { id: user.id },
            data: {
              userRole: 'sysadmin',
              accountStatus: 'Active',
              forcePasswordReset: false,
              loginCount: 0,
              emailVerified: true
            }
          });
        }

        strapi.log.info(`✅ Migration complete: ${users.length} users set to sysadmin role`);
      } else {
        strapi.log.info('ℹ️  All users already have roles assigned');
      }
    } catch (error) {
      strapi.log.error('❌ User role migration error:', error.message);
      // Don't throw error - allow Strapi to start even if migration fails
    }

    // Create default permission profiles
    try {
      const defaultProfiles = [
        {
          name: 'Viewer',
          description: 'Basic viewing access to home, opinions, and user profile',
          permissions: ['home', 'opinions', 'user-profile'],
          isSystemProfile: true
        },
        {
          name: 'Contributor',
          description: 'Can view and interact with opinions',
          permissions: ['home', 'opinions', 'user-profile'],
          isSystemProfile: true
        },
        {
          name: 'Creator',
          description: 'Can create opinions using the opinion generator',
          permissions: ['home', 'opinions', 'opinion-generator', 'user-profile'],
          isSystemProfile: true
        },
        {
          name: 'Advanced',
          description: 'Full access including AI features',
          permissions: ['home', 'opinions', 'opinion-generator', 'ai-test', 'user-profile'],
          isSystemProfile: true
        }
      ];

      for (const profileData of defaultProfiles) {
        const existing = await strapi.query('api::permission-profile.permission-profile').findOne({
          where: { name: profileData.name }
        });

        if (!existing) {
          await strapi.entityService.create('api::permission-profile.permission-profile', {
            data: profileData
          });
          strapi.log.info(`✅ Created permission profile: ${profileData.name}`);
        }
      }

      strapi.log.info('✅ Permission profiles initialized');
    } catch (error) {
      strapi.log.error('❌ Permission profile seeding error:', error.message);
    }
  },
};
