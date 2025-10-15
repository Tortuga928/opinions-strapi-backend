/**
 * User Profile Assignment Controller
 * Manages user-profile assignments and individual menu permissions (sysadmin only)
 */

/**
 * Helper function to validate JWT token and populate ctx.state.user
 * Pattern from CLAUDE.md Phase 4 - User Management Authentication
 */
async function authenticateRequest(ctx) {
  const authHeader = ctx.request.header.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/, '');

  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const decoded = await jwtService.verify(token);

    if (!decoded || !decoded.id) {
      return null;
    }

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: decoded.id }
    });

    if (!user) {
      return null;
    }

    ctx.state.user = user;
    return user;
  } catch (error) {
    strapi.log.error('JWT validation error:', error);
    return null;
  }
}

export default {
  /**
   * Assign permission profile to user
   * POST /api/user-profile-assignments/users/:userId/profiles/:profileId
   */
  async assignProfile(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can assign profiles');
    }

    const { userId, profileId } = ctx.params;

    if (!userId || !profileId) {
      return ctx.badRequest('userId and profileId are required');
    }

    try {
      // Check if user exists
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['permissionProfiles', 'primaryProfile']
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Check if profile exists
      const profile = await strapi.entityService.findOne('api::permission-profile.permission-profile', profileId);

      if (!profile) {
        return ctx.notFound('Permission profile not found');
      }

      // Get current profile IDs
      const userWithRelations = user as any;
      const currentProfileIds = userWithRelations.permissionProfiles?.map((p: any) => p.id) || [];

      // Add new profile if not already assigned
      if (!currentProfileIds.includes(profileId)) {
        currentProfileIds.push(profileId);

        await strapi.query('plugin::users-permissions.user').update({
          where: { id: userId },
          data: {
            permissionProfiles: currentProfileIds
          }
        });

        strapi.log.info(`Profile ${profile.name} assigned to user ${user.username} by ${currentUser.username}`);

        // Log activity
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        if (activityLogger) {
          await activityLogger.logActivity(userId, 'profile_assigned', {
            profileName: profile.name,
            profileId,
            assignedBy: currentUser.username
          }, ctx);
        }

        return {
          data: {
            message: 'Profile assigned successfully',
            userId,
            profileId,
            profileName: profile.name
          }
        };
      } else {
        return ctx.badRequest('Profile already assigned to user');
      }
    } catch (error) {
      strapi.log.error('Error assigning profile:', error);
      return ctx.internalServerError('Failed to assign profile');
    }
  },

  /**
   * Remove permission profile from user
   * DELETE /api/user-profile-assignments/users/:userId/profiles/:profileId
   */
  async removeProfile(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can remove profiles');
    }

    const { userId, profileId } = ctx.params;

    if (!userId || !profileId) {
      return ctx.badRequest('userId and profileId are required');
    }

    try {
      // Check if user exists
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['permissionProfiles', 'primaryProfile']
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Get current profile IDs
      const userWithRelations = user as any;
      const currentProfileIds = userWithRelations.permissionProfiles?.map((p: any) => p.id) || [];

      // Remove profile
      const updatedProfileIds = currentProfileIds.filter((id: number) => id !== profileId);

      if (updatedProfileIds.length === currentProfileIds.length) {
        return ctx.badRequest('Profile not assigned to user');
      }

      await strapi.query('plugin::users-permissions.user').update({
        where: { id: userId },
        data: {
          permissionProfiles: updatedProfileIds
        }
      });

      strapi.log.info(`Profile ${profileId} removed from user ${user.username} by ${currentUser.username}`);

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(userId, 'profile_removed', {
          profileId,
          removedBy: currentUser.username
        }, ctx);
      }

      return {
        data: {
          message: 'Profile removed successfully',
          userId,
          profileId
        }
      };
    } catch (error) {
      strapi.log.error('Error removing profile:', error);
      return ctx.internalServerError('Failed to remove profile');
    }
  },

  /**
   * Set primary profile for user
   * PUT /api/user-profile-assignments/users/:userId/primary-profile
   * Body: { profileId: number }
   */
  async setPrimaryProfile(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can set primary profile');
    }

    const { userId } = ctx.params;
    const { profileId } = ctx.request.body;

    if (!userId || !profileId) {
      return ctx.badRequest('userId and profileId are required');
    }

    try {
      // Check if user exists
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['permissionProfiles']
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Check if profile exists
      const profile = await strapi.entityService.findOne('api::permission-profile.permission-profile', profileId);

      if (!profile) {
        return ctx.notFound('Permission profile not found');
      }

      // Check if profile is assigned to user
      const userWithRelations = user as any;
      const assignedProfileIds = userWithRelations.permissionProfiles?.map((p: any) => p.id) || [];

      if (!assignedProfileIds.includes(profileId)) {
        return ctx.badRequest('Profile must be assigned to user before setting as primary');
      }

      // CRITICAL FIX: Clear ALL individual menu permissions before setting new primary profile
      // Individual permissions should only exist when they override the primary profile
      // When changing primary profile, user should get ONLY the permissions from the new profile

      // Step 1: Query for existing individual menu permissions
      const existingIndividualMenus = await strapi.db.connection.raw(
        'SELECT menu_permission_id FROM up_users_individual_menu_permissions_lnk WHERE user_id = ?',
        [userId]
      );

      const individualMenuCount = existingIndividualMenus?.length || 0;

      // Step 2: Delete ALL individual menu permissions via direct SQL
      if (individualMenuCount > 0) {
        await strapi.db.connection.raw(
          'DELETE FROM up_users_individual_menu_permissions_lnk WHERE user_id = ?',
          [userId]
        );

        strapi.log.info(`[PRIMARY PROFILE CHANGE] Cleared ${individualMenuCount} individual menu permission(s) for user ${user.username}`);

        // Log activity for individual permissions cleared
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        if (activityLogger) {
          await activityLogger.logActivity(userId, 'permission_change', {
            action: 'individual_menus_cleared',
            count: individualMenuCount,
            reason: 'primary_profile_changed',
            clearedBy: currentUser.username
          }, ctx);
        }
      }

      // Step 3: Set new primary profile using direct SQL
      // WORKAROUND for Strapi 5 Bug #20330: Multiple relations to same table fail to populate
      // Solution: Use direct SQL to update the primaryProfile field instead of Strapi ORM
      // The clear-then-set pattern doesn't work for UPDATING existing values in Strapi 5
      // Direct SQL bypasses Strapi's broken relation handling
      await strapi.db.connection.raw(
        'UPDATE up_users SET primary_profile_id = ? WHERE id = ?',
        [profileId, userId]
      );

      strapi.log.info(`Primary profile set to ${profile.name} for user ${user.username} by ${currentUser.username} (using direct SQL workaround)`);

      return {
        data: {
          message: 'Primary profile set successfully',
          userId,
          profileId,
          profileName: profile.name,
          individualMenusCleared: individualMenuCount
        }
      };
    } catch (error) {
      strapi.log.error('Error setting primary profile:', error);
      return ctx.internalServerError('Failed to set primary profile');
    }
  },

  /**
   * Add individual menu permission to user
   * POST /api/user-profile-assignments/users/:userId/individual-menus/:menuId
   */
  async addIndividualMenu(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can add individual menu permissions');
    }

    const { userId, menuId } = ctx.params;

    if (!userId || !menuId) {
      return ctx.badRequest('userId and menuId are required');
    }

    try {
      // Check if user exists
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['individualMenuPermissions']
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Check if menu exists
      const menu = await strapi.entityService.findOne('api::menu-permission.menu-permission', menuId);

      if (!menu) {
        return ctx.notFound('Menu permission not found');
      }

      // Check if relation already exists by querying join table directly
      // Strapi 5 naming: {collectionName}_{relationField}_lnk
      const existingRelation = await strapi.db.connection.raw(
        'SELECT * FROM up_users_individual_menu_permissions_lnk WHERE user_id = ? AND menu_permission_id = ?',
        [userId, menuId]
      );

      const hasRelation = existingRelation && existingRelation.length > 0;

      // Add new menu if not already assigned
      if (!hasRelation) {
        // Direct SQL INSERT into join table - bypasses Strapi's broken ORM for plugin relations
        await strapi.db.connection.raw(
          'INSERT INTO up_users_individual_menu_permissions_lnk (user_id, menu_permission_id) VALUES (?, ?)',
          [userId, menuId]
        );

        strapi.log.info(`Individual menu ${menu.displayName} added to user ${user.username} by ${currentUser.username}`);

        // Log activity
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        if (activityLogger) {
          await activityLogger.logActivity(userId, 'permission_change', {
            action: 'menu_added',
            menuName: menu.displayName,
            menuId,
            addedBy: currentUser.username
          }, ctx);
        }

        // Return simple success message (don't rely on broken populate)
        return {
          data: {
            message: 'Menu permission added successfully',
            userId,
            menuId,
            menuName: menu.displayName
          }
        };
      } else {
        return ctx.badRequest('Menu already assigned to user');
      }
    } catch (error) {
      strapi.log.error('Error adding individual menu:', error);
      return ctx.internalServerError('Failed to add individual menu permission');
    }
  },

  /**
   * Remove individual menu permission from user
   * DELETE /api/user-profile-assignments/users/:userId/individual-menus/:menuId
   */
  async removeIndividualMenu(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can remove individual menu permissions');
    }

    const { userId, menuId } = ctx.params;

    if (!userId || !menuId) {
      return ctx.badRequest('userId and menuId are required');
    }

    try {
      // Check if user exists
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['individualMenuPermissions']
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Check if relation exists by querying join table directly
      // Strapi 5 naming: {collectionName}_{relationField}_lnk
      const existingRelation = await strapi.db.connection.raw(
        'SELECT * FROM up_users_individual_menu_permissions_lnk WHERE user_id = ? AND menu_permission_id = ?',
        [userId, menuId]
      );

      const hasRelation = existingRelation && existingRelation.length > 0;

      // Check if menu is assigned
      if (!hasRelation) {
        return ctx.badRequest('Menu not assigned to user');
      }

      // Direct SQL DELETE from join table - bypasses Strapi's broken ORM for plugin relations
      await strapi.db.connection.raw(
        'DELETE FROM up_users_individual_menu_permissions_lnk WHERE user_id = ? AND menu_permission_id = ?',
        [userId, menuId]
      );

      strapi.log.info(`Individual menu ${menuId} removed from user ${user.username} by ${currentUser.username}`);

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(userId, 'permission_change', {
          action: 'menu_removed',
          menuId,
          removedBy: currentUser.username
        }, ctx);
      }

      // Return simple success message (don't rely on broken populate)
      // Use ctx.send() to bypass any automatic response transformation
      return ctx.send({
        data: {
          message: 'Menu permission removed successfully',
          userId,
          menuId
        }
      });
    } catch (error) {
      strapi.log.error('Error removing individual menu:', error);
      return ctx.internalServerError('Failed to remove individual menu permission');
    }
  },

  /**
   * Get individual menu permissions for user
   * GET /api/user-profile-assignments/users/:userId/individual-menus
   */
  async getIndividualMenus(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can view individual menu permissions');
    }

    const { userId } = ctx.params;

    if (!userId) {
      return ctx.badRequest('userId is required');
    }

    try {
      // Check if user exists
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId }
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Query join table directly for individual menu permissions
      const individualMenusResult = await strapi.db.connection.raw(
        `SELECT mp.id, mp.key, mp.display_name
         FROM menu_permissions mp
         INNER JOIN up_users_individual_menu_permissions_lnk link ON mp.id = link.menu_permission_id
         WHERE link.user_id = ?`,
        [userId]
      );

      const individualMenus = individualMenusResult || [];

      strapi.log.info(`Retrieved ${individualMenus.length} individual menu permission(s) for user ${user.username}`);

      return {
        data: {
          count: individualMenus.length,
          menus: individualMenus.map((menu: any) => ({
            id: menu.id,
            key: menu.key,
            displayName: menu.display_name
          }))
        }
      };
    } catch (error) {
      strapi.log.error('Error retrieving individual menus:', error);
      return ctx.internalServerError('Failed to retrieve individual menu permissions');
    }
  }
};
