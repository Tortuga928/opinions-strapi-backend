/**
 * Investeos Auth Routes
 * OAuth and connection management endpoints
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/investeos/auth/schwab/init',
      handler: 'api::investeos.investeos-auth.initOAuth',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/investeos/auth/schwab/callback',
      handler: 'api::investeos.investeos-auth.handleCallback',
      config: {
        auth: false,  // Public endpoint for OAuth redirect
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/investeos/auth/schwab/status',
      handler: 'api::investeos.investeos-auth.getStatus',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/investeos/auth/schwab/disconnect',
      handler: 'api::investeos.investeos-auth.disconnect',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    }
  ]
};
