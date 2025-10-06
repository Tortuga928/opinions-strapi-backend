/**
 * Get JWT token for testsysadmin user by calling the login API
 */

const http = require('http');

const loginData = JSON.stringify({
  identifier: 'testsysadmin',
  email: 'testsysadmin@test.com'
});

// First, let's try to register the user if it doesn't exist
const registerData = JSON.stringify({
  username: 'testsysadmin',
  email: 'testsysadmin@test.com',
  password: 'TestAdmin123!'
});

console.log('Attempting to register testsysadmin...');

const registerOptions = {
  hostname: 'localhost',
  port: 1341,
  path: '/api/auth/local/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': registerData.length
  }
};

const registerReq = http.request(registerOptions, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(data);

    if (res.statusCode === 200) {
      console.log('✅ User registered successfully');
      console.log('User ID:', response.user.id);
      console.log('📝 JWT Token:', response.jwt);
      console.log('\n💡 Use this token in your tests:');
      console.log(`export TOKEN='${response.jwt}'`);
    } else {
      console.log('⚠️  Registration failed (user may already exist):', response.error?.message);
      console.log('\nUser likely already exists. You need to:');
      console.log('1. Use Strapi admin panel to update user role to "sysadmin"');
      console.log('2. Or login via frontend to get a JWT token');
    }
  });
});

registerReq.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

registerReq.write(registerData);
registerReq.end();
