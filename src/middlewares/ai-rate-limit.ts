/**
 * AI Manager Rate Limiting Middleware
 * Limits AI API requests to prevent abuse and control costs
 */

interface RateLimitStore {
  [userId: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (use Redis in production for distributed systems)
const rateLimitStore: RateLimitStore = {};

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS_PER_WINDOW = 50; // 50 requests per hour per user

export default () => {
  return async (ctx, next) => {
    // Only apply rate limiting to AI Manager endpoints
    if (!ctx.request.url.startsWith('/api/ai-manager')) {
      return await next();
    }

    // Get user ID from authenticated request
    // Note: ctx.state.user is populated by the isAuthenticated policy
    const userId = ctx.state.user?.id;

    if (!userId) {
      // This should not happen if authentication policy is working correctly
      strapi.log.error('AI Manager: No user found in ctx.state after authentication');
      return ctx.unauthorized('Authentication required');
    }

    const now = Date.now();
    const userKey = `ai-manager:${userId}`;

    // Initialize or get user's rate limit data
    if (!rateLimitStore[userKey] || now > rateLimitStore[userKey].resetTime) {
      rateLimitStore[userKey] = {
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW
      };
    }

    // Check if user has exceeded rate limit
    if (rateLimitStore[userKey].count >= MAX_REQUESTS_PER_WINDOW) {
      const resetIn = Math.ceil((rateLimitStore[userKey].resetTime - now) / 1000 / 60);

      strapi.log.warn(`AI Manager: Rate limit exceeded for user ${userId}`);

      return ctx.tooManyRequests(
        `Rate limit exceeded. You can make ${MAX_REQUESTS_PER_WINDOW} requests per hour. Try again in ${resetIn} minutes.`
      );
    }

    // Increment request count
    rateLimitStore[userKey].count++;

    // Add rate limit headers
    ctx.set({
      'X-RateLimit-Limit': MAX_REQUESTS_PER_WINDOW.toString(),
      'X-RateLimit-Remaining': (MAX_REQUESTS_PER_WINDOW - rateLimitStore[userKey].count).toString(),
      'X-RateLimit-Reset': new Date(rateLimitStore[userKey].resetTime).toISOString()
    });

    strapi.log.info(`AI Manager: Rate limit check passed for user ${userId} (${rateLimitStore[userKey].count}/${MAX_REQUESTS_PER_WINDOW})`);

    await next();
  };
};
