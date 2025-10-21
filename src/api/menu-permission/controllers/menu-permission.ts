/**
 * menu-permission controller
 *
 * CRUD operations for menu permissions
 * All endpoints restricted to sysadmin only
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
   * GET /api/menu-permissions
   * List all menu permissions
   * Access: Authenticated users only (frontend restricts page access to sysadmin)
   */
  async find(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to view menu permissions');
    }

    try {
      // WORKAROUND for Strapi 5 Bug #20330: Use direct SQL instead of entityService
      // entityService.findMany() can return wrong data for menu permissions
      // This is the same bug documented in PROFILE_BUG_TRACKING_LOG.md
      const sqlResult = await strapi.db.connection.raw(
        `SELECT id, document_id, key, display_name, description, menu_icon,
                is_system_menu, sort_order, menu_category, created_at, updated_at, published_at
         FROM menu_permissions
         ORDER BY sort_order ASC`
      );

      // CRITICAL FIX: Handle different result formats between PostgreSQL and SQLite
      // PostgreSQL returns {rows: [...]} while SQLite returns [...]
      const rows = sqlResult.rows || sqlResult;

      strapi.log.info(`[menu-permission.find] SQL returned ${rows?.length || 0} rows`);
      strapi.log.info(`[menu-permission.find] First row sample:`, rows[0]);

      // Transform SQL results to match Strapi format (camelCase field names)
      // IMPORTANT: Both PostgreSQL and SQLite return snake_case column names
      const menus = rows.map((row: any) => ({
        id: row.id,
        documentId: row.document_id || row.documentId,  // Fallback for both formats
        key: row.key,
        displayName: row.display_name || row.displayName,
        description: row.description,
        menuIcon: row.menu_icon || row.menuIcon,
        isSystemMenu: row.is_system_menu !== undefined ? row.is_system_menu : row.isSystemMenu,
        sortOrder: row.sort_order !== undefined ? row.sort_order : row.sortOrder,
        menuCategory: row.menu_category || row.menuCategory,
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt,
        publishedAt: row.published_at || row.publishedAt
      }));

      strapi.log.info(`[menu-permission.find] Returning ${menus.length} menu permissions via direct SQL`);
      strapi.log.info(`[menu-permission.find] First menu sample:`, menus[0]);
      return { data: menus };
    } catch (error) {
      strapi.log.error('Error listing menu permissions:', error);
      return ctx.internalServerError('Failed to list menu permissions');
    }
  },

  /**
   * GET /api/menu-permissions/:id
   * Get single menu permission by ID
   * Access: Sysadmin only
   */
  async findOne(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || (currentUser.userRole !== 'sysadmin' && !currentUser.isSuperAdmin)) {
      return ctx.unauthorized('Only sysadmin can view menu permissions');
    }

    const { id } = ctx.params;

    if (!id) {
      return ctx.badRequest('Menu permission ID required');
    }

    try {
      const menu = await strapi.entityService.findOne('api::menu-permission.menu-permission', id, {
        populate: ['permission_profiles', 'users']
      });

      if (!menu) {
        return ctx.notFound('Menu permission not found');
      }

      return { data: menu };
    } catch (error) {
      strapi.log.error('Error fetching menu permission:', error);
      return ctx.internalServerError('Failed to fetch menu permission');
    }
  },

  /**
   * POST /api/menu-permissions
   * Create new menu permission
   * Access: Sysadmin only
   */
  async create(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || (currentUser.userRole !== 'sysadmin' && !currentUser.isSuperAdmin)) {
      return ctx.unauthorized('Only sysadmin can create menu permissions');
    }

    const { key, displayName, description, menuIcon, isSystemMenu, sortOrder, menuCategory } = ctx.request.body;

    // Validation
    if (!key || !displayName) {
      return ctx.badRequest('key and displayName are required');
    }

    if (menuCategory && !['regular', 'admin'].includes(menuCategory)) {
      return ctx.badRequest('menuCategory must be "regular" or "admin"');
    }

    try {
      // Check for duplicate key
      const existing = await strapi.entityService.findMany('api::menu-permission.menu-permission', {
        filters: { key }
      });

      if (existing.length > 0) {
        return ctx.badRequest(`Menu permission with key "${key}" already exists`);
      }

      // Create menu permission
      const menu = await strapi.entityService.create('api::menu-permission.menu-permission', {
        data: {
          key,
          displayName,
          description: description || null,
          menuIcon: menuIcon || null,
          isSystemMenu: isSystemMenu || false,
          sortOrder: sortOrder || 0,
          menuCategory: menuCategory || 'regular',
          publishedAt: new Date()
        }
      });

      strapi.log.info(`Menu permission created: ${key} by user ${currentUser.username}`);

      return { data: menu };
    } catch (error) {
      strapi.log.error('Error creating menu permission:', error);
      return ctx.internalServerError('Failed to create menu permission');
    }
  },

  /**
   * PUT /api/menu-permissions/:id
   * Update existing menu permission
   * Access: Sysadmin only
   * Note: Cannot update system menus (isSystemMenu = true)
   */
  async update(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || (currentUser.userRole !== 'sysadmin' && !currentUser.isSuperAdmin)) {
      return ctx.unauthorized('Only sysadmin can update menu permissions');
    }

    const { id } = ctx.params;
    const { key, displayName, description, menuIcon, sortOrder, menuCategory } = ctx.request.body;

    if (!id) {
      return ctx.badRequest('Menu permission ID required');
    }

    try {
      // Check if menu exists
      const existingMenu = await strapi.entityService.findOne('api::menu-permission.menu-permission', id);

      if (!existingMenu) {
        return ctx.notFound('Menu permission not found');
      }

      // Prevent updating system menus
      if (existingMenu.isSystemMenu) {
        return ctx.forbidden('Cannot update system menu permissions');
      }

      // Validate menuCategory if provided
      if (menuCategory && !['regular', 'admin'].includes(menuCategory)) {
        return ctx.badRequest('menuCategory must be "regular" or "admin"');
      }

      // Check for duplicate key if changing key
      if (key && key !== existingMenu.key) {
        const duplicate = await strapi.entityService.findMany('api::menu-permission.menu-permission', {
          filters: { key }
        });

        if (duplicate.length > 0) {
          return ctx.badRequest(`Menu permission with key "${key}" already exists`);
        }
      }

      // Build update data
      const updateData: any = {};
      if (key !== undefined) updateData.key = key;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (description !== undefined) updateData.description = description;
      if (menuIcon !== undefined) updateData.menuIcon = menuIcon;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (menuCategory !== undefined) updateData.menuCategory = menuCategory;

      // Update menu permission
      const updatedMenu = await strapi.entityService.update('api::menu-permission.menu-permission', id, {
        data: updateData,
        populate: ['permission_profiles', 'users']
      });

      strapi.log.info(`Menu permission updated: ${updatedMenu.key} by user ${currentUser.username}`);

      return { data: updatedMenu };
    } catch (error) {
      strapi.log.error('Error updating menu permission:', error);
      return ctx.internalServerError('Failed to update menu permission');
    }
  },

  /**
   * DELETE /api/menu-permissions/:id
   * Delete menu permission
   * Access: Sysadmin only
   * Note: Cannot delete system menus (isSystemMenu = true)
   * Note: Checks if menu is assigned to profiles/users before deleting
   */
  async delete(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || (currentUser.userRole !== 'sysadmin' && !currentUser.isSuperAdmin)) {
      return ctx.unauthorized('Only sysadmin can delete menu permissions');
    }

    const { id } = ctx.params;

    if (!id) {
      return ctx.badRequest('Menu permission ID required');
    }

    try {
      // Check if menu exists
      const menu = await strapi.entityService.findOne('api::menu-permission.menu-permission', id, {
        populate: ['permission_profiles', 'users']
      });

      if (!menu) {
        return ctx.notFound('Menu permission not found');
      }

      // Prevent deleting system menus
      if (menu.isSystemMenu) {
        return ctx.forbidden('Cannot delete system menu permissions');
      }

      // Check if menu is assigned to any profiles
      const menuWithRelations = menu as any;
      if (menuWithRelations.permission_profiles && menuWithRelations.permission_profiles.length > 0) {
        return ctx.badRequest(`Cannot delete menu permission - assigned to ${menuWithRelations.permission_profiles.length} profile(s)`);
      }

      // Check if menu is assigned to any users
      if (menuWithRelations.users && menuWithRelations.users.length > 0) {
        return ctx.badRequest(`Cannot delete menu permission - assigned to ${menuWithRelations.users.length} user(s)`);
      }

      // Delete menu permission
      await strapi.entityService.delete('api::menu-permission.menu-permission', id);

      strapi.log.info(`Menu permission deleted: ${menu.key} by user ${currentUser.username}`);

      return { data: { id, key: menu.key, deleted: true } };
    } catch (error) {
      strapi.log.error('Error deleting menu permission:', error);
      return ctx.internalServerError('Failed to delete menu permission');
    }
  }
};
