#!/usr/bin/env node

/**
 * Test Background Notification with Proper Payload
 * Tests notifications that should work when app is closed
 */

import dotenv from 'dotenv';
import { adminSupabase } from '../../src/config/supabase.js';

dotenv.config();

console.log('🧪 Testing Background Notification with Proper Payload');
console.log('====================================================\n');

// Test configuration
const TEST_USER_ID = '34e0bb46-ec50-4fec-ac30-4e33f3ced66c';

// Test 1: Get User's Device Tokens
async function getUserDeviceTokens() {
    console.log('1. Getting User Device Tokens...');

    try {
        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('id, device_token, platform, is_active')
            .eq('user_id', TEST_USER_ID)
            .eq('is_active', true);

        if (error) {
            console.log('❌ Error fetching device tokens:', error.message);
            return [];
        }

        if (tokens.length === 0) {
            console.log('❌ No active device tokens found for user');
            return [];
        }

        console.log(`✅ Found ${tokens.length} active device tokens:`);
        tokens.forEach((token, index) => {
            console.log(`   ${index + 1}. Platform: ${token.platform}`);
            console.log(`      Token: ${token.device_token.substring(0, 30)}...`);
        });

        return tokens;

    } catch (error) {
        console.log('❌ Error getting device tokens:', error.message);
        return [];
    }
}

// Test 2: Send Background Notification with Proper Payload
async function sendBackgroundNotification(deviceTokens) {
    console.log('\n2. Sending Background Notification...');

    try {
        // Create notification with proper background payload
        const backgroundNotification = {
            id: 'background_test_' + Date.now(),
            type: 'background_test',
            title: 'Background Test Notification',
            message: 'This notification should appear even when the app is closed',
            priority: 'high',
            created_at: new Date().toISOString()
        };

        console.log('📱 Sending to devices:', deviceTokens.length);

        // Send to each device with enhanced payload
        const results = await Promise.allSettled(
            deviceTokens.map(async (device) => {
                console.log(`   Sending to ${device.platform} device...`);

                // Create enhanced message for background notifications
                const message = {
                    token: device.device_token,
                    notification: {
                        title: backgroundNotification.title,
                        body: backgroundNotification.message
                    },
                    data: {
                        type: backgroundNotification.type,
                        id: backgroundNotification.id,
                        priority: backgroundNotification.priority,
                        created_at: backgroundNotification.created_at,
                        // Add extra data for background processing
                        background: 'true',
                        timestamp: Date.now().toString()
                    },
                    // Android specific configuration for background notifications
                    android: {
                        priority: 'high',
                        notification: {
                            channelId: 'school_notifications',
                            priority: 'high',
                            defaultSound: true,
                            defaultVibrateTimings: true,
                            icon: 'ic_notification',
                            color: '#FF6B35',
                            // Important for background notifications
                            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                            tag: backgroundNotification.id,
                            // Ensure notification shows even when app is closed
                            visibility: 'public',
                            localOnly: false
                        },
                        // Data-only message for background processing
                        data: {
                            type: backgroundNotification.type,
                            id: backgroundNotification.id,
                            priority: backgroundNotification.priority,
                            created_at: backgroundNotification.created_at,
                            background: 'true',
                            timestamp: Date.now().toString()
                        }
                    },
                    // iOS specific configuration
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    title: backgroundNotification.title,
                                    body: backgroundNotification.message
                                },
                                sound: 'default',
                                badge: 1,
                                // Critical for background notifications
                                'content-available': 1,
                                'mutable-content': 1,
                                // Ensure notification shows
                                'alert-type': 'banner'
                            }
                        }
                    }
                };

                // Send using Firebase Admin SDK directly
                const admin = await import('firebase-admin');
                const response = await admin.default.messaging().send(message);

                console.log(`   ✅ Sent to ${device.platform}: ${response}`);
                return { success: true, platform: device.platform, messageId: response };
            })
        );

        const successful = results.filter(result => result.status === 'fulfilled').length;
        const failed = results.filter(result => result.status === 'rejected').length;

        console.log(`\n📊 Results: ${successful} successful, ${failed} failed`);

        if (failed > 0) {
            console.log('\n❌ Failed notifications:');
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.log(`   ${index + 1}. ${deviceTokens[index].platform}: ${result.reason.message}`);
                }
            });
        }

        return { successful, failed, results };

    } catch (error) {
        console.log('❌ Error sending background notification:', error.message);
        return { successful: 0, failed: 1, error: error.message };
    }
}

// Test 3: Send Data-Only Message (for background processing)
async function sendDataOnlyMessage(deviceTokens) {
    console.log('\n3. Sending Data-Only Message...');

    try {
        const dataMessage = {
            type: 'data_only',
            action: 'background_sync',
            timestamp: Date.now().toString(),
            payload: {
                sync_type: 'background',
                data_version: '1.0'
            }
        };

        console.log('📱 Sending data-only message to devices:', deviceTokens.length);

        const results = await Promise.allSettled(
            deviceTokens.map(async (device) => {
                console.log(`   Sending data-only to ${device.platform} device...`);

                const message = {
                    token: device.device_token,
                    data: {
                        type: dataMessage.type,
                        action: dataMessage.action,
                        timestamp: dataMessage.timestamp,
                        payload: JSON.stringify(dataMessage.payload)
                    },
                    android: {
                        priority: 'high',
                        data: {
                            type: dataMessage.type,
                            action: dataMessage.action,
                            timestamp: dataMessage.timestamp,
                            payload: JSON.stringify(dataMessage.payload)
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                'content-available': 1
                            }
                        }
                    }
                };

                const admin = await import('firebase-admin');
                const response = await admin.default.messaging().send(message);

                console.log(`   ✅ Data-only sent to ${device.platform}: ${response}`);
                return { success: true, platform: device.platform, messageId: response };
            })
        );

        const successful = results.filter(result => result.status === 'fulfilled').length;
        const failed = results.filter(result => result.status === 'rejected').length;

        console.log(`\n📊 Data-only Results: ${successful} successful, ${failed} failed`);

        return { successful, failed };

    } catch (error) {
        console.log('❌ Error sending data-only message:', error.message);
        return { successful: 0, failed: 1, error: error.message };
    }
}

// Test 4: Check Firebase Delivery Reports
async function checkFirebaseDeliveryReports() {
    console.log('\n4. Checking Firebase Configuration...');

    try {
        const admin = await import('firebase-admin');

        if (!admin.default.apps.length) {
            console.log('❌ Firebase Admin not initialized');
            return false;
        }

        console.log('✅ Firebase Admin SDK is initialized');
        console.log('📊 To check delivery reports:');
        console.log('   1. Go to Firebase Console (https://console.firebase.google.com)');
        console.log('   2. Select your project: school-app-notifications-c86ab');
        console.log('   3. Go to Cloud Messaging > Reports');
        console.log('   4. Check delivery statistics and error logs');

        return true;

    } catch (error) {
        console.log('❌ Firebase error:', error.message);
        return false;
    }
}

// Main test function
async function runBackgroundNotificationTest() {
    console.log('🚀 Starting Background Notification Test...\n');

    try {
        // Get device tokens
        const deviceTokens = await getUserDeviceTokens();

        if (deviceTokens.length === 0) {
            console.log('❌ No device tokens found. Cannot test notifications.');
            return;
        }

        // Send background notification
        const notificationResult = await sendBackgroundNotification(deviceTokens);

        // Send data-only message
        const dataResult = await sendDataOnlyMessage(deviceTokens);

        // Check Firebase configuration
        const firebaseOk = await checkFirebaseDeliveryReports();

        console.log('\n' + '='.repeat(50));
        console.log('📊 Background Notification Test Results:');
        console.log(`   📱 Device Tokens: ${deviceTokens.length}`);
        console.log(`   🔔 Notifications Sent: ${notificationResult.successful}`);
        console.log(`   📊 Data Messages Sent: ${dataResult.successful}`);
        console.log(`   🔥 Firebase Status: ${firebaseOk ? '✅' : '❌'}`);

        if (notificationResult.successful > 0) {
            console.log('\n🎉 Background notifications sent successfully!');
            console.log('\n📱 Check your mobile device:');
            console.log('   1. Make sure the app is completely closed (not just backgrounded)');
            console.log('   2. Check notification permissions are enabled');
            console.log('   3. Verify battery optimization is disabled for your app');
            console.log('   4. Check if notifications appear in the notification panel');
        } else {
            console.log('\n❌ No notifications were sent successfully.');
            console.log('\n🔧 Troubleshooting:');
            console.log('   1. Check Firebase Console for delivery reports');
            console.log('   2. Verify device tokens are valid');
            console.log('   3. Check mobile app notification configuration');
            console.log('   4. Ensure proper notification channels are set up');
        }

        console.log('\n📚 Next Steps:');
        console.log('   1. Check Firebase Console for delivery reports');
        console.log('   2. Test with app completely closed');
        console.log('   3. Verify mobile app notification settings');
        console.log('   4. Check device notification permissions');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runBackgroundNotificationTest().catch(console.error);
}

export {
    checkFirebaseDeliveryReports, getUserDeviceTokens, runBackgroundNotificationTest, sendBackgroundNotification,
    sendDataOnlyMessage
};

