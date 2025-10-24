import axios from 'axios';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function testApproval() {
    console.log('🧪 Simple Approval Notification Test\n');

    try {
        // Step 1: Login as Principal
        console.log('1. Logging in as Principal...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: '1234567891',
            password: 'password123'
        });

        const principalToken = loginResponse.data.data.token;
        console.log('✅ Principal logged in:', loginResponse.data.data.user.full_name);

        // Step 2: Get pending messages
        console.log('\n2. Getting pending messages...');
        const pendingResponse = await axios.get(`${BASE_URL}/chat/messages/pending`, {
            headers: { 'Authorization': `Bearer ${principalToken}` }
        });

        const messages = pendingResponse.data.data.messages;
        console.log(`Found ${messages.length} pending messages`);

        if (messages.length === 0) {
            console.log('❌ No pending messages to test with');
            return;
        }

        // Step 3: Show available messages
        console.log('\n3. Available messages to approve:');
        messages.forEach((msg, i) => {
            console.log(`${i + 1}. ID: ${msg.id}`);
            console.log(`   Content: "${msg.content}"`);
            console.log(`   From: ${msg.sender.full_name}`);
            console.log(`   Thread: ${msg.thread.title}`);
        });

        // Step 4: Approve first message
        const messageToApprove = messages[0];
        console.log(`\n4. Approving message: "${messageToApprove.content}"`);
        console.log(`   Message ID: ${messageToApprove.id}`);

        const approveResponse = await axios.post(
            `${BASE_URL}/chat/messages/${messageToApprove.id}/approve`,
            {},
            { headers: { 'Authorization': `Bearer ${principalToken}` } }
        );

        console.log('✅ Message approved successfully!');
        console.log('Response:', approveResponse.data);

        // Step 5: Check server logs for notification activity
        console.log('\n5. 🔍 CHECK SERVER LOGS FOR:');
        console.log('   - "💬 sendChatMessageApprovalNotifications called"');
        console.log('   - "📨 Sending message approval notification to parent"');
        console.log('   - "📡 Broadcasting approved message"');
        console.log('   - "✅ Message approval notification result"');

        // Step 6: Login as Parent to verify
        console.log('\n6. Logging in as Parent to verify...');
        const parentLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: '9923149457',
            password: 'Temp@1234'
        });

        const parentToken = parentLoginResponse.data.data.token;
        console.log('✅ Parent logged in:', parentLoginResponse.data.data.user.full_name);

        // Step 7: Check if parent can see the approved message
        console.log('\n7. Checking if parent can see approved message...');
        const threadMessagesResponse = await axios.get(
            `${BASE_URL}/chat/messages?thread_id=${messageToApprove.thread_id}`,
            { headers: { 'Authorization': `Bearer ${parentToken}` } }
        );

        const threadMessages = threadMessagesResponse.data.data.messages;
        console.log(`Parent can see ${threadMessages.length} messages in thread`);

        const approvedMessage = threadMessages.find(msg => msg.id === messageToApprove.id);
        if (approvedMessage) {
            console.log('✅ Parent can see the approved message!');
            console.log(`   Content: "${approvedMessage.content}"`);
            console.log(`   Status: ${approvedMessage.approval_status}`);
            if (approvedMessage.approver) {
                console.log(`   Approved by: ${approvedMessage.approver.full_name}`);
            }
        } else {
            console.log('❌ Parent cannot see the approved message');
        }

        console.log('\n🎯 NOTIFICATION TEST COMPLETE!');
        console.log('📋 Check the server logs above for notification activity');
        console.log('📱 If notifications are working, parent should have received:');
        console.log('   - WebSocket notification (if connected)');
        console.log('   - Firebase push notification');
        console.log('   - In-app notification record');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testApproval();
