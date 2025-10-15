/**
 * menu-permission custom routes
 *
 * All routes use auth: false because authentication is handled
 * via authenticateRequest() helper function in the controller
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/menu-permissions',
      handler: 'menu-permission.find',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/menu-permissions/:id',
      handler: 'menu-permission.findOne',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/menu-permissions',
      handler: 'menu-permission.create',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'PUT',
      path: '/menu-permissions/:id',
      handler: 'menu-permission.update',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'DELETE',
      path: '/menu-permissions/:id',
      handler: 'menu-permission.delete',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    }
  ]
};
