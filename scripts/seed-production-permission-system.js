/**
 * Production Permission System Seeding Script
 *
 * This script populates the permission system tables with:
 * - 7 menu permissions (Home, Opinions, Opinion Generator, AI Test, User Profile, Users Management, Permission Profiles)
 *   - 5 regular menus (home, opinions, opinion-generator, ai-test, user-profile)
 *   - 2 admin menus (users-management, permission-profiles)
 * - 3 system profiles (Full Access, Regular User, Read Only)
 * - Assigns existing users to appropriate profiles based on their userRole
 *
 * Run this ONCE after schema deployment to production
 *
 * Usage:
 *   - Via Render Shell: node scripts/seed-production-permission-system.js
 *   - Via Bootstrap: Automatically runs if database is empty
 */

module.exports = async function seedProductionPermissionSystem() {
  console.log('🌱 Seeding production permission system...');
  console.log('============================================\n');

  try {
    // Step 1: Create menu permissions
    console.log('📋 Step 1: Creating menu permissions...');

    const menuPermissions = [
      { key: 'home', displayName: 'Home', description: 'Homepage', menuIcon: '🏠', menuCategory: 'regular', isSystemMenu: true, sortOrder: 1 },
      { key: 'opinions', displayName: 'Opinions', description: 'View and rate opinions', menuIcon: '💭', menuCategory: 'regular', isSystemMenu: false, sortOrder: 2 },
      { key: 'opinion-generator', displayName: 'Opinion Generator', description: 'AI opinion generation', menuIcon: '🤖', menuCategory: 'regular', isSystemMenu: false, sortOrder: 3 },
      { key: 'ai-test', displayName: 'AI Test', description: 'Claude AI chat interface', menuIcon: '🧪', menuCategory: 'regular', isSystemMenu: false, sortOrder: 4 },
      { key: 'user-profile', displayName: 'Profile', description: 'User profile page', menuIcon: '👤', menuCategory: 'regular', isSystemMenu: true, sortOrder: 5 },
      { key: 'users-management', displayName: 'Users Management', description: 'User management (admin)', menuIcon: '👥', menuCategory: 'admin', isSystemMenu: false, sortOrder: 6 },
      { key: 'permission-profiles', displayName: 'Permission Profiles', description: 'Permission management (admin)', menuIcon: '🔐', menuCategory: 'admin', isSystemMenu: false, sortOrder: 7 }
    ];

    const createdMenus = [];
    for (const menu of menuPermissions) {
      const existing = await strapi.db.query('api::menu-permission.menu-permission').findOne({
        where: { key: menu.key }
      });

      if (existing) {
        console.log(`  ✓ Menu already exists: ${menu.key}`);
        createdMenus.push(existing);
      } else {
        const created = await strapi.entityService.create('api::menu-permission.menu-permission', {
          data: menu
        });
        console.log(`  ✓ Created menu: ${menu.key}`);
        createdMenus.push(created);
      }
    }

    console.log(`✅ Menu permissions complete: ${createdMenus.length} menus\n`);

    // Step 2: Create permission profiles
    console.log('👥 Step 2: Creating permission profiles...');

    const profiles = [
      {
        name: 'Full Access',
        description: 'Complete access to all menus (default for sysadmin)',
        isSystemProfile: true,
        menuKeys: ['home', 'opinions', 'opinion-generator', 'ai-test', 'user-profile', 'users-management', 'permission-profiles']
      },
      {
        name: 'Regular User',
        description: 'Standard user access (home, opinions, opinion-generator, ai-test, profile)',
        isSystemProfile: true,
        menuKeys: ['home', 'opinions', 'opinion-generator', 'ai-test', 'user-profile']
      },
      {
        name: 'Read Only',
        description: 'Limited access (opinions viewing only)',
        isSystemProfile: true,
        menuKeys: ['home', 'opinions', 'user-profile']
      }
    ];

    const createdProfiles = [];
    for (const profile of profiles) {
      const existing = await strapi.db.query('api::permission-profile.permission-profile').findOne({
        where: { name: profile.name }
      });

      if (existing) {
        console.log(`  ✓ Profile already exists: ${profile.name}`);
        createdProfiles.push(existing);
      } else {
        // Get menu IDs for this profile
        const menuIds = createdMenus
          .filter(m => profile.menuKeys.includes(m.key))
          .map(m => m.id);

        const created = await strapi.entityService.create('api::permission-profile.permission-profile', {
          data: {
            name: profile.name,
            description: profile.description,
            isSystemProfile: profile.isSystemProfile,
            menuPermissions: menuIds
          }
        });
        console.log(`  ✓ Created profile: ${profile.name} (${menuIds.length} menus)`);
        createdProfiles.push(created);
      }
    }

    console.log(`✅ Permission profiles complete: ${createdProfiles.length} profiles\n`);

    // Step 3: Assign users to profiles
    console.log('🔗 Step 3: Assigning users to profiles...');

    const allUsers = await strapi.db.query('plugin::users-permissions.user').findMany();
    console.log(`   Found ${allUsers.length} users in database`);

    const fullAccessProfile = createdProfiles.find(p => p.name === 'Full Access');
    const regularUserProfile = createdProfiles.find(p => p.name === 'Regular User');

    let assignedCount = 0;
    let skippedCount = 0;

    for (const user of allUsers) {
      // Check if user already has a primary profile using direct SQL
      // This avoids Strapi 5 populate issues
      const result = await strapi.db.connection.raw(
        'SELECT primary_profile_id FROM up_users WHERE id = ?',
        [user.id]
      );

      const hasPrimaryProfile = result && result[0] && result[0].primary_profile_id;

      if (hasPrimaryProfile) {
        console.log(`  ⊙ ${user.username} already has a profile (ID: ${hasPrimaryProfile})`);
        skippedCount++;
        continue;
      }

      // Assign based on userRole
      const profileToAssign = user.userRole === 'sysadmin' ? fullAccessProfile : regularUserProfile;

      // Update using direct SQL to avoid Strapi 5 relation issues
      await strapi.db.connection.raw(
        'UPDATE up_users SET primary_profile_id = ? WHERE id = ?',
        [profileToAssign.id, user.id]
      );

      console.log(`  ✓ Assigned ${user.username} (${user.userRole}) → ${profileToAssign.name}`);
      assignedCount++;
    }

    console.log(`✅ User assignments complete: ${assignedCount} assigned, ${skippedCount} skipped\n`);

    // Summary
    console.log('============================================');
    console.log('✅ SEEDING COMPLETE!');
    console.log('============================================');
    console.log(`   Menu permissions created: ${createdMenus.length}`);
    console.log(`   Permission profiles created: ${createdProfiles.length}`);
    console.log(`   Users assigned to profiles: ${assignedCount}`);
    console.log(`   Users already had profiles: ${skippedCount}`);
    console.log('============================================\n');

    return {
      success: true,
      menus: createdMenus.length,
      profiles: createdProfiles.length,
      usersAssigned: assignedCount,
      usersSkipped: skippedCount
    };

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    console.error('   Error details:', error.message);
    console.error('   Stack trace:', error.stack);
    throw error;
  }
};

// Allow running directly via node
if (require.main === module) {
  // Load Strapi instance for standalone execution
  const Strapi = require('@strapi/strapi');

  (async () => {
    const appContext = await Strapi().load();
    const app = appContext.start();

    try {
      await module.exports();
      console.log('✅ Seeding script completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Seeding script failed!');
      process.exit(1);
    }
  })();
}
