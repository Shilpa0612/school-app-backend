import axios from 'axios';

async function testRouteFix() {
    const baseUrl = 'http://localhost:3000/api';
    const classDivisionId = 'f98eeccd-d3ff-49b9-9d0d-c433ccf3f567';

    console.log('🧪 Testing Route Fix');
    console.log('='.repeat(50));

    try {
        // Test the specific route that was failing
        const response = await axios.get(`${baseUrl}/users/principal/division/${classDivisionId}/messages`);
        console.log('❌ Unexpected success - should require authentication');
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Route is now working! Got 401 Unauthorized (expected)');
            console.log('   This means the route is properly registered and accessible');
        } else if (error.response?.status === 404) {
            console.log('❌ Route still not found - 404 Not Found');
            console.log('   The route ordering fix did not work');
        } else {
            console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
        }
    }

    // Test the general chats route to make sure it still works
    try {
        const response = await axios.get(`${baseUrl}/users/principal/chats`);
        console.log('❌ Unexpected success - should require authentication');
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ General chats route still working - 401 Unauthorized (expected)');
        } else {
            console.log('❌ General chats route error:', error.response?.status);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎯 Route Fix Test Summary:');
    console.log('If you see 401 Unauthorized for both routes, the fix worked!');
    console.log('If you see 404 for the division route, there might be another issue.');
}

// Run the test
if (require.main === module) {
    testRouteFix()
        .then(() => {
            console.log('\n✨ Route fix test completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Route fix test failed:', error.message);
            process.exit(1);
        });
}

export { testRouteFix };
