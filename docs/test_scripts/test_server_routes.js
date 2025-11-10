import axios from 'axios';

async function testServerRoutes() {
    const baseUrl = 'http://localhost:3000';

    console.log('🧪 Testing Server and Routes');
    console.log('='.repeat(50));

    // Test 1: Check if server is running
    console.log('\n1. Testing server health...');
    try {
        const response = await axios.get(`${baseUrl}/health`);
        console.log('✅ Server is running:', response.data);
    } catch (error) {
        console.log('❌ Server is not running or not accessible:', error.message);
        return;
    }

    // Test 2: Check if users route is accessible
    console.log('\n2. Testing users route...');
    try {
        const response = await axios.get(`${baseUrl}/api/users`);
        console.log('❌ Unexpected success - should require authentication');
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Users route accessible - 401 Unauthorized (expected)');
        } else {
            console.log('❌ Users route error:', error.response?.status, error.response?.data);
        }
    }

    // Test 3: Check specific principal routes
    console.log('\n3. Testing principal routes...');
    const principalRoutes = [
        '/api/users/principal/chats',
        '/api/users/principal/division/test-id/messages'
    ];

    for (const route of principalRoutes) {
        try {
            const response = await axios.get(`${baseUrl}${route}`);
            console.log(`❌ ${route}: Unexpected success - should require authentication`);
        } catch (error) {
            if (error.response?.status === 401) {
                console.log(`✅ ${route}: 401 Unauthorized (route exists)`);
            } else if (error.response?.status === 404) {
                console.log(`❌ ${route}: 404 Not Found (route missing)`);
            } else {
                console.log(`❌ ${route}: ${error.response?.status} ${error.response?.data?.message || ''}`);
            }
        }
    }

    // Test 4: Check with the actual UUID
    console.log('\n4. Testing with actual UUID...');
    const actualRoute = '/api/users/principal/division/f98eeccd-d3ff-49b9-9d0d-c433ccf3f567/messages';
    try {
        const response = await axios.get(`${baseUrl}${actualRoute}`);
        console.log(`❌ ${actualRoute}: Unexpected success - should require authentication`);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log(`✅ ${actualRoute}: 401 Unauthorized (route exists and working!)`);
        } else if (error.response?.status === 404) {
            console.log(`❌ ${actualRoute}: 404 Not Found (route still missing)`);
        } else {
            console.log(`❌ ${actualRoute}: ${error.response?.status} ${error.response?.data?.message || ''}`);
        }
    }

    // Test 5: Check if there are any conflicting routes
    console.log('\n5. Testing similar route patterns...');
    const similarRoutes = [
        '/api/users/principal/division',
        '/api/users/principal/division/',
        '/api/users/principal/division/test',
        '/api/users/principal/division/test/messages'
    ];

    for (const route of similarRoutes) {
        try {
            const response = await axios.get(`${baseUrl}${route}`);
            console.log(`❌ ${route}: Unexpected success - should require authentication`);
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

    console.log('\n' + '='.repeat(50));
    console.log('🎯 Server Routes Test Summary:');
    console.log('If you see 401 for the target route, it exists and needs authentication.');
    console.log('If you see 404, the route is not registered properly.');
    console.log('If you see other errors, there might be a server configuration issue.');
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    testServerRoutes()
        .then(() => {
            console.log('\n✨ Server routes test completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Server routes test failed:', error.message);
            process.exit(1);
        });
}

export { testServerRoutes };
