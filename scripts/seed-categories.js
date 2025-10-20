/**
 * Seed Opinion Categories
 * Creates the 10 predefined opinion categories
 *
 * This script is called by seed-master.js during bootstrap
 * or can be run standalone for testing
 *
 * Usage:
 *   - Via Bootstrap: Automatically runs on empty database
 *   - Via Node: node scripts/seed-categories.js (requires Strapi instance)
 */

module.exports = async function seedCategories() {
  console.log('📋 Seeding categories...');

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

  try {
    // Check if categories already exist
    const existingCategories = await strapi.entityService.findMany('api::category.category');

    if (existingCategories.length === 0) {
      // Create all categories
      for (const category of predefinedCategories) {
        await strapi.entityService.create('api::category.category', {
          data: category
        });
        console.log(`  + Created category: ${category.name}`);
      }
      console.log(`✅ Categories seeded: ${predefinedCategories.length} categories created\n`);
    } else {
      console.log(`  ✓ Categories already exist (${existingCategories.length} found)`);
      console.log('✅ Categories seeding skipped\n');
    }
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
};

// Allow standalone execution for testing
if (require.main === module) {
  console.log('⚠️  This script requires a running Strapi instance');
  console.log('    Run via: npm run strapi script scripts/seed-categories.js');
  process.exit(1);
}
