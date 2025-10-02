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
  },

  // Auto-generate opinion method
  async generateOpinion(ctx) {
    try {
      const { generationType, generationSource } = ctx.request.body;

      // Validate input
      if (!generationType || !generationSource) {
        return ctx.badRequest('Generation type and source are required');
      }

      // Generate the opinion using the service
      const generatedOpinion = await strapi.service('api::opinion.opinion').generateOpinion({
        generationType,
        generationSource
      });

      // Create the opinion in the database
      const opinion = await strapi.entityService.create('api::opinion.opinion', {
        data: {
          ...generatedOpinion,
          source_type: 'AI',
          generation_type: generationType,
          generation_source: generationSource,
          generation_details: `Generated from ${generationSource} about ${generationType}`
        },
        populate: {
          category: true
        }
      });

      return ctx.send(opinion);
    } catch (error) {
      strapi.log.error('Error generating opinion:', error);
      return ctx.internalServerError('Failed to generate opinion');
    }
  }
}));