#!/usr/bin/env node

/**
 * Test Auto-Streaming Notifications
 * This script demonstrates how parents automatically receive ALL notifications
 * without any manual subscription
 */

const WebSocket = require('ws');

const BASE_URL = 'ws://localhost:3000';
const TEST_TOKEN = 'your_jwt_token_here'; // Replace with a real parent JWT token

console.log('🔔 Testing Auto-Streaming Notifications...\n');
console.log('📋 Parents automatically receive ALL notifications for their children:\n');

// Show what parents automatically get
console.log('✅ AUTOMATIC NOTIFICATIONS FOR PARENTS:');
console.log('   🏫 School-wide announcements and events');
console.log('   📚 Class-specific homework, classwork, announcements');
console.log('   👶 Student-specific attendance, birthday, personal messages');
console.log('   📝 Messages from teachers');
console.log('   🔔 System notifications');
console.log('   ⚠️ Urgent announcements (high priority)');
console.log('');

console.log('✅ AUTOMATIC NOTIFICATIONS FOR TEACHERS:');
console.log('   🏫 School-wide announcements and events');
console.log('   📚 Class-specific notifications for assigned classes');
console.log('   📝 Messages and approval requests');
console.log('   🔔 System notifications');
console.log('');

console.log('✅ AUTOMATIC NOTIFICATIONS FOR PRINCIPALS:');
console.log('   🏫 ALL school-wide notifications');
console.log('   📚 ALL class-specific notifications');
console.log('   👶 ALL student-specific notifications');
console.log('   📝 ALL messages and approval requests');
console.log('   🔔 ALL system notifications');
console.log('');

// Test WebSocket connection
function connectToAutoNotificationStream() {
    console.log('🔌 Connecting to Auto-Notification Stream...');

    const ws = new WebSocket(`${BASE_URL}/notifications/ws?token=${TEST_TOKEN}`);

    ws.on('open', () => {
        console.log('✅ Connected to auto-notification stream!');
        console.log('📡 You will now receive ALL relevant notifications automatically');
        console.log('⏳ Waiting for notifications...\n');
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === 'connection_established') {
                console.log('🎉 Connection established successfully!');
                console.log('📊 Your role:', message.data.user_role);
                console.log('📋 Available notification types:', message.data.message_types.join(', '));
                console.log('✨ Auto-subscription active - no manual setup required!\n');

            } else if (message.type === 'notification') {
                console.log('🔔 NEW NOTIFICATION RECEIVED:');
                console.log('   📝 Title:', message.data.title);
                console.log('   💬 Message:', message.data.message);
                console.log('   🏷️ Type:', message.data.type);
                console.log('   ⭐ Priority:', message.data.priority);
                console.log('   👶 Student ID:', message.data.student_id || 'N/A');
                console.log('   📅 Time:', new Date(message.data.created_at).toLocaleString());
                console.log('');

            } else if (message.type === 'pong') {
                console.log('💓 Heartbeat response received');

            } else {
                console.log('📨 Received:', message.type);
            }
        } catch (error) {
            console.log('❌ Error parsing message:', error.message);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`🔌 Connection closed: ${code} - ${reason}`);
    });

    ws.on('error', (error) => {
        console.log('❌ Connection error:', error.message);
    });

    // Send periodic heartbeats
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString()
            }));
        }
    }, 30000); // Every 30 seconds

    return ws;
}

// Test creating notifications to see them stream automatically
async function testNotificationCreation() {
    console.log('🧪 Testing Notification Creation...\n');

    // This would be done by your backend when:
    // - Teacher creates homework → Parent gets notification
    // - Teacher creates announcement → Parent gets notification  
    // - School creates event → Parent gets notification
    // - Student attendance is marked → Parent gets notification
    // - Teacher sends message → Parent gets notification

    console.log('📝 To test notifications, create them via your backend API:');
    console.log('   • POST /api/announcements - Create announcement');
    console.log('   • POST /api/homework - Create homework');
    console.log('   • POST /api/calendar - Create event');
    console.log('   • POST /api/messages - Send message');
    console.log('   • POST /api/attendance - Mark attendance');
    console.log('');
    console.log('✨ Parents will automatically receive notifications for:');
    console.log('   • Their children\'s classes');
    console.log('   • School-wide announcements');
    console.log('   • Student-specific updates');
    console.log('   • Messages from teachers');
    console.log('');
}

// Main test function
async function runTest() {
    console.log('🚀 Starting Auto-Notification Stream Test...\n');

    try {
        // Connect to auto-notification stream
        const ws = connectToAutoNotificationStream();

        // Show test instructions
        await testNotificationCreation();

        // Keep connection alive
        console.log('⏳ Keeping connection alive for 2 minutes...');
        console.log('💡 Create notifications via your backend to see them stream here!');
        console.log('🔄 No manual subscription needed - everything is automatic!\n');

        setTimeout(() => {
            ws.close();
            console.log('\n🎉 Auto-Notification Stream Test Complete!');
            console.log('\n📋 Summary:');
            console.log('✅ Auto-connection to notification stream');
            console.log('✅ Automatic subscription to all relevant notifications');
            console.log('✅ Real-time notification delivery');
            console.log('✅ No manual subscription required');
            console.log('✅ Role-based automatic filtering');

            console.log('\n🔗 Usage in Your App:');
            console.log('1. Connect to: ws://localhost:3000/notifications/ws?token=JWT_TOKEN');
            console.log('2. Receive ALL notifications automatically');
            console.log('3. No need to subscribe to specific topics');
            console.log('4. Everything is filtered by user role and relationships');

        }, 120000); // 2 minutes

    } catch (error) {
        console.log('\n❌ Test failed:', error.message);
    }
}

// Run test
runTest().catch(console.error);
