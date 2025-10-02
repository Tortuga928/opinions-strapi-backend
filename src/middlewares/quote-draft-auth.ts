/**
 * Quote Draft Authentication Middleware
 * Validates JWT token and populates ctx.state.user for quote-draft endpoints
 */

export default () => {
  return async (ctx, next) => {
    strapi.log.info(`Quote Draft Auth Middleware: URL=${ctx.request.url}, Method=${ctx.request.method}`);

    // Only apply to quote-draft endpoints
    if (!ctx.request.url.startsWith('/api/quote-drafts')) {
      strapi.log.info('Quote Draft Auth Middleware: Not a quote-drafts endpoint, skipping');
      return await next();
    }

    try {
      strapi.log.info('Quote Draft Auth Middleware: Processing quote-drafts endpoint');

      // Get token from Authorization header
      const authHeader = ctx.request.header.authorization;
      strapi.log.info(`Quote Draft Auth Middleware: Authorization header present: ${!!authHeader}`);

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        strapi.log.error('Quote Draft Auth Middleware: Missing or invalid Authorization header');
        return ctx.unauthorized('Authentication required');
      }

      const token = authHeader.replace(/^Bearer\s+/, '');
      strapi.log.info(`Quote Draft Auth Middleware: Token extracted, length=${token.length}`);

      // Verify JWT token using Strapi's JWT service
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      const decoded = await jwtService.verify(token);
      strapi.log.info(`Quote Draft Auth Middleware: Token decoded, user ID=${decoded?.id}`);

      if (!decoded || !decoded.id) {
        strapi.log.error('Quote Draft Auth Middleware: Invalid token');
        return ctx.unauthorized('Invalid token');
      }

      // Fetch user from database
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id }
      });
      strapi.log.info(`Quote Draft Auth Middleware: User query result: ${user ? `Found user ${user.id}` : 'User not found'}`);

      if (!user) {
        strapi.log.error('Quote Draft Auth Middleware: User not found in database');
        return ctx.unauthorized('User not found');
      }

      // Populate ctx.state.user
      ctx.state.user = user;
      strapi.log.info(`Quote Draft Auth Middleware: Successfully authenticated user ${user.id} (${user.username})`);

      await next();
    } catch (error) {
      strapi.log.error('Quote Draft Auth Middleware error:', error);
      return ctx.unauthorized('Authentication failed');
    }
  };
};
