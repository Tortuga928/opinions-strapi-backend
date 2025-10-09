/**
 * Avatar Routes
 * Maps HTTP endpoints to controller methods
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/avatars',
      handler: 'api::avatar.avatar.find',
      config: {
        auth: false,  // Public endpoint - no authentication required
        policies: [],
        middlewares: [],
      }
    }
  ]
};
