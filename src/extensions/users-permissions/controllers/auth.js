/**
 * Custom Auth Controller
 * Extends users-permissions plugin to add custom userRole on registration
 */

const { sanitize } = require('@strapi/utils');
const utils = require('@strapi/utils');
const { ApplicationError, ValidationError } = utils.errors;

module.exports = (plugin) => {
  // Extend the register function
  const originalRegister = plugin.controllers.auth.register;

  plugin.controllers.auth.register = async (ctx) => {
    // Call original register logic
    await originalRegister(ctx);

    // If registration was successful, update the user with default userRole
    if (ctx.response.body && ctx.response.body.user) {
      const userId = ctx.response.body.user.id;

      try {
        // Update user with default userRole = 'reguser'
        await strapi.query('plugin::users-permissions.user').update({
          where: { id: userId },
          data: {
            userRole: 'reguser',
            accountStatus: 'Active',
            loginCount: 0,
            emailVerified: false
          }
        });

        // Fetch updated user
        const updatedUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id: userId }
        });

        // Update response with new user data
        ctx.response.body.user = await sanitize.contentAPI.output(
          updatedUser,
          strapi.getModel('plugin::users-permissions.user')
        );

        // Log user creation activity
        // REMOVED FOR PRODUCTION: console.log('[Auth Controller] Attempting to get activity logger service');
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        // REMOVED FOR PRODUCTION: console.log('[Auth Controller] Activity logger service:', activityLogger ? 'FOUND' : 'NOT FOUND');
        if (activityLogger) {
          // REMOVED FOR PRODUCTION: console.log('[Auth Controller] Calling logActivity for user_created');
          await activityLogger.logActivity(userId, 'user_created', {
            username: updatedUser.username,
            email: updatedUser.email
          }, ctx);
        } else {
          console.error('[Auth Controller] Activity logger service not available!');
        }
      } catch (error) {
        strapi.log.error('Error setting default userRole on registration:', error);
      }
    }
  };

  // Extend the callback function (OAuth logins)
  const originalCallback = plugin.controllers.auth.callback;

  plugin.controllers.auth.callback = async (ctx) => {
    await originalCallback(ctx);
    if (ctx.response.body && ctx.response.body.user) {
      await handleSuccessfulLogin(ctx.response.body.user.id, ctx);
    }
  };

  // Extend the local login function
  const originalLogin = plugin.controllers.auth.login;

  plugin.controllers.auth.login = async (ctx) => {
    await originalLogin(ctx);
    if (ctx.response.body && ctx.response.body.user) {
      await handleSuccessfulLogin(ctx.response.body.user.id, ctx);

      // CRITICAL FIX: Populate primaryProfile relation for frontend
      // The frontend needs primaryProfile to display the profile name in the sidebar
      // and useUserPermissions hook needs it to fetch the correct menu permissions
      // WORKAROUND for Strapi 5 Bug #20330: Use direct SQL to fetch primary_profile_id
      strapi.log.info(`[Auth Login] STARTING primaryProfile population for user ${ctx.response.body.user.id}`);
      try {
        const userId = ctx.response.body.user.id;

        // Get base user data without populate (populate is broken for primaryProfile)
        const userWithProfile = await strapi.entityService.findOne('plugin::users-permissions.user', userId);
        strapi.log.info(`[Auth Login] Step 1: Fetched user ${userId} from entityService`);

        // Use direct SQL to fetch primary_profile_id
        const sqlResult = await strapi.db.connection.raw(
          'SELECT primary_profile_id FROM up_users WHERE id = ?',
          [userId]
        );

        const primaryProfileId = sqlResult && sqlResult[0] && sqlResult[0].primary_profile_id;
        strapi.log.info(`[Auth Login] Step 2: User ${userId} primary_profile_id from SQL: ${primaryProfileId}`);

        // Fetch primary profile separately if exists
        if (primaryProfileId) {
          try {
            // Use direct SQL to fetch profile details (avoid Strapi 5 bug)
            const profileSqlResult = await strapi.db.connection.raw(
              'SELECT id, name, description FROM permission_profiles WHERE id = ?',
              [primaryProfileId]
            );

            const primaryProfile = profileSqlResult && profileSqlResult[0] ? {
              id: profileSqlResult[0].id,
              name: profileSqlResult[0].name,
              description: profileSqlResult[0].description
            } : null;

            strapi.log.info(`[Auth Login] Step 3: Successfully fetched profile via SQL: ${primaryProfile?.name || 'none'}`);
            userWithProfile.primaryProfile = primaryProfile;
            strapi.log.info(`[Auth Login] Step 4: Attached primaryProfile to userWithProfile object`);
          } catch (error) {
            strapi.log.error(`[Auth Login] Error fetching primaryProfile ${primaryProfileId}:`, error);
            userWithProfile.primaryProfile = null;
          }
        } else {
          strapi.log.info(`[Auth Login] Step 3: User ${userId} has no primary profile`);
          userWithProfile.primaryProfile = null;
        }

        strapi.log.info(`[Auth Login] Step 5: BEFORE sanitize - primaryProfile: ${JSON.stringify(userWithProfile.primaryProfile)}`);

        // Update response with populated profile data
        // IMPORTANT: sanitize may strip out primaryProfile if it's not in the schema
        // So we'll add it AFTER sanitization
        const sanitizedUser = await sanitize.contentAPI.output(
          userWithProfile,
          strapi.getModel('plugin::users-permissions.user')
        );

        strapi.log.info(`[Auth Login] Step 6: AFTER sanitize - primaryProfile: ${JSON.stringify(sanitizedUser.primaryProfile)}`);

        // Re-attach primaryProfile after sanitization (in case sanitize stripped it)
        if (!sanitizedUser.primaryProfile && userWithProfile.primaryProfile) {
          strapi.log.info(`[Auth Login] Step 7: Sanitize stripped primaryProfile, re-attaching it`);
          sanitizedUser.primaryProfile = userWithProfile.primaryProfile;
        }

        ctx.response.body.user = sanitizedUser;

        strapi.log.info(`[Auth Login] Step 8: FINAL user object primaryProfile: ${ctx.response.body.user.primaryProfile?.name || 'none'}`);
      } catch (error) {
        strapi.log.error('[Auth Login] ERROR during primaryProfile population:', error);
        strapi.log.error('[Auth Login] Error stack:', error.stack);
      }
    }
  };

  // Helper function for successful login tracking
  async function handleSuccessfulLogin(userId, ctx) {
    try {
      // Get current user data
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
      strapi.log.error('Error tracking login activity:', error);
    }
  }

  return plugin;
};
