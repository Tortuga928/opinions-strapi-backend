/**
 * Investeos Auth Controller
 * Handles Schwab OAuth flow and connection management
 */

/**
 * Helper function to validate JWT token and populate ctx.state.user
 */
async function authenticateRequest(ctx) {
  const authHeader = ctx.request.header.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/, '');

  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const decoded = await jwtService.verify(token);

    if (!decoded || !decoded.id) {
      return null;
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: decoded.id }
    });

    if (!user) {
      return null;
    }

    ctx.state.user = user;
    return user;
  } catch (error) {
    strapi.log.error('JWT validation error:', error);
    return null;
  }
}

export default {
  /**
   * Initialize OAuth flow
   * GET /api/investeos/auth/schwab/init
   */
  async initOAuth(ctx) {
    const user = await authenticateRequest(ctx);

    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    try {
      const schwabService = strapi.service('api::investeos.schwab-api');
      const { authUrl, state } = await schwabService.generateAuthUrl(user.id);

      // Store state in session/memory for validation (optional - state is self-validating)
      return ctx.send({
        authUrl,
        state
      });
    } catch (error) {
      strapi.log.error('[Investeos Auth] OAuth init error:', error);
      return ctx.internalServerError('Failed to initialize OAuth flow');
    }
  },

  /**
   * Handle OAuth callback
   * GET /api/investeos/auth/schwab/callback
   * Query params: code, state
   */
  async handleCallback(ctx) {
    const { code, state } = ctx.query;

    if (!code || !state) {
      return ctx.badRequest('Missing authorization code or state');
    }

    try {
      const schwabService = strapi.service('api::investeos.schwab-api');

      // Exchange code for tokens
      const { tokens, userId } = await schwabService.exchangeCodeForTokens(code as string, state as string);

      // Store tokens
      await schwabService.storeTokens(userId, tokens);

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(userId, 'schwab_account_connected', {
          message: 'Successfully connected Schwab account'
        }, ctx);
      }

      return ctx.send({
        success: true,
        message: 'Schwab account connected successfully'
      });
    } catch (error) {
      strapi.log.error('[Investeos Auth] OAuth callback error:', error);
      return ctx.internalServerError('Failed to complete OAuth flow');
    }
  },

  /**
   * Get connection status
   * GET /api/investeos/auth/schwab/status
   */
  async getStatus(ctx) {
    const user = await authenticateRequest(ctx);

    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    try {
      const schwabService = strapi.service('api::investeos.schwab-api');
      const status = await schwabService.getConnectionStatus(user.id);

      return ctx.send(status);
    } catch (error) {
      strapi.log.error('[Investeos Auth] Status check error:', error);
      return ctx.internalServerError('Failed to get connection status');
    }
  },

  /**
   * Disconnect Schwab account
   * POST /api/investeos/auth/schwab/disconnect
   */
  async disconnect(ctx) {
    const user = await authenticateRequest(ctx);

    if (!user) {
      return ctx.unauthorized('Authentication required');
    }

    try {
      const schwabService = strapi.service('api::investeos.schwab-api');
      await schwabService.disconnectAccount(user.id);

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(user.id, 'schwab_account_disconnected', {
          message: 'Disconnected Schwab account'
        }, ctx);
      }

      return ctx.send({
        success: true,
        message: 'Schwab account disconnected'
      });
    } catch (error) {
      strapi.log.error('[Investeos Auth] Disconnect error:', error);
      return ctx.internalServerError('Failed to disconnect account');
    }
  }
};
