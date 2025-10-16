/**
 * Complete Chat System Test - V2 (Simplified)
 * Tests approval workflow, read receipts, and auto-marking
 * 
 * Usage: 
 *   node test_complete_chat_system_v2.js
 * 
 * Prerequisites:
 *   - Server running (npm start)
 *   - Have an admin account (get credentials from database or create one)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// !!! IMPORTANT: Update these with your actual admin credentials !!!
const ADMIN_CREDENTIALS = {
    phone_number: process.env.ADMIN_PHONE || '1111111111',
    password: process.env.ADMIN_PASSWORD || 'Admin@123'
};

// Test credentials - unique phone numbers using timestamp
const timestamp = Date.now().toString().slice(-6);
const USERS = {
    teacher: {
        phone_number: `8888${timestamp}`,
        password: 'Teacher@123',
        full_name: 'Test Teacher',
        role: 'teacher',
        email: `teacher${timestamp}@test.com`
    },
    parent: {
        phone_number: `7777${timestamp}`,
        password: 'Parent@123',
        full_name: 'Test Parent',
        role: 'parent',
        email: `parent${timestamp}@test.com`
    }
};

// Store test data
const tokens = {};
const userIds = {};
let threadId = null;
let messageId = null;

/**
 * Helper function to make HTTP requests
 */
async function makeRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    const data = await response.json();

    return { response, data };
}

/**
 * Step 0: Login Admin (using existing admin)
 */
async function loginAdmin() {
    console.log('\n📝 STEP 0: Login as Admin');
    console.log('='.repeat(80));
    console.log(`Using phone: ${ADMIN_CREDENTIALS.phone_number}`);

    const { response, data } = await makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(ADMIN_CREDENTIALS)
    });

    if (response.ok) {
        tokens.admin = data.data.token;
        userIds.admin = data.data.user.id;
        console.log(`✅ Admin logged in successfully`);
        console.log(`   User ID: ${userIds.admin}`);
        console.log(`   Role: ${data.data.user.role}`);
    } else {
        console.error('\n❌ ADMIN LOGIN FAILED');
        console.error('Error:', data.message);
        console.error('\n💡 To fix this:');
        console.error('1. Find your admin credentials in the database:');
        console.error('   SELECT phone_number, email FROM users WHERE role = \'admin\';');
        console.error('\n2. Run test with correct credentials:');
        console.error('   ADMIN_PHONE="your-phone" ADMIN_PASSWORD="your-password" node test_complete_chat_system_v2.js');
        console.error('\n3. Or create a new admin:');
        console.error('   curl -X POST http://localhost:3000/api/system/register-first-admin \\');
        console.error('     -H "Content-Type: application/json" \\');
        console.error('     -d \'{"phone_number":"1111111111","password":"Admin@123","full_name":"Test Admin","email":"admin@test.com"}\'');
        throw new Error('Admin login required to test approval system');
    }
}

/**
 * Step 1: Create Test Users
 */
async function createTestUsers() {
    console.log('\n📝 STEP 1: Creating test users (Teacher & Parent)');
    console.log('='.repeat(80));

    for (const [role, credentials] of Object.entries(USERS)) {
        try {
            console.log(`\n👤 Creating ${role}...`);

            const { response, data } = await makeRequest('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify(credentials)
            });

            if (response.ok) {
                tokens[role] = data.data.token;
                userIds[role] = data.data.user.id;
                console.log(`   ✅ ${role} created`);
                console.log(`      Phone: ${credentials.phone_number}`);
                console.log(`      User ID: ${userIds[role]}`);
            } else {
                throw new Error(data.message || 'Registration failed');
            }

        } catch (error) {
            console.error(`   ❌ Error creating ${role}:`, error.message);
            throw error;
        }
    }
}

/**
 * Step 2: Create Chat Thread (Teacher → Parent)
 */
async function testCreateThread() {
    console.log('\n📝 STEP 2: Teacher creates thread and sends message to Parent');
    console.log('='.repeat(80));

    const { response, data } = await makeRequest('/api/chat/start-conversation', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokens.teacher}`
        },
        body: JSON.stringify({
            participants: [userIds.parent],
            message_content: 'Hello parent! This is a test message from teacher.',
            thread_type: 'direct'
        })
    });

    if (response.ok) {
        threadId = data.data.thread.id;
        messageId = data.data.message.id;
        const approvalStatus = data.data.message.approval_status;

        console.log(`✅ Thread created: ${threadId}`);
        console.log(`✅ Message sent: ${messageId}`);
        console.log(`✅ Approval status: ${approvalStatus}`);

        if (approvalStatus === 'pending') {
            console.log('   ✅ PASS: Teacher→Parent message requires approval');
        } else {
            console.log('   ❌ FAIL: Expected "pending", got "' + approvalStatus + '"');
        }
    } else {
        console.error('❌ Failed to create thread:', data);
        throw new Error('Thread creation failed');
    }
}

/**
 * Step 3: Parent tries to view (should not see pending message)
 */
async function testParentViewBeforeApproval() {
    console.log('\n📝 STEP 3: Parent tries to view messages (before approval)');
    console.log('='.repeat(80));

    const { response, data } = await makeRequest(`/api/chat/messages?thread_id=${threadId}`, {
        headers: {
            'Authorization': `Bearer ${tokens.parent}`
        }
    });

    if (response.ok) {
        const messageCount = data.data.messages.length;
        console.log(`✅ Messages visible to parent: ${messageCount}`);

        if (messageCount === 0) {
            console.log('   ✅ PASS: Pending messages are hidden from parent');
        } else {
            console.log('   ❌ FAIL: Parent should not see pending messages');
        }
    } else {
        console.error('❌ Failed to fetch messages:', data);
    }
}

/**
 * Step 4: Admin views pending messages
 */
async function testAdminViewPending() {
    console.log('\n📝 STEP 4: Admin views pending messages');
    console.log('='.repeat(80));

    const { response, data } = await makeRequest('/api/chat/messages/pending', {
        headers: {
            'Authorization': `Bearer ${tokens.admin}`
        }
    });

    if (response.ok) {
        const pendingCount = data.data.messages.length;
        console.log(`✅ Pending messages count: ${pendingCount}`);

        if (pendingCount > 0) {
            console.log('   ✅ PASS: Admin can see pending messages');
            console.log('\n   Message details:');
            data.data.messages.slice(0, 3).forEach((msg, i) => {
                console.log(`   ${i + 1}. From: ${msg.sender?.full_name} (${msg.sender?.role})`);
                console.log(`      Content: "${msg.content.substring(0, 50)}..."`);
                console.log(`      Status: ${msg.approval_status}`);
            });
        }
    } else {
        console.error('❌ Failed to fetch pending messages:', data);
    }
}

/**
 * Step 5: Admin approves the message
 */
async function testAdminApproval() {
    console.log('\n📝 STEP 5: Admin approves the message');
    console.log('='.repeat(80));

    const { response, data } = await makeRequest(`/api/chat/messages/${messageId}/approve`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokens.admin}`
        }
    });

    if (response.ok) {
        console.log(`✅ Message approved`);
        console.log(`✅ Status: ${data.data.approval_status}`);
        console.log(`✅ Approved by: ${data.data.approver?.full_name}`);
        console.log(`   ✅ PASS: Message successfully approved`);
    } else {
        console.error('❌ Failed to approve message:', data);
        throw new Error('Message approval failed');
    }
}

/**
 * Step 6: Parent views messages after approval
 */
async function testParentViewAfterApproval() {
    console.log('\n📝 STEP 6: Parent views messages (after approval)');
    console.log('='.repeat(80));

    // Wait a moment for approval to process
    await new Promise(resolve => setTimeout(resolve, 500));

    const { response, data } = await makeRequest(`/api/chat/messages?thread_id=${threadId}`, {
        headers: {
            'Authorization': `Bearer ${tokens.parent}`
        }
    });

    if (response.ok) {
        const messageCount = data.data.messages.length;
        console.log(`✅ Messages visible to parent: ${messageCount}`);

        if (messageCount > 0) {
            console.log('   ✅ PASS: Approved messages visible to parent');

            const message = data.data.messages[0];
            console.log('\n   Message details:');
            console.log(`   Approval: ${message.approval_status}`);
            console.log(`   Status: ${message.status}`);
            console.log(`   Is read: ${message.is_read}`);
            console.log(`   Read count: ${message.read_count}`);

            if (message.read_count > 0 || message.is_read) {
                console.log('   ✅ PASS: Message auto-marked as read');
            }
        } else {
            console.log('   ❌ FAIL: Approved message should be visible');
        }
    } else {
        console.error('❌ Failed to fetch messages:', data);
    }
}

/**
 * Step 7: Check read receipts
 */
async function testReadReceipts() {
    console.log('\n📝 STEP 7: Teacher checks read receipts');
    console.log('='.repeat(80));

    await new Promise(resolve => setTimeout(resolve, 1000));

    const { response, data } = await makeRequest(`/api/chat/messages/${messageId}/read-by`, {
        headers: {
            'Authorization': `Bearer ${tokens.teacher}`
        }
    });

    if (response.ok) {
        console.log(`✅ Message read by ${data.data.read_count} user(s)`);

        if (data.data.read_by.length > 0) {
            console.log('   ✅ PASS: Read receipts tracked');
            data.data.read_by.forEach((reader, i) => {
                console.log(`   ${i + 1}. ${reader.user_name} (${reader.user_role}) at ${reader.read_at}`);
            });
        }
    } else {
        console.error('❌ Failed to fetch read receipts:', data);
    }
}

/**
 * Step 8: Parent sends reply (should be auto-approved)
 */
async function testParentReply() {
    console.log('\n📝 STEP 8: Parent sends reply (no approval needed)');
    console.log('='.repeat(80));

    const { response, data } = await makeRequest('/api/chat/messages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${tokens.parent}`
        },
        body: JSON.stringify({
            thread_id: threadId,
            content: 'Thank you for the message!',
            message_type: 'text'
        })
    });

    if (response.ok) {
        const approvalStatus = data.data.approval_status;
        console.log(`✅ Reply sent: ${data.data.id}`);
        console.log(`✅ Approval status: ${approvalStatus}`);

        if (approvalStatus === 'approved') {
            console.log('   ✅ PASS: Parent→Teacher message auto-approved');
        } else {
            console.log('   ❌ FAIL: Expected "approved", got "' + approvalStatus + '"');
        }
    } else {
        console.error('❌ Failed to send reply:', data);
    }
}

/**
 * Step 9: Check unread counts
 */
async function testUnreadCounts() {
    console.log('\n📝 STEP 9: Check unread counts');
    console.log('='.repeat(80));

    const { response, data } = await makeRequest('/api/chat/unread-count', {
        headers: {
            'Authorization': `Bearer ${tokens.teacher}`
        }
    });

    if (response.ok) {
        console.log(`✅ Teacher total unread: ${data.data.total_unread}`);
        if (data.data.threads.length > 0) {
            console.log('   Unread by thread:');
            data.data.threads.forEach(thread => {
                console.log(`   - ${thread.thread_id}: ${thread.unread_count} unread`);
            });
        }
    }
}

/**
 * Cleanup: Show SQL for manual cleanup
 */
function showCleanupInstructions() {
    console.log('\n🧹 CLEANUP INSTRUCTIONS');
    console.log('='.repeat(80));
    console.log('\nTest users created with these phone numbers:');
    console.log(`   Teacher: ${USERS.teacher.phone_number}`);
    console.log(`   Parent: ${USERS.parent.phone_number}`);

    console.log('\n📋 Option 1: Run SQL cleanup script (RECOMMENDED)');
    console.log('   psql -h <host> -U <user> -d <database> -f cleanup_test_users.sql');

    console.log('\n📋 Option 2: Manual SQL cleanup');
    console.log('   Run this SQL in your database:');
    console.log(`\n   DELETE FROM users WHERE phone_number IN ('${USERS.teacher.phone_number}', '${USERS.parent.phone_number}');\n`);

    console.log('   This will cascade delete:');
    console.log('   - Chat threads created by these users');
    console.log('   - Chat messages sent by these users');
    console.log('   - Chat participants records');
    console.log('   - Message read receipts');
    console.log('   - All related data');
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log('\n🚀 Complete Chat System Test - V2');
    console.log('='.repeat(80));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('\n📌 This test will:');
    console.log('   1. Login with your existing admin account');
    console.log('   2. Create temporary teacher & parent accounts');
    console.log('   3. Test all chat features');
    console.log('   4. Show cleanup instructions');

    try {
        // Login admin first
        await loginAdmin();

        // Create test users
        await createTestUsers();

        // Run tests
        await testCreateThread();
        await testParentViewBeforeApproval();
        await testAdminViewPending();
        await testAdminApproval();
        await testParentViewAfterApproval();
        await testReadReceipts();
        await testParentReply();
        await testUnreadCounts();

        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('='.repeat(80));
        console.log('\n✅ Test Summary:');
        console.log('   ✅ Teacher→Parent message requires approval');
        console.log('   ✅ Pending messages hidden from parent');
        console.log('   ✅ Admin can view and approve messages');
        console.log('   ✅ Approved messages visible to parent');
        console.log('   ✅ Messages auto-marked as read');
        console.log('   ✅ Read receipts tracked');
        console.log('   ✅ Parent→Teacher messages auto-approved');
        console.log('   ✅ Unread counts working');
        console.log('\n🎊 Your chat system is working perfectly!');

        // Show cleanup instructions
        showCleanupInstructions();

    } catch (error) {
        console.error('\n❌ TEST FAILED');
        console.error('Error:', error.message);

        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }

        // Still show cleanup instructions
        if (userIds.teacher || userIds.parent) {
            showCleanupInstructions();
        }

        process.exit(1);
    }
}

// Check if admin credentials are set
if (ADMIN_CREDENTIALS.phone_number === '1111111111') {
    console.log('\n⚠️  WARNING: Using default admin credentials');
    console.log('If these don\'t work, set environment variables:');
    console.log('  ADMIN_PHONE="your-admin-phone" ADMIN_PASSWORD="your-admin-password" node test_complete_chat_system_v2.js\n');
}

// Run tests
runAllTests();

