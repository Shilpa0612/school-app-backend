// Test script to check principal access and role
import https from 'https';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function testPrincipalAccess() {
    console.log('🔍 Testing Principal Access and Role');
    console.log('==================================');
    console.log('');
    
    try {
        // Step 1: Login as Principal
        console.log('1️⃣ Logging in as Principal...');
        const principalLogin = await makeRequest('POST', '/auth/login', {
            phone_number: '1234567891',
            password: 'password123'
        });
        
        if (principalLogin.status !== 200) {
            console.error('❌ Principal login failed:', principalLogin.data);
            return;
        }
        
        const principalToken = principalLogin.data.data.token;
        const principalUser = principalLogin.data.data.user;
        console.log('✅ Principal logged in successfully');
        console.log('Principal details:');
        console.log(`   Name: ${principalUser.full_name}`);
        console.log(`   Role: ${principalUser.role}`);
        console.log(`   ID: ${principalUser.id}`);
        console.log(`   Email: ${principalUser.email}`);
        
        // Step 2: Test access to thread messages
        console.log('\n2️⃣ Testing access to thread messages...');
        const threadResponse = await makeRequest('GET', '/chat/messages?thread_id=66344b6e-22f6-4719-81af-744b872a92ae&limit=50', null, principalToken);
        
        console.log(`Response Status: ${threadResponse.status}`);
        console.log('Response Data:', JSON.stringify(threadResponse.data, null, 2));
        
        if (threadResponse.status === 200) {
            console.log('✅ Principal can access thread messages!');
            console.log(`Found ${threadResponse.data.data.messages.length} messages`);
        } else {
            console.log('❌ Principal access failed');
            console.log('Error details:', threadResponse.data);
        }
        
        // Step 3: Test access to pending messages
        console.log('\n3️⃣ Testing access to pending messages...');
        const pendingResponse = await makeRequest('GET', '/chat/messages/pending', null, principalToken);
        
        console.log(`Response Status: ${pendingResponse.status}`);
        
        if (pendingResponse.status === 200) {
            console.log('✅ Principal can access pending messages!');
            console.log(`Found ${pendingResponse.data.data.messages.length} pending messages`);
        } else {
            console.log('❌ Principal access to pending messages failed');
            console.log('Error details:', pendingResponse.data);
        }
        
        console.log('\n🎯 DIAGNOSTIC SUMMARY:');
        console.log('======================');
        console.log(`Principal Role: ${principalUser.role}`);
        console.log(`Principal ID: ${principalUser.id}`);
        console.log(`Thread Access: ${threadResponse.status === 200 ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`Pending Access: ${pendingResponse.status === 200 ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        if (threadResponse.status !== 200) {
            console.log('\n🔍 DEBUGGING INFO:');
            console.log('Check your server logs for:');
            console.log('   - User role and ID logging');
            console.log('   - Access control decision');
            console.log('   - Any error messages');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testPrincipalAccess();
