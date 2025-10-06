const axios = require('axios');

async function testLogin() {
  try {
    console.log('Testing login...');

    // Try to register a new user first
    try {
      const registerResponse = await axios.post('http://localhost:1341/api/auth/local/register', {
        username: 'testuser_' + Date.now(),
        email: `testuser${Date.now()}@test.com`,
        password: 'TestPass123!'
      });

      console.log('✅ Registration successful!');
      console.log('User ID:', registerResponse.data.user.id);
      console.log('JWT Token:', registerResponse.data.jwt);

      const token = registerResponse.data.jwt;

      // Now test the user-activity-logs endpoint
      console.log('\nTesting /api/user-activity-logs endpoint...');
      const logsResponse = await axios.get('http://localhost:1341/api/user-activity-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      console.log('✅ Success! Response:', JSON.stringify(logsResponse.data, null, 2));

    } catch (regError) {
      console.error('❌ Registration failed:', regError.response?.data || regError.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testLogin();
