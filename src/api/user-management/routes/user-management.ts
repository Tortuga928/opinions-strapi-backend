/**
 * User Management Custom Routes
 * Maps HTTP endpoints to controller methods
 */

export default {
  routes: [
    // Admin Routes (sysadmin only)
    {
      method: 'GET',
      path: '/user-management/users',
      handler: 'user-management.listUsers',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/user-management/users/:id',
      handler: 'user-management.getUserDetails',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'PUT',
      path: '/user-management/users/:id',
      handler: 'user-management.updateUser',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'DELETE',
      path: '/user-management/users/:id',
      handler: 'user-management.deleteUser',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/user-management/users/:id/reset-password',
      handler: 'user-management.resetPassword',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },

    // User Profile Routes (all authenticated users)
    {
      method: 'GET',
      path: '/user-management/profile',
      handler: 'user-management.getOwnProfile',
      config: {
        auth: false,  // Auth handled in controller via authenticateRequest()
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'PUT',
      path: '/user-management/profile',
      handler: 'user-management.updateOwnProfile',
      config: {
        auth: false,  // Auth handled in controller via authenticateRequest()
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/user-management/change-password',
      handler: 'user-management.changeOwnPassword',
      config: {
        auth: false,  // Auth handled in controller via authenticateRequest()
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/user-management/stats',
      handler: 'user-management.getAccountStats',
      config: {
        auth: false,  // Auth handled in controller via authenticateRequest()
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/user-management/menus',
      handler: 'user-management.getUserMenus',
      config: {
        auth: false,  // Auth handled in controller via authenticateRequest()
        policies: [],
        middlewares: [],
      }
    },

    // Email Verification Routes
    {
      method: 'POST',
      path: '/user-management/request-email-verification',
      handler: 'user-management.requestEmailVerification',
      config: {
        auth: false,  // Auth handled in controller via authenticateRequest()
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/user-management/verify-email/:token',
      handler: 'user-management.verifyEmail',
      config: {
        auth: false,  // Token-based verification, redirects to frontend
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/user-management/exchange-verify-token',
      handler: 'user-management.exchangeVerifyToken',
      config: {
        auth: false,  // One-time token verification
        policies: [],
        middlewares: [],
      }
    },

    // Password Reset Routes (public, token-based)
    {
      method: 'POST',
      path: '/user-management/request-password-reset',
      handler: 'user-management.requestPasswordReset',
      config: {
        auth: false,  // Public endpoint, accepts email address
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/user-management/reset-password/:token',
      handler: 'user-management.verifyPasswordResetToken',
      config: {
        auth: false,  // Token-based verification, redirects to frontend
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/user-management/reset-password-with-token',
      handler: 'user-management.resetPasswordWithToken',
      config: {
        auth: false,  // One-time token verification
        policies: [],
        middlewares: [],
      }
    }
  ]
};
