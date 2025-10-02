/**
 * Custom routes for quote-draft
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/quote-drafts/generate',
      handler: 'quote-draft.generateQuote',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'DELETE',
      path: '/quote-drafts/delete-all',
      handler: 'quote-draft.deleteAllUserDrafts',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/quote-drafts/:id/publish',
      handler: 'quote-draft.publish',
      config: {
        auth: false, // Auth handled by middleware below
        policies: [],
        middlewares: ['global::quote-draft-auth']
      }
    }
  ]
};
