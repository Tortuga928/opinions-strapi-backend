/**
 * Permission Profile Custom Routes
 * All routes restricted to sysadmin (auth handled in controller)
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/permission-profiles',
      handler: 'api::permission-profile.permission-profile.find',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'GET',
      path: '/permission-profiles/:id',
      handler: 'api::permission-profile.permission-profile.findOne',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/permission-profiles',
      handler: 'api::permission-profile.permission-profile.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'PUT',
      path: '/permission-profiles/:id',
      handler: 'api::permission-profile.permission-profile.update',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'DELETE',
      path: '/permission-profiles/:id',
      handler: 'api::permission-profile.permission-profile.delete',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    }
  ]
};
