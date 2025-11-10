// Simple test to check if the route is working
// This doesn't require external dependencies

console.log('🧪 Testing Route Registration');
console.log('='.repeat(50));

// Test if the server is running by making a simple HTTP request
async function testRoute() {
    try {
        // Use fetch (available in Node.js 18+)
        const response = await fetch('http://localhost:3000/health');
        if (response.ok) {
            console.log('✅ Server is running');

            // Test the specific route
            try {
                const routeResponse = await fetch('http://localhost:3000/api/users/principal/division/f98eeccd-d3ff-49b9-9d0d-c433ccf3f567/messages');
                console.log(`Route response status: ${routeResponse.status}`);

                if (routeResponse.status === 401) {
                    console.log('✅ Route is working! Got 401 Unauthorized (expected - needs authentication)');
                } else if (routeResponse.status === 404) {
                    console.log('❌ Route still not found - 404 Not Found');
                } else {
                    console.log(`❌ Unexpected status: ${routeResponse.status}`);
                }
            } catch (routeError) {
                console.log('❌ Route test failed:', routeError.message);
            }
        } else {
            console.log('❌ Server health check failed');
        }
    } catch (error) {
        console.log('❌ Server is not running or not accessible:', error.message);
        console.log('Please make sure your server is running on port 3000');
    }
}

// Run the test
testRoute().then(() => {
    console.log('\n✨ Route test completed!');
}).catch(error => {
    console.error('💥 Route test failed:', error.message);
});
