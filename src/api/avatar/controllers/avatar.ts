/**
 * Avatar Controller
 * Handles avatar-related API requests
 */

export default {
  /**
   * GET /api/avatars
   * Returns list of all available avatars
   */
  async find(ctx) {
    try {
      const avatarService = strapi.service('api::avatar.avatar');
      const avatars = avatarService.getAvailableAvatars();

      ctx.body = {
        data: avatars,
        meta: {
          total: avatars.length
        }
      };
    } catch (error) {
      strapi.log.error('Avatar find error:', error);
      ctx.badRequest('Failed to retrieve avatars');
    }
  }
};
