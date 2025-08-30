const fetch = require('node-fetch');

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com';

async function testCalendarFallback() {
    console.log('🔍 Testing calendar endpoints with fallback logic...\n');

    try {
        // Test 1: Basic calendar events endpoint
        console.log('1. Testing /api/calendar/events...');
        const response = await fetch(`${BASE_URL}/api/calendar/events`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('   Status:', response.status);
        if (response.status === 401) {
            console.log('   ✅ Correctly requires authentication');
        } else if (response.status === 500) {
            console.log('   ❌ Server error - check logs');
        } else {
            console.log('   ⚠️ Unexpected status');
        }

        const data = await response.text();
        console.log('   Response:', data.substring(0, 200));
        console.log('');

        // Test 2: Calendar events with status filter
        console.log('2. Testing /api/calendar/events?status=pending...');
        const response2 = await fetch(`${BASE_URL}/api/calendar/events?status=pending`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('   Status:', response2.status);
        if (response2.status === 401) {
            console.log('   ✅ Correctly requires authentication');
        } else if (response2.status === 500) {
            console.log('   ❌ Server error - check logs');
        } else {
            console.log('   ⚠️ Unexpected status');
        }

        const data2 = await response2.text();
        console.log('   Response:', data2.substring(0, 200));
        console.log('');

        // Test 3: Pending events endpoint
        console.log('3. Testing /api/calendar/events/pending...');
        const response3 = await fetch(`${BASE_URL}/api/calendar/events/pending`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('   Status:', response3.status);
        if (response3.status === 401) {
            console.log('   ✅ Correctly requires authentication');
        } else if (response3.status === 500) {
            console.log('   ❌ Server error - check logs');
        } else {
            console.log('   ⚠️ Unexpected status');
        }

        const data3 = await response3.text();
        console.log('   Response:', data3.substring(0, 200));

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }

    console.log('\n🎯 Calendar fallback tests completed!');
    console.log('\n💡 If you see 401 errors, the endpoints are working but need authentication.');
    console.log('💡 If you see 500 errors, there are still issues with the fallback logic.');
}

testCalendarFallback().catch(console.error);
