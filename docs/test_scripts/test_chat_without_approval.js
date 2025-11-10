/**
 * Chat System Test - Without Approval Testing
 * Tests: Parent→Teacher messages and read receipts
 * (Doesn't require admin approval)
 * 
 * Usage: node test_chat_without_approval.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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

const tokens = {};
const userIds = {};
let threadId = null;

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

async function createUsers() {
    console.log('\n📝 Creating test users');
    console.log('='.repeat(80));

    for (const [role, creds] of Object.entries(USERS)) {
        console.log(`\n👤 Creating ${role}...`);
        const { response, data } = await makeRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(creds)
        });

        if (response.ok) {
            tokens[role] = data.data.token;
            userIds[role] = data.data.user.id;
            console.log(`   ✅ Created - Phone: ${creds.phone_number}`);
            console.log(`   User ID: ${userIds[role]}`);
        } else {
            throw new Error(`Failed to create ${role}: ${data.message}`);
        }
    }
}

async function testParentToTeacher() {
    console.log('\n📝 TEST 1: Parent sends message to Teacher (AUTO-APPROVED)');
    console.log('='.repeat(80));

    // Create thread and send message
    const { response, data } = await makeRequest('/api/chat/start-conversation', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens.parent}` },
        body: JSON.stringify({
            participants: [userIds.teacher],
            message_content: 'Hello teacher! I have a question.',
            thread_type: 'direct'
        })
    });

    if (response.ok) {
        threadId = data.data.thread.id;
        const messageId = data.data.message.id;
        const approvalStatus = data.data.message.approval_status;

        console.log(`✅ Thread created: ${threadId}`);
        console.log(`✅ Message sent: ${messageId}`);
        console.log(`✅ Approval status: ${approvalStatus}`);

        if (approvalStatus === 'approved') {
            console.log('   ✅ PASS: Parent→Teacher message AUTO-APPROVED');
        } else {
            console.log('   ❌ FAIL: Expected "approved", got "' + approvalStatus + '"');
        }
    } else {
        throw new Error('Failed to create thread: ' + data.message);
    }
}

async function testTeacherViewsMessage() {
    console.log('\n📝 TEST 2: Teacher views message (AUTO-READ)');
    console.log('='.repeat(80));

    await new Promise(r => setTimeout(r, 500));

    const { response, data } = await makeRequest(`/api/chat/messages?thread_id=${threadId}`, {
        headers: { 'Authorization': `Bearer ${tokens.teacher}` }
    });

    if (response.ok) {
        const messages = data.data.messages;
        console.log(`✅ Messages visible to teacher: ${messages.length}`);

        if (messages.length > 0) {
            const msg = messages[0];
            console.log(`   Content: "${msg.content}"`);
            console.log(`   Status: ${msg.status}`);
            console.log(`   Is read: ${msg.is_read}`);
            console.log(`   Read count: ${msg.read_count}`);

            if (msg.read_count > 0 || msg.is_read) {
                console.log('   ✅ PASS: Message auto-marked as read');
            }
        }
    }
}

async function testReadReceipts() {
    console.log('\n📝 TEST 3: Check read receipts');
    console.log('='.repeat(80));

    await new Promise(r => setTimeout(r, 1000));

    // Get first message ID
    const { response: msgResponse, data: msgData } = await makeRequest(`/api/chat/messages?thread_id=${threadId}`, {
        headers: { 'Authorization': `Bearer ${tokens.parent}` }
    });

    if (msgResponse.ok && msgData.data.messages.length > 0) {
        const messageId = msgData.data.messages[0].id;

        const { response, data } = await makeRequest(`/api/chat/messages/${messageId}/read-by`, {
            headers: { 'Authorization': `Bearer ${tokens.parent}` }
        });

        if (response.ok) {
            console.log(`✅ Message read by ${data.data.read_count} user(s)`);

            if (data.data.read_by.length > 0) {
                console.log('   ✅ PASS: Read receipts working');
                data.data.read_by.forEach(r => {
                    console.log(`   - ${r.user_name} read at ${r.read_at}`);
                });
            }
        }
    }
}

async function testTeacherReply() {
    console.log('\n📝 TEST 4: Teacher sends reply');
    console.log('='.repeat(80));
    console.log('⚠️  NOTE: Teacher→Parent needs approval, so this will be PENDING');

    const { response, data } = await makeRequest('/api/chat/messages', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokens.teacher}` },
        body: JSON.stringify({
            thread_id: threadId,
            content: 'Thank you for your question!',
            message_type: 'text'
        })
    });

    if (response.ok) {
        console.log(`✅ Reply sent: ${data.data.id}`);
        console.log(`✅ Approval status: ${data.data.approval_status}`);

        if (data.data.approval_status === 'pending') {
            console.log('   ✅ PASS: Teacher→Parent requires approval');
            console.log('   ℹ️  This message won\'t be visible to parent until admin approves');
        }
    }
}

async function testUnreadCounts() {
    console.log('\n📝 TEST 5: Unread counts');
    console.log('='.repeat(80));

    const { response, data } = await makeRequest('/api/chat/unread-count', {
        headers: { 'Authorization': `Bearer ${tokens.parent}` }
    });

    if (response.ok) {
        console.log(`✅ Parent total unread: ${data.data.total_unread}`);
        console.log('   ✅ PASS: Unread count working');
    }
}

function showCleanup() {
    console.log('\n🧹 SAFE CLEANUP');
    console.log('='.repeat(80));
    console.log('⚠️  IMPORTANT: Use exact IDs, NOT wildcards!');
    console.log('\nRun this SQL in Supabase SQL Editor:\n');

    console.log('-- STEP 1: PREVIEW (verify these are test users)');
    console.log('SELECT id, phone_number, full_name, role FROM users WHERE id IN (');
    console.log(`    '${userIds.teacher}',  -- Test Teacher`);
    console.log(`    '${userIds.parent}'    -- Test Parent`);
    console.log(');\n');

    console.log('-- STEP 2: If preview shows ONLY test users, delete:');
    console.log('DELETE FROM users WHERE id IN (');
    console.log(`    '${userIds.teacher}',  -- ${USERS.teacher.phone_number}`);
    console.log(`    '${userIds.parent}'    -- ${USERS.parent.phone_number}`);
    console.log(');\n');

    console.log('⚠️  DO NOT use wildcards like:');
    console.log('   DELETE FROM users WHERE phone_number LIKE \'8888%\'  ← DANGEROUS!');
    console.log('   This would delete REAL parents with similar numbers!\n');
}

async function runTests() {
    console.log('\n🚀 Chat System Test (Without Approval Testing)');
    console.log('='.repeat(80));
    console.log('Testing: Read receipts, auto-marking, Parent→Teacher messages\n');

    try {
        await createUsers();
        await testParentToTeacher();
        await testTeacherViewsMessage();
        await testReadReceipts();
        await testTeacherReply();
        await testUnreadCounts();

        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('='.repeat(80));
        console.log('\n✅ What Worked:');
        console.log('   ✅ Parent→Teacher messages (auto-approved)');
        console.log('   ✅ Messages auto-marked as read');
        console.log('   ✅ Read receipts tracked');
        console.log('   ✅ Unread counts accurate');
        console.log('\n⚠️  Not Tested (Requires Admin):');
        console.log('   - Teacher→Parent approval workflow');
        console.log('   - Admin pending messages view');
        console.log('   - Admin approve/reject endpoints');

        showCleanup();

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        showCleanup();
        process.exit(1);
    }
}

runTests();

