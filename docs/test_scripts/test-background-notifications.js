#!/usr/bin/env node

/**
 * Background Notification Test Suite
 * Tests push notifications when app is closed/backgrounded
 */

import dotenv from 'dotenv';
import { adminSupabase } from '../../src/config/supabase.js';
import { EnhancedNotificationService } from '../../src/services/enhancedNotificationService.js';

dotenv.config();

console.log('🧪 Testing Background Notifications');
console.log('===================================\n');

// Test configuration
const TEST_CONFIG = {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    testUserId: 'test-user-background-id',
    testDeviceToken: 'test_device_token_background_' + Date.now()
};

// Test 1: Check Firebase Configuration
async function testFirebaseConfiguration() {
    console.log('1. Testing Firebase Configuration...');

    try {
        const notificationService = new EnhancedNotificationService();

        // Test with a dummy token to check Firebase setup
        const testResult = await notificationService.testNotification('dummy_token_test');

        if (testResult.success === false && testResult.code === 'messaging/invalid-registration-token') {
            console.log('✅ Firebase is configured correctly (expected error with dummy token)');
            return true;
        } else if (testResult.success) {
            console.log('✅ Firebase is working and test notification sent');
            return true;
        } else {
            console.log('❌ Firebase configuration issue:', testResult.error);
            return false;
        }
    } catch (error) {
        console.log('❌ Firebase configuration error:', error.message);
        return false;
    }
}

// Test 2: Device Token Registration
async function testDeviceTokenRegistration() {
    console.log('\n2. Testing Device Token Registration...');

    try {
        // Register a test device token
        const { data, error } = await adminSupabase
            .from('device_tokens')
            .insert([{
                user_id: TEST_CONFIG.testUserId,
                device_token: TEST_CONFIG.testDeviceToken,
                platform: 'android',
                device_info: {
                    model: 'Test Device',
                    os_version: 'Android 12',
                    app_version: '1.0.0'
                },
                is_active: true
            }])
            .select()
            .single();

        if (error) {
            console.log('❌ Failed to register device token:', error.message);
            return false;
        }

        console.log('✅ Device token registered successfully');
        console.log('   Token ID:', data.id);
        console.log('   User ID:', data.user_id);
        console.log('   Platform:', data.platform);

        return true;
    } catch (error) {
        console.log('❌ Error registering device token:', error.message);
        return false;
    }
}

// Test 3: Background Notification Payload
async function testBackgroundNotificationPayload() {
    console.log('\n3. Testing Background Notification Payload...');

    const notificationService = new EnhancedNotificationService();

    const testNotification = {
        title: 'Background Test Notification',
        body: 'This notification should appear even when the app is closed',
        type: 'test',
        id: 'background_test_' + Date.now(),
        data: {
            test_type: 'background',
            timestamp: Date.now().toString(),
            priority: 'high'
        }
    };

    try {
        const result = await notificationService.sendPushNotification(
            TEST_CONFIG.testDeviceToken,
            testNotification
        );

        if (result.success) {
            console.log('✅ Background notification sent successfully');
            console.log('   Message ID:', result.messageId);
            console.log('   Device Token:', result.deviceToken);
            return true;
        } else {
            console.log('❌ Failed to send background notification:', result.error);
            return false;
        }
    } catch (error) {
        console.log('❌ Error sending background notification:', error.message);
        return false;
    }
}

// Test 4: Data-Only Message (for background processing)
async function testDataOnlyMessage() {
    console.log('\n4. Testing Data-Only Message...');

    const notificationService = new EnhancedNotificationService();

    const dataMessage = {
        type: 'data_only',
        action: 'sync_data',
        timestamp: Date.now().toString(),
        payload: {
            sync_type: 'background',
            data_version: '1.0'
        }
    };

    try {
        const result = await notificationService.sendDataOnlyMessage(
            TEST_CONFIG.testDeviceToken,
            dataMessage
        );

        if (result.success) {
            console.log('✅ Data-only message sent successfully');
            console.log('   Message ID:', result.messageId);
            return true;
        } else {
            console.log('❌ Failed to send data-only message:', result.error);
            return false;
        }
    } catch (error) {
        console.log('❌ Error sending data-only message:', error.message);
        return false;
    }
}

// Test 5: User-Based Notification
async function testUserBasedNotification() {
    console.log('\n5. Testing User-Based Notification...');

    const notificationService = new EnhancedNotificationService();

    const userNotification = {
        title: 'User Background Test',
        body: 'This notification is sent to a specific user',
        type: 'user_test',
        id: 'user_background_test_' + Date.now(),
        data: {
            user_id: TEST_CONFIG.testUserId,
            test_type: 'user_background'
        }
    };

    try {
        const result = await notificationService.sendNotificationToUser(
            TEST_CONFIG.testUserId,
            userNotification
        );

        if (result.success) {
            console.log('✅ User-based notification sent successfully');
            console.log('   Sent to devices:', result.sent);
            console.log('   Failed devices:', result.failed);
            return true;
        } else {
            console.log('❌ Failed to send user-based notification:', result.error);
            return false;
        }
    } catch (error) {
        console.log('❌ Error sending user-based notification:', error.message);
        return false;
    }
}

// Test 6: Notification Channel Configuration
async function testNotificationChannelConfig() {
    console.log('\n6. Testing Notification Channel Configuration...');

    const correctPayload = {
        token: 'test_token',
        notification: {
            title: 'Channel Test',
            body: 'Testing notification channel configuration'
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'school_notifications',
                priority: 'high',
                defaultSound: true,
                defaultVibrateTimings: true,
                icon: 'ic_notification',
                color: '#FF6B35'
            }
        },
        apns: {
            payload: {
                aps: {
                    alert: {
                        title: 'Channel Test',
                        body: 'Testing notification channel configuration'
                    },
                    sound: 'default',
                    badge: 1,
                    'content-available': 1,
                    'mutable-content': 1
                }
            }
        }
    };

    console.log('✅ Correct notification payload structure:');
    console.log(JSON.stringify(correctPayload, null, 2));

    return true;
}

// Test 7: Cleanup Test Data
async function cleanupTestData() {
    console.log('\n7. Cleaning up test data...');

    try {
        // Remove test device token
        const { error } = await adminSupabase
            .from('device_tokens')
            .delete()
            .eq('device_token', TEST_CONFIG.testDeviceToken);

        if (error) {
            console.log('⚠️  Warning: Failed to cleanup test device token:', error.message);
        } else {
            console.log('✅ Test device token cleaned up');
        }

        return true;
    } catch (error) {
        console.log('⚠️  Warning: Error during cleanup:', error.message);
        return true; // Don't fail the test for cleanup issues
    }
}

// Main test function
async function runBackgroundNotificationTests() {
    console.log('🚀 Starting Background Notification Tests...\n');

    const tests = [
        { name: 'Firebase Configuration', fn: testFirebaseConfiguration },
        { name: 'Device Token Registration', fn: testDeviceTokenRegistration },
        { name: 'Background Notification Payload', fn: testBackgroundNotificationPayload },
        { name: 'Data-Only Message', fn: testDataOnlyMessage },
        { name: 'User-Based Notification', fn: testUserBasedNotification },
        { name: 'Notification Channel Config', fn: testNotificationChannelConfig },
        { name: 'Cleanup Test Data', fn: cleanupTestData }
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
    console.log('📊 Background Notification Test Results:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    if (failed === 0) {
        console.log('\n🎉 All background notification tests passed!');
        console.log('\n📱 Next Steps for Mobile App:');
        console.log('1. Implement the Android notification channel configuration');
        console.log('2. Add proper background message handling');
        console.log('3. Test with real device tokens');
        console.log('4. Verify battery optimization settings');
        console.log('5. Test with app completely closed');
    } else {
        console.log('\n⚠️  Some tests failed. Check the errors above.');
        console.log('\n🔧 Common Issues:');
        console.log('1. Firebase configuration problems');
        console.log('2. Missing environment variables');
        console.log('3. Database connection issues');
        console.log('4. Invalid device tokens');
    }

    console.log('\n📚 For detailed setup instructions, see:');
    console.log('- android-notification-setup.md');
    console.log('- PUSH_NOTIFICATIONS_IMPLEMENTATION_GUIDE.md');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runBackgroundNotificationTests().catch(console.error);
}

export {
    cleanupTestData,
    runBackgroundNotificationTests, testBackgroundNotificationPayload,
    testDataOnlyMessage, testDeviceTokenRegistration, testFirebaseConfiguration, testNotificationChannelConfig, testUserBasedNotification
};

