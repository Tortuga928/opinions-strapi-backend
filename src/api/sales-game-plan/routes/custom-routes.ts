/**
 * Custom routes for sales-game-plan
 *
 * Approval workflow, feedback, and sharing endpoints
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/sales-game-plans/:documentId/submit-approval',
      handler: 'sales-game-plan.submitApproval',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/sales-game-plans/:documentId/approve',
      handler: 'sales-game-plan.approve',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/sales-game-plans/:documentId/reject',
      handler: 'sales-game-plan.reject',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'POST',
      path: '/sales-game-plans/:documentId/feedback',
      handler: 'sales-game-plan.addFeedback',
      config: {
        auth: false  // Auth handled in controller
      }
    },
    {
      method: 'GET',
      path: '/sales-game-plans/shared/:token',
      handler: 'sales-game-plan.viewShared',
      config: {
        auth: false  // Public endpoint with token validation
      }
    }
  ]
};
