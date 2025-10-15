const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Checking Schema Files...\n');

const contentTypes = [
  'category',
  'login-history',
  'menu-permission',
  'opinion',
  'permission-profile',
  'quote-draft',
  'statement',
  'user-activity-log',
  'user-rating'
];

let hasErrors = false;

contentTypes.forEach(type => {
  const schemaPath = `src/api/${type}/content-types/${type}/schema.json`;

  // Check file exists
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Missing: ${schemaPath}`);
    hasErrors = true;
    return;
  }

  // Check file is tracked in git
  try {
    const result = execSync(`git ls-files ${schemaPath}`).toString().trim();
    if (!result) {
      console.error(`❌ Not in git: ${schemaPath}`);
      hasErrors = true;
      return;
    }
  } catch (e) {
    console.error(`❌ Git error for: ${schemaPath}`);
    hasErrors = true;
    return;
  }

  // Check file is not empty
  const content = fs.readFileSync(schemaPath, 'utf8');
  if (content.length < 50) {
    console.error(`❌ Empty/Invalid: ${schemaPath}`);
    hasErrors = true;
    return;
  }

  console.log(`✅ ${type}`);
});

if (hasErrors) {
  console.error('\n❌ Schema check FAILED');
  process.exit(1);
}

console.log('\n✅ All schema files verified');
