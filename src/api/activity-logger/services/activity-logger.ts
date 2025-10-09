/**
 * Activity Logger Service
 * Central service for logging user activities and login attempts
 */

type ActivityType =
  | 'login'
  | 'logout'
  | 'password_change'
  | 'profile_update'
  | 'permission_change'
  | 'page_visit'
  | 'failed_access'
  | 'account_status_change'
  | 'user_created'
  | 'user_deleted'
  | 'profile_assigned'
  | 'profile_removed'
  | 'permission_profile_created'
  | 'permission_profile_updated'
  | 'permission_profile_deleted'
  | 'email_changed'
  | 'username_changed'
  | 'avatar_changed';

interface ActivityDetails {
  [key: string]: any;
}

interface LoginDetails {
  success: boolean;
  failureReason?: string;
}

export default () => ({
  /**
   * Log a user activity
   */
  async logActivity(
    userId: number,
    activityType: ActivityType,
    details?: ActivityDetails,
    ctx?: any
  ) {
    try {
      // REMOVED FOR PRODUCTION: console.log(`[Activity Logger] Attempting to log ${activityType} for user ${userId}`);
      const ipAddress = ctx?.request?.ip || ctx?.ip || 'unknown';
      const userAgent = ctx?.request?.header?.['user-agent'] || 'unknown';

      const result = await strapi.entityService.create('api::user-activity-log.user-activity-log', {
        data: {
          user: userId,
          activityType,
          details: details || {},
          ipAddress,
          userAgent,
          isRead: false
        }
      });

      // REMOVED FOR PRODUCTION: console.log(`[Activity Logger] Successfully logged ${activityType} for user ${userId}`, result);
      strapi.log.debug(`Activity logged: ${activityType} for user ${userId}`);
    } catch (error) {
      console.error(`[Activity Logger] Error logging ${activityType} for user ${userId}:`, error);
      strapi.log.error('Failed to log activity:', error);
    }
  },

  /**
   * Log a login attempt
   */
  async logLogin(
    userId: number,
    details: LoginDetails,
    ctx?: any
  ) {
    try {
      const ipAddress = ctx?.request?.ip || ctx?.ip || 'unknown';
      const userAgent = ctx?.request?.header?.['user-agent'] || 'unknown';

      await strapi.entityService.create('api::login-history.login-history', {
        data: {
          user: userId,
          loginTime: new Date(),
          ipAddress,
          userAgent,
          success: details.success,
          failureReason: details.failureReason || null
        }
      });

      strapi.log.debug(`Login logged: ${details.success ? 'Success' : 'Failed'} for user ${userId}`);
    } catch (error) {
      strapi.log.error('Failed to log login:', error);
    }
  },

  /**
   * Log a logout
   */
  async logLogout(userId: number, loginHistoryId?: number) {
    try {
      if (loginHistoryId) {
        // Update existing login history record with logout time
        await strapi.entityService.update('api::login-history.login-history', loginHistoryId, {
          data: {
            logoutTime: new Date()
          }
        });
      }

      // Also log as activity
      await this.logActivity(userId, 'logout', { timestamp: new Date() });

      strapi.log.debug(`Logout logged for user ${userId}`);
    } catch (error) {
      strapi.log.error('Failed to log logout:', error);
    }
  }
});
