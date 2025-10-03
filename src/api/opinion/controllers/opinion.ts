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

  // Custom delete method to unpublish related quote draft
  async delete(ctx) {
    const { id } = ctx.params;

    try {
      // First, find the opinion to check if it has a related quote draft
      const opinion = await strapi.entityService.findOne('api::opinion.opinion', id, {
        populate: ['category']
      });

      if (!opinion) {
        return ctx.notFound('Opinion not found');
      }

      // Find any quote drafts that reference this opinion
      const relatedDrafts = await strapi.db.query('api::quote-draft.quote-draft').findMany({
        where: {
          opinion: {
            id: opinion.id
          }
        }
      });

      // Delete the opinion using the default method
      const response = await super.delete(ctx);

      // Unpublish any related quote drafts (set is_published to false)
      if (relatedDrafts && relatedDrafts.length > 0) {
        for (const draft of relatedDrafts) {
          await strapi.entityService.update('api::quote-draft.quote-draft', draft.id, {
            data: {
              is_published: false,
              opinion: null
            }
          });
        }
        strapi.log.info(`Unpublished ${relatedDrafts.length} quote draft(s) after deleting opinion ${id}`);
      }

      return response;
    } catch (error) {
      strapi.log.error('Error deleting opinion:', error);
      return ctx.internalServerError('Failed to delete opinion');
    }
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