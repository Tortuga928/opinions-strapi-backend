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
        console.log('[Auth Controller] Attempting to get activity logger service');
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        console.log('[Auth Controller] Activity logger service:', activityLogger ? 'FOUND' : 'NOT FOUND');
        if (activityLogger) {
          console.log('[Auth Controller] Calling logActivity for user_created');
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
