import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';
import pushNotificationService from './src/services/pushNotificationService.js';

dotenv.config();

async function testFCMConfig() {
    try {
        console.log('🧪 Testing FCM Configuration');
        console.log('============================');
        console.log('');

        // Test Firebase Admin SDK initialization
        console.log('1. Testing Firebase Admin SDK...');
        try {
            await pushNotificationService.initialize();
            console.log('   ✅ Firebase Admin SDK initialized successfully');
        } catch (error) {
            console.log('   ❌ Firebase Admin SDK initialization failed:', error.message);
            return;
        }

        // Test sending a notification to a real token
        console.log('');
        console.log('2. Testing FCM message sending...');

        // Get a real device token
        const { data: tokens, error: tokensError } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform, user_id')
            .eq('is_active', true)
            .limit(1);

        if (tokensError || !tokens || tokens.length === 0) {
            console.log('   ❌ No active tokens found');
            return;
        }

        const testToken = tokens[0].device_token;
        const testUserId = tokens[0].user_id;

        console.log(`   Testing with token: ${testToken.substring(0, 30)}...`);
        console.log(`   User ID: ${testUserId}`);

        // Test sending a notification
        const testNotification = {
            id: 'fcm-test-' + Date.now(),
            type: 'system',
            title: 'FCM Configuration Test',
            message: 'Testing if FCM is properly configured',
            priority: 'normal',
            created_at: new Date().toISOString()
        };

        const result = await pushNotificationService.sendToUser(testUserId, testNotification);

        if (result.success) {
            console.log('   ✅ FCM message sent successfully');
            console.log(`   Sent: ${result.sent}, Failed: ${result.failed}`);
        } else {
            console.log('   ❌ FCM message failed:', result.error);
        }

        console.log('');
        console.log('3. Next steps:');
        console.log('   - Update your google-services.json with the firebase_messaging service');
        console.log('   - Rebuild your mobile app');
        console.log('   - Re-register device tokens');
        console.log('   - Test background notifications');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testFCMConfig();
