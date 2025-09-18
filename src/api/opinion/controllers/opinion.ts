/**
 * opinion controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::opinion.opinion', ({ strapi }) => ({
  // Custom create method to associate opinion with current user
  async create(ctx) {
    if (ctx.state.user) {
      ctx.request.body.data.user = ctx.state.user.id;
    }
    const response = await super.create(ctx);
    return response;
  },

  // Custom find method to include user data
  async find(ctx) {
    ctx.query = {
      ...ctx.query,
      populate: {
        user: {
          fields: ['id', 'username']
        },
        category: {
          fields: ['id', 'name', 'color']
        }
      }
    };
    const response = await super.find(ctx);
    return response;
  },

  // Custom findOne method
  async findOne(ctx) {
    ctx.query = {
      ...ctx.query,
      populate: {
        user: {
          fields: ['id', 'username']
        },
        category: {
          fields: ['id', 'name', 'color']
        }
      }
    };
    const response = await super.findOne(ctx);
    return response;
  }
}));