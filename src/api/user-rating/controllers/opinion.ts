/**
 * opinion controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::opinion.opinion', ({ strapi }) => ({
  // Custom find method to include category data
  async find(ctx) {
    ctx.query = {
      ...ctx.query,
      populate: {
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
        category: {
          fields: ['id', 'name', 'color']
        }
      }
    };
    const response = await super.findOne(ctx);
    return response;
  }
}));