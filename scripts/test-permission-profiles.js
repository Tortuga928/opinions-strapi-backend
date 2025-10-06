/**
 * Test all 5 permission profile endpoints
 */

const http = require('http');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTUsImlhdCI6MTc1OTY5NTExNywiZXhwIjoxNzYyMjg3MTE3fQ.9DIbxOAryUGGq-QG_OrFRJKxH_keEvqucc0KtXQJq10';
const BASE_URL = 'http://localhost:1341';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 1341,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Permission Profile Endpoints\n');
  console.log('=' .repeat(60));

  // Test 1: List all permission profiles
  console.log('\n📋 Test 1: GET /api/permission-profiles');
  try {
    const result = await makeRequest('GET', '/api/permission-profiles');
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.log(`❌ Error:`, error.message);
  }

  // Test 2: Create permission profile
  console.log('\n📋 Test 2: POST /api/permission-profiles');
  let profileId = null;
  try {
    const result = await makeRequest('POST', '/api/permission-profiles', {
      name: 'Test Profile',
      description: 'Test profile for automated testing',
      permissions: ['read:opinions', 'write:opinions', 'delete:opinions'],
      isSystemProfile: false
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));

    if (result.data && result.data.data) {
      profileId = result.data.data.id;
    }
  } catch (error) {
    console.log(`❌ Error:`, error.message);
  }

  if (!profileId) {
    console.log('\n⚠️  Cannot continue tests without a profile ID');
    return;
  }

  // Test 3: Get single permission profile
  console.log(`\n📋 Test 3: GET /api/permission-profiles/${profileId}`);
  try {
    const result = await makeRequest('GET', `/api/permission-profiles/${profileId}`);
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.log(`❌ Error:`, error.message);
  }

  // Test 4: Update permission profile
  console.log(`\n📋 Test 4: PUT /api/permission-profiles/${profileId}`);
  try {
    const result = await makeRequest('PUT', `/api/permission-profiles/${profileId}`, {
      description: 'Updated test profile description',
      permissions: ['read:opinions', 'write:opinions']
    });
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.log(`❌ Error:`, error.message);
  }

  // Test 5: Delete permission profile
  console.log(`\n📋 Test 5: DELETE /api/permission-profiles/${profileId}`);
  try {
    const result = await makeRequest('DELETE', `/api/permission-profiles/${profileId}`);
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.log(`❌ Error:`, error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');
}

runTests();
