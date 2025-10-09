/**
 * Security Headers Middleware
 * Adds additional security headers not provided by strapi::security
 */

export default () => {
  return async (ctx, next) => {
    await next();

    // Add X-XSS-Protection header (not in koa-helmet defaults anymore)
    ctx.set('X-XSS-Protection', '1; mode=block');

    // Remove X-Powered-By header (security through obscurity)
    ctx.remove('X-Powered-By');
  };
};
