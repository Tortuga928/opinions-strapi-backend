/**
 * Users-Permissions Plugin Extension
 * Registers custom controllers and services
 */

const authController = require('./controllers/auth');

module.exports = (plugin) => {
  // Extend auth controller
  authController(plugin);

  return plugin;
};
