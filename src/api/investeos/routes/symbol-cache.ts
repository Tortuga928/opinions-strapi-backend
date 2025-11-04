/**
 * Symbol Cache Routes
 * Defines API endpoints for symbol cache management
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/investeos/symbols/search',
      handler: 'api::investeos.symbol-cache.search',
      config: {
        auth: false, // Manual JWT validation in controller
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/investeos/symbols/stats',
      handler: 'api::investeos.symbol-cache.getStats',
      config: {
        auth: false, // Manual JWT validation in controller
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/investeos/symbols/populate',
      handler: 'api::investeos.symbol-cache.populate',
      config: {
        auth: false, // Manual JWT validation in controller (admin only)
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'DELETE',
      path: '/investeos/symbols/clear',
      handler: 'api::investeos.symbol-cache.clear',
      config: {
        auth: false, // Manual JWT validation in controller (admin only)
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/investeos/symbols/import',
      handler: 'api::investeos.symbol-cache.import',
      config: {
        auth: false, // Manual JWT validation in controller (admin only)
        policies: [],
        middlewares: []
      }
    }
  ]
};
