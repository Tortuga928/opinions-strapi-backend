/**
 * user-rating router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::user-rating.user-rating', {
  config: {
    find: {
      policies: [],
      middlewares: [],
    },
    findOne: {
      policies: [],
      middlewares: [],
    },
    create: {
      policies: [],
      middlewares: [],
    },
    update: {
      policies: [],
      middlewares: [],
    },
    delete: {
      policies: [],
      middlewares: [],
    }
  },
});
