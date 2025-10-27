/**
 * sales-game-plan controller
 *
 * CRUD operations and custom endpoints for sales game plans
 * Includes approval workflow, sharing, and feedback
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
   * POST /api/sales-game-plans
   * Create new game plan
   * Access: Authenticated users with SalesPilot permission
   */
  async create(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to create game plans');
    }

    // Extract data from request body (Strapi convention: POST data wrapped in 'data' object)
    const requestData = ctx.request.body.data || ctx.request.body;

    const {
      primaryCompanyName,
      primaryCompanyDomain,
      primaryContactName,
      primaryContactTitle,
      primaryContactLinkedIn,
      additionalParties,
      meetingSubject,
      desiredOutcome,
      meetingDate,
      researchDepth,
      personaDetailLevel,
      influenceFramework,
      selectedMaterials,
      templateChoice,
      // AI-generated analysis fields
      companyAnalysis,
      contactPersona,
      influenceTactics,
      discussionPoints,
      objectionHandling,
      // Status fields
      status,
      approvalStatus
    } = requestData;

    // Validation
    if (!primaryCompanyName || !primaryContactName || !meetingSubject || !desiredOutcome) {
      return ctx.badRequest('primaryCompanyName, primaryContactName, meetingSubject, and desiredOutcome are required');
    }

    try {
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').create({
        data: {
          user: currentUser.id,
          primaryCompanyName,
          primaryCompanyDomain: primaryCompanyDomain || null,
          primaryContactName,
          primaryContactTitle: primaryContactTitle || null,
          primaryContactLinkedIn: primaryContactLinkedIn || null,
          additionalParties: additionalParties || [],
          meetingSubject,
          desiredOutcome,
          meetingDate: meetingDate || null,
          researchDepth: researchDepth || 'Standard',
          personaDetailLevel: personaDetailLevel || 'Standard',
          influenceFramework: influenceFramework || 'Hybrid',
          selectedMaterials: selectedMaterials || [],
          templateChoice: templateChoice || 'Modern',
          status: status || 'Draft',
          approvalStatus: approvalStatus || 'Not Submitted',
          // AI-generated analysis
          companyAnalysis: companyAnalysis || null,
          contactPersona: contactPersona || null,
          influenceTactics: influenceTactics || null,
          discussionPoints: discussionPoints || null,
          objectionHandling: objectionHandling || null
        }
      });

      strapi.log.info(`Game plan created: ${gamePlan.documentId} by user ${currentUser.username}`);

      return { data: gamePlan };
    } catch (error) {
      strapi.log.error('Error creating game plan:', error);
      return ctx.internalServerError('Failed to create game plan');
    }
  },

  /**
   * GET /api/sales-game-plans
   * List user's game plans
   * Access: Authenticated users (returns only their own game plans)
   */
  async find(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to view game plans');
    }

    try {
      const gamePlans = await strapi.documents('api::sales-game-plan.sales-game-plan').findMany({
        filters: {
          user: {
            id: currentUser.id
          }
        } as any, // TypeScript workaround for Strapi 5 bug
        sort: { createdAt: 'desc' },
        populate: ['user', 'assignedManager']
      });

      return { data: gamePlans };
    } catch (error) {
      strapi.log.error('Error listing game plans:', error);
      return ctx.internalServerError('Failed to list game plans');
    }
  },

  /**
   * GET /api/sales-game-plans/:documentId
   * Get single game plan by documentId
   * Access: Authenticated users (owner only)
   */
  async findOne(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to view game plans');
    }

    const { documentId } = ctx.params;

    if (!documentId) {
      return ctx.badRequest('Game plan documentId required');
    }

    try {
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user', 'assignedManager']
      });

      if (!gamePlan) {
        return ctx.notFound('Game plan not found');
      }

      // Check ownership
      const plan = gamePlan as any;
      if (plan.user?.id !== currentUser.id) {
        return ctx.forbidden('Access denied');
      }

      return { data: gamePlan };
    } catch (error) {
      strapi.log.error('Error fetching game plan:', error);
      return ctx.internalServerError('Failed to fetch game plan');
    }
  },

  /**
   * PUT /api/sales-game-plans/:documentId
   * Update existing game plan
   * Access: Authenticated users (owner only)
   */
  async update(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to update game plans');
    }

    const { documentId } = ctx.params;
    const updateData = ctx.request.body;

    if (!documentId) {
      return ctx.badRequest('Game plan documentId required');
    }

    try {
      // Get the existing game plan to verify ownership
      const existingPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user']
      });

      if (!existingPlan) {
        return ctx.notFound('Game plan not found');
      }

      const plan = existingPlan as any;
      if (plan.user?.id !== currentUser.id) {
        return ctx.forbidden('Access denied');
      }

      // Update the game plan
      const updatedPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').update({
        documentId,
        data: updateData,
        populate: ['user', 'assignedManager']
      });

      strapi.log.info(`Game plan updated: ${documentId} by user ${currentUser.username}`);

      return { data: updatedPlan };
    } catch (error) {
      strapi.log.error('Error updating game plan:', error);
      return ctx.internalServerError('Failed to update game plan');
    }
  },

  /**
   * DELETE /api/sales-game-plans/:documentId
   * Delete game plan
   * Access: Authenticated users (owner only)
   */
  async delete(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to delete game plans');
    }

    const { documentId } = ctx.params;

    if (!documentId) {
      return ctx.badRequest('Game plan documentId required');
    }

    try {
      // Get the existing game plan to verify ownership
      const existingPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user']
      });

      if (!existingPlan) {
        return ctx.notFound('Game plan not found');
      }

      const plan = existingPlan as any;
      if (plan.user?.id !== currentUser.id) {
        return ctx.forbidden('Access denied');
      }

      // Delete the game plan
      await strapi.documents('api::sales-game-plan.sales-game-plan').delete({
        documentId
      });

      strapi.log.info(`Game plan deleted: ${documentId} by user ${currentUser.username}`);

      return { data: { documentId, deleted: true } };
    } catch (error) {
      strapi.log.error('Error deleting game plan:', error);
      return ctx.internalServerError('Failed to delete game plan');
    }
  },

  /**
   * POST /api/sales-game-plans/:documentId/submit-approval
   * Submit game plan for manager approval
   * Access: Authenticated users (owner only)
   */
  async submitApproval(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in');
    }

    const { documentId } = ctx.params;
    const { managerId, note } = ctx.request.body;

    try {
      // Find the game plan
      const existingPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user']
      });

      if (!existingPlan) {
        return ctx.notFound('Game plan not found');
      }

      const plan = existingPlan as any;
      if (plan.user?.id !== currentUser.id) {
        return ctx.forbidden('Access denied');
      }

      // Update status
      const updatedPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').update({
        documentId,
        data: {
          status: 'Submitted for Approval',
          approvalStatus: 'Pending',
          assignedManager: managerId || currentUser.assignedManager?.id || null,
          managerFeedback: note || null
        },
        populate: ['user', 'assignedManager']
      });

      strapi.log.info(`Game plan submitted for approval: ${documentId} by user ${currentUser.username}`);

      // TODO: Send notification to manager (Phase 11)

      return { data: updatedPlan };
    } catch (error) {
      strapi.log.error('Error submitting game plan for approval:', error);
      return ctx.internalServerError('Failed to submit game plan');
    }
  },

  /**
   * POST /api/sales-game-plans/:documentId/approve
   * Approve game plan
   * Access: Manager assigned to the game plan
   */
  async approve(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in');
    }

    const { documentId } = ctx.params;
    const { feedback } = ctx.request.body;

    try {
      // Find the game plan
      const existingPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['assignedManager']
      });

      if (!existingPlan) {
        return ctx.notFound('Game plan not found');
      }

      const plan = existingPlan as any;

      // Check if current user is the assigned manager
      if (!plan.assignedManager || plan.assignedManager.id !== currentUser.id) {
        return ctx.forbidden('You are not authorized to approve this game plan');
      }

      // Update status
      const updatedPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').update({
        documentId,
        data: {
          status: 'Approved',
          approvalStatus: 'Approved',
          managerFeedback: feedback || null
        },
        populate: ['user', 'assignedManager']
      });

      strapi.log.info(`Game plan approved: ${documentId} by manager ${currentUser.username}`);

      // TODO: Send notification to user (Phase 11)

      return { data: updatedPlan };
    } catch (error) {
      strapi.log.error('Error approving game plan:', error);
      return ctx.internalServerError('Failed to approve game plan');
    }
  },

  /**
   * POST /api/sales-game-plans/:documentId/reject
   * Reject game plan
   * Access: Manager assigned to the game plan
   */
  async reject(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in');
    }

    const { documentId } = ctx.params;
    const { feedback } = ctx.request.body;

    if (!feedback) {
      return ctx.badRequest('Feedback is required when rejecting a game plan');
    }

    try {
      // Find the game plan
      const existingPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['assignedManager']
      });

      if (!existingPlan) {
        return ctx.notFound('Game plan not found');
      }

      const plan = existingPlan as any;

      // Check if current user is the assigned manager
      if (!plan.assignedManager || plan.assignedManager.id !== currentUser.id) {
        return ctx.forbidden('You are not authorized to reject this game plan');
      }

      // Update status
      const updatedPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').update({
        documentId,
        data: {
          status: 'Rejected',
          approvalStatus: 'Rejected',
          managerFeedback: feedback
        },
        populate: ['user', 'assignedManager']
      });

      strapi.log.info(`Game plan rejected: ${documentId} by manager ${currentUser.username}`);

      // TODO: Send notification to user (Phase 11)

      return { data: updatedPlan };
    } catch (error) {
      strapi.log.error('Error rejecting game plan:', error);
      return ctx.internalServerError('Failed to reject game plan');
    }
  },

  /**
   * POST /api/sales-game-plans/:documentId/feedback
   * Add post-meeting feedback
   * Access: Authenticated users (owner only)
   */
  async addFeedback(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in');
    }

    const { documentId } = ctx.params;
    const feedbackData = ctx.request.body;

    try {
      // Find the game plan
      const existingPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user']
      });

      if (!existingPlan) {
        return ctx.notFound('Game plan not found');
      }

      const plan = existingPlan as any;
      if (plan.user?.id !== currentUser.id) {
        return ctx.forbidden('Access denied');
      }

      // Update with feedback
      const updatedPlan = await strapi.documents('api::sales-game-plan.sales-game-plan').update({
        documentId,
        data: {
          meetingFeedback: {
            ...feedbackData,
            submittedAt: new Date().toISOString()
          }
        },
        populate: ['user', 'assignedManager']
      });

      strapi.log.info(`Feedback added to game plan: ${documentId} by user ${currentUser.username}`);

      return { data: updatedPlan };
    } catch (error) {
      strapi.log.error('Error adding feedback:', error);
      return ctx.internalServerError('Failed to add feedback');
    }
  },

  /**
   * GET /api/sales-game-plans/shared/:token
   * View shared game plan (public access with token)
   * Access: Anyone with valid share link token
   * Note: Password protection handled in Phase 10
   */
  async viewShared(ctx) {
    const { token } = ctx.params;

    if (!token) {
      return ctx.badRequest('Share token required');
    }

    try {
      // Find game plan by shareable link
      const gamePlans = await strapi.documents('api::sales-game-plan.sales-game-plan').findMany({
        filters: {
          shareableLink: token
        } as any, // TypeScript workaround for Strapi 5 bug
        populate: ['user']
      });

      if (!gamePlans || gamePlans.length === 0) {
        return ctx.notFound('Shared game plan not found or link expired');
      }

      const gamePlan = gamePlans[0] as any;

      // Check if link is expired
      if (gamePlan.linkExpiration && new Date(gamePlan.linkExpiration) < new Date()) {
        return ctx.forbidden('This share link has expired');
      }

      // TODO: Check password protection in Phase 10

      // Return game plan (excluding sensitive fields)
      const publicData = {
        documentId: gamePlan.documentId,
        primaryCompanyName: gamePlan.primaryCompanyName,
        primaryContactName: gamePlan.primaryContactName,
        meetingSubject: gamePlan.meetingSubject,
        desiredOutcome: gamePlan.desiredOutcome,
        meetingDate: gamePlan.meetingDate,
        companyAnalysis: gamePlan.companyAnalysis,
        contactPersona: gamePlan.contactPersona,
        influenceTactics: gamePlan.influenceTactics,
        discussionPoints: gamePlan.discussionPoints,
        objectionHandling: gamePlan.objectionHandling,
        generatedMaterials: gamePlan.generatedMaterials,
        templateChoice: gamePlan.templateChoice,
        createdAt: gamePlan.createdAt
      };

      return { data: publicData };
    } catch (error) {
      strapi.log.error('Error viewing shared game plan:', error);
      return ctx.internalServerError('Failed to view shared game plan');
    }
  }
};
