import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function testNotification() {
    const output = [];

    try {
        output.push('🧪 Testing Notification System...');
        output.push('');

        // Get device tokens
        output.push('1. Getting device tokens...');
        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('id, device_token, platform, is_active')
            .eq('user_id', '34e0bb46-ec50-4fec-ac30-4e33f3ced66c')
            .eq('is_active', true);

        if (error) {
            output.push(`❌ Error: ${error.message}`);
            return;
        }

        output.push(`✅ Found ${tokens.length} device tokens`);

        if (tokens.length > 0) {
            tokens.forEach((token, index) => {
                output.push(`   ${index + 1}. Platform: ${token.platform}`);
                output.push(`      Token: ${token.device_token.substring(0, 30)}...`);
            });
        }

        // Test Firebase
        output.push('');
        output.push('2. Testing Firebase...');

        try {
            const admin = await import('firebase-admin');

            if (!admin.default.apps.length) {
                const serviceAccount = {
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                };

                admin.default.initializeApp({
                    credential: admin.default.credential.cert(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID,
                });
            }

            output.push('✅ Firebase initialized');

            // Send test notification
            if (tokens.length > 0) {
                output.push('');
                output.push('3. Sending test notification...');

                const message = {
                    token: tokens[0].device_token,
                    notification: {
                        title: 'Test Background Notification',
                        body: 'This should appear even when app is closed'
                    },
                    data: {
                        type: 'test',
                        id: 'test_' + Date.now(),
                        background: 'true'
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
                                    title: 'Test Background Notification',
                                    body: 'This should appear even when app is closed'
                                },
                                sound: 'default',
                                badge: 1,
                                'content-available': 1
                            }
                        }
                    }
                };

                const response = await admin.default.messaging().send(message);
                output.push(`✅ Notification sent: ${response}`);
            }

        } catch (error) {
            output.push(`❌ Firebase error: ${error.message}`);
        }

        output.push('');
        output.push('🎉 Test completed!');

    } catch (error) {
        output.push(`❌ Test failed: ${error.message}`);
    }

    // Write output to file
    writeFileSync('test-output.txt', output.join('\n'));
    console.log('Test completed. Check test-output.txt for results.');
}

testNotification();
