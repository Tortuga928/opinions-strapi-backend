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
      strapi.log.info(`Quote Draft Controller: Deleting all drafts for user ${user.id}`);

      // Find all drafts for this user
      const userDrafts = await strapi.entityService.findMany('api::quote-draft.quote-draft', {
        filters: {
          user: {
            id: user.id
          }
        }
      });

      strapi.log.info(`Quote Draft Controller: Found ${userDrafts.length} drafts to delete`);

      // Delete each draft
      const deletePromises = userDrafts.map(draft =>
        strapi.entityService.delete('api::quote-draft.quote-draft', draft.id)
      );

      await Promise.all(deletePromises);

      strapi.log.info(`Quote Draft Controller: Successfully deleted ${userDrafts.length} drafts for user ${user.id}`);

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
    strapi.log.info('[Quote Draft Controller] find() called');
    strapi.log.info(`[Quote Draft Controller] ctx.state.user = ${ctx.state.user ? `${ctx.state.user.id} (${ctx.state.user.username})` : 'null'}`);

    const user = ctx.state.user;

    if (!user) {
      strapi.log.error('[Quote Draft Controller] No user found in ctx.state.user');
      return ctx.unauthorized('You must be logged in to view quote drafts');
    }

    strapi.log.info(`[Quote Draft Controller] Fetching drafts for user ${user.id}`);

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

    strapi.log.info('[Quote Draft Controller] Filters being applied:', JSON.stringify(filters, null, 2));

    // Use entityService to find drafts with user filter - DO NOT use super.find()
    const pagination = (ctx.query?.pagination || {}) as any;
    const results = await strapi.entityService.findMany('api::quote-draft.quote-draft', {
      filters,
      populate,
      sort: { createdAt: 'desc' },
      ...pagination
    });

    strapi.log.info(`[Quote Draft Controller] Found ${results?.length || 0} drafts for user ${user.id}`);

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
  }
}));
