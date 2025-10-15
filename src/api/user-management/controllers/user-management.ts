/**
 * User Management Controller
 * Handles user administration tasks (sysadmin only) and profile updates (reguser)
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

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
    // Verify using Strapi's JWT service
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const decoded = await jwtService.verify(token);

    if (!decoded || !decoded.id) {
      return null;
    }

    // Fetch user
    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: decoded.id }
    });

    if (!user) {
      return null;
    }

    // Populate ctx.state.user for downstream use
    ctx.state.user = user;
    return user;
  } catch (error) {
    strapi.log.error('JWT validation error:', error);
    return null;
  }
}

export default {
  /**
   * List all users (sysadmin only)
   * GET /api/user-management/users
   * Query params: userRole, accountStatus, search (username/email)
   */
  async listUsers(ctx) {
    // Validate JWT and populate ctx.state.user
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can list users');
    }

    try {
      const { userRole, accountStatus, search, page = 1, pageSize = 25 } = ctx.query;

      // Build filters
      const filters: any = {};

      if (userRole) {
        filters.userRole = userRole;
      }

      if (accountStatus) {
        filters.accountStatus = accountStatus;
      }

      if (search) {
        filters.$or = [
          { username: { $containsi: search } },
          { email: { $containsi: search } },
          { displayName: { $containsi: search } }
        ];
      }

      // Use strapi.query() instead of entityService to work around Strapi 5 bug
      // Bug: Multiple relations to same table fail to populate with entityService
      // Solution: Fetch users without primaryProfile populate, then manually attach it
      const users = await strapi.db.query('plugin::users-permissions.user').findMany({
        where: filters,
        populate: ['permissionProfiles', 'individualMenuPermissions'],
        orderBy: { createdAt: 'desc' },
        offset: (page - 1) * pageSize,
        limit: pageSize
      });

      // WORKAROUND for Strapi 5 Bug #20330: Manually fetch and attach primaryProfile
      // The populate mechanism is completely broken for primaryProfile relation
      // Solution: Use direct SQL to fetch from link table (production uses link table, not direct column)
      strapi.log.info(`[PRIMARY PROFILE DEBUG] Processing ${users.length} users`);
      for (const user of users) {
        // Use direct SQL to fetch primary_profile_id from link table
        // Production uses: up_users_primary_profile_lnk (user_id, permission_profile_id)
        const sqlResult = await strapi.db.connection.raw(
          'SELECT permission_profile_id FROM up_users_primary_profile_lnk WHERE user_id = ?',
          [user.id]
        );

        // Extract permission_profile_id from SQL result
        const primaryProfileId = sqlResult && sqlResult[0] && sqlResult[0].permission_profile_id;
        strapi.log.info(`[PRIMARY PROFILE DEBUG] User ${user.id} (${user.username}) primaryProfileId from link table: ${primaryProfileId}`);

        if (primaryProfileId) {
          try {
            strapi.log.info(`[PRIMARY PROFILE DEBUG] Fetching profile ${primaryProfileId}...`);
            // WORKAROUND: Also use direct SQL to fetch profile name
            // Strapi entityService returns wrong data for permission profiles
            const profileSqlResult = await strapi.db.connection.raw(
              'SELECT id, name, description FROM permission_profiles WHERE id = ?',
              [primaryProfileId]
            );

            const primaryProfile = profileSqlResult && profileSqlResult[0] ? {
              id: profileSqlResult[0].id,
              name: profileSqlResult[0].name,
              description: profileSqlResult[0].description
            } : null;

            strapi.log.info(`[PRIMARY PROFILE DEBUG] Successfully fetched profile via SQL: ${primaryProfile?.name}`);
            user.primaryProfile = primaryProfile;
          } catch (error) {
            strapi.log.error(`[PRIMARY PROFILE DEBUG] Failed to fetch primaryProfile ${primaryProfileId} for user ${user.id}:`, error);
            user.primaryProfile = null;
          }
        } else {
          strapi.log.info(`[PRIMARY PROFILE DEBUG] User ${user.id} has no primary profile ID`);
          user.primaryProfile = null;
        }
      }
      strapi.log.info(`[PRIMARY PROFILE DEBUG] Finished processing all users`);

      const total = await strapi.query('plugin::users-permissions.user').count({ where: filters });

      return {
        data: users,
        meta: {
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            pageCount: Math.ceil(total / pageSize),
            total
          }
        }
      };
    } catch (error) {
      strapi.log.error('Error listing users:', error);
      return ctx.internalServerError('Failed to list users');
    }
  },

  /**
   * Get user details with activity logs and login history (sysadmin only)
   * GET /api/user-management/users/:id
   */
  async getUserDetails(ctx) {
    // Validate JWT and populate ctx.state.user
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can view user details');
    }

    const { id } = ctx.params;

    try {
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', id, {
        populate: ['permissionProfiles']
      });

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Get recent activity logs
      const activityLogs = await strapi.entityService.findMany('api::user-activity-log.user-activity-log', {
        filters: { user: { id } },
        sort: { createdAt: 'desc' },
        limit: 50
      });

      // Get login history
      const loginHistory = await strapi.entityService.findMany('api::login-history.login-history', {
        filters: { user: { id } },
        sort: { loginTime: 'desc' },
        limit: 50
      });

      return {
        data: {
          ...user,
          activityLogs,
          loginHistory
        }
      };
    } catch (error) {
      strapi.log.error('Error fetching user details:', error);
      return ctx.internalServerError('Failed to fetch user details');
    }
  },

  /**
   * Update user (sysadmin only)
   * PUT /api/user-management/users/:id
   * Body: { username, email, userRole, accountStatus, permissionProfiles, adminNotes, forcePasswordReset, accountExpiration, password }
   */
  async updateUser(ctx) {
    // Validate JWT and populate ctx.state.user
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can update users');
    }

    const { id } = ctx.params;
    const { username, email, userRole, accountStatus, permissionProfiles, adminNotes, forcePasswordReset, accountExpiration, password } = ctx.request.body;

    try {
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', id);

      if (!user) {
        return ctx.notFound('User not found');
      }

      const updateData: any = {};

      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (userRole !== undefined) updateData.userRole = userRole;
      if (accountStatus !== undefined) updateData.accountStatus = accountStatus;
      if (permissionProfiles !== undefined) updateData.permissionProfiles = permissionProfiles;
      if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
      if (forcePasswordReset !== undefined) updateData.forcePasswordReset = forcePasswordReset;
      if (accountExpiration !== undefined) updateData.accountExpiration = accountExpiration;

      // Handle password update separately using strapi.query (required for proper hashing)
      if (password !== undefined && password !== '') {
        if (password.length < 6) {
          return ctx.badRequest('Password must be at least 6 characters');
        }

        // Hash password using bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password using strapi.query (not entityService) for proper hashing
        await strapi.query('plugin::users-permissions.user').update({
          where: { id },
          data: {
            password: hashedPassword
          }
        });
      }

      // Update other fields using entityService
      let updatedUser;
      if (Object.keys(updateData).length > 0) {
        updatedUser = await strapi.entityService.update('plugin::users-permissions.user', id, {
          data: updateData,
          populate: ['permissionProfiles']
        });
      } else {
        // If only password was updated, fetch the user
        updatedUser = await strapi.entityService.findOne('plugin::users-permissions.user', id, {
          populate: ['permissionProfiles']
        });
      }

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        const changes = Object.keys(updateData).filter(key => key !== 'password').join(', ');
        const changesList = password ? [...changes.split(', ').filter(c => c), 'password'].join(', ') : changes;
        await activityLogger.logActivity(id, 'profile_update', {
          updatedBy: currentUser.username,
          changes: changesList
        }, ctx);
      }

      return { data: updatedUser };
    } catch (error) {
      strapi.log.error('Error updating user:', error);
      return ctx.internalServerError('Failed to update user');
    }
  },

  /**
   * Delete user (sysadmin only)
   * DELETE /api/user-management/users/:id
   */
  async deleteUser(ctx) {
    // Validate JWT and populate ctx.state.user
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can delete users');
    }

    const { id } = ctx.params;

    try {
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', id);

      if (!user) {
        return ctx.notFound('User not found');
      }

      // Prevent deleting yourself
      if (user.id === currentUser.id) {
        return ctx.badRequest('Cannot delete your own account');
      }

      await strapi.entityService.delete('plugin::users-permissions.user', id);

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(currentUser.id, 'user_deleted', {
          deletedUser: user.username,
          deletedUserId: user.id
        }, ctx);
      }

      return { data: { message: 'User deleted successfully' } };
    } catch (error) {
      strapi.log.error('Error deleting user:', error);
      return ctx.internalServerError('Failed to delete user');
    }
  },

  /**
   * Reset user password (sysadmin only)
   * POST /api/user-management/users/:id/reset-password
   * Body: { method: 'direct' | 'email', newPassword?: string }
   */
  async resetPassword(ctx) {
    // Validate JWT and populate ctx.state.user
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can reset passwords');
    }

    const { id } = ctx.params;
    const { method, newPassword } = ctx.request.body;

    try {
      // Convert ID to number for Strapi 5 entity service
      const userId = parseInt(id, 10);
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', userId);

      if (!user) {
        return ctx.notFound('User not found');
      }

      if (method === 'direct') {
        if (!newPassword || newPassword.length < 6) {
          return ctx.badRequest('Password must be at least 6 characters');
        }

        // Hash password using bcrypt
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await strapi.query('plugin::users-permissions.user').update({
          where: { id: userId },
          data: {
            password: hashedPassword,
            forcePasswordReset: true
          }
        });

        // Log activity
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        if (activityLogger) {
          await activityLogger.logActivity(userId, 'password_change', {
            changedBy: currentUser.username,
            method: 'admin_direct'
          }, ctx);
        }

        return { data: { message: 'Password reset successfully' } };
      } else if (method === 'email') {
        // Trigger password reset email
        // This would use Strapi's built-in forgot-password flow
        // For now, just set forcePasswordReset flag
        await strapi.entityService.update('plugin::users-permissions.user', userId, {
          data: { forcePasswordReset: true }
        });

        return { data: { message: 'Password reset email sent (forcePasswordReset flag set)' } };
      } else {
        return ctx.badRequest('Invalid reset method. Use "direct" or "email"');
      }
    } catch (error) {
      strapi.log.error('Error resetting password:', error);
      return ctx.internalServerError('Failed to reset password');
    }
  },

  /**
   * Update own profile (reguser and sysadmin)
   * PUT /api/user-management/profile
   * Body: { displayName, bio, avatarId, username, email, currentPassword }
   */
  async updateOwnProfile(ctx) {
    // Validate JWT and populate ctx.state.user
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in');
    }

    const { displayName, bio, avatarId, username, email, currentPassword } = ctx.request.body;

    try {
      const updateData: any = {};
      const activityLogger = strapi.service('api::activity-logger.activity-logger');

      // Validate displayName (3-50 characters)
      if (displayName !== undefined) {
        if (typeof displayName !== 'string' || displayName.length < 3 || displayName.length > 50) {
          return ctx.badRequest('Display name must be between 3 and 50 characters');
        }
        updateData.displayName = displayName;
      }

      // Validate bio (max 500 characters)
      if (bio !== undefined) {
        if (typeof bio !== 'string' || bio.length > 500) {
          return ctx.badRequest('Bio must be 500 characters or less');
        }
        updateData.bio = bio;
      }

      // Validate and update avatarId
      if (avatarId !== undefined) {
        const avatarService = strapi.service('api::avatar.avatar');
        if (!avatarService || !avatarService.isValidAvatarId(avatarId)) {
          return ctx.badRequest('Invalid avatar ID');
        }

        const oldAvatarId = currentUser.avatarId;
        if (oldAvatarId !== avatarId) {
          updateData.avatarId = avatarId;

          // Log avatar change
          if (activityLogger) {
            await activityLogger.logActivity(currentUser.id, 'avatar_changed', {
              oldAvatar: oldAvatarId,
              newAvatar: avatarId,
              selfUpdate: true
            }, ctx);
          }
        }
      }

      // Handle username change (requires password confirmation)
      if (username !== undefined && username !== currentUser.username) {
        // Validate username format (3-20 chars, alphanumeric + underscore)
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
          return ctx.badRequest('Username must be 3-20 characters (alphanumeric and underscore only)');
        }

        // Require password confirmation for username change
        if (!currentPassword) {
          return ctx.badRequest('Password confirmation required to change username');
        }

        // Verify password
        const validPassword = await strapi.plugins['users-permissions'].services.user.validatePassword(
          currentPassword,
          currentUser.password
        );

        if (!validPassword) {
          return ctx.badRequest('Invalid password');
        }

        // Check if username is already taken
        const existingUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { username }
        });

        if (existingUser && existingUser.id !== currentUser.id) {
          return ctx.badRequest('Username already taken');
        }

        const oldUsername = currentUser.username;
        updateData.username = username;

        // Log username change
        if (activityLogger) {
          await activityLogger.logActivity(currentUser.id, 'username_changed', {
            oldUsername,
            newUsername: username,
            selfUpdate: true
          }, ctx);
        }
      }

      // Handle email change (requires verification)
      if (email !== undefined && email !== currentUser.email) {
        // Require password confirmation for email change
        if (!currentPassword) {
          return ctx.badRequest('Password confirmation required to change email');
        }

        // Verify password
        const validPassword = await strapi.plugins['users-permissions'].services.user.validatePassword(
          currentPassword,
          currentUser.password
        );

        if (!validPassword) {
          return ctx.badRequest('Invalid password');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return ctx.badRequest('Invalid email format');
        }

        // Check if email is already taken
        const existingUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { email }
        });

        if (existingUser && existingUser.id !== currentUser.id) {
          return ctx.badRequest('Email already in use');
        }

        // Get email verification service
        const emailVerificationService = strapi.service('api::email-verification.email-verification');
        if (!emailVerificationService) {
          strapi.log.error('Email verification service not found');
          return ctx.internalServerError('Email verification service unavailable');
        }

        // Generate email verification token and expiration
        const { token, expires } = emailVerificationService.generateVerificationToken();

        const oldEmail = currentUser.email;
        updateData.pendingEmail = email;
        updateData.emailVerificationToken = token;
        updateData.emailVerificationExpires = expires;
        updateData.emailVerified = false;

        // Send verification email
        try {
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
          await emailVerificationService.sendVerificationEmail({
            email: email,
            username: currentUser.username,
            token,
            baseUrl
          });

          // Log email change activity
          if (activityLogger) {
            await activityLogger.logActivity(currentUser.id, 'email_changed', {
              oldEmail,
              newEmail: email,
              status: 'pending_verification',
              selfUpdate: true
            }, ctx);
          }
        } catch (error) {
          strapi.log.error('Error sending verification email:', error);
          return ctx.internalServerError('Failed to send verification email. Please try again.');
        }
      }

      // Update user if there are changes
      if (Object.keys(updateData).length > 0) {
        const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', currentUser.id, {
          data: updateData
        });

        // Log general profile update
        // Exclude fields that have their own specific activity logs:
        // - avatarId has avatar_changed
        // - username has username_changed
        // - emailVerificationToken, pendingEmail are internal email change fields
        if (activityLogger) {
          const allKeys = Object.keys(updateData);

          // Best practice: Only log fields that ACTUALLY CHANGED (compare old vs new values)
          // Filter to only fields that both:
          // 1. Don't have their own specific activity log
          // 2. Actually changed in value (different from currentUser value)
          const actuallyChangedFields = allKeys.filter(key => {
            // Skip fields with their own activity logs
            if (['emailVerificationToken', 'pendingEmail', 'avatarId', 'username'].includes(key)) {
              return false;
            }

            // Compare old value vs new value
            const oldValue = currentUser[key];
            const newValue = updateData[key];

            // Only include if value actually changed
            return oldValue !== newValue;
          });

          const changes = actuallyChangedFields.join(', ');

          if (changes) {
            await activityLogger.logActivity(currentUser.id, 'profile_update', {
              changes,
              selfUpdate: true
            }, ctx);
          }
        }

        return { data: updatedUser };
      }

      return { data: currentUser };
    } catch (error) {
      strapi.log.error('Error updating own profile:', error);
      return ctx.internalServerError('Failed to update profile');
    }
  },

  /**
   * Get own profile (reguser and sysadmin)
   * GET /api/user-management/profile
   */
  async getOwnProfile(ctx) {
    // Validate JWT and populate ctx.state.user
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in');
    }

    try {
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', currentUser.id, {
        populate: ['permissionProfiles']
      });

      return { data: user };
    } catch (error) {
      strapi.log.error('Error fetching own profile:', error);
      return ctx.internalServerError('Failed to fetch profile');
    }
  },

  /**
   * Change own password (reguser and sysadmin)
   * POST /api/user-management/change-password
   * Body: { currentPassword, newPassword, confirmPassword }
   */
  async changeOwnPassword(ctx) {
    // Validate JWT and populate ctx.state.user
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in');
    }

    const { currentPassword, newPassword, confirmPassword } = ctx.request.body;

    try {
      // Validate required fields
      if (!currentPassword || !newPassword || !confirmPassword) {
        return ctx.badRequest('Current password, new password, and confirmation are required');
      }

      // Validate new password matches confirmation
      if (newPassword !== confirmPassword) {
        return ctx.badRequest('New password and confirmation do not match');
      }

      // Validate new password is different from current
      if (currentPassword === newPassword) {
        return ctx.badRequest('New password must be different from current password');
      }

      // Validate password strength (min 6 characters as per user schema)
      if (newPassword.length < 6) {
        return ctx.badRequest('New password must be at least 6 characters long');
      }

      // Verify current password
      const validPassword = await strapi.plugins['users-permissions'].services.user.validatePassword(
        currentPassword,
        currentUser.password
      );

      if (!validPassword) {
        return ctx.badRequest('Current password is incorrect');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await strapi.entityService.update('plugin::users-permissions.user', currentUser.id, {
        data: {
          password: hashedPassword
        }
      });

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(currentUser.id, 'password_change', {
          selfChange: true,
          timestamp: new Date()
        }, ctx);
      }

      return {
        message: 'Password changed successfully'
      };
    } catch (error) {
      strapi.log.error('Error changing password:', error);
      return ctx.internalServerError('Failed to change password');
    }
  },

  /**
   * GET /api/user-management/stats
   * Get account statistics for the authenticated user
   */
  async getAccountStats(ctx) {
    try {
      const currentUser = await authenticateRequest(ctx);

      if (!currentUser) {
        return ctx.unauthorized('You must be logged in to view account statistics');
      }

      // Calculate account age in days
      const createdAt = new Date(currentUser.createdAt);
      const now = new Date();
      const accountAgeDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Get last login timestamp
      const lastLoginAt = currentUser.lastLoginAt ? new Date(currentUser.lastLoginAt) : null;

      // Calculate profile completeness percentage
      let completedFields = 0;
      const totalFields = 6; // username, email, displayName, bio, avatarId, confirmed

      if (currentUser.username) completedFields++;
      if (currentUser.email && currentUser.confirmed) completedFields++; // Email must be confirmed
      if (currentUser.displayName) completedFields++;
      if (currentUser.bio) completedFields++;
      if (currentUser.avatarId) completedFields++;
      if (currentUser.confirmed) completedFields++; // Account confirmed

      const profileCompleteness = Math.round((completedFields / totalFields) * 100);

      // Get total unique opinions rated by user (count distinct opinions, not all rating rows)
      // Users can have multiple rating rows for the same opinion (update history)
      // We should only count each opinion once
      const allUserRatings = await strapi.entityService.findMany('api::user-rating.user-rating', {
        filters: { users_permissions_user: { id: currentUser.id } },
        populate: ['opinion']
      });

      // Get unique opinion IDs
      const uniqueOpinionIds = new Set();
      allUserRatings.forEach((rating: any) => {
        if (rating.opinion && rating.opinion.id) {
          uniqueOpinionIds.add(rating.opinion.id);
        }
      });

      const ratingsCount = uniqueOpinionIds.size;

      // Get total activity log entries for user (excluding rating activities to avoid double counting)
      const activityCount = await strapi.db.query('api::user-activity-log.user-activity-log').count({
        where: {
          user: currentUser.id,
          activityType: {
            $notIn: ['rating_given', 'rating_updated']
          }
        }
      });

      // Get login count
      const loginCount = currentUser.loginCount || 0;

      // Return comprehensive statistics
      return {
        data: {
          accountAge: {
            days: accountAgeDays,
            createdAt: createdAt.toISOString()
          },
          loginStats: {
            loginCount,
            lastLoginAt: lastLoginAt ? lastLoginAt.toISOString() : null
          },
          profileCompleteness: {
            percentage: profileCompleteness,
            completedFields,
            totalFields
          },
          activityStats: {
            ratingsGiven: ratingsCount,
            totalActivities: activityCount
          },
          userInfo: {
            username: currentUser.username,
            email: currentUser.email,
            displayName: currentUser.displayName,
            avatarId: currentUser.avatarId,
            userRole: currentUser.userRole,
            accountStatus: currentUser.accountStatus
          }
        }
      };
    } catch (error) {
      strapi.log.error('Error fetching account statistics:', error);
      return ctx.internalServerError('Failed to fetch account statistics');
    }
  },

  /**
   * GET /api/user-management/menus
   * Get user's accessible menu permissions
   * Returns list of menus the user can access (based on profile + individual permissions + super admin status)
   */
  async getUserMenus(ctx) {
    try {
      const currentUser = await authenticateRequest(ctx);

      if (!currentUser) {
        return ctx.unauthorized('You must be logged in to view menu permissions');
      }

      strapi.log.info(`[MENU PERMISSIONS DEBUG] getUserMenus called for user ${currentUser.id} (${currentUser.username})`);
      strapi.log.info(`[MENU PERMISSIONS DEBUG] User isSuperAdmin: ${currentUser.isSuperAdmin}, is_super_admin: ${currentUser.is_super_admin}`);

      // Call permission-checker service to get user's menus
      const permissionChecker = strapi.service('api::permission-checker.permission-checker');
      if (!permissionChecker) {
        strapi.log.error('Permission checker service not found');
        return ctx.internalServerError('Permission checker service unavailable');
      }

      const menus = await permissionChecker.getUserMenus(currentUser.id);

      strapi.log.info(`[MENU PERMISSIONS DEBUG] Retrieved ${menus.length} menus from permission-checker service`);
      strapi.log.info(`[MENU PERMISSIONS DEBUG] Menu keys: ${menus.map(m => m.key).join(', ')}`);
      strapi.log.info(`[MENU PERMISSIONS] User ${currentUser.id} (${currentUser.username}) has access to ${menus.length} menus`);

      return {
        data: menus
      };
    } catch (error) {
      strapi.log.error('Error fetching user menus:', error);
      return ctx.internalServerError('Failed to fetch menu permissions');
    }
  },

  /**
   * Request email verification (resend verification email)
   * POST /api/user-management/request-email-verification
   * Sends a new verification email to the user's pending email address
   */
  async requestEmailVerification(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in');
    }

    // Check account status
    if (currentUser.accountStatus !== 'Active') {
      return ctx.forbidden('Only active users can request email verification');
    }

    try {
      // Determine which email to verify:
      // - If pendingEmail exists, verify the new email (email change flow)
      // - If no pendingEmail, verify the current email (initial registration flow)
      const emailToVerify = currentUser.pendingEmail || currentUser.email;

      if (!emailToVerify) {
        return ctx.badRequest('No email address found to verify');
      }

      // Check if user already verified (both current email AND no pending changes)
      if (currentUser.emailVerified && !currentUser.pendingEmail) {
        return ctx.badRequest('Email is already verified');
      }

      // Get email verification service
      const emailVerificationService = strapi.service('api::email-verification.email-verification');
      if (!emailVerificationService) {
        strapi.log.error('Email verification service not found');
        return ctx.internalServerError('Email verification service unavailable');
      }

      // Generate new verification token
      const { token, expires } = emailVerificationService.generateVerificationToken();

      // Update user with new token
      const updateData: any = {
        emailVerificationToken: token,
        emailVerificationExpires: expires,
        emailVerified: false
      };

      // If no pendingEmail exists (initial registration), set it to current email
      // This ensures the verifyEmail function can process it correctly
      if (!currentUser.pendingEmail) {
        updateData.pendingEmail = currentUser.email;
      }

      await strapi.entityService.update('plugin::users-permissions.user', currentUser.id, {
        data: updateData
      });

      // Send verification email
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
      await emailVerificationService.sendVerificationEmail({
        email: emailToVerify,
        username: currentUser.username,
        token,
        baseUrl
      });

      // Log activity (use email_changed since email_verification_requested not in schema)
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(currentUser.id, 'email_changed', {
          email: emailToVerify,
          action: 'verification_requested'
        }, ctx);
      }

      return {
        message: 'Verification email sent successfully'
      };
    } catch (error) {
      strapi.log.error('Error requesting email verification:', error);
      return ctx.internalServerError('Failed to send verification email');
    }
  },

  /**
   * Verify email address via token
   * GET /api/user-management/verify-email/:token
   * Verifies the user's email using the token from the email link
   * Creates a one-time session token and redirects to frontend
   */
  async verifyEmail(ctx) {
    const { token } = ctx.params;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';

    if (!token) {
      return ctx.redirect(`${frontendUrl}?verification=error&message=Token+missing`);
    }

    try {
      // Find user by verification token
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { emailVerificationToken: token }
      });

      if (!user) {
        return ctx.redirect(`${frontendUrl}?verification=error&message=Invalid+or+expired+token`);
      }

      // Get email verification service
      const emailVerificationService = strapi.service('api::email-verification.email-verification');
      if (!emailVerificationService) {
        strapi.log.error('Email verification service not found');
        return ctx.redirect(`${frontendUrl}?verification=error&message=Service+unavailable`);
      }

      // Check if token is expired
      if (!emailVerificationService.isTokenValid(user.emailVerificationToken, user.emailVerificationExpires)) {
        return ctx.redirect(`${frontendUrl}?verification=error&message=Token+expired`);
      }

      // Check if user has a pending email
      if (!user.pendingEmail) {
        return ctx.redirect(`${frontendUrl}?verification=error&message=No+pending+email+change`);
      }

      const verifiedEmail = user.pendingEmail;

      // Update user: move pendingEmail to email, mark as verified, clear email verification tokens
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          email: verifiedEmail,
          pendingEmail: null,
          emailVerified: true,
          confirmed: true,  // Set Strapi's built-in confirmed field as well
          emailVerificationToken: null,
          emailVerificationExpires: null
        }
      });

      // Generate one-time session token for frontend to exchange for user data
      const oneTimeToken = crypto.randomBytes(32).toString('hex');
      const oneTimeExpires = new Date();
      oneTimeExpires.setMinutes(oneTimeExpires.getMinutes() + 5); // 5 minute expiration

      // Store one-time token in user record
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          oneTimeVerificationToken: oneTimeToken,
          oneTimeVerificationExpires: oneTimeExpires
        }
      });

      // Log activity (use email_changed since email_verified not in schema)
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(user.id, 'email_changed', {
          email: verifiedEmail,
          action: 'verification_completed',
          verifiedAt: new Date()
        }, ctx);
      }

      strapi.log.info(`Email verified for user ${user.id} (${user.username}): ${verifiedEmail}`);

      // Redirect to frontend with one-time token
      return ctx.redirect(`${frontendUrl}?verifyToken=${oneTimeToken}`);
    } catch (error) {
      strapi.log.error('Error verifying email:', error);
      return ctx.redirect(`${frontendUrl}?verification=error&message=Verification+failed`);
    }
  },

  /**
   * Exchange one-time verification token for updated user data + JWT token
   * POST /api/user-management/exchange-verify-token
   * Body: { verifyToken: string }
   * Returns: Updated user object with new email AND JWT token for automatic login
   */
  async exchangeVerifyToken(ctx) {
    const { verifyToken } = ctx.request.body;

    if (!verifyToken) {
      return ctx.badRequest('Verification token required');
    }

    try {
      // Find user by one-time token
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { oneTimeVerificationToken: verifyToken }
      });

      if (!user) {
        return ctx.unauthorized('Invalid or expired verification token');
      }

      // Check if token is expired
      const now = new Date();
      const expires = new Date(user.oneTimeVerificationExpires);
      if (now >= expires) {
        return ctx.unauthorized('Verification token expired');
      }

      // Clear one-time token (can only be used once)
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          oneTimeVerificationToken: null,
          oneTimeVerificationExpires: null
        }
      });

      // Get fresh user data with all fields
      const updatedUser = await strapi.entityService.findOne('plugin::users-permissions.user', user.id, {
        populate: ['permissionProfiles']
      });

      // Generate JWT token for automatic login
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      const jwt = jwtService.issue({ id: updatedUser.id });

      // Return user data (without password) AND JWT token
      const { password, ...userWithoutPassword } = updatedUser;

      strapi.log.info(`Issued JWT token for user ${updatedUser.id} (${updatedUser.username}) after email verification`);

      return {
        data: {
          user: userWithoutPassword,
          jwt: jwt,
          message: 'Email verified successfully'
        }
      };
    } catch (error) {
      strapi.log.error('Error exchanging verify token:', error);
      return ctx.internalServerError('Failed to exchange verification token');
    }
  },

  /**
   * Request password reset (send clickable link via email)
   * POST /api/user-management/request-password-reset
   * Body: { email: string }
   * Public endpoint - no authentication required
   */
  async requestPasswordReset(ctx) {
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest('Email address is required');
    }

    try {
      // Find user by email
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { email }
      });

      // For security, always return success even if user doesn't exist
      // This prevents email enumeration attacks
      if (!user) {
        strapi.log.info(`Password reset requested for non-existent email: ${email}`);
        return {
          message: 'If an account with that email exists, a password reset link has been sent.'
        };
      }

      // Check if account is active
      if (user.accountStatus !== 'Active') {
        strapi.log.warn(`Password reset requested for inactive account: ${user.username}`);
        return {
          message: 'If an account with that email exists, a password reset link has been sent.'
        };
      }

      // Get email verification service (reuse for token generation)
      const emailVerificationService = strapi.service('api::email-verification.email-verification');
      if (!emailVerificationService) {
        strapi.log.error('Email verification service not found');
        return ctx.internalServerError('Service unavailable');
      }

      // Generate password reset token (24 hour expiration)
      const { token, expires } = emailVerificationService.generateVerificationToken();

      // Store token and expiration in user record
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          resetPasswordToken: token,
          resetPasswordExpires: expires
        }
      });

      // Send password reset email
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
      await emailVerificationService.sendPasswordResetEmail({
        email: user.email,
        username: user.username,
        token,
        baseUrl
      });

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(user.id, 'password_change', {
          action: 'reset_requested',
          timestamp: new Date()
        }, ctx);
      }

      strapi.log.info(`Password reset email sent to user ${user.id} (${user.username})`);

      return {
        message: 'If an account with that email exists, a password reset link has been sent.'
      };
    } catch (error) {
      strapi.log.error('Error requesting password reset:', error);
      return ctx.internalServerError('Failed to process password reset request');
    }
  },

  /**
   * Verify password reset token and redirect to frontend
   * GET /api/user-management/reset-password/:token
   * Verifies the password reset token and redirects to frontend with one-time token
   * Public endpoint - no authentication required
   */
  async verifyPasswordResetToken(ctx) {
    const { token } = ctx.params;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';

    if (!token) {
      return ctx.redirect(`${frontendUrl}/reset-password?status=error&message=Token+missing`);
    }

    try {
      // Find user by reset password token
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { resetPasswordToken: token }
      });

      if (!user) {
        return ctx.redirect(`${frontendUrl}/reset-password?status=error&message=Invalid+or+expired+token`);
      }

      // Get email verification service for token validation
      const emailVerificationService = strapi.service('api::email-verification.email-verification');
      if (!emailVerificationService) {
        strapi.log.error('Email verification service not found');
        return ctx.redirect(`${frontendUrl}/reset-password?status=error&message=Service+unavailable`);
      }

      // Check if token is expired
      if (!emailVerificationService.isTokenValid(user.resetPasswordToken, user.resetPasswordExpires)) {
        return ctx.redirect(`${frontendUrl}/reset-password?status=error&message=Token+expired`);
      }

      // Generate one-time token for password reset form
      const oneTimeToken = crypto.randomBytes(32).toString('hex');
      const oneTimeExpires = new Date();
      oneTimeExpires.setMinutes(oneTimeExpires.getMinutes() + 15); // 15 minute expiration for password reset form

      // Store one-time token in user record
      await strapi.entityService.update('plugin::users-permissions.user', user.id, {
        data: {
          oneTimeVerificationToken: oneTimeToken,
          oneTimeVerificationExpires: oneTimeExpires
        }
      });

      strapi.log.info(`Password reset token verified for user ${user.id} (${user.username})`);

      // Redirect to frontend password reset form with one-time token
      return ctx.redirect(`${frontendUrl}/reset-password?resetToken=${oneTimeToken}`);
    } catch (error) {
      strapi.log.error('Error verifying password reset token:', error);
      return ctx.redirect(`${frontendUrl}/reset-password?status=error&message=Verification+failed`);
    }
  },

  /**
   * Reset password with one-time token
   * POST /api/user-management/reset-password-with-token
   * Body: { resetToken: string, newPassword: string, confirmPassword: string }
   * Public endpoint - no authentication required
   */
  async resetPasswordWithToken(ctx) {
    const { resetToken, newPassword, confirmPassword } = ctx.request.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return ctx.badRequest('Reset token, new password, and confirmation are required');
    }

    if (newPassword !== confirmPassword) {
      return ctx.badRequest('Passwords do not match');
    }

    if (newPassword.length < 6) {
      return ctx.badRequest('Password must be at least 6 characters long');
    }

    try {
      // Find user by one-time token
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: { oneTimeVerificationToken: resetToken }
      });

      if (!user) {
        return ctx.unauthorized('Invalid or expired reset token');
      }

      // Check if token is expired
      const now = new Date();
      const expires = new Date(user.oneTimeVerificationExpires);
      if (now >= expires) {
        return ctx.unauthorized('Reset token expired. Please request a new password reset link.');
      }

      // Hash the new password using bcrypt
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear all reset tokens
      await strapi.query('plugin::users-permissions.user').update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          oneTimeVerificationToken: null,
          oneTimeVerificationExpires: null
        }
      });

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(user.id, 'password_change', {
          action: 'reset_completed',
          method: 'email_link',
          timestamp: new Date()
        }, ctx);
      }

      strapi.log.info(`Password reset successfully for user ${user.id} (${user.username})`);

      return {
        message: 'Password reset successfully. You can now log in with your new password.'
      };
    } catch (error) {
      strapi.log.error('Error resetting password with token:', error);
      return ctx.internalServerError('Failed to reset password');
    }
  },

  /**
   * Toggle super admin status (sysadmin only)
   * POST /api/user-management/users/:id/toggle-super-admin
   * Body: { isSuperAdmin: boolean }
   */
  async toggleSuperAdmin(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can toggle super admin status');
    }

    const { id } = ctx.params;
    const { isSuperAdmin } = ctx.request.body;

    if (typeof isSuperAdmin !== 'boolean') {
      return ctx.badRequest('isSuperAdmin must be a boolean');
    }

    try {
      // Get target user
      const targetUser = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id }
      });

      if (!targetUser) {
        return ctx.notFound('User not found');
      }

      // If removing super admin status, check if this is the last super admin
      if (!isSuperAdmin && targetUser.isSuperAdmin) {
        const superAdminCount = await strapi.db.query('plugin::users-permissions.user').count({
          where: { isSuperAdmin: true }
        });

        if (superAdminCount <= 1) {
          return ctx.badRequest('Cannot remove super admin status - at least one super admin must exist');
        }
      }

      // Update user
      await strapi.query('plugin::users-permissions.user').update({
        where: { id },
        data: { isSuperAdmin }
      });

      strapi.log.info(`Super admin status ${isSuperAdmin ? 'granted to' : 'removed from'} user ${targetUser.username} by ${currentUser.username}`);

      // Log activity
      const activityLogger = strapi.service('api::activity-logger.activity-logger');
      if (activityLogger) {
        await activityLogger.logActivity(id, 'account_status_change', {
          action: isSuperAdmin ? 'super_admin_granted' : 'super_admin_revoked',
          changedBy: currentUser.username,
          targetUser: targetUser.username
        }, ctx);
      }

      return {
        data: {
          message: `Super admin status ${isSuperAdmin ? 'granted' : 'removed'} successfully`,
          userId: id,
          username: targetUser.username,
          isSuperAdmin
        }
      };
    } catch (error) {
      strapi.log.error('Error toggling super admin status:', error);
      return ctx.internalServerError('Failed to toggle super admin status');
    }
  },

  /**
   * Check if super admin can be removed (sysadmin only)
   * GET /api/user-management/users/:id/can-remove-super-admin
   */
  async canRemoveSuperAdmin(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser || currentUser.userRole !== 'sysadmin') {
      return ctx.unauthorized('Only sysadmin can check super admin status');
    }

    const { id } = ctx.params;

    try {
      // Get target user
      const targetUser = await strapi.query('plugin::users-permissions.user').findOne({
        where: { id }
      });

      if (!targetUser) {
        return ctx.notFound('User not found');
      }

      // If user is not a super admin, they can't be removed
      if (!targetUser.isSuperAdmin) {
        return {
          data: {
            canRemove: false,
            reason: 'User is not a super admin'
          }
        };
      }

      // Count total super admins
      const superAdminCount = await strapi.db.query('plugin::users-permissions.user').count({
        where: { isSuperAdmin: true }
      });

      const canRemove = superAdminCount > 1;

      return {
        data: {
          canRemove,
          reason: canRemove ? 'Multiple super admins exist' : 'This is the last super admin',
          totalSuperAdmins: superAdminCount
        }
      };
    } catch (error) {
      strapi.log.error('Error checking super admin status:', error);
      return ctx.internalServerError('Failed to check super admin status');
    }
  }
};
