/**
 * Custom authentication policy for AI Manager
 * Validates JWT token and populates ctx.state.user
 */

export default async (policyContext, config, { strapi }) => {
  const ctx = policyContext;
  try {
    strapi.log.info('AI Manager Auth Policy: Starting authentication check');

    // Get token from Authorization header
    const authHeader = ctx.request.header.authorization;
    strapi.log.info('AI Manager Auth Policy: Authorization header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      strapi.log.error('AI Manager Auth Policy: No valid authorization header');
      return ctx.unauthorized('Authentication required');
    }

    const token = authHeader.replace(/^Bearer\s+/, '');
    strapi.log.info('AI Manager Auth Policy: Token extracted, length:', token.length);

    // Verify JWT token using Strapi's JWT service
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    strapi.log.info('AI Manager Auth Policy: JWT service retrieved');

    const decoded = await jwtService.verify(token);
    strapi.log.info('AI Manager Auth Policy: Token decoded, user ID:', decoded?.id);

    if (!decoded || !decoded.id) {
      strapi.log.error('AI Manager Auth Policy: Invalid token - no user ID in decoded token');
      return ctx.unauthorized('Invalid token');
    }

    // Fetch user from database
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: decoded.id }
    });
    strapi.log.info('AI Manager Auth Policy: User query result:', user ? `Found user ${user.id}` : 'User not found');

    if (!user) {
      strapi.log.error('AI Manager Auth Policy: User not found in database');
      return ctx.unauthorized('User not found');
    }

    // Populate ctx.state.user
    ctx.state.user = user;

    strapi.log.info(`AI Manager Auth Policy: Successfully authenticated user ${user.id} (${user.username})`);

    return true; // Allow request to continue
  } catch (error) {
    strapi.log.error('AI Manager Auth Policy error:', error);
    return ctx.unauthorized('Authentication failed');
  }
};
