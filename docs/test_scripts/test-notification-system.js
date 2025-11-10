#!/usr/bin/env node

/**
 * Complete Notification System Test
 * Tests the actual notification system with your existing setup
 */

import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';
import pushNotificationService from './src/services/pushNotificationService.js';

dotenv.config();

console.log('🧪 Testing Complete Notification System');
console.log('======================================\n');

// Test configuration
const TEST_CONFIG = {
    testUserId: 'test-user-notification-id',
    testDeviceToken: 'test_device_token_' + Date.now()
};

// Test 1: Check Database Tables
async function testDatabaseTables() {
    console.log('1. Checking Database Tables...');

    try {
        // Check if user_device_tokens table exists
        const { data: tokens, error: tokenError } = await adminSupabase
            .from('user_device_tokens')
            .select('count')
            .limit(1);

        if (tokenError) {
            console.log('❌ user_device_tokens table issue:', tokenError.message);
            return false;
        }

        console.log('✅ user_device_tokens table exists');

        // Check if users table exists
        const { data: users, error: userError } = await adminSupabase
            .from('users')
            .select('count')
            .limit(1);

        if (userError) {
            console.log('❌ users table issue:', userError.message);
            return false;
        }

        console.log('✅ users table exists');
        return true;

    } catch (error) {
        console.log('❌ Database error:', error.message);
        return false;
    }
}

// Test 2: Check Existing Device Tokens
async function testExistingDeviceTokens() {
    console.log('\n2. Checking Existing Device Tokens...');

    try {
        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('id, user_id, device_token, platform, is_active, created_at')
            .limit(10);

        if (error) {
            console.log('❌ Error fetching device tokens:', error.message);
            return false;
        }

        if (tokens.length === 0) {
            console.log('⚠️  No device tokens found in database');
            console.log('   This means no devices are registered for notifications');
            return false;
        }

        console.log(`✅ Found ${tokens.length} device tokens in database`);
        tokens.forEach((token, index) => {
            console.log(`   ${index + 1}. User: ${token.user_id}, Platform: ${token.platform}, Active: ${token.is_active}`);
            console.log(`      Token: ${token.device_token.substring(0, 20)}...`);
            console.log(`      Created: ${token.created_at}`);
        });

        return true;

    } catch (error) {
        console.log('❌ Error checking device tokens:', error.message);
        return false;
    }
}

// Test 3: Test Device Token Registration
async function testDeviceTokenRegistration() {
    console.log('\n3. Testing Device Token Registration...');

    try {
        // First, create a test user if it doesn't exist
        const { data: existingUser, error: userCheckError } = await adminSupabase
            .from('users')
            .select('id')
            .eq('id', TEST_CONFIG.testUserId)
            .single();

        if (userCheckError && userCheckError.code !== 'PGRST116') {
            console.log('❌ Error checking test user:', userCheckError.message);
            return false;
        }

        if (!existingUser) {
            // Create test user
            const { error: createUserError } = await adminSupabase
                .from('users')
                .insert([{
                    id: TEST_CONFIG.testUserId,
                    email: 'test@notification.com',
                    full_name: 'Test User',
                    role: 'parent',
                    is_active: true
                }]);

            if (createUserError) {
                console.log('❌ Error creating test user:', createUserError.message);
                return false;
            }

            console.log('✅ Test user created');
        } else {
            console.log('✅ Test user exists');
        }

        // Register device token
        const result = await pushNotificationService.registerDeviceToken(
            TEST_CONFIG.testUserId,
            TEST_CONFIG.testDeviceToken,
            'android'
        );

        if (!result.success) {
            console.log('❌ Failed to register device token:', result.error);
            return false;
        }

        console.log('✅ Device token registered successfully');
        return true;

    } catch (error) {
        console.log('❌ Error in device token registration:', error.message);
        return false;
    }
}

// Test 4: Test Push Notification Service
async function testPushNotificationService() {
    console.log('\n4. Testing Push Notification Service...');

    try {
        const testNotification = {
            id: 'test_' + Date.now(),
            type: 'test',
            title: 'Test Background Notification',
            message: 'This notification should appear even when the app is closed',
            priority: 'high',
            created_at: new Date().toISOString()
        };

        const result = await pushNotificationService.sendToUser(
            TEST_CONFIG.testUserId,
            testNotification
        );

        if (!result.success) {
            console.log('❌ Failed to send test notification:', result.error);
            return false;
        }

        console.log('✅ Test notification sent successfully');
        console.log(`   Sent to devices: ${result.sent}`);
        console.log(`   Failed devices: ${result.failed}`);

        return true;

    } catch (error) {
        console.log('❌ Error sending test notification:', error.message);
        return false;
    }
}

// Test 5: Test Firebase Configuration
async function testFirebaseConfiguration() {
    console.log('\n5. Testing Firebase Configuration...');

    try {
        // Try to initialize the service
        await pushNotificationService.initialize();
        console.log('✅ Firebase Admin SDK initialized successfully');

        // Test with a dummy token to verify Firebase setup
        const testMessage = {
            token: 'dummy_token_for_testing',
            notification: {
                title: 'Test',
                body: 'Test message'
            }
        };

        try {
            await pushNotificationService.sendToDevice('dummy_token_for_testing', {
                id: 'test',
                type: 'test',
                title: 'Test',
                message: 'Test message',
                priority: 'normal',
                created_at: new Date().toISOString()
            });
        } catch (error) {
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('✅ Firebase is configured correctly (expected error with dummy token)');
                return true;
            } else {
                throw error;
            }
        }

        return true;

    } catch (error) {
        console.log('❌ Firebase configuration error:', error.message);
        return false;
    }
}

// Test 6: Cleanup Test Data
async function cleanupTestData() {
    console.log('\n6. Cleaning up test data...');

    try {
        // Remove test device token
        const { error: tokenError } = await adminSupabase
            .from('user_device_tokens')
            .delete()
            .eq('device_token', TEST_CONFIG.testDeviceToken);

        if (tokenError) {
            console.log('⚠️  Warning: Failed to cleanup test device token:', tokenError.message);
        } else {
            console.log('✅ Test device token cleaned up');
        }

        // Remove test user
        const { error: userError } = await adminSupabase
            .from('users')
            .delete()
            .eq('id', TEST_CONFIG.testUserId);

        if (userError) {
            console.log('⚠️  Warning: Failed to cleanup test user:', userError.message);
        } else {
            console.log('✅ Test user cleaned up');
        }

        return true;

    } catch (error) {
        console.log('⚠️  Warning: Error during cleanup:', error.message);
        return true; // Don't fail the test for cleanup issues
    }
}

// Main test function
async function runNotificationSystemTests() {
    console.log('🚀 Starting Complete Notification System Tests...\n');

    const tests = [
        { name: 'Database Tables', fn: testDatabaseTables },
        { name: 'Existing Device Tokens', fn: testExistingDeviceTokens },
        { name: 'Device Token Registration', fn: testDeviceTokenRegistration },
        { name: 'Push Notification Service', fn: testPushNotificationService },
        { name: 'Firebase Configuration', fn: testFirebaseConfiguration },
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
    console.log('📊 Notification System Test Results:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

    if (failed === 0) {
        console.log('\n🎉 All notification system tests passed!');
        console.log('\n📱 Your notification system is working correctly.');
        console.log('\n🔧 If notifications still don\'t work when app is closed:');
        console.log('   1. Check Android notification channels (see android-notification-setup.md)');
        console.log('   2. Verify device notification permissions');
        console.log('   3. Disable battery optimization for your app');
        console.log('   4. Test with real device tokens from your mobile app');
    } else {
        console.log('\n⚠️  Some tests failed. Check the errors above.');
        console.log('\n🔧 Common Issues:');
        console.log('   1. Database connection problems');
        console.log('   2. Missing device tokens');
        console.log('   3. Firebase configuration issues');
        console.log('   4. Invalid notification payloads');
    }

    console.log('\n📚 Next Steps:');
    console.log('   1. Register real device tokens from your mobile app');
    console.log('   2. Test with actual notifications');
    console.log('   3. Monitor Firebase console for delivery reports');
    console.log('   4. Check device notification settings');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runNotificationSystemTests().catch(console.error);
}

export {
    cleanupTestData,
    runNotificationSystemTests, testDatabaseTables, testDeviceTokenRegistration, testExistingDeviceTokens, testFirebaseConfiguration, testPushNotificationService
};

