/**
 * user-activity-log router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::user-activity-log.user-activity-log', {
  config: {
    find: {
      auth: false,
      policies: [],
      middlewares: ['global::user-activity-auth'],
    },
    findOne: {
      auth: false,
      policies: [],
      middlewares: ['global::user-activity-auth'],
    },
    create: {
      auth: false,
      policies: [],
      middlewares: ['global::user-activity-auth'],
    },
    update: {
      auth: false,
      policies: [],
      middlewares: ['global::user-activity-auth'],
    },
    delete: {
      auth: false,
      policies: [],
      middlewares: ['global::user-activity-auth'],
    }
  },
});
