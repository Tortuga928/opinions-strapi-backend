/**
 * Compare User Accounts Script
 * Analyzes differences between working and broken user accounts
 *
 * Usage: node compare-user-accounts.js
 *
 * Compares:
 * - sjb@stevenbanke.com (working account)
 * - testsysadmin (broken account after password change)
 */

const { Client } = require('pg');

async function compareAccounts() {
  console.log('🔍 Comparing User Accounts\n');
  console.log('=' .repeat(80));

  // Use production database URL from Render environment variable
  // Get it from: Render Dashboard → Backend Service → Shell → echo $DATABASE_URL
  const databaseUrl = process.argv[2];

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not provided\n');
    console.log('Usage: node compare-user-accounts.js "<DATABASE_URL>"\n');
    console.log('Get DATABASE_URL from:');
    console.log('  1. Go to Render Dashboard');
    console.log('  2. Click on opinions-strapi-backend service');
    console.log('  3. Click "Shell" tab');
    console.log('  4. Run: echo $DATABASE_URL');
    console.log('  5. Copy the full postgres://... URL\n');
    process.exit(1);
  }

  // Connect to database
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Fetch both users
    const workingUser = await client.query(
      `SELECT * FROM up_users WHERE email = $1`,
      ['sjb@stevenbanke.com']
    );

    const brokenUser = await client.query(
      `SELECT * FROM up_users WHERE username = $1`,
      ['testsysadmin']
    );

    if (workingUser.rows.length === 0) {
      console.error('❌ Working user (sjb@stevenbanke.com) not found');
      return;
    }

    if (brokenUser.rows.length === 0) {
      console.error('❌ Broken user (testsysadmin) not found');
      return;
    }

    const working = workingUser.rows[0];
    const broken = brokenUser.rows[0];

    console.log('📊 Account Comparison\n');
    console.log('=' .repeat(80));

    // Compare all fields
    const allFields = Object.keys(working);
    const differences = [];
    const similarities = [];

    for (const field of allFields) {
      const workingVal = working[field];
      const brokenVal = broken[field];

      // Special handling for password field
      if (field === 'password') {
        console.log(`\n🔐 PASSWORD HASHES:\n`);
        console.log(`Working user password hash:`);
        console.log(`  ${workingVal}`);
        console.log(`  Length: ${workingVal ? workingVal.length : 0} chars`);
        console.log(`  Algorithm: ${workingVal ? (workingVal.startsWith('$2a$') || workingVal.startsWith('$2b$') ? 'bcrypt' : 'UNKNOWN') : 'null'}`);
        console.log();
        console.log(`Broken user password hash:`);
        console.log(`  ${brokenVal}`);
        console.log(`  Length: ${brokenVal ? brokenVal.length : 0} chars`);
        console.log(`  Algorithm: ${brokenVal ? (brokenVal.startsWith('$2a$') || brokenVal.startsWith('$2b$') ? 'bcrypt' : 'UNKNOWN') : 'null'}`);
        console.log();

        if (workingVal !== brokenVal) {
          differences.push({
            field: 'password',
            working: `${workingVal ? workingVal.substring(0, 20) + '...' : 'null'}`,
            broken: `${brokenVal ? brokenVal.substring(0, 20) + '...' : 'null'}`
          });
        }
        continue;
      }

      // Compare other fields
      if (JSON.stringify(workingVal) !== JSON.stringify(brokenVal)) {
        differences.push({
          field,
          working: workingVal,
          broken: brokenVal
        });
      } else {
        similarities.push(field);
      }
    }

    // Display differences
    console.log('🔴 DIFFERENCES:\n');
    console.log('=' .repeat(80));
    if (differences.length === 0) {
      console.log('✅ No differences found (identical accounts)');
    } else {
      console.table(differences);
    }

    // Display key similarities
    console.log('\n✅ KEY SIMILARITIES:\n');
    console.log('=' .repeat(80));
    const keyFields = ['blocked', 'confirmed', 'provider', 'role'];
    for (const field of keyFields) {
      if (similarities.includes(field)) {
        console.log(`  ✓ ${field}: ${working[field]}`);
      }
    }

    // Analyze password structure
    console.log('\n🔬 PASSWORD ANALYSIS:\n');
    console.log('=' .repeat(80));

    const bcrypt = require('bcryptjs');

    // Test if passwords are valid bcrypt hashes
    const workingHash = working.password;
    const brokenHash = broken.password;

    console.log('Working user password:');
    console.log(`  Starts with $2a$ or $2b$: ${workingHash && (workingHash.startsWith('$2a$') || workingHash.startsWith('$2b$'))}`);
    console.log(`  Has proper bcrypt structure: ${workingHash && workingHash.split('$').length === 4}`);
    console.log(`  Length matches bcrypt (60 chars): ${workingHash && workingHash.length === 60}`);

    console.log('\nBroken user password:');
    console.log(`  Starts with $2a$ or $2b$: ${brokenHash && (brokenHash.startsWith('$2a$') || brokenHash.startsWith('$2b$'))}`);
    console.log(`  Has proper bcrypt structure: ${brokenHash && brokenHash.split('$').length === 4}`);
    console.log(`  Length matches bcrypt (60 chars): ${brokenHash && brokenHash.length === 60}`);

    // Check for NULL or empty values
    console.log('\n🔍 NULL/EMPTY CHECK:\n');
    console.log('=' .repeat(80));
    const criticalFields = ['password', 'email', 'username', 'blocked', 'confirmed'];
    for (const field of criticalFields) {
      const workingEmpty = working[field] === null || working[field] === undefined || working[field] === '';
      const brokenEmpty = broken[field] === null || broken[field] === undefined || broken[field] === '';

      if (workingEmpty || brokenEmpty) {
        console.log(`  ⚠️  ${field}:`);
        console.log(`      Working: ${workingEmpty ? '❌ NULL/EMPTY' : '✅ Has value'}`);
        console.log(`      Broken:  ${brokenEmpty ? '❌ NULL/EMPTY' : '✅ Has value'}`);
      }
    }

    // Check reset tokens
    console.log('\n🔑 RESET TOKENS:\n');
    console.log('=' .repeat(80));
    const tokenFields = ['resetPasswordToken', 'resetPasswordExpires', 'oneTimeVerificationToken', 'oneTimeVerificationExpires'];
    console.log('Working user:');
    tokenFields.forEach(field => {
      console.log(`  ${field}: ${working[field] || 'null'}`);
    });
    console.log('\nBroken user:');
    tokenFields.forEach(field => {
      console.log(`  ${field}: ${broken[field] || 'null'}`);
    });

    console.log('\n' + '=' .repeat(80));
    console.log('✅ Analysis complete\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run comparison
compareAccounts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
