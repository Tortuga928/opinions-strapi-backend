/**
 * Custom routes for user-activity-log
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/user-activity-logs/count',
      handler: 'user-activity-log.count',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::user-activity-auth']
      }
    },
    {
      method: 'POST',
      path: '/user-activity-logs/mark-all-read',
      handler: 'user-activity-log.markAllAsRead',
      config: {
        auth: false,
        policies: [],
        middlewares: ['global::user-activity-auth']
      }
    }
  ]
};
