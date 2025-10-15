/**
 * User Profile Assignment Custom Routes
 * All routes restricted to sysadmin (auth handled in controller)
 *
 * RESTful API design:
 * - POST   /user-profile-assignments/users/:userId/profiles/:profileId - Assign profile
 * - DELETE /user-profile-assignments/users/:userId/profiles/:profileId - Remove profile
 * - PUT    /user-profile-assignments/users/:userId/primary-profile - Set primary profile
 * - GET    /user-profile-assignments/users/:userId/individual-menus - Get individual menus
 * - POST   /user-profile-assignments/users/:userId/individual-menus/:menuId - Add individual menu
 * - DELETE /user-profile-assignments/users/:userId/individual-menus/:menuId - Remove individual menu
 */

export default {
  routes: [
    // Profile assignment routes
    {
      method: 'POST',
      path: '/user-profile-assignments/users/:userId/profiles/:profileId',
      handler: 'user-profile-assignment.assignProfile',
      config: {
        auth: false,  // Auth handled in controller
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'DELETE',
      path: '/user-profile-assignments/users/:userId/profiles/:profileId',
      handler: 'user-profile-assignment.removeProfile',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'PUT',
      path: '/user-profile-assignments/users/:userId/primary-profile',
      handler: 'user-profile-assignment.setPrimaryProfile',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },

    // Individual menu permission routes
    {
      method: 'GET',
      path: '/user-profile-assignments/users/:userId/individual-menus',
      handler: 'user-profile-assignment.getIndividualMenus',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'POST',
      path: '/user-profile-assignments/users/:userId/individual-menus/:menuId',
      handler: 'user-profile-assignment.addIndividualMenu',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    },
    {
      method: 'DELETE',
      path: '/user-profile-assignments/users/:userId/individual-menus/:menuId',
      handler: 'user-profile-assignment.removeIndividualMenu',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      }
    }
  ]
};
