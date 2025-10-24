const axios = require('axios');

// Configuration
const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// User credentials
const PRINCIPAL_CREDENTIALS = {
    phone: '1234567891',
    password: 'password123'
};

const TEACHER_CREDENTIALS = {
    phone: '9158834913',
    password: 'Temp@1234'
};

const PARENT_CREDENTIALS = {
    phone: '9923149457',
    password: 'Temp@1234'
};

let principalToken = '';
let teacherToken = '';
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

// Step 2: Login as Teacher
async function loginAsTeacher() {
    console.log('🔐 Logging in as Teacher...');
    try {
        const response = await makeRequest('POST', '/auth/login', TEACHER_CREDENTIALS);
        teacherToken = response.data.token;
        console.log('✅ Teacher login successful');
        console.log(`Teacher: ${response.data.user.full_name} (${response.data.user.role})`);
        return response.data;
    } catch (error) {
        console.error('❌ Teacher login failed:', error.response?.data || error.message);
        throw error;
    }
}

// Step 3: Login as Parent
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

// Step 4: Get Pending Messages (Principal only)
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

// Step 5: Approve a specific message
async function approveMessage(messageId) {
    console.log(`✅ Approving message: ${messageId}`);
    try {
        const response = await makeRequest('POST', `/chat/messages/${messageId}/approve`, null, principalToken);
        console.log('✅ Message approved successfully');
        console.log(`Approved by: ${response.data.data.approver.full_name} (${response.data.data.approver.role})`);
        console.log(`Approved at: ${response.data.data.approved_at}`);
        return response.data;
    } catch (error) {
        console.error('❌ Failed to approve message:', error.response?.data || error.message);
        throw error;
    }
}

// Step 6: Get messages in a thread to verify approval
async function getThreadMessages(threadId) {
    console.log(`📨 Getting messages in thread: ${threadId}`);
    try {
        const response = await makeRequest('GET', `/chat/messages?thread_id=${threadId}`, null, parentToken);
        console.log('✅ Thread messages retrieved');
        console.log(`Found ${response.data.messages.length} messages in thread`);

        if (response.data.messages.length > 0) {
            console.log('\n📝 Thread Messages:');
            response.data.messages.forEach((msg, index) => {
                console.log(`\n${index + 1}. Message ID: ${msg.id}`);
                console.log(`   Content: ${msg.content}`);
                console.log(`   From: ${msg.sender.full_name} (${msg.sender.role})`);
                console.log(`   Status: ${msg.approval_status}`);
                if (msg.approval_status === 'approved' && msg.approver) {
                    console.log(`   Approved by: ${msg.approver.full_name} (${msg.approver.role})`);
                    console.log(`   Approved at: ${msg.approved_at}`);
                }
            });
        }

        return response.data;
    } catch (error) {
        console.error('❌ Failed to get thread messages:', error.response?.data || error.message);
        throw error;
    }
}

// Step 7: Send a test message from teacher to parent
async function sendTestMessage() {
    console.log('📤 Sending test message from teacher to parent...');
    try {
        // First, we need to create or find a thread between teacher and parent
        // Let's try to get existing threads first
        const threadsResponse = await makeRequest('GET', '/chat/threads', null, teacherToken);
        console.log(`Found ${threadsResponse.data.threads.length} existing threads`);

        let threadId = null;

        // Look for a thread with parent
        for (const thread of threadsResponse.data.threads) {
            const hasParent = thread.participants.some(p => p.user.role === 'parent');
            if (hasParent) {
                threadId = thread.id;
                console.log(`Found existing thread with parent: ${threadId}`);
                break;
            }
        }

        if (!threadId) {
            console.log('No existing thread found. Creating new thread...');
            // Create a new thread between teacher and parent
            const createThreadResponse = await makeRequest('POST', '/chat/threads', {
                title: 'Teacher-Parent Communication',
                thread_type: 'direct',
                participants: [PARENT_CREDENTIALS.phone] // This should be the parent's user ID, but we'll use phone for now
            }, teacherToken);
            threadId = createThreadResponse.data.id;
            console.log(`Created new thread: ${threadId}`);
        }

        // Send message
        const messageResponse = await makeRequest('POST', '/chat/messages', {
            thread_id: threadId,
            content: 'Hello parent! This is a test message from teacher that requires approval.',
            message_type: 'text'
        }, teacherToken);

        console.log('✅ Test message sent successfully');
        console.log(`Message ID: ${messageResponse.data.id}`);
        console.log(`Status: ${messageResponse.data.approval_status}`);

        return messageResponse.data;
    } catch (error) {
        console.error('❌ Failed to send test message:', error.response?.data || error.message);
        throw error;
    }
}

// Main execution function
async function main() {
    console.log('🚀 Starting Message Approval Test\n');

    try {
        // Step 1: Login as all users
        await loginAsPrincipal();
        await loginAsTeacher();
        await loginAsParent();

        console.log('\n' + '='.repeat(50));

        // Step 2: Get pending messages
        const pendingMessages = await getPendingMessages();

        if (pendingMessages.messages.length === 0) {
            console.log('\n📤 No pending messages found. Sending a test message...');
            const testMessage = await sendTestMessage();

            // Get updated pending messages
            console.log('\n📋 Getting updated pending messages...');
            const updatedPending = await getPendingMessages();

            if (updatedPending.messages.length > 0) {
                const messageToApprove = updatedPending.messages[0];
                console.log(`\n🎯 Approving message: ${messageToApprove.id}`);
                await approveMessage(messageToApprove.id);

                // Verify the message is now visible to parent
                console.log('\n🔍 Verifying message is visible to parent...');
                await getThreadMessages(messageToApprove.thread_id);
            }
        } else {
            // Approve the first pending message
            const messageToApprove = pendingMessages.messages[0];
            console.log(`\n🎯 Approving message: ${messageToApprove.id}`);
            await approveMessage(messageToApprove.id);

            // Verify the message is now visible to parent
            console.log('\n🔍 Verifying message is visible to parent...');
            await getThreadMessages(messageToApprove.thread_id);
        }

        console.log('\n✅ Message approval test completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    main();
}

module.exports = {
    loginAsPrincipal,
    loginAsTeacher,
    loginAsParent,
    getPendingMessages,
    approveMessage,
    getThreadMessages,
    sendTestMessage
};
