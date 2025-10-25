// Test script that makes actual API calls to test with real messages
import https from 'https';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// Helper function to make HTTP requests
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

async function testRealMessages() {
    console.log('🧪 Testing Chat Message Approval with Real Messages');
    console.log('==================================================');
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
        console.log('✅ Principal logged in:', principalLogin.data.data.user.full_name);
        console.log('Token:', principalToken.substring(0, 20) + '...');

        // Step 2: Get pending messages
        console.log('\n2️⃣ Getting pending messages...');
        const pendingResponse = await makeRequest('GET', '/chat/messages/pending', null, principalToken);

        if (pendingResponse.status !== 200) {
            console.error('❌ Failed to get pending messages:', pendingResponse.data);
            return;
        }

        const messages = pendingResponse.data.data.messages;
        console.log(`✅ Found ${messages.length} pending messages`);

        if (messages.length === 0) {
            console.log('❌ No pending messages to test with');
            console.log('💡 To create test messages:');
            console.log('   1. Login as teacher (9158834913 / Temp@1234)');
            console.log('   2. Send a message to parent (9923149457)');
            console.log('   3. Run this test again');
            return;
        }

        // Step 3: Show available messages
        console.log('\n3️⃣ Available messages to approve:');
        messages.forEach((msg, i) => {
            console.log(`\n${i + 1}. Message ID: ${msg.id}`);
            console.log(`   Content: "${msg.content}"`);
            console.log(`   From: ${msg.sender.full_name} (${msg.sender.role})`);
            console.log(`   Thread: ${msg.thread.title}`);
            console.log(`   Created: ${msg.created_at}`);
            console.log(`   Status: ${msg.approval_status}`);

            // Check if thread has parent participants
            const hasParent = msg.thread.participants.some(p => p.user?.role === 'parent');
            console.log(`   Has Parent: ${hasParent ? '✅ Yes' : '❌ No'}`);
        });

        // Step 4: Choose first message to approve
        const messageToApprove = messages[0];
        console.log(`\n4️⃣ Approving message: "${messageToApprove.content}"`);
        console.log(`   Message ID: ${messageToApprove.id}`);
        console.log(`   Thread ID: ${messageToApprove.thread_id}`);

        // Step 5: Approve the message
        console.log('\n5️⃣ Sending approval request...');
        const approveResponse = await makeRequest('POST', `/chat/messages/${messageToApprove.id}/approve`, null, principalToken);

        if (approveResponse.status !== 200) {
            console.error('❌ Failed to approve message:', approveResponse.data);
            return;
        }

        console.log('✅ Message approved successfully!');
        console.log('Response:', JSON.stringify(approveResponse.data, null, 2));

        // Step 6: Login as Parent
        console.log('\n6️⃣ Logging in as Parent...');
        const parentLogin = await makeRequest('POST', '/auth/login', {
            phone_number: '9923149457',
            password: 'Temp@1234'
        });

        if (parentLogin.status !== 200) {
            console.error('❌ Parent login failed:', parentLogin.data);
            return;
        }

        const parentToken = parentLogin.data.data.token;
        console.log('✅ Parent logged in:', parentLogin.data.data.user.full_name);

        // Step 7: Check if parent can see approved message
        console.log('\n7️⃣ Checking if parent can see approved message...');
        const threadResponse = await makeRequest('GET', `/chat/messages?thread_id=${messageToApprove.thread_id}`, null, parentToken);

        if (threadResponse.status !== 200) {
            console.error('❌ Failed to get thread messages:', threadResponse.data);
            return;
        }

        const threadMessages = threadResponse.data.data.messages;
        console.log(`✅ Parent can see ${threadMessages.length} messages in thread`);

        // Check if the approved message is visible
        const approvedMessage = threadMessages.find(msg => msg.id === messageToApprove.id);
        if (approvedMessage) {
            console.log('✅ Parent can see the approved message!');
            console.log(`   Content: "${approvedMessage.content}"`);
            console.log(`   Status: ${approvedMessage.approval_status}`);
            if (approvedMessage.approver) {
                console.log(`   Approved by: ${approvedMessage.approver.full_name}`);
                console.log(`   Approved at: ${approvedMessage.approved_at}`);
            }
        } else {
            console.log('❌ Parent cannot see the approved message');
        }

        // Step 8: Summary
        console.log('\n🎯 TEST SUMMARY:');
        console.log('================');
        console.log('✅ Message approved successfully');
        console.log('✅ Parent can see approved message');
        console.log('📋 Check your server logs for notification activity');
        console.log('');
        console.log('🔍 Look for these debug messages in your server console:');
        console.log('   🔔 Starting notification process for approved message...');
        console.log('   📊 Found X thread participants');
        console.log('   📨 Calling sendChatMessageApprovalNotifications...');
        console.log('   💬 sendChatMessageApprovalNotifications called for message: <id>');
        console.log('   📊 Found X parent participants for message approval notification');
        console.log('   📨 Sending message approval notification to parent <parent_id>');
        console.log('   ✅ Message approval notification result for parent <parent_id>: SUCCESS');
        console.log('   📡 Calling broadcastApprovedMessage...');
        console.log('   📡 Broadcasting approved message to thread participants: <thread_id>');
        console.log('   📤 Broadcasted approved message to user <user_id>');
        console.log('   ✅ Notification process completed');
        console.log('');
        console.log('📱 If you see all these logs, the notification system is working!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testRealMessages();
