/**
 * Auth Response Enhancer Middleware
 * Intercepts login responses and adds primaryProfile data
 */

export default () => {
  return async (ctx, next) => {
    // Run the controller first
    await next();

    // Only process auth login responses
    if (ctx.request.url === '/api/auth/local' && ctx.request.method === 'POST') {
      strapi.log.info('[Auth Response Enhancer] Intercepted login response');

      // Check if response has user data
      if (ctx.response.body && ctx.response.body.user) {
        const userId = ctx.response.body.user.id;
        strapi.log.info(`[Auth Response Enhancer] Processing user ${userId}`);

        try {
          // Use direct SQL to fetch primary_profile_id
          const sqlResult = await strapi.db.connection.raw(
            'SELECT primary_profile_id FROM up_users WHERE id = ?',
            [userId]
          );

          const primaryProfileId = sqlResult && sqlResult[0] && sqlResult[0].primary_profile_id;
          strapi.log.info(`[Auth Response Enhancer] primary_profile_id from SQL: ${primaryProfileId}`);

          // Fetch primary profile separately if exists
          let primaryProfile = null;
          if (primaryProfileId) {
            // Use direct SQL to fetch profile details
            const profileSqlResult = await strapi.db.connection.raw(
              'SELECT id, name, description FROM permission_profiles WHERE id = ?',
              [primaryProfileId]
            );

            primaryProfile = profileSqlResult && profileSqlResult[0] ? {
              id: profileSqlResult[0].id,
              name: profileSqlResult[0].name,
              description: profileSqlResult[0].description
            } : null;

            strapi.log.info(`[Auth Response Enhancer] Profile fetched: ${primaryProfile?.name || 'none'}`);
          }

          // Add primaryProfile to response
          ctx.response.body.user.primaryProfile = primaryProfile;
          strapi.log.info(`[Auth Response Enhancer] FINAL primaryProfile: ${ctx.response.body.user.primaryProfile?.name || 'none'}`);
        } catch (error) {
          strapi.log.error('[Auth Response Enhancer] ERROR:', error);
        }
      }
    }
  };
};
