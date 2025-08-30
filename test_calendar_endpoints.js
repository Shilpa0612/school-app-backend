const fetch = require('node-fetch');

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com';

// Test authentication first
async function testAuth() {
    try {
        console.log('🔐 Testing authentication...');
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'principal@school.com',
                password: 'password123'
            })
        });

        const data = await response.json();
        console.log('Auth response status:', response.status);
        console.log('Auth response:', data);

        if (data.token) {
            return data.token;
        } else {
            console.error('❌ Authentication failed');
            return null;
        }
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        return null;
    }
}

// Test calendar endpoints
async function testCalendarEndpoints(token) {
    if (!token) {
        console.log('❌ No token available, skipping calendar tests');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const endpoints = [
        '/api/calendar/events?status=pending',
        '/api/calendar/events',
        '/api/calendar/events/pending',
        '/api/calendar/events/teacher',
        '/api/calendar/events/parent'
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\n🔍 Testing endpoint: ${endpoint}`);
            const response = await fetch(`${BASE_URL}${endpoint}`, {
                method: 'GET',
                headers: headers
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            const data = await response.text();
            console.log('Response body:', data.substring(0, 500) + (data.length > 500 ? '...' : ''));

            if (response.ok) {
                console.log('✅ Endpoint working');
            } else {
                console.log('❌ Endpoint failed');
            }
        } catch (error) {
            console.error(`❌ Error testing ${endpoint}:`, error.message);
        }
    }
}

// Test health endpoint
async function testHealth() {
    try {
        console.log('\n🏥 Testing health endpoint...');
        const response = await fetch(`${BASE_URL}/health`);
        const data = await response.json();
        console.log('Health status:', response.status);
        console.log('Health response:', data);
    } catch (error) {
        console.error('❌ Health check error:', error.message);
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting calendar endpoint tests...\n');

    await testHealth();
    const token = await testAuth();
    await testCalendarEndpoints(token);

    console.log('\n✅ Tests completed');
}

runTests().catch(console.error);
