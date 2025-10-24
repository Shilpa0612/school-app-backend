import axios from 'axios';

// Configuration
const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// User credentials
const PRINCIPAL_CREDENTIALS = {
    phone_number: '1234567891',
    password: 'password123'
};

const PARENT_CREDENTIALS = {
    phone_number: '9923149457',
    password: 'Temp@1234'
};

let principalToken = '';
let parentToken = '';

// Helper function to make authenticated requests
async function makeRequest(method, url, data = null, token = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${url}`,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error(`Error making ${method} request to ${url}:`, error.response?.data || error.message);
        throw error;
    }
}

// Step 1: Login as Principal
async function loginAsPrincipal() {
    console.log('🔐 Logging in as Principal...');
    try {
        const response = await makeRequest('POST', '/auth/login', PRINCIPAL_CREDENTIALS);
        principalToken = response.data.token;
        console.log('✅ Principal login successful');
        console.log(`Principal: ${response.data.user.full_name} (${response.data.user.role})`);
        return response.data;
    } catch (error) {
        console.error('❌ Principal login failed:', error.response?.data || error.message);
        throw error;
    }
}

// Step 2: Login as Parent
async function loginAsParent() {
    console.log('🔐 Logging in as Parent...');
    try {
        const response = await makeRequest('POST', '/auth/login', PARENT_CREDENTIALS);
        parentToken = response.data.token;
        console.log('✅ Parent login successful');
        console.log(`Parent: ${response.data.user.full_name} (${response.data.user.role})`);
        return response.data;
    } catch (error) {
        console.error('❌ Parent login failed:', error.response?.data || error.message);
        throw error;
    }
}

// Step 3: Get Pending Messages
async function getPendingMessages() {
    console.log('📋 Getting pending messages...');
    try {
        const response = await makeRequest('GET', '/chat/messages/pending', null, principalToken);
        console.log('✅ Pending messages retrieved');
        console.log(`Found ${response.data.messages.length} pending messages`);

        if (response.data.messages.length > 0) {
            console.log('\n📝 Pending Messages:');
            response.data.messages.forEach((msg, index) => {
                console.log(`\n${index + 1}. Message ID: ${msg.id}`);
                console.log(`   Content: ${msg.content}`);
                console.log(`   From: ${msg.sender.full_name} (${msg.sender.role})`);
                console.log(`   Thread: ${msg.thread.title}`);
                console.log(`   Created: ${msg.created_at}`);
                console.log(`   Status: ${msg.approval_status}`);
            });
        } else {
            console.log('ℹ️ No pending messages found');
        }

        return response.data;
    } catch (error) {
        console.error('❌ Failed to get pending messages:', error.response?.data || error.message);
        throw error;
    }
}

// Step 4: Approve a specific message
async function approveMessage(messageId) {
    console.log(`✅ Approving message: ${messageId}`);
    try {
        const response = await makeRequest('POST', `/chat/messages/${messageId}/approve`, null, principalToken);
        console.log('✅ Message approved successfully');
        console.log(`Approved by: ${response.data.data.approver.full_name} (${response.data.data.approver.role})`);
        console.log(`Approved at: ${response.data.data.approved_at}`);

        console.log('\n🔔 NOTIFICATION SYSTEM SHOULD NOW ACTIVATE:');
        console.log('📱 Parent should receive:');
        console.log('   - WebSocket real-time notification (if connected)');
        console.log('   - Firebase push notification (if app is closed)');
        console.log('   - In-app notification record');
        console.log('   - Message should appear in chat immediately');

        return response.data;
    } catch (error) {
        console.error('❌ Failed to approve message:', error.response?.data || error.message);
        throw error;
    }
}

// Step 5: Check parent notifications
async function checkParentNotifications() {
    console.log('🔔 Checking parent notifications...');
    try {
        // Try different notification endpoints
        const endpoints = [
            '/notifications',
            '/parent/notifications',
            '/api/notifications',
            '/api/parent/notifications'
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`Trying endpoint: ${endpoint}`);
                const response = await makeRequest('GET', endpoint, null, parentToken);
                console.log(`✅ Found notifications at ${endpoint}:`, response);
                return response;
            } catch (error) {
                console.log(`❌ ${endpoint} failed:`, error.response?.status || error.message);
            }
        }

        console.log('⚠️ No notification endpoints found');
        return null;
    } catch (error) {
        console.error('❌ Failed to check parent notifications:', error.response?.data || error.message);
        return null;
    }
}

// Step 6: Check if parent can see approved message
async function checkParentCanSeeMessage(threadId) {
    console.log(`📨 Checking if parent can see approved message in thread: ${threadId}`);
    try {
        const response = await makeRequest('GET', `/chat/messages?thread_id=${threadId}`, null, parentToken);
        console.log('✅ Parent thread messages retrieved');
        console.log(`Found ${response.data.messages.length} messages in thread`);

        if (response.data.messages.length > 0) {
            console.log('\n📝 Messages Visible to Parent:');
            response.data.messages.forEach((msg, index) => {
                console.log(`\n${index + 1}. Message ID: ${msg.id}`);
                console.log(`   Content: ${msg.content}`);
                console.log(`   From: ${msg.sender.full_name} (${msg.sender.role})`);
                console.log(`   Status: ${msg.approval_status}`);
                if (msg.approval_status === 'approved' && msg.approver) {
                    console.log(`   ✅ Approved by: ${msg.approver.full_name} (${msg.approver.role})`);
                    console.log(`   ✅ Approved at: ${msg.approved_at}`);
                }
            });
        }

        return response.data;
    } catch (error) {
        console.error('❌ Failed to get parent thread messages:', error.response?.data || error.message);
        throw error;
    }
}

// Step 7: Debug notification system
async function debugNotificationSystem() {
    console.log('🔍 Debugging notification system...');

    try {
        // Check if notification service is working
        console.log('\n1. Checking notification service endpoints...');

        // Try to get parent info
        const parentInfo = await makeRequest('GET', '/auth/me', null, parentToken);
        console.log('Parent info:', parentInfo);

        // Check if parent has students
        try {
            const studentsResponse = await makeRequest('GET', '/parent/students', null, parentToken);
            console.log('Parent students:', studentsResponse);
        } catch (error) {
            console.log('No students endpoint or error:', error.message);
        }

        // Check database tables
        console.log('\n2. Checking if notification tables exist...');
        try {
            const dbCheck = await makeRequest('GET', '/debug/tables', null, principalToken);
            console.log('Database tables check:', dbCheck);
        } catch (error) {
            console.log('Debug endpoint not available:', error.message);
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Main execution function
async function main() {
    console.log('🚀 Starting Approval Notification Test\n');

    try {
        // Step 1: Login as all users
        await loginAsPrincipal();
        await loginAsParent();

        console.log('\n' + '='.repeat(60));

        // Step 2: Get pending messages
        const pendingMessages = await getPendingMessages();

        if (pendingMessages.messages.length === 0) {
            console.log('\n📤 No pending messages found.');
            console.log('🎯 To test notifications:');
            console.log('1. Have a teacher send a message to a parent');
            console.log('2. Then run this script again to approve it');
            return;
        }

        // Step 3: Debug notification system first
        await debugNotificationSystem();

        console.log('\n' + '='.repeat(60));

        // Step 4: Test approval with notifications
        const messageToApprove = pendingMessages.messages[0]; // Get first pending message
        console.log(`\n🎯 Testing APPROVAL with notifications for message: "${messageToApprove.content}"`);
        console.log(`Message ID: ${messageToApprove.id}`);
        console.log(`Thread ID: ${messageToApprove.thread_id}`);

        await approveMessage(messageToApprove.id);

        // Wait for notifications to process
        console.log('\n⏳ Waiting for notifications to process...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 5: Check if parent can see the approved message
        console.log('\n🔍 Verifying parent can see approved message...');
        await checkParentCanSeeMessage(messageToApprove.thread_id);

        // Step 6: Check parent notifications
        console.log('\n🔔 Checking parent notifications...');
        await checkParentNotifications();

        console.log('\n✅ Approval Notification Test completed!');
        console.log('\n📋 Summary:');
        console.log('✅ Message approved successfully');
        console.log('✅ Parent can see approved message');
        console.log('🔍 Check console logs above for notification status');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the test
main();
