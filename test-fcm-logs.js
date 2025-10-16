import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';
import pushNotificationService from './src/services/pushNotificationService.js';

dotenv.config();

async function testFCMLogs() {
    try {
        console.log('🧪 Testing FCM and Checking Logs');
        console.log('=================================');
        console.log('');

        // Get a real device token
        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform, user_id')
            .eq('is_active', true)
            .limit(1);

        if (error || !tokens || tokens.length === 0) {
            console.log('❌ No active tokens found');
            return;
        }

        const testToken = tokens[0].device_token;
        const testUserId = tokens[0].user_id;

        console.log(`Testing with token: ${testToken.substring(0, 30)}...`);
        console.log(`User ID: ${testUserId}`);
        console.log('');

        // Test sending a notification
        console.log('📱 Sending test notification...');
        console.log('   Watch the logs below for FCM messages:');
        console.log('');

        const testNotification = {
            id: 'log-test-' + Date.now(),
            type: 'system',
            title: 'FCM Log Test',
            message: 'Testing FCM logs and SenderId',
            priority: 'normal',
            created_at: new Date().toISOString()
        };

        // This will trigger the FCM sending and show logs
        const result = await pushNotificationService.sendToUser(testUserId, testNotification);

        console.log('');
        console.log('📊 Result:');
        if (result.success) {
            console.log('   ✅ Notification sent successfully');
            console.log(`   Sent: ${result.sent}, Failed: ${result.failed}`);
        } else {
            console.log('   ❌ Notification failed:', result.error);
        }

        console.log('');
        console.log('🔍 Check these locations for detailed logs:');
        console.log('   1. Console output (above)');
        console.log('   2. error.log file');
        console.log('   3. combined.log file');
        console.log('');
        console.log('Look for these log messages:');
        console.log('   ✅ "Push notification sent successfully"');
        console.log('   ❌ "SenderId mismatch"');
        console.log('   ❌ "messaging/invalid-registration-token"');
        console.log('   ❌ "messaging/authentication-error"');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testFCMLogs();
