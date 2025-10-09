/**
 * Users-Permissions Plugin Extension
 * Registers custom controllers and services
 */

const authController = require('./controllers/auth');

module.exports = (plugin) => {
  // REMOVED FOR PRODUCTION: console.log('[strapi-server.js] Loading users-permissions extension');

  // Extend auth controller
  authController(plugin);

  // REMOVED FOR PRODUCTION: console.log('[strapi-server.js] Auth controller extended successfully');

  return plugin;
};
