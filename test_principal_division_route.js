const axios = require('axios');

// Test the principal division messages route
async function testPrincipalDivisionRoute() {
    const baseUrl = 'http://localhost:3000/api';
    const classDivisionId = 'f98eeccd-d3ff-49b9-9d0d-c433ccf3f567';

    console.log('🧪 Testing Principal Division Messages Route');
    console.log('='.repeat(60));

    // Test 1: Check if the route exists (without auth)
    console.log('\n1. Testing route existence (expecting 401 Unauthorized)...');
    try {
        const response = await axios.get(`${baseUrl}/users/principal/division/${classDivisionId}/messages`);
        console.log('❌ Unexpected success:', response.status);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Route exists - got 401 Unauthorized (expected)');
        } else if (error.response?.status === 404) {
            console.log('❌ Route not found - 404 Not Found');
            console.log('   This suggests the route is not properly registered');
        } else {
            console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
        }
    }

    // Test 2: Check route with different methods
    console.log('\n2. Testing different HTTP methods...');
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];

    for (const method of methods) {
        try {
            const response = await axios({
                method: method,
                url: `${baseUrl}/users/principal/division/${classDivisionId}/messages`
            });
            console.log(`✅ ${method}: ${response.status}`);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(`✅ ${method}: 401 Unauthorized (route exists)`);
            } else if (error.response?.status === 404) {
                console.log(`❌ ${method}: 404 Not Found (route missing)`);
            } else {
                console.log(`❌ ${method}: ${error.response?.status} ${error.response?.data?.message || ''}`);
            }
        }
    }

    // Test 3: Check if there are any conflicting routes
    console.log('\n3. Testing similar route patterns...');
    const testRoutes = [
        '/users/principal/division/test/messages',
        '/users/principal/division/123/messages',
        '/users/principal/division/messages',
        '/users/principal/division/',
        '/users/principal/',
        '/users/principal/chats'
    ];

    for (const route of testRoutes) {
        try {
            const response = await axios.get(`${baseUrl}${route}`);
            console.log(`✅ ${route}: ${response.status}`);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(`✅ ${route}: 401 Unauthorized (route exists)`);
            } else if (error.response?.status === 404) {
                console.log(`❌ ${route}: 404 Not Found`);
            } else {
                console.log(`❌ ${route}: ${error.response?.status}`);
            }
        }
    }

    // Test 4: Check server health
    console.log('\n4. Testing server health...');
    try {
        const response = await axios.get(`${baseUrl.replace('/api', '')}/health`);
        console.log('✅ Server health check:', response.data);
    } catch (error) {
        console.log('❌ Server health check failed:', error.message);
    }

    // Test 5: Check if users route is working
    console.log('\n5. Testing users route...');
    try {
        const response = await axios.get(`${baseUrl}/users`);
        console.log('✅ Users route accessible:', response.status);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Users route exists (401 Unauthorized - expected)');
        } else {
            console.log('❌ Users route error:', error.response?.status);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 Route Testing Summary:');
    console.log('If you see 401 Unauthorized for the target route, it exists but needs authentication.');
    console.log('If you see 404 Not Found, the route is not properly registered.');
    console.log('If you see other errors, there might be a server configuration issue.');
}

// Run the test
if (require.main === module) {
    testPrincipalDivisionRoute()
        .then(() => {
            console.log('\n✨ Route test completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Route test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testPrincipalDivisionRoute };
