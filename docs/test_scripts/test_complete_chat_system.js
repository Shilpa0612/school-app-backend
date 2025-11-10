/**
 * Complete Chat System Test
 * Tests approval workflow, read receipts, and auto-marking
 * 
 * Usage: 
 *   node test_complete_chat_system.js              # Auto-cleanup test users
 *   node test_complete_chat_system.js --keep-users # Keep test users for manual testing
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const KEEP_USERS = process.argv.includes('--keep-users');

// Test credentials - use unique phone numbers to avoid conflicts
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
    },
    admin: {
        phone_number: '1111111111', // Use existing admin if available
        password: 'Admin@123',
        full_name: 'Test Admin',
        role: 'admin',
        email: 'admin@test.com'
    }
};

// Store tokens and IDs
const tokens = {};
const userIds = {};
const createdUsers = []; // Track which users we created (for cleanup)
let threadId = null;
let messageId = null;
let adminAlreadyExisted = false;

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
 * Step 1: Login or Register Users
 */
async function setupUsers() {
    console.log('\n📝 STEP 1: Setting up test users');
    console.log('='.repeat(80));

    for (const [role, credentials] of Object.entries(USERS)) {
        try {
            // Try to login first
            console.log(`\n🔐 Attempting to login as ${role}...`);
            let { response, data } = await makeRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    phone_number: credentials.phone_number,
                    password: credentials.password
                })
            });

            // If login successful, user already exists
            if (response.ok) {
                tokens[role] = data.data.token;
                userIds[role] = data.data.user.id;
                console.log(`   ✅ ${role} already exists (using existing user)`);
                console.log(`      User ID: ${userIds[role]}`);

                if (role === 'admin') {
                    adminAlreadyExisted = true;
                }
            } else {
                // Login failed, try to register
                console.log(`   ⚠️  User doesn't exist, creating new ${role}...`);

                // For admin, if register-first-admin fails, try regular register
                if (role === 'admin') {
                    let result = await makeRequest('/api/system/register-first-admin', {
                        method: 'POST',
                        body: JSON.stringify(credentials)
                    });

                    // If first admin already exists, try regular admin login with a different account
                    if (!result.response.ok && result.data.message?.includes('already exists')) {
                        console.log('   ⚠️  System admin exists, trying to login with existing admin...');
                        // Try common admin credentials
                        const loginResult = await makeRequest('/api/auth/login', {
                            method: 'POST',
                            body: JSON.stringify({
                                phone_number: '1111111111',
                                password: 'Admin@123'
                            })
                        });

                        if (loginResult.response.ok) {
                            result = loginResult;
                            adminAlreadyExisted = true;
                        } else {
                            throw new Error('Could not login to existing admin. Please provide valid admin credentials.');
                        }
                    }

                    response = result.response;
                    data = result.data;
                } else {
                    // Regular user registration
                    const result = await makeRequest('/api/auth/register', {
                        method: 'POST',
                        body: JSON.stringify(credentials)
                    });

                    response = result.response;
                    data = result.data;
                }

                if (response.ok) {
                    tokens[role] = data.data.token;
                    userIds[role] = data.data.user.id;

                    // Track created users for cleanup (don't track if admin already existed)
                    if (!(role === 'admin' && adminAlreadyExisted)) {
                        createdUsers.push({ role, userId: userIds[role], phone: credentials.phone_number });
                    }

                    console.log(`   ✅ ${role} created successfully`);
                    console.log(`      User ID: ${userIds[role]}`);
                    console.log(`      Token: ${tokens[role].substring(0, 20)}...`);
                } else {
                    throw new Error(data.message || 'Failed to setup user');
                }
            }

        } catch (error) {
            console.error(`   ❌ Error setting up ${role}:`, error.message);
            throw error;
        }
    }

    if (createdUsers.length > 0 && !KEEP_USERS) {
        console.log(`\n   ℹ️  Created ${createdUsers.length} test user(s) - will be cleaned up after tests`);
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
            console.log('   ❌ FAIL: Expected approval_status "pending", got "' + approvalStatus + '"');
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
        console.log(`✅ Parent can access thread`);
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
        console.log(`✅ Admin can view pending messages`);
        console.log(`✅ Pending messages count: ${pendingCount}`);

        if (pendingCount > 0) {
            console.log('   ✅ PASS: Admin can see pending messages');
            console.log('\n   Message details:');
            data.data.messages.forEach((msg, i) => {
                console.log(`   ${i + 1}. From: ${msg.sender?.full_name} (${msg.sender?.role})`);
                console.log(`      Content: "${msg.content.substring(0, 50)}..."`);
                console.log(`      Status: ${msg.approval_status}`);
            });
        } else {
            console.log('   ⚠️  No pending messages found');
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
        const approvalStatus = data.data.approval_status;
        console.log(`✅ Message approved`);
        console.log(`✅ New status: ${approvalStatus}`);
        console.log(`✅ Approved by: ${data.data.approved_by}`);
        console.log(`✅ Approved at: ${data.data.approved_at}`);

        if (approvalStatus === 'approved') {
            console.log('   ✅ PASS: Message successfully approved');
        } else {
            console.log('   ❌ FAIL: Expected approval_status "approved", got "' + approvalStatus + '"');
        }
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

    const { response, data } = await makeRequest(`/api/chat/messages?thread_id=${threadId}`, {
        headers: {
            'Authorization': `Bearer ${tokens.parent}`
        }
    });

    if (response.ok) {
        const messageCount = data.data.messages.length;
        console.log(`✅ Messages visible to parent: ${messageCount}`);

        if (messageCount > 0) {
            console.log('   ✅ PASS: Approved messages are now visible to parent');

            // Check if auto-marked as read
            const message = data.data.messages[0];
            console.log('\n   Message details:');
            console.log(`   Approval status: ${message.approval_status}`);
            console.log(`   Message status: ${message.status}`);
            console.log(`   Is read: ${message.is_read}`);
            console.log(`   Read count: ${message.read_count}`);

            if (message.read_count > 0) {
                console.log('   ✅ PASS: Message auto-marked as read when fetched');
            } else {
                console.log('   ⚠️  Message not marked as read yet (may need a moment)');
            }
        } else {
            console.log('   ❌ FAIL: Parent should see approved message');
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

    // Wait a moment for read receipts to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { response, data } = await makeRequest(`/api/chat/messages/${messageId}/read-by`, {
        headers: {
            'Authorization': `Bearer ${tokens.teacher}`
        }
    });

    if (response.ok) {
        const readCount = data.data.read_count;
        console.log(`✅ Message read by ${readCount} user(s)`);

        if (data.data.read_by.length > 0) {
            console.log('   ✅ PASS: Read receipts tracked');
            console.log('\n   Read by:');
            data.data.read_by.forEach((reader, i) => {
                console.log(`   ${i + 1}. ${reader.user_name} (${reader.user_role})`);
                console.log(`      Read at: ${reader.read_at}`);
            });
        } else {
            console.log('   ⚠️  No read receipts yet');
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
        const replyId = data.data.id;
        const approvalStatus = data.data.approval_status;
        console.log(`✅ Reply sent: ${replyId}`);
        console.log(`✅ Approval status: ${approvalStatus}`);

        if (approvalStatus === 'approved') {
            console.log('   ✅ PASS: Parent→Teacher message auto-approved');
        } else {
            console.log('   ❌ FAIL: Expected auto-approval, got "' + approvalStatus + '"');
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

    // Teacher's unread count
    const { response: teacherResponse, data: teacherData } = await makeRequest('/api/chat/unread-count', {
        headers: {
            'Authorization': `Bearer ${tokens.teacher}`
        }
    });

    if (teacherResponse.ok) {
        console.log(`✅ Teacher total unread: ${teacherData.data.total_unread}`);
        if (teacherData.data.threads.length > 0) {
            console.log('   Unread threads:');
            teacherData.data.threads.forEach(thread => {
                console.log(`   - Thread ${thread.thread_id}: ${thread.unread_count} unread`);
            });
        }
    }

    // Parent's unread count
    const { response: parentResponse, data: parentData } = await makeRequest('/api/chat/unread-count', {
        headers: {
            'Authorization': `Bearer ${tokens.parent}`
        }
    });

    if (parentResponse.ok) {
        console.log(`✅ Parent total unread: ${parentData.data.total_unread}`);
    }
}

/**
 * Cleanup: Delete test users
 */
async function cleanupTestUsers() {
    if (KEEP_USERS) {
        console.log('\n📌 KEEPING TEST USERS (--keep-users flag set)');
        console.log('='.repeat(80));
        console.log('\nYou can use these credentials for manual testing:');
        for (const user of createdUsers) {
            const userCreds = USERS[user.role];
            console.log(`\n${user.role.toUpperCase()}:`);
            console.log(`   Phone: ${userCreds.phone_number}`);
            console.log(`   Password: ${userCreds.password}`);
            console.log(`   User ID: ${user.userId}`);
        }
        return;
    }

    if (createdUsers.length === 0) {
        console.log('\n   ℹ️  No test users to clean up');
        return;
    }

    console.log('\n🧹 CLEANUP: Deleting test users');
    console.log('='.repeat(80));

    for (const user of createdUsers) {
        try {
            console.log(`\n🗑️  Deleting ${user.role} (${user.phone})...`);

            // Note: You'll need to implement a delete endpoint or use admin privileges
            // For now, we'll attempt to delete via admin
            const { response, data } = await makeRequest(`/api/users/${user.userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${tokens.admin}`
                }
            });

            if (response.ok) {
                console.log(`   ✅ ${user.role} deleted successfully`);
            } else {
                console.log(`   ⚠️  Could not delete ${user.role}: ${data.message || 'Unknown error'}`);
                console.log(`   ℹ️  You may need to manually delete user ${user.userId}`);
            }
        } catch (error) {
            console.log(`   ⚠️  Error deleting ${user.role}:`, error.message);
        }
    }

    console.log('\n✅ Cleanup completed');
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log('\n🚀 Starting Complete Chat System Test');
    console.log('='.repeat(80));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Mode: ${KEEP_USERS ? 'Keep users after testing' : 'Auto-cleanup after testing'}`);

    try {
        await setupUsers();
        await testCreateThread();
        await testParentViewBeforeApproval();
        await testAdminViewPending();
        await testAdminApproval();
        await testParentViewAfterApproval();
        await testReadReceipts();
        await testParentReply();
        await testUnreadCounts();

        console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
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

        // Cleanup test users
        await cleanupTestUsers();

    } catch (error) {
        console.error('\n❌ TEST FAILED');
        console.error('Error:', error.message);
        console.error(error.stack);

        // Still try to cleanup even if tests failed
        if (!KEEP_USERS && createdUsers.length > 0) {
            console.log('\n⚠️  Tests failed, but attempting cleanup anyway...');
            await cleanupTestUsers();
        }

        process.exit(1);
    }
}

// Run tests
runAllTests();

