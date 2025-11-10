const fetch = require('node-fetch');

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com';

async function testEndpoints() {
    const endpoints = [
        '/health',
        '/api/calendar/events',
        '/api/calendar/events?status=pending',
        '/api/calendar/events/pending'
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\n🔍 Testing: ${endpoint}`);
            const response = await fetch(`${BASE_URL}${endpoint}`);

            console.log('Status:', response.status);
            console.log('Headers:', Object.fromEntries(response.headers.entries()));

            const text = await response.text();
            console.log('Response (first 200 chars):', text.substring(0, 200));

            if (response.ok) {
                console.log('✅ Working');
            } else {
                console.log('❌ Failed');
            }
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        }
    }
}

testEndpoints().catch(console.error);
