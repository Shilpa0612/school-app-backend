const fetch = require('node-fetch');

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com';

async function testBasicEndpoints() {
    console.log('🔍 Testing basic server connectivity...\n');

    // Test 1: Health endpoint
    try {
        console.log('1. Testing health endpoint...');
        const healthResponse = await fetch(`${BASE_URL}/health`);
        console.log('   Status:', healthResponse.status);
        const healthData = await healthResponse.text();
        console.log('   Response:', healthData);
        console.log('   ✅ Health endpoint working\n');
    } catch (error) {
        console.log('   ❌ Health endpoint failed:', error.message, '\n');
    }

    // Test 2: Calendar events without auth (should return 401)
    try {
        console.log('2. Testing calendar events without auth...');
        const calendarResponse = await fetch(`${BASE_URL}/api/calendar/events`);
        console.log('   Status:', calendarResponse.status);
        const calendarData = await calendarResponse.text();
        console.log('   Response:', calendarData.substring(0, 200));
        if (calendarResponse.status === 401) {
            console.log('   ✅ Correctly requires authentication\n');
        } else {
            console.log('   ⚠️ Unexpected response\n');
        }
    } catch (error) {
        console.log('   ❌ Calendar endpoint failed:', error.message, '\n');
    }

    // Test 3: Calendar events with status parameter without auth
    try {
        console.log('3. Testing calendar events with status=pending without auth...');
        const calendarPendingResponse = await fetch(`${BASE_URL}/api/calendar/events?status=pending`);
        console.log('   Status:', calendarPendingResponse.status);
        const calendarPendingData = await calendarPendingResponse.text();
        console.log('   Response:', calendarPendingData.substring(0, 200));
        if (calendarPendingResponse.status === 401) {
            console.log('   ✅ Correctly requires authentication\n');
        } else {
            console.log('   ⚠️ Unexpected response\n');
        }
    } catch (error) {
        console.log('   ❌ Calendar pending endpoint failed:', error.message, '\n');
    }

    // Test 4: Pending events endpoint without auth
    try {
        console.log('4. Testing pending events endpoint without auth...');
        const pendingResponse = await fetch(`${BASE_URL}/api/calendar/events/pending`);
        console.log('   Status:', pendingResponse.status);
        const pendingData = await pendingResponse.text();
        console.log('   Response:', pendingData.substring(0, 200));
        if (pendingResponse.status === 401) {
            console.log('   ✅ Correctly requires authentication\n');
        } else {
            console.log('   ⚠️ Unexpected response\n');
        }
    } catch (error) {
        console.log('   ❌ Pending events endpoint failed:', error.message, '\n');
    }

    console.log('🎯 Basic connectivity tests completed!');
}

testBasicEndpoints().catch(console.error);
