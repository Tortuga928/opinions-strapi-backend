/**
 * quote-draft controller
 */

import { factories } from '@strapi/strapi';
import { Readable } from 'stream';

export default factories.createCoreController('api::quote-draft.quote-draft', ({ strapi }) => ({
  /**
   * Generate quote with streaming progress updates
   * POST /api/quote-drafts/generate
   */
  async generateQuote(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to generate quotes');
    }

    // Validate request body
    const { category, generationType, generationSource, generationDetails } = ctx.request.body;

    if (!category || !generationType || !generationSource) {
      return ctx.badRequest('Missing required fields: category, generationType, generationSource');
    }

    // Set up SSE headers
    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // Create readable stream for SSE
    const stream = new Readable({
      read() {}
    });

    ctx.body = stream;

    try {
      // Send status updates as we progress
      stream.push(`data: ${JSON.stringify({ status: 'searching', message: 'Searching web for quotes...' })}\n\n`);

      // Call service to generate quote (this does all the work)
      const result = await strapi.service('api::quote-draft.quote-draft').generateQuoteFromWeb({
        category,
        generationType,
        generationSource,
        generationDetails,
        userId: user.id
      });

      // Send final result with candidates and reasoning
      stream.push(`data: ${JSON.stringify({
        status: 'complete',
        message: 'Quote generated successfully!',
        data: result.quoteDraft,
        candidates: result.candidates,
        selection_reasoning: result.selection_reasoning
      })}\n\n`);

      stream.push('data: [DONE]\n\n');
      stream.push(null);

    } catch (error) {
      strapi.log.error('Quote generation controller error:', error);

      // Send error to client
      stream.push(`data: ${JSON.stringify({
        status: 'error',
        message: error.message || 'Failed to generate quote'
      })}\n\n`);

      stream.push(null);
    }
  },

  /**
   * Delete all quote drafts for current user
   * DELETE /api/quote-drafts/delete-all
   */
  async deleteAllUserDrafts(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to delete quote drafts');
    }

    try {

      // Find all drafts for this user
      const userDrafts = await strapi.entityService.findMany('api::quote-draft.quote-draft', {
        filters: {
          user: {
            id: user.id
          }
        }
      });


      // Delete each draft
      const deletePromises = userDrafts.map(draft =>
        strapi.entityService.delete('api::quote-draft.quote-draft', draft.id)
      );

      await Promise.all(deletePromises);


      return ctx.send({
        data: {
          deleted: userDrafts.length,
          message: `Successfully deleted ${userDrafts.length} quote draft(s)`
        }
      });

    } catch (error) {
      strapi.log.error('Delete all drafts error:', error);
      return ctx.internalServerError('Failed to delete quote drafts');
    }
  },

  // Override find to only return current user's drafts
  async find(ctx) {

    const user = ctx.state.user;

    if (!user) {
      strapi.log.error('[Quote Draft Controller] No user found in ctx.state.user');
      return ctx.unauthorized('You must be logged in to view quote drafts');
    }


    // Build filters with user filter
    const existingFilters = (ctx.query?.filters || {}) as any;
    const filters = {
      ...existingFilters,
      user: {
        id: user.id
      }
    };

    // Always populate both category and user fields
    const populate = {
      category: true,
      user: true
    };


    // Use entityService to find drafts with user filter - DO NOT use super.find()
    const pagination = (ctx.query?.pagination || {}) as any;
    const results = await strapi.entityService.findMany('api::quote-draft.quote-draft', {
      filters,
      populate,
      sort: { createdAt: 'desc' },
      ...pagination
    });


    // Return in Strapi format
    return { data: results, meta: {} };
  },

  // Override create to automatically associate with current user
  async create(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to create quote drafts');
    }

    // Add user to the request body
    ctx.request.body = {
      ...ctx.request.body,
      data: {
        ...ctx.request.body.data,
        user: user.id
      }
    };

    // Call the default core action
    const response = await super.create(ctx);
    return response;
  },

  /**
   * Publish quote draft as an opinion
   * POST /api/quote-drafts/:id/publish
   */
  async publish(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to publish quote drafts');
    }

    const { id } = ctx.params;

    try {

      // Find the quote draft by documentId using query API
      const drafts = await strapi.db.query('api::quote-draft.quote-draft').findMany({
        where: {
          documentId: id
        },
        populate: ['category', 'user']
      });

      if (!drafts || drafts.length === 0) {
        strapi.log.error(`[Quote Draft Controller] Draft ${id} not found`);
        return ctx.notFound('Quote draft not found');
      }

      // Get the quote draft
      const quoteDraft: any = drafts[0];

      // Verify ownership
      if (quoteDraft.user.id !== user.id) {
        return ctx.forbidden('You can only publish your own quote drafts');
      }

      // Check if already published
      if (quoteDraft.is_published) {
        return ctx.badRequest('This quote draft has already been published');
      }

      // Validate category exists
      if (!quoteDraft.category || !quoteDraft.category.id) {
        strapi.log.error(`[Quote Draft Controller] Draft ${quoteDraft.id} has no category`);
        return ctx.badRequest('Quote draft must have a category to be published');
      }

      // Format the opinion statement: "quote" - Speaker, Source
      const statement = `"${quoteDraft.quote_text}" - ${quoteDraft.speaker_name}, ${quoteDraft.publication_source}`;


      // Create opinion from quote draft
      const opinion = await strapi.entityService.create('api::opinion.opinion', {
        data: {
          statement,
          category: quoteDraft.category.id,
          source_type: 'AI',
          generation_type: quoteDraft.generation_type,
          generation_source: quoteDraft.generation_source,
          generation_details: quoteDraft.generation_details || `Published from quote draft`
        },
        populate: ['category']
      });

      if (!opinion) {
        strapi.log.error(`[Quote Draft Controller] Opinion creation returned null/undefined`);
        throw new Error('Opinion creation failed - returned null');
      }


      // Mark quote draft as published (use numeric id)
      const updatedDraft = await strapi.entityService.update('api::quote-draft.quote-draft', quoteDraft.id, {
        data: {
          is_published: true
        },
        populate: ['category', 'user']
      });


      // Return both the created opinion and updated draft
      return ctx.send({
        data: {
          opinion,
          quoteDraft: updatedDraft
        },
        message: 'Quote draft published successfully'
      });

    } catch (error) {
      strapi.log.error('[Quote Draft Controller] Publish error:', {
        message: error.message,
        stack: error.stack,
        draftId: id,
        userId: user?.id
      });
      return ctx.internalServerError(`Failed to publish quote draft: ${error.message}`);
    }
  }
}));
