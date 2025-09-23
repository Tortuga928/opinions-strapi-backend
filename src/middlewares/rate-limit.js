module.exports = () => {
  return async (ctx, next) => {
    // Simple in-memory rate limiting
    const ip = ctx.ip;
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 100; // 100 requests per minute
    
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
    }
    
    const userRequests = global.rateLimitStore.get(ip) || [];
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      ctx.status = 429;
      ctx.body = {
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
      };
      return;
    }
    
    recentRequests.push(now);
    global.rateLimitStore.set(ip, recentRequests);
    
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [key, requests] of global.rateLimitStore.entries()) {
        const valid = requests.filter(time => now - time < windowMs);
        if (valid.length === 0) {
          global.rateLimitStore.delete(key);
        } else {
          global.rateLimitStore.set(key, valid);
        }
      }
    }
    
    await next();
  };
};
