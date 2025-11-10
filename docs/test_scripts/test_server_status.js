const fetch = require('node-fetch');

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com';

async function checkServerStatus() {
    console.log('🔍 Checking server status...\n');

    try {
        // Test basic connectivity
        console.log('1. Testing basic connectivity...');
        const startTime = Date.now();
        const response = await fetch(`${BASE_URL}/health`, {
            method: 'GET',
            timeout: 10000 // 10 second timeout
        });
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`   Response time: ${responseTime}ms`);
        console.log('   Status:', response.status);
        console.log('   Headers:', Object.fromEntries(response.headers.entries()));

        const data = await response.text();
        console.log('   Response:', data);

        if (response.ok) {
            console.log('   ✅ Server is running and responding\n');
        } else {
            console.log('   ⚠️ Server responded but with error status\n');
        }

    } catch (error) {
        console.log('   ❌ Server connection failed:', error.message);

        if (error.code === 'ENOTFOUND') {
            console.log('   💡 This might mean the domain is not found or DNS issue');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('   💡 This might mean the server is not running');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('   💡 This might mean the server is slow or overloaded');
        }
        console.log('');
    }

    // Test if it's a Heroku app
    try {
        console.log('2. Testing if this is a Heroku app...');
        const herokuResponse = await fetch(`${BASE_URL}`, {
            method: 'GET',
            timeout: 5000
        });

        console.log('   Status:', herokuResponse.status);
        const herokuData = await herokuResponse.text();

        if (herokuData.includes('heroku') || herokuData.includes('Heroku')) {
            console.log('   ✅ This appears to be a Heroku app');
        } else {
            console.log('   ℹ️ This might not be a Heroku app or has custom response');
        }
        console.log('   Response preview:', herokuData.substring(0, 200));
        console.log('');

    } catch (error) {
        console.log('   ❌ Could not determine app type:', error.message, '\n');
    }

    console.log('🎯 Server status check completed!');
}

checkServerStatus().catch(console.error);
