/**
 * Symbol Cache Controller
 * Provides API endpoints for managing and searching the stock symbol cache
 */

export default {
  /**
   * Search for symbols (autocomplete endpoint)
   * GET /api/investeos/symbols/search?q=AAPL&limit=20
   */
  async search(ctx) {
    try {
      // Validate authentication
      const token = ctx.request.header.authorization?.replace('Bearer ', '');
      if (!token) {
        return ctx.unauthorized('No authorization token provided');
      }

      // Verify JWT token
      try {
        await strapi.plugins['users-permissions'].services.jwt.verify(token);
      } catch (err) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const { q: query = '', limit = 20 } = ctx.query;

      if (!query) {
        return ctx.badRequest('Search query is required');
      }

      const symbolCache = strapi.service('api::investeos.symbol-cache');
      const results = await symbolCache.searchSymbols(query, parseInt(limit as string));

      ctx.body = {
        success: true,
        data: results,
        count: results.length
      };
    } catch (error) {
      strapi.log.error('Symbol search error:', error);
      ctx.body = {
        success: false,
        error: { message: 'Failed to search symbols' }
      };
      ctx.status = 500;
    }
  },

  /**
   * Get cache statistics
   * GET /api/investeos/symbols/stats
   */
  async getStats(ctx) {
    try {
      // Validate authentication
      const token = ctx.request.header.authorization?.replace('Bearer ', '');
      if (!token) {
        return ctx.unauthorized('No authorization token provided');
      }

      // Verify JWT token
      try {
        await strapi.plugins['users-permissions'].services.jwt.verify(token);
      } catch (err) {
        return ctx.unauthorized('Invalid or expired token');
      }

      const symbolCache = strapi.service('api::investeos.symbol-cache');
      const count = await symbolCache.getSymbolCount();

      ctx.body = {
        success: true,
        data: {
          totalSymbols: count,
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      strapi.log.error('Symbol stats error:', error);
      ctx.body = {
        success: false,
        error: { message: 'Failed to get cache statistics' }
      };
      ctx.status = 500;
    }
  },

  /**
   * Populate cache with common symbols (admin only)
   * POST /api/investeos/symbols/populate
   */
  async populate(ctx) {
    try {
      // Validate authentication
      const token = ctx.request.header.authorization?.replace('Bearer ', '');
      if (!token) {
        return ctx.unauthorized('No authorization token provided');
      }

      // Verify JWT token and get user
      let decodedToken;
      try {
        decodedToken = await strapi.plugins['users-permissions'].services.jwt.verify(token);
      } catch (err) {
        return ctx.unauthorized('Invalid or expired token');
      }

      // Get user data
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: decodedToken.id }
      });

      if (!user) {
        return ctx.unauthorized('User not found');
      }

      // Check if user is super admin (userRole: 'sysadmin')
      if (user.userRole !== 'sysadmin') {
        return ctx.forbidden('Only system administrators can populate the symbol cache');
      }

      const symbolCache = strapi.service('api::investeos.symbol-cache');
      const processedCount = await symbolCache.populateCommonSymbols();

      ctx.body = {
        success: true,
        data: {
          processed: processedCount,
          message: `Successfully populated cache with ${processedCount} symbols`
        }
      };
    } catch (error) {
      strapi.log.error('Symbol populate error:', error);
      ctx.body = {
        success: false,
        error: { message: 'Failed to populate symbol cache' }
      };
      ctx.status = 500;
    }
  },

  /**
   * Clear symbol cache (admin only)
   * DELETE /api/investeos/symbols/clear
   */
  async clear(ctx) {
    try {
      // Validate authentication
      const token = ctx.request.header.authorization?.replace('Bearer ', '');
      if (!token) {
        return ctx.unauthorized('No authorization token provided');
      }

      // Verify JWT token and get user
      let decodedToken;
      try {
        decodedToken = await strapi.plugins['users-permissions'].services.jwt.verify(token);
      } catch (err) {
        return ctx.unauthorized('Invalid or expired token');
      }

      // Get user data
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: decodedToken.id }
      });

      if (!user) {
        return ctx.unauthorized('User not found');
      }

      // Check if user is super admin
      if (user.userRole !== 'sysadmin') {
        return ctx.forbidden('Only system administrators can clear the symbol cache');
      }

      const symbolCache = strapi.service('api::investeos.symbol-cache');
      const deletedCount = await symbolCache.clearCache();

      ctx.body = {
        success: true,
        data: {
          deleted: deletedCount,
          message: `Successfully cleared ${deletedCount} symbols from cache`
        }
      };
    } catch (error) {
      strapi.log.error('Symbol clear error:', error);
      ctx.body = {
        success: false,
        error: { message: 'Failed to clear symbol cache' }
      };
      ctx.status = 500;
    }
  },

  /**
   * Bulk import symbols from JSON (admin only)
   * POST /api/investeos/symbols/import
   * Body: { symbols: [{ ticker, companyName, exchange }, ...] }
   */
  async import(ctx) {
    try {
      // Validate authentication
      const token = ctx.request.header.authorization?.replace('Bearer ', '');
      if (!token) {
        return ctx.unauthorized('No authorization token provided');
      }

      // Verify JWT token and get user
      let decodedToken;
      try {
        decodedToken = await strapi.plugins['users-permissions'].services.jwt.verify(token);
      } catch (err) {
        return ctx.unauthorized('Invalid or expired token');
      }

      // Get user data
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: decodedToken.id }
      });

      if (!user) {
        return ctx.unauthorized('User not found');
      }

      // Check if user is super admin
      if (user.userRole !== 'sysadmin') {
        return ctx.forbidden('Only system administrators can import symbols');
      }

      const { symbols } = ctx.request.body;

      if (!symbols || !Array.isArray(symbols)) {
        return ctx.badRequest('Request body must contain a "symbols" array');
      }

      // Validate symbol format
      for (const symbol of symbols) {
        if (!symbol.ticker || !symbol.companyName || !symbol.exchange) {
          return ctx.badRequest('Each symbol must have ticker, companyName, and exchange fields');
        }
      }

      const symbolCache = strapi.service('api::investeos.symbol-cache');
      const processedCount = await symbolCache.populateCache(symbols);

      ctx.body = {
        success: true,
        data: {
          processed: processedCount,
          total: symbols.length,
          message: `Successfully imported ${processedCount} symbols`
        }
      };
    } catch (error) {
      strapi.log.error('Symbol import error:', error);
      ctx.body = {
        success: false,
        error: { message: 'Failed to import symbols' }
      };
      ctx.status = 500;
    }
  }
};
