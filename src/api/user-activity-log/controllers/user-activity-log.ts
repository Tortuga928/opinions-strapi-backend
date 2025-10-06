/**
 * user-activity-log controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::user-activity-log.user-activity-log', ({ strapi }) => ({
  // Override find to filter by current user only
  async find(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // Strapi 5: Use Document Service API
    const pagination = (ctx.query?.pagination || {}) as any;

    const results = await strapi.documents('api::user-activity-log.user-activity-log').findMany({
      filters: {
        user: { id: user.id }
      },
      sort: { createdAt: 'desc' },
      ...(pagination.page && { start: (pagination.page - 1) * (pagination.pageSize || 25) }),
      ...(pagination.pageSize && { limit: pagination.pageSize })
    });

    // Get total count for pagination
    const allResults = await strapi.documents('api::user-activity-log.user-activity-log').findMany({
      filters: {
        user: { id: user.id }
      }
    });
    const total = allResults.length;

    return {
      data: results,
      meta: {
        pagination: {
          page: pagination.page || 1,
          pageSize: pagination.pageSize || 25,
          pageCount: Math.ceil(total / (pagination.pageSize || 25)),
          total
        }
      }
    };
  },

  // Custom endpoint: Get unread count
  async count(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be logged in');
    }

    // Strapi 5: Use Document Service API
    const filters = (ctx.query?.filters || {}) as any;
    const isReadFilter = filters.isRead?.$eq;

    const documentFilters: any = { user: { id: user.id } };

    if (isReadFilter !== undefined) {
      documentFilters.isRead = isReadFilter === 'false' ? false : isReadFilter === 'true' ? true : isReadFilter;
    }

    const results = await strapi.documents('api::user-activity-log.user-activity-log').findMany({
      filters: documentFilters
    });

    return results.length;
  },

  // Custom endpoint: Mark all as read
  async markAllAsRead(ctx) {
    strapi.log.info('markAllAsRead controller called');
    const user = ctx.state.user;
    strapi.log.info(`markAllAsRead: user = ${user ? user.id : 'null'}`);

    if (!user) {
      strapi.log.error('markAllAsRead: No user in ctx.state');
      return ctx.unauthorized('You must be logged in');
    }

    try {
      strapi.log.info(`markAllAsRead: Updating notifications for user ${user.id}`);

      // Strapi 5: Find all unread activity logs for this user
      const unreadLogs = await strapi.documents('api::user-activity-log.user-activity-log').findMany({
        filters: {
          user: { id: user.id },
          isRead: false
        }
      });

      strapi.log.info(`markAllAsRead: Found ${unreadLogs.length} unread notifications`);

      // Update each unread log individually
      for (const log of unreadLogs) {
        strapi.log.info(`markAllAsRead: Updating log ${log.documentId}`);
        try {
          const updated = await strapi.documents('api::user-activity-log.user-activity-log').update({
            documentId: log.documentId,
            data: {
              isRead: true
            }
          });
          strapi.log.info(`markAllAsRead: Successfully updated log ${log.documentId}, isRead=${updated.isRead}`);
        } catch (err) {
          strapi.log.error(`markAllAsRead: Failed to update log ${log.documentId}:`, err);
        }
      }

      strapi.log.info('markAllAsRead: Update successful');
      return { success: true, message: 'All notifications marked as read' };
    } catch (error) {
      strapi.log.error('markAllAsRead: Error updating:', error);
      throw error;
    }
  }
}));
