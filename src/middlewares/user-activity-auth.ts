/**
 * User Activity Log Authentication Middleware
 * Validates JWT token and populates ctx.state.user for user-activity-log endpoints
 */

export default () => {
  return async (ctx, next) => {
    strapi.log.info(`User Activity Auth Middleware: URL=${ctx.request.url}, Method=${ctx.request.method}`);

    // Only apply to user-activity-log endpoints
    if (!ctx.request.url.startsWith('/api/user-activity-logs')) {
      strapi.log.info('User Activity Auth Middleware: Not a user-activity-logs endpoint, skipping');
      return await next();
    }

    try {
      strapi.log.info('User Activity Auth Middleware: Processing user-activity-logs endpoint');

      // Get token from Authorization header
      const authHeader = ctx.request.header.authorization;
      strapi.log.info(`User Activity Auth Middleware: Authorization header present: ${!!authHeader}`);

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        strapi.log.error('User Activity Auth Middleware: Missing or invalid Authorization header');
        return ctx.unauthorized('Authentication required');
      }

      const token = authHeader.replace(/^Bearer\s+/, '');
      strapi.log.info(`User Activity Auth Middleware: Token extracted, length=${token.length}`);

      // Verify JWT token using Strapi's JWT service
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      const decoded = await jwtService.verify(token);
      strapi.log.info(`User Activity Auth Middleware: Token decoded, user ID=${decoded?.id}`);

      if (!decoded || !decoded.id) {
        strapi.log.error('User Activity Auth Middleware: Invalid token');
        return ctx.unauthorized('Invalid token');
      }

      // Fetch user from database
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id }
      });
      strapi.log.info(`User Activity Auth Middleware: User query result: ${user ? `Found user ${user.id}` : 'User not found'}`);

      if (!user) {
        strapi.log.error('User Activity Auth Middleware: User not found in database');
        return ctx.unauthorized('User not found');
      }

      // Populate ctx.state.user
      ctx.state.user = user;
      strapi.log.info(`User Activity Auth Middleware: Successfully authenticated user ${user.id} (${user.username})`);

      await next();
    } catch (error) {
      strapi.log.error('User Activity Auth Middleware error:', error.message);
      strapi.log.error('User Activity Auth Middleware stack:', error.stack);
      return ctx.unauthorized('Authentication failed');
    }
  };
};
