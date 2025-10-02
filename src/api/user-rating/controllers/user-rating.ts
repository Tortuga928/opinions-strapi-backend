/**
 * user-rating controller
 *
 * This controller ensures that users can only access their own ratings
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::user-rating.user-rating', ({ strapi }) => ({

  /**
   * Override the default find method to filter by authenticated user
   * Special case: if query contains 'public=true' and 'opinionId', return public ratings
   */
  async find(ctx) {
    // Get the authenticated user from the context
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to view ratings');
    }

    // Check if this is a request for statistics (all ratings including current user)
    if (ctx.query.stats === 'true' && ctx.query.opinionId) {
      const opinionId = ctx.query.opinionId;

      try {
        // Find ALL ratings for this opinion (including current user)
        const allRatings = await strapi.entityService.findMany('api::user-rating.user-rating', {
          filters: {
            opinion: opinionId
          },
          populate: {
            users_permissions_user: {
              fields: ['username', 'email', 'id']
            },
            opinion: true
          },
          sort: { createdAt: 'desc' }
        });

        // Group ratings by user and keep only the most recent one
        const latestRatingsByUser = new Map();

        allRatings.forEach((rating: any) => {
          const userId = rating.users_permissions_user?.id;
          if (userId) {
            if (!latestRatingsByUser.has(userId)) {
              latestRatingsByUser.set(userId, rating);
            }
          }
        });

        // Convert to array and calculate stats
        const uniqueRatings = Array.from(latestRatingsByUser.values());

        const stats = {
          totalRatings: uniqueRatings.length,
          averageRating: uniqueRatings.length > 0
            ? Number((uniqueRatings.reduce((sum, r: any) => sum + r.rating, 0) / uniqueRatings.length).toFixed(1))
            : 0,
          totalComments: uniqueRatings.filter((r: any) => r.comments && r.comments.trim().length > 0).length,
          ratings: uniqueRatings.map((rating: any) => ({
            id: rating.id,
            rating: rating.rating,
            hasComment: !!(rating.comments && rating.comments.trim().length > 0),
            userId: rating.users_permissions_user?.id
          }))
        };

        return { data: stats, meta: {} };
      } catch (error) {
        console.error('[UserRating Controller] Error fetching stats:', error);
        throw error;
      }
    }

    // Check if this is a request for public ratings
    if (ctx.query.public === 'true' && ctx.query.opinionId) {
      // Handle public ratings inline
      const opinionId = ctx.query.opinionId;

      try {
        // Find all ratings for this opinion, excluding the current user
        const allRatings = await strapi.entityService.findMany('api::user-rating.user-rating', {
          filters: {
            opinion: opinionId,
            users_permissions_user: {
              id: {
                $ne: user.id // Exclude current user
              }
            }
          },
          populate: {
            users_permissions_user: {
              fields: ['username', 'email']
            },
            opinion: true
          },
          sort: { createdAt: 'desc' } // Sort by newest first
        });

        // Group ratings by user and keep only the most recent one
        const latestRatingsByUser = new Map();

        allRatings.forEach((rating: any) => {
          const userId = rating.users_permissions_user?.id;
          if (userId) {
            // Since we sorted by createdAt desc, the first rating for each user is the most recent
            if (!latestRatingsByUser.has(userId)) {
              latestRatingsByUser.set(userId, rating);
            }
          }
        });

        // Convert map values to array and transform the data
        const uniqueRatings = Array.from(latestRatingsByUser.values());

        const publicRatings = uniqueRatings.map((rating: any) => ({
          id: rating.id,
          rating: rating.rating,
          comments: rating.comments || '',
          username: rating.users_permissions_user?.username || 'Anonymous',
          createdAt: rating.createdAt
        }));

        return { data: publicRatings, meta: {} };
      } catch (error) {
        console.error('[UserRating Controller] Error fetching public ratings:', error);
        throw error;
      }
    }

    // Build query with user filter
    const existingFilters = (ctx.query?.filters || {}) as any;
    const filters = {
      ...existingFilters,
      users_permissions_user: user.id  // Direct ID assignment
    };

    // Always populate both opinion and user fields
    const populate = {
      opinion: true,
      users_permissions_user: true
    };

    // Use entityService to find ratings with user filter
    const pagination = (ctx.query?.pagination || {}) as any;
    const allResults = await strapi.entityService.findMany('api::user-rating.user-rating', {
      filters,
      populate,
      sort: { createdAt: 'desc' }, // Get newest first
      ...pagination
    });

    // Group by opinion and keep only the most recent rating per opinion
    const latestRatingsByOpinion = new Map();

    allResults.forEach((rating: any) => {
      const opinionId = rating.opinion?.id || rating.opinion;
      if (opinionId) {
        // Since we sorted by createdAt desc, the first rating for each opinion is the most recent
        if (!latestRatingsByOpinion.has(opinionId)) {
          latestRatingsByOpinion.set(opinionId, rating);
        }
      }
    });

    // Convert map values to array
    const results = Array.from(latestRatingsByOpinion.values());

    // Return in Strapi format
    return { data: results, meta: {} };
  },

  /**
   * Override the default findOne method to ensure user owns the rating
   */
  async findOne(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to view ratings');
    }

    // First get the rating
    const { id } = ctx.params;
    const rating = await strapi.entityService.findOne('api::user-rating.user-rating', id, {
      populate: ['users_permissions_user']
    });

    // Check if the rating belongs to the authenticated user
    if (!rating || (rating as any).users_permissions_user?.id !== user.id) {
      return ctx.notFound('Rating not found');
    }

    // Call the default findOne if user owns it
    return super.findOne(ctx);
  },

  /**
   * Override create to automatically set the user
   * This will update existing rating if one already exists for this user/opinion combo
   */
  async create(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to create ratings');
    }

    // Get the data without the user field (it will be set automatically)
    const { rating, comments, opinion } = ctx.request.body.data;

    // Check if a rating already exists for this user and opinion
    const existingRating = await strapi.entityService.findMany('api::user-rating.user-rating', {
      filters: {
        opinion: opinion,
        users_permissions_user: user.id
      },
      sort: { createdAt: 'desc' },
      limit: 1
    });

    if (existingRating && existingRating.length > 0) {
      // Update the existing rating
      const result = await strapi.entityService.update('api::user-rating.user-rating', existingRating[0].id, {
        data: {
          rating,
          comments
        },
        populate: ['opinion', 'users_permissions_user']
      });

      return { data: result, meta: {} };
    }

    try {
      // Create the rating using entityService with the user automatically set
      const result = await strapi.entityService.create('api::user-rating.user-rating', {
        data: {
          rating,
          comments,
          opinion,
          users_permissions_user: user.id  // Set user directly in entityService
        },
        populate: ['opinion', 'users_permissions_user']
      });

      // Return in the expected format
      return { data: result, meta: {} };
    } catch (error) {
      console.error('[UserRating Controller] Error creating rating:', error);
      throw error;
    }
  },

  /**
   * Override update to ensure user owns the rating
   */
  async update(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to update ratings');
    }

    // First check if the rating belongs to the user
    const { id } = ctx.params;
    const rating = await strapi.entityService.findOne('api::user-rating.user-rating', id, {
      populate: ['users_permissions_user']
    });

    if (!rating || (rating as any).users_permissions_user?.id !== user.id) {
      return ctx.forbidden('You can only update your own ratings');
    }

    // Ensure user field cannot be changed
    if (ctx.request.body.data) {
      ctx.request.body.data.users_permissions_user = user.id;
    }

    // Call the default update method
    return super.update(ctx);
  },

  /**
   * Override delete to ensure user owns the rating
   */
  async delete(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in to delete ratings');
    }

    // First check if the rating belongs to the user
    const { id } = ctx.params;
    const rating = await strapi.entityService.findOne('api::user-rating.user-rating', id, {
      populate: ['users_permissions_user']
    });

    if (!rating || (rating as any).users_permissions_user?.id !== user.id) {
      return ctx.forbidden('You can only delete your own ratings');
    }

    // Call the default delete method
    return super.delete(ctx);
  }
}));