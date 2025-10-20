/**
 * Seed Menu Permissions
 * Creates the 7 core menu permissions with correct categories
 *
 * Usage:
 *   node seed-menu-permissions.js
 *
 * Or via psql:
 *   psql $DATABASE_URL -f seed-menu-permissions.sql
 */

const { Client } = require('pg');

const menuPermissions = [
  // Regular Menus (5)
  {
    key: 'home',
    displayName: 'Home',
    menuCategory: 'regular',
    sortOrder: 1,
    description: 'Home page',
    menuIcon: '🏠',
    isSystemMenu: true
  },
  {
    key: 'opinions',
    displayName: 'Opinions',
    menuCategory: 'regular',
    sortOrder: 2,
    description: 'Browse and rate opinions',
    menuIcon: '💭',
    isSystemMenu: true
  },
  {
    key: 'opinion-generator',
    displayName: 'Opinion Generator',
    menuCategory: 'regular',
    sortOrder: 3,
    description: 'AI-powered opinion generation',
    menuIcon: '🤖',
    isSystemMenu: true
  },
  {
    key: 'ai-test',
    displayName: 'AI Test',
    menuCategory: 'regular',
    sortOrder: 4,
    description: 'Test AI features',
    menuIcon: '🧪',
    isSystemMenu: true
  },
  {
    key: 'user-profile',
    displayName: 'User Profile',
    menuCategory: 'regular',
    sortOrder: 5,
    description: 'User profile and settings',
    menuIcon: '👤',
    isSystemMenu: true
  },

  // Admin Menus (2)
  {
    key: 'users-management',
    displayName: 'Users Management',
    menuCategory: 'admin',
    sortOrder: 6,
    description: 'Manage users and permissions',
    menuIcon: '👥',
    isSystemMenu: true
  },
  {
    key: 'permission-profiles',
    displayName: 'Permission Profiles',
    menuCategory: 'admin',
    sortOrder: 7,
    description: 'Manage permission profiles',
    menuIcon: '🔐',
    isSystemMenu: true
  }
];

async function seedMenuPermissions() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? {
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
    } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if menu_permissions table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'menu_permissions'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ menu_permissions table does not exist');
      process.exit(1);
    }

    console.log('\n📝 Seeding menu permissions...\n');

    for (const menu of menuPermissions) {
      // Check if menu already exists
      const existing = await client.query(
        'SELECT id FROM menu_permissions WHERE key = $1',
        [menu.key]
      );

      if (existing.rows.length > 0) {
        // Update existing menu
        await client.query(
          `UPDATE menu_permissions
           SET display_name = $1,
               menu_category = $2,
               sort_order = $3,
               description = $4,
               menu_icon = $5,
               is_system_menu = $6,
               updated_at = NOW()
           WHERE key = $7`,
          [
            menu.displayName,
            menu.menuCategory,
            menu.sortOrder,
            menu.description,
            menu.menuIcon,
            menu.isSystemMenu,
            menu.key
          ]
        );
        console.log(`  ✓ Updated: ${menu.key} (${menu.menuCategory})`);
      } else {
        // Insert new menu
        await client.query(
          `INSERT INTO menu_permissions
           (key, display_name, menu_category, sort_order, description, menu_icon, is_system_menu, created_at, updated_at, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())`,
          [
            menu.key,
            menu.displayName,
            menu.menuCategory,
            menu.sortOrder,
            menu.description,
            menu.menuIcon,
            menu.isSystemMenu
          ]
        );
        console.log(`  + Created: ${menu.key} (${menu.menuCategory})`);
      }
    }

    // Verify results
    const result = await client.query(`
      SELECT key, display_name, menu_category, sort_order
      FROM menu_permissions
      ORDER BY sort_order
    `);

    console.log('\n✅ Seeding complete!\n');
    console.log('📊 Current menu permissions:');
    console.log('─'.repeat(70));
    console.log('Key                    | Display Name        | Category | Order');
    console.log('─'.repeat(70));
    result.rows.forEach(row => {
      console.log(
        `${row.key.padEnd(23)}| ${row.display_name.padEnd(20)}| ${row.menu_category.padEnd(9)}| ${row.sort_order}`
      );
    });
    console.log('─'.repeat(70));
    console.log(`\nTotal: ${result.rows.length} menu permissions`);

  } catch (error) {
    console.error('❌ Error seeding menu permissions:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if executed directly
if (require.main === module) {
  seedMenuPermissions();
}

module.exports = { seedMenuPermissions, menuPermissions };
