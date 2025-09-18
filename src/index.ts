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
  },
};
