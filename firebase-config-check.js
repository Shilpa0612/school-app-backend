#!/usr/bin/env node

/**
 * Firebase Configuration Checker
 * This script helps verify your Firebase setup for push notifications
 */

import dotenv from 'dotenv';
import admin from 'firebase-admin';

dotenv.config();

console.log('🔍 Checking Firebase Configuration...\n');

// Check environment variables
function checkEnvironmentVariables() {
    console.log('1. Checking Environment Variables...');

    const requiredVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL'
    ];

    let allPresent = true;

    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName}: Present`);
        } else {
            console.log(`   ❌ ${varName}: Missing`);
            allPresent = false;
        }
    });

    if (!allPresent) {
        console.log('\n❌ Missing required environment variables!');
        console.log('Please add these to your .env file:');
        console.log('FIREBASE_PROJECT_ID=your-project-id');
        console.log('FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n"');
        console.log('FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com');
        return false;
    }

    console.log('✅ All environment variables present');
    return true;
}

// Initialize Firebase Admin
function initializeFirebase() {
    console.log('\n2. Initializing Firebase Admin...');

    try {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        };

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID,
            });
        }

        console.log('✅ Firebase Admin initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error.message);
        return false;
    }
}

// Test sending a notification
async function testNotification() {
    console.log('\n3. Testing Push Notification...');

    try {
        const messaging = admin.messaging();

        // Test with a dummy token (this will fail but shows if Firebase is working)
        const testToken = 'test_token_12345';

        const message = {
            token: testToken,
            notification: {
                title: 'Test Notification',
                body: 'This is a test notification'
            },
            data: {
                type: 'test',
                timestamp: Date.now().toString()
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'school_notifications',
                    priority: 'high',
                    defaultSound: true,
                    defaultVibrateTimings: true
                }
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: 'Test Notification',
                            body: 'This is a test notification'
                        },
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };

        // This will fail with invalid token, but shows if Firebase is configured correctly
        try {
            await messaging.send(message);
            console.log('✅ Test notification sent successfully');
        } catch (error) {
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('✅ Firebase is configured correctly (expected error with test token)');
            } else {
                throw error;
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Failed to test notification:', error.message);
        return false;
    }
}

// Check notification payload structure
function checkNotificationPayload() {
    console.log('\n4. Checking Notification Payload Structure...');

    const correctPayload = {
        token: 'device_token_here',
        notification: {
            title: 'Notification Title',
            body: 'Notification body text'
        },
        data: {
            type: 'announcement',
            id: '123',
            timestamp: Date.now().toString()
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'school_notifications',
                priority: 'high',
                defaultSound: true,
                defaultVibrateTimings: true,
                icon: 'ic_notification',
                color: '#FF0000'
            }
        },
        apns: {
            payload: {
                aps: {
                    alert: {
                        title: 'Notification Title',
                        body: 'Notification body text'
                    },
                    sound: 'default',
                    badge: 1,
                    'content-available': 1
                }
            }
        }
    };

    console.log('✅ Correct notification payload structure:');
    console.log(JSON.stringify(correctPayload, null, 2));

    return true;
}

// Main function
async function main() {
    console.log('Firebase Configuration Checker');
    console.log('==============================\n');

    const checks = [
        { name: 'Environment Variables', fn: checkEnvironmentVariables },
        { name: 'Firebase Initialization', fn: initializeFirebase },
        { name: 'Notification Test', fn: testNotification },
        { name: 'Payload Structure', fn: checkNotificationPayload }
    ];

    let allPassed = true;

    for (const check of checks) {
        const result = await check.fn();
        if (!result) {
            allPassed = false;
        }
    }

    console.log('\n' + '='.repeat(50));

    if (allPassed) {
        console.log('🎉 Firebase configuration looks good!');
        console.log('\nIf notifications still don\'t work when app is closed, check:');
        console.log('1. Device token registration');
        console.log('2. Android notification channels');
        console.log('3. iOS notification permissions');
        console.log('4. Background app refresh settings');
    } else {
        console.log('❌ Firebase configuration has issues.');
        console.log('Please fix the errors above before testing notifications.');
    }
}

// Run the check
main().catch(console.error);
