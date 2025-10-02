/**
 * quote-draft router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::quote-draft.quote-draft', {
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
