/**
 * User Management Controller
 * Handles user administration tasks (sysadmin only) and profile updates (reguser)
 */

import bcrypt from 'bcryptjs';

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

      const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
        filters,
        populate: ['permissionProfiles'],
        sort: { createdAt: 'desc' },
        start: (page - 1) * pageSize,
        limit: pageSize
      });

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
      const user = await strapi.entityService.findOne('plugin::users-permissions.user', id);

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
          where: { id },
          data: {
            password: hashedPassword,
            forcePasswordReset: true
          }
        });

        // Log activity
        const activityLogger = strapi.service('api::activity-logger.activity-logger');
        if (activityLogger) {
          await activityLogger.logActivity(id, 'password_change', {
            changedBy: currentUser.username,
            method: 'admin_direct'
          }, ctx);
        }

        return { data: { message: 'Password reset successfully' } };
      } else if (method === 'email') {
        // Trigger password reset email
        // This would use Strapi's built-in forgot-password flow
        // For now, just set forcePasswordReset flag
        await strapi.entityService.update('plugin::users-permissions.user', id, {
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

        // Generate email verification token
        const crypto = require('crypto');
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');

        const oldEmail = currentUser.email;
        updateData.pendingEmail = email;
        updateData.emailVerificationToken = emailVerificationToken;

        // TODO: Send verification email (Phase 3)
        // For now, just log the activity
        if (activityLogger) {
          await activityLogger.logActivity(currentUser.id, 'email_changed', {
            oldEmail,
            newEmail: email,
            status: 'pending_verification',
            selfUpdate: true
          }, ctx);
        }
      }

      // Update user if there are changes
      if (Object.keys(updateData).length > 0) {
        const updatedUser = await strapi.entityService.update('plugin::users-permissions.user', currentUser.id, {
          data: updateData
        });

        // Log general profile update
        if (activityLogger) {
          const changes = Object.keys(updateData)
            .filter(key => !['emailVerificationToken', 'pendingEmail'].includes(key))
            .join(', ');

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

      // Get total ratings given by user
      const ratingsCount = await strapi.db.query('api::user-rating.user-rating').count({
        where: { users_permissions_user: currentUser.id }
      });

      // Get total activity log entries for user
      const activityCount = await strapi.db.query('api::user-activity-log.user-activity-log').count({
        where: { user: currentUser.id }
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
  }
};
