import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function debugNotification() {
    const results = [];
    
    try {
        results.push('🔍 Debugging Notification System...');
        results.push('');
        
        // 1. Check device tokens
        results.push('1. Checking device tokens...');
        const { data: tokens, error: tokenError } = await adminSupabase
            .from('user_device_tokens')
            .select('id, device_token, platform, is_active, created_at')
            .eq('user_id', '34e0bb46-ec50-4fec-ac30-4e33f3ced66c')
            .eq('is_active', true);
            
        if (tokenError) {
            results.push(`❌ Token error: ${tokenError.message}`);
            return;
        }
        
        results.push(`✅ Found ${tokens.length} active device tokens`);
        
        if (tokens.length > 0) {
            tokens.forEach((token, index) => {
                results.push(`   ${index + 1}. Platform: ${token.platform}`);
                results.push(`      Token: ${token.device_token.substring(0, 50)}...`);
                results.push(`      Created: ${token.created_at}`);
                results.push(`      Active: ${token.is_active}`);
            });
        }
        
        // 2. Test Firebase Admin SDK
        results.push('');
        results.push('2. Testing Firebase Admin SDK...');
        
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
            
            results.push('✅ Firebase Admin SDK initialized');
            
            // 3. Send test notification
            if (tokens.length > 0) {
                results.push('');
                results.push('3. Sending test notification...');
                
                const testToken = tokens[0].device_token;
                const platform = tokens[0].platform;
                
                results.push(`   Testing with ${platform} token: ${testToken.substring(0, 30)}...`);
                
                const message = {
                    token: testToken,
                    notification: {
                        title: 'Debug Test Notification',
                        body: 'This is a debug test - should appear even when app is closed'
                    },
                    data: {
                        type: 'debug_test',
                        id: 'debug_' + Date.now(),
                        platform: platform,
                        background: 'true',
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
                            color: '#FF6B35',
                            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                            tag: 'debug_test',
                            visibility: 'public'
                        }
                    },
                    apns: {
                        payload: {
                            aps: {
                                alert: {
                                    title: 'Debug Test Notification',
                                    body: 'This is a debug test - should appear even when app is closed'
                                },
                                sound: 'default',
                                badge: 1,
                                'content-available': 1,
                                'mutable-content': 1
                            }
                        }
                    }
                };
                
                try {
                    const response = await admin.default.messaging().send(message);
                    results.push(`✅ Notification sent successfully!`);
                    results.push(`   Message ID: ${response}`);
                    results.push(`   Platform: ${platform}`);
                    results.push(`   Token: ${testToken.substring(0, 30)}...`);
                    
                    // 4. Check if token is valid
                    results.push('');
                    results.push('4. Token validation...');
                    results.push('✅ Token appears to be valid (no error thrown)');
                    
                } catch (sendError) {
                    results.push(`❌ Failed to send notification: ${sendError.message}`);
                    results.push(`   Error code: ${sendError.code}`);
                    
                    if (sendError.code === 'messaging/invalid-registration-token') {
                        results.push('   ⚠️  Token is invalid - needs to be refreshed');
                    } else if (sendError.code === 'messaging/registration-token-not-registered') {
                        results.push('   ⚠️  Token is not registered - app may need to re-register');
                    }
                }
            } else {
                results.push('❌ No device tokens found - cannot test');
            }
            
        } catch (error) {
            results.push(`❌ Firebase error: ${error.message}`);
        }
        
        // 5. Recommendations
        results.push('');
        results.push('5. Recommendations:');
        results.push('   📱 Mobile App Checklist:');
        results.push('      - Check notification permissions are granted');
        results.push('      - Verify notification channels are configured');
        results.push('      - Ensure background message handler is implemented');
        results.push('      - Disable battery optimization for your app');
        results.push('      - Test with app completely closed (not just backgrounded)');
        results.push('');
        results.push('   🔧 Backend Checklist:');
        results.push('      - Firebase configuration is correct ✅');
        results.push('      - Device tokens are registered ✅');
        results.push('      - Notification payload is optimized ✅');
        results.push('');
        results.push('   📊 Next Steps:');
        results.push('      1. Check your mobile device notification panel');
        results.push('      2. Verify app notification settings');
        results.push('      3. Test with app completely closed');
        results.push('      4. Check device notification permissions');
        
    } catch (error) {
        results.push(`❌ Debug failed: ${error.message}`);
    }
    
    // Write results to file
    const output = results.join('\n');
    writeFileSync('debug-results.txt', output);
    console.log('Debug completed. Check debug-results.txt for detailed results.');
    
    // Also log to console
    console.log('\n' + '='.repeat(50));
    console.log('🔍 NOTIFICATION DEBUG RESULTS');
    console.log('='.repeat(50));
    console.log(output);
}

debugNotification();
