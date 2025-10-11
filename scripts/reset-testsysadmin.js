const bcrypt = require('bcryptjs');

async function resetTestSysadmin() {
  // This script resets the testsysadmin password
  const password = 'TestAdmin123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log('='.repeat(60));
  console.log('Password for testsysadmin:', password);
  console.log('Hashed password:', hashedPassword);
  console.log('='.repeat(60));
  console.log('\nTo update in database, run:');
  console.log(`UPDATE up_users SET password='${hashedPassword}' WHERE username='testsysadmin';`);
  console.log('='.repeat(60));
}

resetTestSysadmin();
