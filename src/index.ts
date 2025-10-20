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
    strapi.log.info('[Bootstrap] Starting application bootstrap...');

    // STEP 1: AUTO-SEED DATABASE (only when empty)
    // Checks if database needs seeding and runs seed-master.js
    // seed-master.js orchestrates all seed scripts in dependency order
    try {
      // Check if database needs seeding (use permission profiles as indicator)
      const profileCount = await strapi.db.query('api::permission-profile.permission-profile').count();

      if (profileCount === 0) {
        strapi.log.info('[Bootstrap] Database is empty, running seed scripts...');

        // CRITICAL: Path is relative to dist/src/index.js after compilation
        // ../../scripts/ goes from dist/src/ up to project root, then into scripts/
        const seedMaster = require('../../scripts/seed-master.js');
        await seedMaster();

        strapi.log.info('[Bootstrap] ✅ Database seeding complete!');
      } else {
        strapi.log.info(`[Bootstrap] Database already seeded (${profileCount} profiles found)`);
      }
    } catch (error) {
      console.error('[Bootstrap] ❌ Error during database seeding:', error);
      // Don't throw - allow app to start even if seeding fails
    }

    // STEP 2: CONFIGURE CONTENT-TYPE PERMISSIONS (always run)
    // Content-type permissions are Strapi configuration, not database records
    // Must be configured on every startup to ensure permissions are correct
    try {
      strapi.log.info('[Bootstrap] Configuring content-type permissions...');

      const seedContentPermissions = require('../../scripts/seed-content-permissions.js');
      await seedContentPermissions();

      strapi.log.info('[Bootstrap] ✅ Content-type permissions configured!');
    } catch (error) {
      console.error('[Bootstrap] ❌ Error configuring content-type permissions:', error);
      // Don't throw - allow app to start even if permission config fails
    }

    strapi.log.info('[Bootstrap] Bootstrap complete, starting application...\n');
  },
};
