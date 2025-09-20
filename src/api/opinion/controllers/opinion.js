'use strict';

/**
 * opinion controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::opinion.opinion', ({ strapi }) => ({
  async create(ctx) {
    // Auto-populate user field from authenticated user
    if (ctx.state.user) {
      ctx.request.body.data.user = ctx.state.user.id;
    }

    // Call the default create controller
    const response = await super.create(ctx);
    return response;
  },

  async update(ctx) {
    // Auto-populate user field from authenticated user for updates
    if (ctx.state.user) {
      ctx.request.body.data.user = ctx.state.user.id;
    }

    // Call the default update controller
    const response = await super.update(ctx);
    return response;
  }
}));