import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';
import pushNotificationService from './src/services/pushNotificationService.js';

dotenv.config();

async function testFCMNotifications() {
    console.log('🧪 Testing FCM Notifications');
    console.log('=============================');
    console.log('');

    try {
        // Get the active token
        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform, user_id')
            .eq('is_active', true)
            .limit(1);

        if (error || !tokens || tokens.length === 0) {
            console.log('❌ No active tokens found');
            return;
        }

        const token = tokens[0];
        console.log(`Testing with token: ${token.device_token.substring(0, 30)}...`);
        console.log(`Platform: ${token.platform}`);
        console.log(`User: ${token.user_id}`);
        console.log('');

        // Test sending a notification
        console.log('📱 Sending test notification...');

        const testNotification = {
            id: 'fcm-test-' + Date.now(),
            type: 'system',
            title: 'FCM Test Notification',
            message: 'Testing FCM notifications with real token',
            priority: 'normal',
            created_at: new Date().toISOString()
        };

        const result = await pushNotificationService.sendToUser(token.user_id, testNotification);

        console.log('');
        if (result.success) {
            console.log('✅ FCM notification sent successfully!');
            console.log(`   Sent: ${result.sent}, Failed: ${result.failed}`);
            console.log('');
            console.log('🎯 Check your device for the notification');
            console.log('   - If you see it: FCM is working perfectly!');
            console.log('   - If not: Check device notification settings');
        } else {
            console.log('❌ FCM notification failed:', result.error);
        }

    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

testFCMNotifications();
