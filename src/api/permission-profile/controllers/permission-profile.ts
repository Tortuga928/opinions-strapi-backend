/**
 * Permission Profile Controller
 * Manages permission groups for users (sysadmin only)
 */

/**
 * Helper function to validate JWT token and populate ctx.state.user
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
   * List all permission profiles (sysadmin only)
   * GET /api/permission-profiles
   */
  async find(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can list permission profiles');
    }

    try {
      const profiles = await strapi.entityService.findMany('api::permission-profile.permission-profile', {
        sort: { createdAt: 'desc' },
        populate: ['menuPermissions', 'users']
      });

      // Add user count to each profile
      const profilesWithCount = profiles.map(profile => {
        const profileWithRelations = profile as any;
        return {
          ...profile,
          userCount: profileWithRelations.users?.length || 0
        };
      });

      return { data: profilesWithCount };
    } catch (error) {
      strapi.log.error('Error listing permission profiles:', error);
      return ctx.internalServerError('Failed to list permission profiles');
    }
  },

  /**
   * Get single permission profile (sysadmin only)
   * GET /api/permission-profiles/:id
   */
  async findOne(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can view permission profiles');
    }

    const { id } = ctx.params;

    try {
      const profile = await strapi.entityService.findOne('api::permission-profile.permission-profile', id, {
        populate: ['menuPermissions', 'users']
      });

      if (!profile) {
        return ctx.notFound('Permission profile not found');
      }

      // Add user count
      const profileWithRelations = profile as any;
      const profileWithCount = {
        ...profile,
        userCount: profileWithRelations.users?.length || 0
      };

      return { data: profileWithCount };
    } catch (error) {
      strapi.log.error('Error fetching permission profile:', error);
      return ctx.internalServerError('Failed to fetch permission profile');
    }
  },

  /**
   * Create permission profile (sysadmin only)
   * POST /api/permission-profiles
   * Body: { name, description?, permissions: [], isSystemProfile? }
   */
  async create(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can create permission profiles');
    }

    const { name, description, permissions, isSystemProfile } = ctx.request.body;

    // Validation
    if (!name || !permissions) {
      return ctx.badRequest('Name and permissions are required');
    }

    if (!Array.isArray(permissions)) {
      return ctx.badRequest('Permissions must be an array');
    }

    try {
      const profile = await strapi.entityService.create('api::permission-profile.permission-profile', {
        data: {
          name,
          description: description || '',
          permissions,
          isSystemProfile: isSystemProfile || false
        }
      });

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(currentUser.id, 'permission_profile_created', {
          profileName: name,
          createdBy: currentUser.username
        }, ctx);
      }

      return { data: profile };
    } catch (error) {
      strapi.log.error('Error creating permission profile:', error);
      return ctx.internalServerError('Failed to create permission profile');
    }
  },

  /**
   * Update permission profile (sysadmin only)
   * PUT /api/permission-profiles/:id
   * Body: { name?, description?, permissions? }
   */
  async update(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can update permission profiles');
    }

    const { id } = ctx.params;
    const updateData = ctx.request.body;

    try {
      const existingProfile = await strapi.entityService.findOne('api::permission-profile.permission-profile', id);

      if (!existingProfile) {
        return ctx.notFound('Permission profile not found');
      }

      // Prevent updating system profiles
      if (existingProfile.isSystemProfile) {
        return ctx.badRequest('Cannot update system profiles');
      }

      // Validate permissions if provided
      if (updateData.permissions && !Array.isArray(updateData.permissions)) {
        return ctx.badRequest('Permissions must be an array');
      }

      const updatedProfile = await strapi.entityService.update('api::permission-profile.permission-profile', id, {
        data: updateData
      });

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(currentUser.id, 'permission_profile_updated', {
          profileName: existingProfile.name,
          updatedBy: currentUser.username,
          changes: Object.keys(updateData).join(', ')
        }, ctx);
      }

      return { data: updatedProfile };
    } catch (error) {
      strapi.log.error('Error updating permission profile:', error);
      return ctx.internalServerError('Failed to update permission profile');
    }
  },

  /**
   * Delete permission profile (sysadmin only)
   * DELETE /api/permission-profiles/:id
   */
  async delete(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can delete permission profiles');
    }

    const { id } = ctx.params;

    try {
      const profile = await strapi.entityService.findOne('api::permission-profile.permission-profile', id, {
        populate: ['users']
      });

      if (!profile) {
        return ctx.notFound('Permission profile not found');
      }

      // Prevent deleting system profiles
      if (profile.isSystemProfile) {
        return ctx.badRequest('Cannot delete system profiles');
      }

      // Check if profile is assigned to any users
      const profileWithRelations = profile as any;
      if (profileWithRelations.users && profileWithRelations.users.length > 0) {
        return ctx.badRequest(`Cannot delete profile - assigned to ${profileWithRelations.users.length} user(s)`);
      }

      await strapi.entityService.delete('api::permission-profile.permission-profile', id);

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(currentUser.id, 'permission_profile_deleted', {
          profileName: profile.name,
          deletedBy: currentUser.username
        }, ctx);
      }

      return { data: { message: 'Permission profile deleted successfully' } };
    } catch (error) {
      strapi.log.error('Error deleting permission profile:', error);
      return ctx.internalServerError('Failed to delete permission profile');
    }
  },

  /**
   * Update profile menu permissions (sysadmin only)
   * PUT /api/permission-profiles/:id/menus
   * Body: { menuIds: [1, 2, 3] }
   */
  async updateMenus(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can update profile menus');
    }

    const { id } = ctx.params;
    const { menuIds } = ctx.request.body;

    if (!Array.isArray(menuIds)) {
      return ctx.badRequest('menuIds must be an array');
    }

    try {
      const profile = await strapi.entityService.findOne('api::permission-profile.permission-profile', id);

      if (!profile) {
        return ctx.notFound('Permission profile not found');
      }

      // Prevent updating system profiles
      if (profile.isSystemProfile) {
        return ctx.badRequest('Cannot update system profiles');
      }

      // Update menu permissions
      const updatedProfile = await strapi.entityService.update('api::permission-profile.permission-profile', id, {
        data: {
          menuPermissions: menuIds as any
        },
        populate: ['menuPermissions', 'users']
      });

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(currentUser.id, 'permission_profile_updated', {
          profileName: profile.name,
          updatedBy: currentUser.username,
          changes: 'menuPermissions'
        }, ctx);
      }

      // Add user count
      const profileWithRelations = updatedProfile as any;
      const profileWithCount = {
        ...updatedProfile,
        userCount: profileWithRelations.users?.length || 0
      };

      return { data: profileWithCount };
    } catch (error) {
      strapi.log.error('Error updating profile menus:', error);
      return ctx.internalServerError('Failed to update profile menus');
    }
  }
};
