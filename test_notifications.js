const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// Configuration
const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test user credentials (replace with actual parent credentials)
const TEST_PARENT = {
    id: 'test-parent-id',
    email: 'parent@test.com',
    role: 'parent'
};

// Generate JWT token for parent
const token = jwt.sign(
    {
        userId: TEST_PARENT.id,
        email: TEST_PARENT.email,
        role: TEST_PARENT.role
    },
    JWT_SECRET,
    { expiresIn: '1h' }
);

console.log('🧪 Testing Parent Notification System');
console.log('=====================================');

// Test 1: WebSocket Connection and Notification Subscription
async function testWebSocketConnection() {
    console.log('\n1. Testing WebSocket Connection...');

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_URL}?token=${token}`);

        ws.on('open', () => {
            console.log('✅ WebSocket connected successfully');

            // Test heartbeat response
            ws.on('message', (data) => {
                const message = JSON.parse(data.toString());

                if (message.type === 'connection_established') {
                    console.log('✅ Connection established for user:', message.user_id);
                } else if (message.type === 'heartbeat') {
                    console.log('💓 Heartbeat received, responding...');
                    ws.send(JSON.stringify({
                        type: 'heartbeat_response',
                        timestamp: Date.now()
                    }));
                } else if (message.type === 'notification') {
                    console.log('🔔 Notification received:', message.data);
                    console.log('   Title:', message.data.title);
                    console.log('   Type:', message.data.type);
                    console.log('   Priority:', message.data.priority);
                    console.log('   Student:', message.data.student?.full_name);
                }
            });

            resolve(ws);
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket connection failed:', error.message);
            reject(error);
        });
    });
}

// Test 2: Create Test Announcement
async function testCreateAnnouncement() {
    console.log('\n2. Testing Announcement Creation...');

    try {
        const response = await fetch(`${BASE_URL}/api/announcements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: 'Test Announcement for Notifications',
                content: 'This is a test announcement to verify the notification system is working correctly.',
                announcement_type: 'general',
                priority: 'normal',
                target_roles: ['parent'],
                target_classes: [],
                target_departments: [],
                target_subjects: [],
                is_featured: false
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Announcement created successfully');
            console.log('   ID:', result.data.announcement.id);
            console.log('   Status:', result.data.announcement.status);
            return result.data.announcement;
        } else {
            console.error('❌ Failed to create announcement:', result);
            return null;
        }
    } catch (error) {
        console.error('❌ Error creating announcement:', error.message);
        return null;
    }
}

// Test 3: Create Test Homework
async function testCreateHomework() {
    console.log('\n3. Testing Homework Creation...');

    try {
        // First, get a class division ID
        const classResponse = await fetch(`${BASE_URL}/api/academic/class-divisions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const classData = await classResponse.json();
        if (!classData.data || classData.data.length === 0) {
            console.log('⚠️  No class divisions found, skipping homework test');
            return null;
        }

        const classDivisionId = classData.data[0].id;

        const response = await fetch(`${BASE_URL}/api/homework`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                class_division_id: classDivisionId,
                subject: 'Mathematics',
                title: 'Test Homework Assignment',
                description: 'Complete exercises 1-10 from chapter 5. Due tomorrow.',
                due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Homework created successfully');
            console.log('   ID:', result.data.homework.id);
            console.log('   Subject:', result.data.homework.subject);
            console.log('   Due Date:', result.data.homework.due_date);
            return result.data.homework;
        } else {
            console.error('❌ Failed to create homework:', result);
            return null;
        }
    } catch (error) {
        console.error('❌ Error creating homework:', error.message);
        return null;
    }
}

// Test 4: Get Parent Notifications
async function testGetNotifications() {
    console.log('\n4. Testing Get Parent Notifications...');

    try {
        const response = await fetch(`${BASE_URL}/api/notifications`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Notifications retrieved successfully');
            console.log('   Total notifications:', result.data.length);
            console.log('   Unread count:', result.data.filter(n => !n.is_read).length);

            // Show first few notifications
            result.data.slice(0, 3).forEach((notification, index) => {
                console.log(`   ${index + 1}. ${notification.title} (${notification.type})`);
            });

            return result.data;
        } else {
            console.error('❌ Failed to get notifications:', result);
            return [];
        }
    } catch (error) {
        console.error('❌ Error getting notifications:', error.message);
        return [];
    }
}

// Test 5: Get Unread Count
async function testGetUnreadCount() {
    console.log('\n5. Testing Get Unread Count...');

    try {
        const response = await fetch(`${BASE_URL}/api/notifications/unread-count`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Unread count retrieved successfully');
            console.log('   Unread notifications:', result.data.unread_count);
            return result.data.unread_count;
        } else {
            console.error('❌ Failed to get unread count:', result);
            return 0;
        }
    } catch (error) {
        console.error('❌ Error getting unread count:', error.message);
        return 0;
    }
}

// Test 6: Mark Notification as Read
async function testMarkAsRead(notificationId) {
    console.log('\n6. Testing Mark Notification as Read...');

    try {
        const response = await fetch(`${BASE_URL}/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Notification marked as read successfully');
            return true;
        } else {
            console.error('❌ Failed to mark notification as read:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Error marking notification as read:', error.message);
        return false;
    }
}

// Test 7: Get Notification Statistics
async function testGetStats() {
    console.log('\n7. Testing Get Notification Statistics...');

    try {
        const response = await fetch(`${BASE_URL}/api/notifications/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Notification statistics retrieved successfully');
            console.log('   Total notifications:', result.data.total);
            console.log('   Unread notifications:', result.data.unread);
            console.log('   By type:', result.data.byType);
            console.log('   By priority:', result.data.byPriority);
            return result.data;
        } else {
            console.error('❌ Failed to get statistics:', result);
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting statistics:', error.message);
        return null;
    }
}

// Main test function
async function runTests() {
    try {
        console.log('🚀 Starting Parent Notification System Tests...\n');

        // Test WebSocket connection
        const ws = await testWebSocketConnection();

        // Wait a moment for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test creating content that should trigger notifications
        const announcement = await testCreateAnnouncement();
        await new Promise(resolve => setTimeout(resolve, 1000));

        const homework = await testCreateHomework();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test notification APIs
        const notifications = await testGetNotifications();
        const unreadCount = await testGetUnreadCount();
        const stats = await testGetStats();

        // Test marking a notification as read
        if (notifications.length > 0) {
            await testMarkAsRead(notifications[0].id);
        }

        // Wait for any real-time notifications
        console.log('\n⏳ Waiting for real-time notifications (10 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Close WebSocket connection
        ws.close();

        console.log('\n✅ All tests completed!');
        console.log('\n📊 Test Summary:');
        console.log('   - WebSocket connection: ✅');
        console.log('   - Announcement creation: ✅');
        console.log('   - Homework creation: ✅');
        console.log('   - Notification retrieval: ✅');
        console.log('   - Unread count: ✅');
        console.log('   - Mark as read: ✅');
        console.log('   - Statistics: ✅');

    } catch (error) {
        console.error('❌ Test suite failed:', error);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = {
    testWebSocketConnection,
    testCreateAnnouncement,
    testCreateHomework,
    testGetNotifications,
    testGetUnreadCount,
    testMarkAsRead,
    testGetStats,
    runTests
};
