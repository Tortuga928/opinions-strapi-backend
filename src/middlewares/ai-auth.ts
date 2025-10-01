/**
 * AI Manager Authentication Middleware
 * Validates JWT token and populates ctx.state.user for AI Manager endpoints
 */

export default () => {
  return async (ctx, next) => {
    // Only apply to AI Manager endpoints
    if (!ctx.request.url.startsWith('/api/ai-manager')) {
      return await next();
    }

    try {
      strapi.log.info('AI Manager Auth Middleware: Starting authentication');

      // Get token from Authorization header
      const authHeader = ctx.request.header.authorization;
      strapi.log.info('AI Manager Auth Middleware: Authorization header:', authHeader ? 'Present' : 'Missing');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        strapi.log.error('AI Manager Auth Middleware: No valid authorization header');
        return ctx.unauthorized('Authentication required');
      }

      const token = authHeader.replace(/^Bearer\s+/, '');
      strapi.log.info('AI Manager Auth Middleware: Token extracted, length:', token.length);

      // Verify JWT token using Strapi's JWT service
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      const decoded = await jwtService.verify(token);
      strapi.log.info('AI Manager Auth Middleware: Token decoded, user ID:', decoded?.id);

      if (!decoded || !decoded.id) {
        strapi.log.error('AI Manager Auth Middleware: Invalid token');
        return ctx.unauthorized('Invalid token');
      }

      // Fetch user from database
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id }
      });
      strapi.log.info('AI Manager Auth Middleware: User query result:', user ? `Found user ${user.id}` : 'User not found');

      if (!user) {
        strapi.log.error('AI Manager Auth Middleware: User not found in database');
        return ctx.unauthorized('User not found');
      }

      // Populate ctx.state.user
      ctx.state.user = user;
      strapi.log.info(`AI Manager Auth Middleware: Successfully authenticated user ${user.id} (${user.username})`);

      await next();
    } catch (error) {
      strapi.log.error('AI Manager Auth Middleware error:', error);
      return ctx.unauthorized('Authentication failed');
    }
  };
};
