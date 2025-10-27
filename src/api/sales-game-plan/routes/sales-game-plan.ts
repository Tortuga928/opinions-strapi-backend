/**
 * sales-game-plan router
 *
 * Uses Strapi's core router factory to generate CRUD routes
 * Authentication handled in controller via authenticateRequest() helper
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::sales-game-plan.sales-game-plan', {
  config: {
    find: {
      auth: false,  // Auth handled in controller
      policies: [],
      middlewares: [],
    },
    findOne: {
      auth: false,  // Auth handled in controller
      policies: [],
      middlewares: [],
    },
    create: {
      auth: false,  // Auth handled in controller
      policies: [],
      middlewares: [],
    },
    update: {
      auth: false,  // Auth handled in controller
      policies: [],
      middlewares: [],
    },
    delete: {
      auth: false,  // Auth handled in controller
      policies: [],
      middlewares: [],
    }
  }
});
