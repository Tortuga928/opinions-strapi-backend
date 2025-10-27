/**
 * SalesPilot Conversation Routes
 *
 * Custom routes for conversational AI interface
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/salespilot/conversation',
      handler: 'salespilot-conversation.processMessage',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/salespilot/find-urls',
      handler: 'salespilot-conversation.findUrls',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/salespilot/research',
      handler: 'salespilot-conversation.performResearch',
      config: {
        auth: false, // Will check auth manually in controller
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/salespilot/generate-analysis',
      handler: 'salespilot-conversation.generateAnalysis',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'GET',
      path: '/salespilot/analysis-progress/:analysisId',
      handler: 'salespilot-conversation.streamAnalysisProgress',
      config: {
        auth: false  // Auth handled in controller (SSE endpoint)
      }
    },
    {
      method: 'GET',
      path: '/salespilot/analysis-status/:analysisId',
      handler: 'salespilot-conversation.getAnalysisStatus',
      config: {
        auth: false  // Auth handled in controller (Polling endpoint)
      }
    },
    {
      method: 'POST',
      path: '/salespilot/generate-materials',
      handler: 'salespilot-conversation.generateMaterials',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/salespilot/improve-content',
      handler: 'salespilot-conversation.improveContent',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/salespilot/apply-improvement',
      handler: 'salespilot-conversation.applyImprovement',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'GET',
      path: '/salespilot/game-plans',
      handler: 'salespilot-conversation.listGamePlans',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'DELETE',
      path: '/salespilot/game-plans/:documentId',
      handler: 'salespilot-conversation.deleteGamePlan',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/salespilot/game-plans/:documentId/duplicate',
      handler: 'salespilot-conversation.duplicateGamePlan',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'GET',
      path: '/salespilot/game-plans/:documentId/export',
      handler: 'salespilot-conversation.exportGamePlan',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/salespilot/game-plans/:documentId/share',
      handler: 'salespilot-conversation.shareGamePlan',
      config: {
        auth: false  // Auth handled in controller
      }
    }
  ]
};
