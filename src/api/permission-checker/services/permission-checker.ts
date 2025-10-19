/**
 * Permission Checker Service
 * Provides helper functions for checking menu access and user permissions
 * Used by controllers and middleware to enforce permission-based access control
 */

/**
 * Check if user has access to a specific menu
 * Permission hierarchy:
 * 1. Super Admins (isSuperAdmin: true) have access to ALL menus
 * 2. Individual menu permissions (individualMenuPermissions) override profile permissions
 * 3. Primary profile menu permissions (primaryProfile.menuPermissions)
 * 4. All assigned profile menu permissions (permissionProfiles[].menuPermissions)
 *
 * @param userId - User ID to check
 * @param menuId - Menu ID to check access for
 * @returns Promise<boolean> - True if user has access, false otherwise
 */
export default () => ({
  async hasMenuAccess(userId: number, menuId: number): Promise<boolean> {
    try {
      // Fetch user with all permission relations
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: [
          'individualMenuPermissions',
          'primaryProfile',
          'primaryProfile.menuPermissions',
          'permissionProfiles',
          'permissionProfiles.menuPermissions'
        ]
      });

      if (!user) {
        strapi.log.warn(`Permission check failed: User ${userId} not found`);
        return false;
      }

      const userWithRelations = user as any;

      // Rule 1: Super admins have access to everything
      if (userWithRelations.isSuperAdmin === true) {
        strapi.log.debug(`User ${userId} is super admin - granted access to menu ${menuId}`);
        return true;
      }

      // Rule 2: Check individual menu permissions (highest priority override)
      const individualMenus = userWithRelations.individualMenuPermissions || [];
      if (individualMenus.some((menu: any) => menu.id === menuId)) {
        strapi.log.debug(`User ${userId} has individual permission for menu ${menuId}`);
        return true;
      }

      // Rule 3: Check primary profile menu permissions
      if (userWithRelations.primaryProfile && userWithRelations.primaryProfile.menuPermissions) {
        const primaryMenus = userWithRelations.primaryProfile.menuPermissions || [];
        if (primaryMenus.some((menu: any) => menu.id === menuId)) {
          strapi.log.debug(`User ${userId} has access via primary profile to menu ${menuId}`);
          return true;
        }
      }

      // Rule 4: Check all assigned profile menu permissions
      const profiles = userWithRelations.permissionProfiles || [];
      for (const profile of profiles) {
        const profileMenus = profile.menuPermissions || [];
        if (profileMenus.some((menu: any) => menu.id === menuId)) {
          strapi.log.debug(`User ${userId} has access via profile "${profile.name}" to menu ${menuId}`);
          return true;
        }
      }

      // No access found
      strapi.log.debug(`User ${userId} does NOT have access to menu ${menuId}`);
      return false;
    } catch (error) {
      strapi.log.error(`Error checking menu access for user ${userId}, menu ${menuId}:`, error);
      return false;
    }
  },

  /**
   * Get all menus accessible to a user
   * Returns deduplicated list of all menus the user can access
   * Useful for building navigation menus and UI access control
   *
   * @param userId - User ID to get menus for
   * @returns Promise<Array<any>> - Array of menu objects user can access
   */
  async getUserMenus(userId: number): Promise<Array<any>> {
    try {
      // Fetch user with basic data first
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['individualMenuPermissions']
      });

      if (!user) {
        strapi.log.warn(`Get menus failed: User ${userId} not found`);
        return [];
      }

      const userWithRelations = user as any;

      // Super admins get ALL menus
      if (userWithRelations.isSuperAdmin === true) {
        const allMenus = await strapi.entityService.findMany('api::menu-permission.menu-permission', {
          sort: { sortOrder: 'asc' }
        });
        strapi.log.debug(`User ${userId} is super admin - returning all ${allMenus.length} menus`);
        return allMenus;
      }

      // Collect menus from all sources using Set for deduplication
      const menuMap = new Map();

      // Collect individual menu permissions
      const individualMenus = userWithRelations.individualMenuPermissions || [];
      individualMenus.forEach((menu: any) => {
        if (menu && menu.id) {
          menuMap.set(menu.id, menu);
        }
      });

      // WORKAROUND for Strapi 5 Bug: Use direct SQL to fetch from join table
      // The primaryProfile populate is broken in Strapi 5 for relations to same table
      const sqlResult = await strapi.db.connection.raw(
        'SELECT permission_profile_id FROM up_users_primary_profile_lnk WHERE user_id = ?',
        [userId]
      );

      // Handle PostgreSQL .rows format
      const rows = sqlResult.rows || sqlResult;
      const primaryProfileId = rows && rows[0] && rows[0].permission_profile_id;
      strapi.log.info(`[PERMISSION CHECKER] User ${userId} primary_profile_id from join table: ${primaryProfileId}`);

      // Collect primary profile menus if exists
      if (primaryProfileId) {
        try {
          const primaryProfile = await strapi.entityService.findOne(
            'api::permission-profile.permission-profile',
            primaryProfileId,
            { populate: ['menuPermissions'] }
          ) as any; // Cast to any - TypeScript doesn't know about populated relations

          if (primaryProfile && primaryProfile.menuPermissions) {
            const primaryMenus = primaryProfile.menuPermissions || [];
            strapi.log.info(`[PERMISSION CHECKER] Primary profile "${primaryProfile.name}" has ${primaryMenus.length} menus`);
            primaryMenus.forEach((menu: any) => {
              if (menu && menu.id) {
                menuMap.set(menu.id, menu);
              }
            });
          }
        } catch (error) {
          strapi.log.error(`[PERMISSION CHECKER] Error fetching primary profile ${primaryProfileId}:`, error);
        }
      } else {
        strapi.log.info(`[PERMISSION CHECKER] User ${userId} has no primary profile`);
      }

      // NOTE: Intentionally NOT collecting from permissionProfiles (many-to-many relation)
      // Only primary profile is used for menu permissions in Phase 6 design
      // Individual menu permissions can supplement/override primary profile

      // Convert map to array and sort by sortOrder
      const menus = Array.from(menuMap.values()).sort((a: any, b: any) => {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });

      strapi.log.info(`[PERMISSION CHECKER] User ${userId} has access to ${menus.length} menus total`);
      return menus;
    } catch (error) {
      strapi.log.error(`Error getting menus for user ${userId}:`, error);
      return [];
    }
  },

  /**
   * Check if it's safe to remove super admin status from a user
   * Prevents removing the last super admin from the system
   *
   * @param userId - User ID to check
   * @returns Promise<{ canRemove: boolean, reason: string, totalSuperAdmins: number }>
   */
  async canRemoveSuperAdmin(userId: number): Promise<{
    canRemove: boolean;
    reason: string;
    totalSuperAdmins: number;
  }> {
    try {
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId }
      });

      if (!user) {
        return {
          canRemove: false,
          reason: 'User not found',
          totalSuperAdmins: 0
        };
      }

      const userWithFields = user as any;

      if (!userWithFields.isSuperAdmin) {
        return {
          canRemove: false,
          reason: 'User is not a super admin',
          totalSuperAdmins: 0
        };
      }

      // Count total super admins
      const superAdminCount = await strapi.db.query('plugin::users-permissions.user').count({
        where: { is_super_admin: true }
      });

      const canRemove = superAdminCount > 1;

      return {
        canRemove,
        reason: canRemove ? 'Multiple super admins exist' : 'This is the last super admin',
        totalSuperAdmins: superAdminCount
      };
    } catch (error) {
      strapi.log.error(`Error checking if super admin can be removed for user ${userId}:`, error);
      return {
        canRemove: false,
        reason: 'Error checking super admin status',
        totalSuperAdmins: 0
      };
    }
  },

  /**
   * Check if user has a specific permission profile assigned
   *
   * @param userId - User ID to check
   * @param profileId - Profile ID to check
   * @returns Promise<boolean> - True if user has profile, false otherwise
   */
  async hasProfile(userId: number, profileId: number): Promise<boolean> {
    try {
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['permissionProfiles']
      });

      if (!user) {
        return false;
      }

      const userWithRelations = user as any;
      const profiles = userWithRelations.permissionProfiles || [];
      return profiles.some((profile: any) => profile.id === profileId);
    } catch (error) {
      strapi.log.error(`Error checking profile ${profileId} for user ${userId}:`, error);
      return false;
    }
  },

  /**
   * Get user's primary profile
   *
   * @param userId - User ID to check
   * @returns Promise<any | null> - Primary profile object or null
   */
  async getPrimaryProfile(userId: number): Promise<any | null> {
    try {
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['primaryProfile', 'primaryProfile.menuPermissions']
      });

      if (!user) {
        return null;
      }

      const userWithRelations = user as any;
      return userWithRelations.primaryProfile || null;
    } catch (error) {
      strapi.log.error(`Error getting primary profile for user ${userId}:`, error);
      return null;
    }
  },

  /**
   * Get all profiles assigned to a user
   *
   * @param userId - User ID to check
   * @returns Promise<Array<any>> - Array of profile objects
   */
  async getUserProfiles(userId: number): Promise<Array<any>> {
    try {
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: ['permissionProfiles', 'permissionProfiles.menuPermissions']
      });

      if (!user) {
        return [];
      }

      const userWithRelations = user as any;
      return userWithRelations.permissionProfiles || [];
    } catch (error) {
      strapi.log.error(`Error getting profiles for user ${userId}:`, error);
      return [];
    }
  }
});
