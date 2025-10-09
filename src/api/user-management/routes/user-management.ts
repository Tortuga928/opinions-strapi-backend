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
    }
  ]
};
