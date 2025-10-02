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
        auth: {
          scope: ['api::quote-draft.quote-draft.generateQuote']
        }
      }
    },
    {
      method: 'DELETE',
      path: '/quote-drafts/delete-all',
      handler: 'quote-draft.deleteAllUserDrafts',
      config: {
        auth: {
          scope: ['api::quote-draft.quote-draft.deleteAllUserDrafts']
        }
      }
    }
  ]
};
