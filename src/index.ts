// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Seed predefined categories
    const predefinedCategories = [
      { name: 'Technology', color: '#3B82F6', description: 'Technology and software opinions' },
      { name: 'Politics', color: '#EF4444', description: 'Political and social issues' },
      { name: 'Entertainment', color: '#8B5CF6', description: 'Movies, TV, music, and entertainment' },
      { name: 'Sports', color: '#10B981', description: 'Sports and athletics' },
      { name: 'Health', color: '#06B6D4', description: 'Health and wellness topics' },
      { name: 'Business', color: '#F59E0B', description: 'Business and finance' },
      { name: 'Education', color: '#84CC16', description: 'Education and learning' },
      { name: 'Environment', color: '#22C55E', description: 'Environmental and climate issues' },
      { name: 'Food', color: '#F97316', description: 'Food and dining' },
      { name: 'Travel', color: '#14B8A6', description: 'Travel and tourism' }
    ];

    // Check if categories already exist
    const existingCategories = await strapi.entityService.findMany('api::category.category');

    if (existingCategories.length === 0) {
      console.log('🌱 Seeding predefined categories...');

      for (const category of predefinedCategories) {
        await strapi.entityService.create('api::category.category', {
          data: category
        });
      }

      console.log('✅ Categories seeded successfully');
    } else {
      console.log('📋 Categories already exist, skipping seed');
    }

    // Configure quote-draft permissions for authenticated users
    try {
      const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
      const authenticatedRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'authenticated' } });

      if (authenticatedRole) {
        const currentPermissions = await pluginStore.get({ key: 'grant' });

        // Set quote-draft permissions
        const quoteDraftPermissions = {
          controllers: {
            'quote-draft': {
              find: { enabled: true },
              findOne: { enabled: true },
              create: { enabled: true },
              update: { enabled: true },
              delete: { enabled: true },
              generateQuote: { enabled: true },
              deleteAllUserDrafts: { enabled: true }
            }
          }
        };

        // Merge with existing permissions
        if (!currentPermissions.authenticated) {
          currentPermissions.authenticated = {};
        }
        if (!currentPermissions.authenticated['api::quote-draft']) {
          currentPermissions.authenticated['api::quote-draft'] = {};
        }

        currentPermissions.authenticated['api::quote-draft'] = quoteDraftPermissions;

        await pluginStore.set({ key: 'grant', value: currentPermissions });
        console.log('✅ Quote-draft permissions configured');
      }
    } catch (error) {
      console.error('❌ Error configuring quote-draft permissions:', error);
    }
  },
};
