/**
 * SalesPilot Conversation Controller
 *
 * Manages conversational AI interface for gathering game plan inputs
 * Supports URL finding via Google Custom Search API
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
   * POST /api/salespilot/conversation
   * Process conversation messages for game plan creation
   */
  async processMessage(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to use SalesPilot AI');
    }

    const { message, conversationState } = ctx.request.body;

    // Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return ctx.badRequest('Message is required and must be a non-empty string');
    }

    if (message.length > 4000) {
      return ctx.badRequest('Message exceeds maximum length of 4000 characters');
    }

    try {
      // Call service to process conversation
      const response = await strapi
        .service('api::salespilot-conversation.salespilot-conversation')
        .processConversation(message, conversationState, currentUser.id);

      strapi.log.info(`Conversation processed for user ${currentUser.username}`);

      return { data: response };
    } catch (error) {
      strapi.log.error('Error processing conversation:', error);

      if (error.status === 429) {
        return ctx.tooManyRequests('Rate limit exceeded. Please try again later.');
      }

      return ctx.internalServerError('Failed to process message. Please try again.');
    }
  },

  /**
   * POST /api/salespilot/find-urls
   * Use Google Custom Search to find LinkedIn profiles and company websites
   */
  async findUrls(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to use SalesPilot AI');
    }

    const { query, searchType } = ctx.request.body;

    // Validation
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return ctx.badRequest('Search query is required');
    }

    if (!searchType || !['linkedin', 'company'].includes(searchType)) {
      return ctx.badRequest('Search type must be "linkedin" or "company"');
    }

    try {
      // Call service to search for URLs
      const results = await strapi
        .service('api::salespilot-conversation.salespilot-conversation')
        .findUrls(query, searchType, currentUser.id);

      strapi.log.info(`URL search completed for user ${currentUser.username}: ${searchType} - ${query}`);

      return { data: results };
    } catch (error) {
      strapi.log.error('Error finding URLs:', error);

      if (error.message?.includes('quota')) {
        return ctx.tooManyRequests('Search quota exceeded. Please try again later or enter URLs manually.');
      }

      return ctx.internalServerError('Failed to find URLs. Please try entering them manually.');
    }
  },

  /**
   * POST /api/salespilot/research
   * Perform web research for company and contact information
   */
  async performResearch(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to use SalesPilot AI');
    }

    // Validate request body
    const {
      companyName,
      companyDomain,
      contactName,
      contactTitle,
      contactLinkedIn,
      industry,
      researchDepth,
      additionalParties
    } = ctx.request.body;

    // Validation
    if (!companyName && !companyDomain) {
      return ctx.badRequest('Company name or domain is required');
    }

    if (!researchDepth || !['Quick', 'Standard', 'Deep'].includes(researchDepth)) {
      return ctx.badRequest('Research depth must be "Quick", "Standard", or "Deep"');
    }

    try {
      // Call web research service
      const results = await strapi
        .service('api::salespilot-conversation.salespilot-conversation')
        .performWebResearch({
          companyName,
          companyDomain,
          contactName,
          contactTitle,
          contactLinkedIn,
          industry,
          researchDepth,
          additionalParties
        }, currentUser.id);

      strapi.log.info(`Research completed for user ${currentUser.username}: ${researchDepth} research on ${companyName || companyDomain}`);

      return { data: results };
    } catch (error) {
      strapi.log.error('Error performing research:', error);

      if (error.message?.includes('quota')) {
        return ctx.tooManyRequests({
          error: {
            message: 'Research quota exceeded. Would you like to enter information manually or proceed with limited data?',
            fallbackAvailable: true
          }
        });
      }

      return ctx.internalServerError({
        error: {
          message: 'Research failed. Would you like to enter information manually or proceed with limited data?',
          fallbackAvailable: true
        }
      });
    }
  },

  /**
   * POST /api/salespilot/generate-analysis
   * Generate complete game plan analysis using AI
   * Returns analysis ID immediately and runs generation in background
   */
  async generateAnalysis(ctx) {
    const currentUser = await authenticateRequest(ctx);

    if (!currentUser) {
      return ctx.unauthorized('You must be logged in to use SalesPilot AI');
    }

    // Validate request body
    const {
      companyName,
      contactName,
      contactTitle,
      industry,
      meetingSubject,
      desiredOutcome,
      personaDetailLevel,
      influenceFramework,
      researchData, // Optional - if not provided, backend will perform research internally
      researchDepth, // Optional - for internal research ('Quick', 'Standard', 'Deep')
      companyDomain, // Optional - for internal research
      contactLinkedIn, // Optional - for internal research
      additionalParties, // Optional - for internal research
      globalStartTime,
      selectedMaterials,
      templateChoice
    } = ctx.request.body;

    // Validation
    if (!companyName || !contactName) {
      return ctx.badRequest('Company name and contact name are required');
    }

    if (!personaDetailLevel || !['Brief', 'Standard', 'Detailed'].includes(personaDetailLevel)) {
      return ctx.badRequest('Persona detail level must be "Brief", "Standard", or "Detailed"');
    }

    if (!influenceFramework || influenceFramework.trim() === '') {
      return ctx.badRequest('Influence framework is required');
    }

    try {
      // Import progress tracker
      const { progressTracker } = await import('../services/game-plan-generator');

      // Generate unique analysis ID
      const analysisId = progressTracker.generateAnalysisId();

      // Initialize progress tracking
      progressTracker.initializeProgress(analysisId);

      strapi.log.info(`[AnalysisGeneration] Started with ID: ${analysisId} for user ${currentUser.username}`);

      // Return analysis ID immediately (non-blocking)
      ctx.send({
        success: true,
        data: {
          analysisId,
          message: 'Analysis generation started. Use the analysis ID to track progress via SSE or polling endpoints.'
        }
      });

      // Run analysis generation in background (don't await)
      // This allows the response to return immediately while generation continues
      strapi
        .service('api::salespilot-conversation.salespilot-conversation')
        .generateGamePlanAnalysis({
          companyName,
          contactName,
          contactTitle,
          industry,
          meetingSubject,
          desiredOutcome,
          personaDetailLevel,
          influenceFramework,
          researchData, // Optional - backend will perform research if not provided
          researchDepth, // For internal research
          companyDomain, // For internal research
          contactLinkedIn, // For internal research
          additionalParties, // For internal research
          globalStartTime,
          selectedMaterials,
          templateChoice
        }, currentUser.id, analysisId)
        .then(async (analysis) => {
          try {
            strapi.log.info(`[AnalysisGeneration] Completed for ${analysisId}: ${companyName} / ${contactName}`);
            strapi.log.info(`[AnalysisGeneration] Saving game plan to database...`);

            // Save the game plan to the database
            const gamePlan = await strapi.entityService.create('api::sales-game-plan.sales-game-plan', {
              data: {
                // User relation
                user: currentUser.id,

                // Company and contact info
                primaryCompanyName: companyName,
                primaryCompanyDomain: companyDomain || null,
                primaryContactName: contactName,
                primaryContactTitle: contactTitle || null,
                primaryContactLinkedIn: contactLinkedIn || null,
                additionalParties: additionalParties || null,

                // Meeting details
                meetingSubject: meetingSubject,
                desiredOutcome: desiredOutcome,
                meetingDate: null, // User can set this later

                // Analysis parameters
                researchDepth: researchDepth || 'Standard',
                personaDetailLevel: personaDetailLevel,
                influenceFramework: influenceFramework,
                selectedMaterials: selectedMaterials || null,
                templateChoice: templateChoice || 'Modern',

                // Generated analysis content
                companyAnalysis: analysis.companyAnalysis,
                contactPersona: analysis.contactPersona,
                influenceTactics: analysis.influenceTactics,
                discussionPoints: analysis.discussionPoints,
                objectionHandling: analysis.objectionHandling,
                generatedMaterials: analysis.generatedMaterials || null,

                // Status
                status: 'Ready', // Analysis complete, ready to use

                // Approval fields
                approvalStatus: 'Not Submitted'
              }
            });

            strapi.log.info(`[AnalysisGeneration] Game plan saved successfully with ID: ${gamePlan.documentId}`);

            // Update progress tracker with game plan ID
            const { progressTracker } = await import('../services/game-plan-generator');
            const currentProgress = progressTracker.getProgress(analysisId);
            if (currentProgress) {
              progressTracker.setCompleted(analysisId, {
                ...currentProgress.result,
                gamePlanId: gamePlan.documentId
              });
            }

          } catch (saveError) {
            strapi.log.error(`[AnalysisGeneration] Failed to save game plan:`, saveError);
            strapi.log.error(`[AnalysisGeneration] Error details:`, {
              name: saveError.name,
              message: saveError.message,
              stack: saveError.stack
            });
            // Don't throw - analysis was successful, just saving failed
            // User can still see results in progress tracker
          }
        })
        .catch((error) => {
          strapi.log.error(`[AnalysisGeneration] Failed for ${analysisId}:`, error);
          // Error is already handled by progressTracker in the service
        });

    } catch (error) {
      strapi.log.error('Error starting analysis:', error);

      return ctx.internalServerError({
        error: {
          message: 'Failed to start analysis generation. Please try again.',
          retryAvailable: true
        }
      });
    }
  },

  /**
   * Stream analysis progress using Server-Sent Events (SSE)
   * GET /api/salespilot/analysis-progress/:analysisId
   */
  async streamAnalysisProgress(ctx) {
    const { analysisId } = ctx.params;

    try {
      // Validate authentication - check both header and query param
      // Query param is needed because EventSource doesn't support custom headers
      let token = ctx.request.headers['authorization']?.split(' ')[1];

      // Fallback to query parameter for EventSource compatibility
      if (!token) {
        token = ctx.query.token;
      }

      if (!token) {
        strapi.log.warn('[SSE] No auth token provided');
        ctx.status = 401;
        ctx.body = { error: { message: 'Authentication required' } };
        return;
      }

      // Verify token and get user
      let currentUser;
      try {
        const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token);
        currentUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id }
        });

        if (!currentUser) {
          throw new Error('User not found');
        }
      } catch (error) {
        strapi.log.warn('[SSE] Invalid auth token');
        ctx.status = 401;
        ctx.body = { error: { message: 'Invalid authentication token' } };
        return;
      }

      strapi.log.info(`[SSE] User ${currentUser.username} connecting to analysis: ${analysisId}`);

      // Import progress tracker
      const { progressTracker } = await import('../services/game-plan-generator');

      // Check if analysis exists
      if (!progressTracker.exists(analysisId)) {
        strapi.log.warn(`[SSE] Analysis not found: ${analysisId}`);
        ctx.status = 404;
        ctx.body = { error: { message: 'Analysis not found' } };
        return;
      }

      // Set SSE headers
      ctx.request.socket.setTimeout(0);
      ctx.request.socket.setNoDelay(true);
      ctx.request.socket.setKeepAlive(true);

      ctx.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'  // Disable Nginx buffering
      });

      ctx.status = 200;

      strapi.log.info(`[SSE] Starting event stream for analysis: ${analysisId}`);

      // Send initial connection event
      ctx.res.write('event: connected\n');
      ctx.res.write(`data: ${JSON.stringify({ message: 'Connected to progress stream' })}\n\n`);

      // Return a Promise that keeps the connection alive until stream closes
      // This prevents Koa from auto-closing the response when the function ends
      return new Promise<void>((resolve) => {
        // Create polling interval to check progress
        const pollInterval = setInterval(() => {
          try {
            const progress = progressTracker.getProgress(analysisId);

            if (!progress) {
              // Analysis not found (might have been cleaned up)
              strapi.log.info(`[SSE] Analysis ${analysisId} no longer exists, closing stream`);
              ctx.res.write('event: error\n');
              ctx.res.write(`data: ${JSON.stringify({ message: 'Analysis not found' })}\n\n`);
              clearInterval(pollInterval);
              ctx.res.end();
              resolve(); // Resolve promise to end Koa handler
              return;
            }

            // Send progress update
            ctx.res.write('event: progress\n');
            ctx.res.write(`data: ${JSON.stringify({
              stage: progress.stage,
              percentage: progress.percentage,
              status: progress.status,
              // New timing fields
              phaseNumber: progress.phaseNumber,
              totalPhases: progress.totalPhases,
              elapsedSeconds: progress.totalElapsedSeconds,
              remainingSeconds: progress.totalRemainingSeconds
            })}\n\n`);

            // If completed or error, send final event and close
            if (progress.status === 'completed') {
              strapi.log.info(`[SSE] Analysis ${analysisId} completed, sending complete event`);
              ctx.res.write('event: complete\n');
              ctx.res.write(`data: ${JSON.stringify({
                stage: progress.stage,
                percentage: 100,
                result: progress.result
              })}\n\n`);
              clearInterval(pollInterval);
              ctx.res.end();
              resolve(); // Resolve promise to end Koa handler
            } else if (progress.status === 'error') {
              strapi.log.error(`[SSE] Analysis ${analysisId} failed: ${progress.error}`);
              ctx.res.write('event: error\n');
              ctx.res.write(`data: ${JSON.stringify({
                message: progress.error || 'Analysis generation failed'
              })}\n\n`);
              clearInterval(pollInterval);
              ctx.res.end();
              resolve(); // Resolve promise to end Koa handler
            }
          } catch (error) {
            strapi.log.error('[SSE] Error in polling interval:', error);
            clearInterval(pollInterval);
            ctx.res.end();
            resolve(); // Resolve promise to end Koa handler
          }
        }, 500); // Poll every 500ms for updates

        // Handle client disconnect
        ctx.req.on('close', () => {
          strapi.log.info(`[SSE] Client disconnected from analysis: ${analysisId}`);
          clearInterval(pollInterval);
          resolve(); // Resolve promise to end Koa handler
        });

        ctx.req.on('error', (err) => {
          strapi.log.error(`[SSE] Connection error for analysis ${analysisId}:`, err);
          clearInterval(pollInterval);
          resolve(); // Resolve promise to end Koa handler
        });
      });

    } catch (error) {
      strapi.log.error('[SSE] Stream setup error:', error);
      ctx.status = 500;
      ctx.body = { error: { message: 'Failed to setup progress stream' } };
    }
  },

  /**
   * Get analysis status via polling (fallback for SSE)
   * GET /api/salespilot/analysis-status/:analysisId
   */
  async getAnalysisStatus(ctx) {
    const { analysisId } = ctx.params;

    try {
      // Validate authentication
      const token = ctx.request.headers['authorization']?.split(' ')[1];

      if (!token) {
        strapi.log.warn('[Polling] No auth token provided');
        return ctx.unauthorized({
          error: { message: 'Authentication required' }
        });
      }

      // Verify token and get user
      let currentUser;
      try {
        const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token);
        currentUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id }
        });

        if (!currentUser) {
          throw new Error('User not found');
        }
      } catch (error) {
        strapi.log.warn('[Polling] Invalid auth token');
        return ctx.unauthorized({
          error: { message: 'Invalid authentication token' }
        });
      }

      strapi.log.info(`[Polling] User ${currentUser.username} checking status: ${analysisId}`);

      // Import progress tracker
      const { progressTracker } = await import('../services/game-plan-generator');

      // Get progress data
      const progress = progressTracker.getProgress(analysisId);

      if (!progress) {
        strapi.log.warn(`[Polling] Analysis not found: ${analysisId}`);
        return ctx.notFound({
          error: { message: 'Analysis not found or expired' }
        });
      }

      // Recalculate elapsed/remaining time dynamically if globalStartTime is available
      let currentElapsed = progress.totalElapsedSeconds || 0;
      let currentRemaining = progress.totalRemainingSeconds || 0;

      if (progress.globalStartTime) {
        // Calculate current elapsed time from global start (continuous timer)
        const now = new Date();
        currentElapsed = Math.round((now.getTime() - new Date(progress.globalStartTime).getTime()) / 1000);
        // Remaining = total estimate (210s for 7 phases) minus elapsed
        currentRemaining = Math.max(0, 210 - currentElapsed);
      }

      // Return progress data in same format as SSE events
      return ctx.send({
        success: true,
        data: {
          stage: progress.stage,
          percentage: progress.percentage,
          status: progress.status,
          error: progress.error,
          complete: progress.status === 'completed',
          result: progress.status === 'completed' ? progress.result : undefined,
          // Timing fields - dynamically calculated
          phaseNumber: progress.phaseNumber,
          totalPhases: progress.totalPhases,
          elapsedSeconds: currentElapsed,
          remainingSeconds: currentRemaining
        },
        timestamp: progress.updatedAt
      });

    } catch (error) {
      strapi.log.error('[Polling] Status check error:', error);
      return ctx.internalServerError({
        error: { message: 'Failed to retrieve analysis status' }
      });
    }
  },

  /**
   * Generate Materials
   * POST /api/salespilot/generate-materials
   *
   * Generates selected materials (emails, agenda PDF, presentation PDF) from a game plan
   */
  async generateMaterials(ctx) {
    try {
      // Validate authentication
      const token = ctx.request.headers['authorization']?.split(' ')[1];

      if (!token) {
        strapi.log.warn('[Materials] No auth token provided');
        return ctx.unauthorized({
          error: { message: 'Authentication required' }
        });
      }

      // Verify token and get user
      let currentUser;
      try {
        const { id } = await strapi.plugins['users-permissions'].services.jwt.verify(token);
        currentUser = await strapi.query('plugin::users-permissions.user').findOne({
          where: { id }
        });

        if (!currentUser) {
          throw new Error('User not found');
        }
      } catch (error) {
        strapi.log.warn('[Materials] Invalid auth token');
        return ctx.unauthorized({
          error: { message: 'Invalid authentication token' }
        });
      }

      // Extract parameters
      const { gamePlanId, materials, template } = ctx.request.body;

      if (!gamePlanId || !materials || !Array.isArray(materials)) {
        return ctx.badRequest({
          error: { message: 'gamePlanId and materials array are required' }
        });
      }

      strapi.log.info(`[Materials] User ${currentUser.username} generating materials for game plan ${gamePlanId}`);
      strapi.log.info(`[Materials] Requested materials: ${materials.join(', ')}`);
      strapi.log.info(`[Materials] Template: ${template || 'modern'}`);

      // Fetch game plan with user relation populated
      const gamePlan = await strapi.db.query('api::sales-game-plan.sales-game-plan').findOne({
        where: { documentId: gamePlanId },
        populate: ['user']
      });

      if (!gamePlan) {
        strapi.log.warn(`[Materials] Game plan not found: ${gamePlanId}`);
        return ctx.notFound({
          error: { message: 'Game plan not found' }
        });
      }

      // Verify ownership (check the user relation)
      const gamePlanUserId = gamePlan.user?.id || gamePlan.user;
      if (gamePlanUserId !== currentUser.id) {
        strapi.log.warn(`[Materials] User ${currentUser.username} (ID: ${currentUser.id}) attempted to access game plan ${gamePlanId} owned by user ${gamePlanUserId}`);
        return ctx.forbidden({
          error: { message: 'You do not have permission to access this game plan' }
        });
      }

      // Import services
      const materialGenerator = await import('../services/material-generator');
      const pdfGenerator = await import('../services/pdf-generator');

      const generatedMaterials: any = {};

      // Generate pre-meeting email
      if (materials.includes('preMeetingEmail')) {
        strapi.log.info(`[Materials] Generating pre-meeting email...`);
        const email = await materialGenerator.generatePreMeetingEmail(gamePlan);
        generatedMaterials.preMeetingEmail = email;
        strapi.log.info(`[Materials] Pre-meeting email generated (${email.body.length} chars)`);
      }

      // Generate post-meeting email
      if (materials.includes('postMeetingEmail')) {
        strapi.log.info(`[Materials] Generating post-meeting email...`);
        const email = await materialGenerator.generatePostMeetingEmail(gamePlan);
        generatedMaterials.postMeetingEmail = email;
        strapi.log.info(`[Materials] Post-meeting email generated (${email.body.length} chars)`);
      }

      // Generate agenda PDF
      if (materials.includes('agenda')) {
        strapi.log.info(`[Materials] Generating agenda PDF with template ${template || 'modern'}...`);
        const pdf = await pdfGenerator.generateAgendaPDF(gamePlan, template || 'modern');
        generatedMaterials.agenda = pdf;
        strapi.log.info(`[Materials] Agenda PDF generated: ${pdf.filename}`);
      }

      // Generate presentation PDF
      if (materials.includes('presentation')) {
        strapi.log.info(`[Materials] Generating presentation PDF with template ${template || 'modern'}...`);
        const pdf = await pdfGenerator.generatePresentationPDF(gamePlan, template || 'modern');
        generatedMaterials.presentation = pdf;
        strapi.log.info(`[Materials] Presentation PDF generated: ${pdf.filename}`);
      }

      // Update game plan with generated materials
      const updatedGamePlan = await strapi.db.query('api::sales-game-plan.sales-game-plan').update({
        where: { documentId: gamePlanId },
        data: {
          generatedMaterials: generatedMaterials
        }
      });

      strapi.log.info(`[Materials] Game plan ${gamePlanId} updated with generated materials`);

      return ctx.send({
        success: true,
        materials: generatedMaterials
      });

    } catch (error) {
      strapi.log.error('[Materials] Generation error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to generate materials',
          details: error.message
        }
      });
    }
  },

  /**
   * POST /api/salespilot/improve-content
   * Request AI-powered content improvement for a game plan section
   */
  async improveContent(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    const { gamePlanId, section, improvementRequest } = ctx.request.body;

    if (!gamePlanId || !section || !improvementRequest) {
      return ctx.badRequest('Missing required fields: gamePlanId, section, improvementRequest');
    }

    try {
      const contentImprover = require('../services/content-improver');

      // Validate section name
      if (!contentImprover.isValidSection(section)) {
        return ctx.badRequest(`Invalid section name. Must be one of: companyAnalysis, contactPersona, influenceTactics, discussionPoints, objectionHandling`);
      }

      // Fetch game plan
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId: gamePlanId,
        populate: ['user']
      });

      if (!gamePlan) {
        return ctx.notFound('Game plan not found');
      }

      // Verify ownership
      if (gamePlan.user?.id !== currentUser.id) {
        return ctx.forbidden('You do not have permission to modify this game plan');
      }

      // Get current content from the specified section
      const currentContent = gamePlan[section];
      if (!currentContent) {
        return ctx.badRequest(`Section '${section}' has no content to improve`);
      }

      // Prepare context for improvement
      const gamePlanContext = {
        companyName: gamePlan.primaryCompanyName,
        contactName: gamePlan.primaryContactName,
        meetingSubject: gamePlan.meetingSubject
      };

      // Generate improvement
      strapi.log.info(`[Content Improvement] User ${currentUser.id} requesting improvement for section '${section}' on game plan ${gamePlanId}`);

      const improvement = await contentImprover.improveContent({
        section,
        currentContent,
        improvementRequest,
        gamePlanContext
      });

      return ctx.send({
        success: true,
        improvement: {
          section,
          original: improvement.original,
          improved: improvement.improved,
          changes: improvement.changes,
          rationale: improvement.rationale
        }
      });

    } catch (error) {
      strapi.log.error('[Content Improvement] Error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to improve content',
          details: error.message
        }
      });
    }
  },

  /**
   * POST /api/salespilot/apply-improvement
   * Apply approved content improvement to game plan
   */
  async applyImprovement(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    const { gamePlanId, section, improvedContent } = ctx.request.body;

    if (!gamePlanId || !section || !improvedContent) {
      return ctx.badRequest('Missing required fields: gamePlanId, section, improvedContent');
    }

    try {
      const contentImprover = require('../services/content-improver');

      // Validate section name
      if (!contentImprover.isValidSection(section)) {
        return ctx.badRequest(`Invalid section name`);
      }

      // Fetch game plan
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId: gamePlanId,
        populate: ['user']
      });

      if (!gamePlan) {
        return ctx.notFound('Game plan not found');
      }

      // Verify ownership
      if (gamePlan.user?.id !== currentUser.id) {
        return ctx.forbidden('You do not have permission to modify this game plan');
      }

      // Update the section content
      const updatedGamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').update({
        documentId: gamePlanId,
        data: {
          [section]: improvedContent
        }
      });

      strapi.log.info(`[Content Improvement] Applied improvement to section '${section}' on game plan ${gamePlanId}`);

      return ctx.send({
        success: true,
        message: 'Improvement applied successfully',
        gamePlan: updatedGamePlan
      });

    } catch (error) {
      strapi.log.error('[Content Improvement] Apply error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to apply improvement',
          details: error.message
        }
      });
    }
  },
  /**
   * GET /api/salespilot/game-plans
   * List user's game plans with search, filter, sort, and pagination
   */
  async listGamePlans(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    try {
      const {
        limit = 20,
        offset = 0,
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        hasAnalysis = null,
        hasMaterials = null
      } = ctx.query;

      // Build query filters
      const filters: any = {
        user: currentUser.id
      };

      // Search filter
      if (search && search.trim()) {
        filters.$or = [
          { primaryCompanyName: { $containsi: search } },
          { primaryContactName: { $containsi: search } },
          { meetingSubject: { $containsi: search } }
        ];
      }

      // Status filters
      if (hasAnalysis === 'true') {
        filters.companyAnalysis = { $notNull: true };
      }
      if (hasMaterials === 'true') {
        filters.selectedMaterials = { $notNull: true };
      }

      // Fetch game plans
      const gamePlans = await strapi.documents('api::sales-game-plan.sales-game-plan').findMany({
        filters,
        sort: { [sortBy]: sortOrder },
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      // Count total for pagination
      const total = await strapi.db.query('api::sales-game-plan.sales-game-plan').count({
        where: filters
      });

      // Add computed status flags
      const enrichedGamePlans = gamePlans.map(gp => ({
        ...gp,
        hasAnalysis: !!(gp.companyAnalysis || gp.contactPersona || gp.influenceTactics),
        hasMaterials: !!(gp.selectedMaterials && Array.isArray(gp.selectedMaterials) && gp.selectedMaterials.length > 0)
      }));

      return ctx.send({
        success: true,
        data: enrichedGamePlans,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + enrichedGamePlans.length < total
        }
      });

    } catch (error) {
      strapi.log.error('[List Game Plans] Error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to fetch game plans',
          details: error.message
        }
      });
    }
  },

  /**
   * DELETE /api/salespilot/game-plans/:documentId
   * Delete a game plan
   */
  async deleteGamePlan(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    const { documentId} = ctx.params;

    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }

    try {
      // Fetch game plan to verify ownership
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user']
      });

      if (!gamePlan) {
        return ctx.notFound('Game plan not found');
      }

      // Verify ownership
      if (gamePlan.user?.id !== currentUser.id) {
        return ctx.forbidden('You do not have permission to delete this game plan');
      }

      // Delete the game plan
      await strapi.documents('api::sales-game-plan.sales-game-plan').delete({
        documentId
      });

      strapi.log.info(`[Delete Game Plan] User ${currentUser.id} deleted game plan ${documentId}`);

      return ctx.send({
        success: true,
        message: 'Game plan deleted successfully'
      });

    } catch (error) {
      strapi.log.error('[Delete Game Plan] Error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to delete game plan',
          details: error.message
        }
      });
    }
  },

  /**
   * POST /api/salespilot/game-plans/:documentId/duplicate
   * Duplicate a game plan
   */
  async duplicateGamePlan(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    const { documentId } = ctx.params;

    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }

    try {
      // Fetch original game plan
      const original = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user']
      });

      if (!original) {
        return ctx.notFound('Game plan not found');
      }

      // Verify ownership
      if (original.user?.id !== currentUser.id) {
        return ctx.forbidden('You do not have permission to duplicate this game plan');
      }

      // Create copy with only the necessary fields
      const duplicateData: any = {
        primaryCompanyName: `${original.primaryCompanyName} (Copy)`,
        primaryCompanyDomain: original.primaryCompanyDomain,
        primaryContactName: original.primaryContactName,
        primaryContactTitle: original.primaryContactTitle,
        primaryContactLinkedIn: original.primaryContactLinkedIn,
        additionalParties: original.additionalParties,
        meetingSubject: original.meetingSubject ? `${original.meetingSubject} (Copy)` : null,
        desiredOutcome: original.desiredOutcome,
        researchDepth: original.researchDepth,
        personaDetailLevel: original.personaDetailLevel,
        influenceFramework: original.influenceFramework,
        companyAnalysis: original.companyAnalysis,
        contactPersona: original.contactPersona,
        influenceTactics: original.influenceTactics,
        discussionPoints: original.discussionPoints,
        objectionHandling: original.objectionHandling,
        selectedMaterials: original.selectedMaterials,
        user: currentUser.id
      };

      // Create new game plan
      const newGamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').create({
        data: duplicateData
      });

      strapi.log.info(`[Duplicate Game Plan] User ${currentUser.id} duplicated game plan ${documentId} to ${newGamePlan.documentId}`);

      return ctx.send({
        success: true,
        message: 'Game plan duplicated successfully',
        gamePlan: newGamePlan
      });

    } catch (error) {
      strapi.log.error('[Duplicate Game Plan] Error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to duplicate game plan',
          details: error.message
        }
      });
    }
  },

  /**
   * GET /api/salespilot/game-plans/:documentId/export
   * Export game plan as PDF
   */
  async exportGamePlan(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    const { documentId } = ctx.params;

    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }

    try {
      // Fetch game plan
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user']
      });

      if (!gamePlan) {
        return ctx.notFound('Game plan not found');
      }

      // Verify ownership
      if (gamePlan.user?.id !== currentUser.id) {
        return ctx.forbidden('You do not have permission to export this game plan');
      }

      // Reuse PDF generator from Phase 6
      const pdfGenerator = require('../services/pdf-generator');

      // Generate comprehensive game plan PDF (all sections)
      const pdfBuffer = await pdfGenerator.generateGamePlanPDF({
        gamePlan,
        sections: [
          'summary',
          'companyAnalysis',
          'contactPersona',
          'influenceTactics',
          'discussionPoints',
          'objectionHandling'
        ]
      });

      // Set response headers for PDF download
      ctx.set('Content-Type', 'application/pdf');
      ctx.set('Content-Disposition', `attachment; filename="game-plan-${gamePlan.primaryCompanyName.replace(/\s/g, '-')}-${documentId}.pdf"`);
      ctx.body = pdfBuffer;

      strapi.log.info(`[Export Game Plan] User ${currentUser.id} exported game plan ${documentId}`);

    } catch (error) {
      strapi.log.error('[Export Game Plan] Error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to export game plan',
          details: error.message
        }
      });
    }
  },

  /**
   * POST /api/salespilot/game-plans/:documentId/share
   * Share game plan via email or generate shareable link
   */
  async shareGamePlan(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    const { documentId } = ctx.params;
    const { method, email } = ctx.request.body;

    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }

    if (!method || !['email', 'link'].includes(method)) {
      return ctx.badRequest('Share method must be either "email" or "link"');
    }

    try {
      // Fetch game plan
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId,
        populate: ['user']
      });

      if (!gamePlan) {
        return ctx.notFound('Game plan not found');
      }

      // Verify ownership
      if (gamePlan.user?.id !== currentUser.id) {
        return ctx.forbidden('You do not have permission to share this game plan');
      }

      if (method === 'email') {
        if (!email || !email.trim()) {
          return ctx.badRequest('Email address is required for email sharing');
        }

        // Generate PDF for email
        const pdfGenerator = require('../services/pdf-generator');
        const pdfBuffer = await pdfGenerator.generateGamePlanPDF({
          gamePlan,
          sections: [
            'summary',
            'companyAnalysis',
            'contactPersona',
            'influenceTactics',
            'discussionPoints',
            'objectionHandling'
          ]
        });

        // Send email with PDF attachment
        await strapi.plugin('email').service('email').send({
          to: email,
          from: process.env.SENDGRID_DEFAULT_FROM || 'noreply@nleos.com',
          subject: `Sales Game Plan: ${gamePlan.primaryCompanyName}`,
          text: `Please find attached the sales game plan for ${gamePlan.primaryCompanyName}.\n\nMeeting: ${gamePlan.meetingSubject}\nContact: ${gamePlan.primaryContactName}`,
          attachments: [
            {
              filename: `game-plan-${gamePlan.primaryCompanyName.replace(/\s/g, '-')}.pdf`,
              content: pdfBuffer
            }
          ]
        });

        strapi.log.info(`[Share Game Plan] User ${currentUser.id} shared game plan ${documentId} via email to ${email}`);

        return ctx.send({
          success: true,
          message: 'Game plan sent via email successfully'
        });

      } else if (method === 'link') {
        // Generate shareable link (simple implementation - could be enhanced with expiring tokens)
        const shareableLink = `${process.env.FRONTEND_URL}/salespilot/shared/${documentId}`;

        strapi.log.info(`[Share Game Plan] User ${currentUser.id} generated shareable link for game plan ${documentId}`);

        return ctx.send({
          success: true,
          shareableLink,
          message: 'Shareable link generated successfully'
        });
      }

    } catch (error) {
      strapi.log.error('[Share Game Plan] Error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to share game plan',
          details: error.message
        }
      });
    }
  },

  /**
   * POST /api/salespilot/regenerate-section
   * Regenerate a specific section of a game plan with AI
   */
  async regenerateSection(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    const { gamePlanId, section, chatContext, mode, existingContent } = ctx.request.body;

    if (!gamePlanId || !section) {
      return ctx.badRequest('Missing required fields: gamePlanId, section');
    }

    try {
      const gamePlanGenerator = require('../services/game-plan-generator');

      // Validate section name
      const validSections = ['companyAnalysis', 'contactPersona', 'influenceTactics', 'discussionPoints', 'objectionHandling'];
      if (!validSections.includes(section)) {
        return ctx.badRequest(`Invalid section name. Must be one of: ${validSections.join(', ')}`);
      }

      // Fetch game plan
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId: gamePlanId,
        populate: ['user']
      });

      if (!gamePlan) {
        return ctx.notFound('Game plan not found');
      }

      // Verify ownership
      if (gamePlan.user.id !== currentUser.id) {
        return ctx.forbidden('You can only regenerate your own game plans');
      }

      strapi.log.info(`[Regenerate Section] User ${currentUser.id} regenerating section "${section}" for game plan ${gamePlanId}`);

      // Generate new content for the specific section
      let newContent;

      switch (section) {
        case 'companyAnalysis':
          newContent = await gamePlanGenerator.generateCompanyAnalysis({
            companyName: gamePlan.primaryCompanyName,
            industry: (gamePlan as any).industry,
            researchData: (gamePlan as any).researchData || {},
            chatContext,
            mode,
            existingContent
          });
          break;

        case 'contactPersona':
          newContent = await gamePlanGenerator.generateContactPersona({
            contactName: gamePlan.primaryContactName,
            contactTitle: gamePlan.primaryContactTitle,
            companyName: gamePlan.primaryCompanyName,
            industry: (gamePlan as any).industry,
            researchData: (gamePlan as any).researchData || {},
            detailLevel: gamePlan.personaDetailLevel || 'Standard',
            chatContext,
            mode,
            existingContent
          });
          break;

        case 'influenceTactics':
          newContent = await gamePlanGenerator.generateInfluenceTactics({
            contactName: gamePlan.primaryContactName,
            contactTitle: gamePlan.primaryContactTitle,
            companyName: gamePlan.primaryCompanyName,
            meetingSubject: gamePlan.meetingSubject,
            desiredOutcome: gamePlan.desiredOutcome,
            framework: gamePlan.influenceFramework || 'Hybrid',
            companyAnalysis: gamePlan.companyAnalysis || '',
            contactPersona: gamePlan.contactPersona || '',
            chatContext,
            mode,
            existingContent
          });
          break;

        case 'discussionPoints':
          newContent = await gamePlanGenerator.generateDiscussionPoints({
            companyName: gamePlan.primaryCompanyName,
            meetingSubject: gamePlan.meetingSubject,
            desiredOutcome: gamePlan.desiredOutcome,
            companyAnalysis: gamePlan.companyAnalysis || '',
            contactPersona: gamePlan.contactPersona || '',
            chatContext,
            mode,
            existingContent
          });
          break;

        case 'objectionHandling':
          newContent = await gamePlanGenerator.generateObjectionHandling({
            companyName: gamePlan.primaryCompanyName,
            meetingSubject: gamePlan.meetingSubject,
            detailLevel: gamePlan.personaDetailLevel || 'Standard',
            companyAnalysis: gamePlan.companyAnalysis || '',
            contactPersona: gamePlan.contactPersona || '',
            chatContext,
            mode,
            existingContent
          });
          break;
      }

      // Content generated - frontend will call applyImprovement to save
      strapi.log.info(`[Regenerate Section] Generated new content for section "${section}"`);

      return ctx.send({
        success: true,
        data: {
          section,
          content: newContent
        },
        message: 'Content generated successfully (not saved - use Apply to save)'
      });

    } catch (error) {
      strapi.log.error('[Regenerate Section] Error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to regenerate section',
          details: error.message
        }
      });
    }
  },

  /**
   * POST /api/salespilot/delete-section
   * Delete a specific section from a game plan
   */
  async deleteSection(ctx) {
    const currentUser = await authenticateRequest(ctx);
    if (!currentUser) {
      return ctx.unauthorized('Authentication required');
    }

    const { gamePlanId, section } = ctx.request.body;

    if (!gamePlanId || !section) {
      return ctx.badRequest('Missing required fields: gamePlanId, section');
    }

    try {
      // Validate section name
      const validSections = ['companyAnalysis', 'contactPersona', 'influenceTactics', 'discussionPoints', 'objectionHandling'];
      if (!validSections.includes(section)) {
        return ctx.badRequest(`Invalid section name. Must be one of: ${validSections.join(', ')}`);
      }

      // Fetch game plan
      const gamePlan = await strapi.documents('api::sales-game-plan.sales-game-plan').findOne({
        documentId: gamePlanId,
        populate: ['user']
      });

      if (!gamePlan) {
        return ctx.notFound('Game plan not found');
      }

      // Verify ownership
      if (gamePlan.user.id !== currentUser.id) {
        return ctx.forbidden('You can only delete sections from your own game plans');
      }

      strapi.log.info(`[Delete Section] User ${currentUser.id} deleting section "${section}" from game plan ${gamePlanId}`);

      // Delete the section by setting it to null
      await strapi.documents('api::sales-game-plan.sales-game-plan').update({
        documentId: gamePlanId,
        data: {
          [section]: null
        }
      });

      strapi.log.info(`[Delete Section] Successfully deleted section "${section}"`);

      return ctx.send({
        success: true,
        data: {
          section
        },
        message: 'Section deleted successfully'
      });

    } catch (error) {
      strapi.log.error('[Delete Section] Error:', error);
      return ctx.internalServerError({
        error: {
          message: 'Failed to delete section',
          details: error.message
        }
      });
    }
  }
};
