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
      handler: 'api::user-management.user-management.listUsers',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/user-management/users/:id',
      handler: 'api::user-management.user-management.getUserDetails',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'PUT',
      path: '/user-management/users/:id',
      handler: 'api::user-management.user-management.updateUser',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'DELETE',
      path: '/user-management/users/:id',
      handler: 'api::user-management.user-management.deleteUser',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/user-management/users/:id/reset-password',
      handler: 'api::user-management.user-management.resetPassword',
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
      handler: 'api::user-management.user-management.getOwnProfile',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'PUT',
      path: '/user-management/profile',
      handler: 'api::user-management.user-management.updateOwnProfile',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    }
  ]
};
