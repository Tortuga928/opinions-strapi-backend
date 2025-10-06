/**
 * Test script for user-activity-log endpoints
 * Run with: node scripts/test-notifications.js
 */

const axios = require('axios');

const PORT = process.env.PORT || 1341;
const BASE_URL = `http://localhost:${PORT}`;

async function testNotifications() {
  try {
    console.log('🧪 Testing User Activity Log (Notifications) System\n');

    // Step 1: Login to get fresh JWT token
    console.log('📋 Step 1: Logging in to get JWT token...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/local`, {
      identifier: 'testsysadmin',
      password: 'TestAdmin123!'
    });

    const token = loginResponse.data.jwt;
    const userId = loginResponse.data.user.id;
    console.log(`✅ Logged in as user ${userId}\n`);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // Step 2: Test GET /api/user-activity-logs (find)
    console.log('📋 Step 2: Testing GET /api/user-activity-logs...');
    try {
      const logsResponse = await axios.get(`${BASE_URL}/api/user-activity-logs`, { headers });
      console.log(`✅ Retrieved ${logsResponse.data.data?.length || 0} activity logs`);
      if (logsResponse.data.data?.length > 0) {
        console.log('   First log:', JSON.stringify(logsResponse.data.data[0], null, 2));
      }
    } catch (error) {
      console.error('❌ Failed:', error.response?.status, error.response?.data);
    }
    console.log();

    // Step 3: Test GET /api/user-activity-logs/count with isRead filter
    console.log('📋 Step 3: Testing GET /api/user-activity-logs/count (unread)...');
    try {
      const countResponse = await axios.get(
        `${BASE_URL}/api/user-activity-logs/count?filters[isRead][$eq]=false`,
        { headers }
      );
      console.log(`✅ Unread count:`, countResponse.data);
    } catch (error) {
      console.error('❌ Failed:', error.response?.status, error.response?.data);
    }
    console.log();

    // Step 4: Test POST /api/user-activity-logs/mark-all-read
    console.log('📋 Step 4: Testing POST /api/user-activity-logs/mark-all-read...');
    try {
      const markReadResponse = await axios.post(
        `${BASE_URL}/api/user-activity-logs/mark-all-read`,
        {},
        { headers }
      );
      console.log(`✅ Response:`, markReadResponse.data);
    } catch (error) {
      console.error('❌ Failed:', error.response?.status, error.response?.data);
    }
    console.log();

    // Step 5: Verify unread count is now 0
    console.log('📋 Step 5: Verifying unread count after mark-all-read...');
    try {
      const verifyCountResponse = await axios.get(
        `${BASE_URL}/api/user-activity-logs/count?filters[isRead][$eq]=false`,
        { headers }
      );
      console.log(`✅ Unread count after mark-all-read:`, verifyCountResponse.data);
    } catch (error) {
      console.error('❌ Failed:', error.response?.status, error.response?.data);
    }
    console.log();

    console.log('🎉 Notification system test complete!');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testNotifications();
