const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

// Configuration
const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Test user credentials (replace with actual parent credentials)
const TEST_PARENT = {
    id: 'test-parent-push-id',
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

console.log('🧪 Testing Push Notifications System');
console.log('=====================================');

// Test 1: Register Device Token
async function testRegisterDeviceToken() {
    console.log('\n1. Testing Device Token Registration...');

    try {
        const response = await fetch(`${BASE_URL}/api/device-tokens/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                device_token: 'test_device_token_' + Date.now(),
                platform: 'android',
                device_info: {
                    model: 'Test Device',
                    os_version: 'Android 12',
                    app_version: '1.0.0'
                }
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Device token registered successfully');
            return true;
        } else {
            console.error('❌ Failed to register device token:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Error registering device token:', error.message);
        return false;
    }
}

// Test 2: Get My Device Tokens
async function testGetMyTokens() {
    console.log('\n2. Testing Get My Device Tokens...');

    try {
        const response = await fetch(`${BASE_URL}/api/device-tokens/my-tokens`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Device tokens retrieved successfully');
            console.log('   Total tokens:', result.data.length);
            result.data.forEach((token, index) => {
                console.log(`   ${index + 1}. ${token.platform} - ${token.device_token.substring(0, 20)}...`);
            });
            return result.data;
        } else {
            console.error('❌ Failed to get device tokens:', result);
            return [];
        }
    } catch (error) {
        console.error('❌ Error getting device tokens:', error.message);
        return [];
    }
}

// Test 3: Send Test Push Notification
async function testSendPushNotification() {
    console.log('\n3. Testing Send Push Notification...');

    try {
        const response = await fetch(`${BASE_URL}/api/device-tokens/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: 'Test Push Notification',
                message: 'This is a test push notification from the school app!'
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Test push notification sent successfully');
            console.log('   Sent to devices:', result.data.sent);
            console.log('   Failed devices:', result.data.failed);
            return true;
        } else {
            console.error('❌ Failed to send test push notification:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Error sending test push notification:', error.message);
        return false;
    }
}

// Test 4: Subscribe to Topic
async function testSubscribeToTopic() {
    console.log('\n4. Testing Subscribe to Topic...');

    try {
        const response = await fetch(`${BASE_URL}/api/device-tokens/subscribe-topic`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                device_token: 'test_device_token_' + Date.now(),
                topic: 'school_announcements'
            })
        });

        const result = await response.json();

        if (response.ok) {
            console.log('✅ Successfully subscribed to topic');
            return true;
        } else {
            console.error('❌ Failed to subscribe to topic:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Error subscribing to topic:', error.message);
        return false;
    }
}

// Test 5: WebSocket + Push Notification Integration
async function testWebSocketAndPushIntegration() {
    console.log('\n5. Testing WebSocket + Push Notification Integration...');

    return new Promise((resolve) => {
        const ws = new WebSocket(`${WS_URL}?token=${token}`);

        ws.on('open', async () => {
            console.log('✅ WebSocket connected');

            // Register device token
            await testRegisterDeviceToken();

            // Wait a moment
            setTimeout(async () => {
                // Send test notification (this should trigger both WebSocket and Push)
                await testSendPushNotification();

                // Wait for WebSocket message
                setTimeout(() => {
                    ws.close();
                    resolve(true);
                }, 5000);
            }, 2000);
        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === 'notification') {
                console.log('🔔 WebSocket notification received:', message.data.title);
            } else if (message.type === 'connection_established') {
                console.log('📡 WebSocket connection established');
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
            resolve(false);
        });

        ws.on('close', () => {
            console.log('📡 WebSocket disconnected');
        });
    });
}

// Test 6: Create Content and Test Notifications
async function testContentCreationWithNotifications() {
    console.log('\n6. Testing Content Creation with Notifications...');

    try {
        // Create announcement (this should trigger notifications)
        const response = await fetch(`${BASE_URL}/api/announcements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: 'Test Announcement for Push Notifications',
                content: 'This announcement should trigger both WebSocket and push notifications.',
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
            console.log('   Auto-approved:', result.data.auto_approved);

            if (result.data.auto_approved) {
                console.log('🔔 Notifications should have been sent (WebSocket + Push)');
            } else {
                console.log('⏳ Announcement pending approval - no notifications sent yet');
            }

            return true;
        } else {
            console.error('❌ Failed to create announcement:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Error creating announcement:', error.message);
        return false;
    }
}

// Main test function
async function runTests() {
    try {
        console.log('🚀 Starting Push Notifications System Tests...\n');

        const tests = [
            { name: 'Device Token Registration', fn: testRegisterDeviceToken },
            { name: 'Get My Device Tokens', fn: testGetMyTokens },
            { name: 'Send Test Push Notification', fn: testSendPushNotification },
            { name: 'Subscribe to Topic', fn: testSubscribeToTopic },
            { name: 'WebSocket + Push Integration', fn: testWebSocketAndPushIntegration },
            { name: 'Content Creation with Notifications', fn: testContentCreationWithNotifications }
        ];

        let passed = 0;
        let failed = 0;

        for (const test of tests) {
            try {
                const result = await test.fn();
                if (result) {
                    passed++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error(`❌ Test "${test.name}" failed with error:`, error.message);
                failed++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 Test Results:');
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

        if (failed === 0) {
            console.log('\n🎉 All tests passed! Push notification system is working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Check the errors above and fix the issues.');
        }

        console.log('\n📱 Next Steps:');
        console.log('1. Set up Firebase project and get service account key');
        console.log('2. Configure environment variables');
        console.log('3. Test with real mobile devices');
        console.log('4. Implement client-side push notification handling');

    } catch (error) {
        console.error('❌ Test suite failed:', error);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = {
    testRegisterDeviceToken,
    testGetMyTokens,
    testSendPushNotification,
    testSubscribeToTopic,
    testWebSocketAndPushIntegration,
    testContentCreationWithNotifications,
    runTests
};
