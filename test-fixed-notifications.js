import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';
import pushNotificationService from './src/services/pushNotificationService.js';

dotenv.config();

async function testFixedNotifications() {
    try {
        console.log('🧪 Testing Fixed FCM Notifications...');
        console.log('Using corrected payload structure for background notifications');
        console.log('');

        const userId = '34e0bb46-ec50-4fec-ac30-4e33f3ced66c';

        // Get user's device tokens
        console.log('1. Fetching device tokens...');
        const { data: deviceTokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (error) {
            console.error('❌ Error fetching device tokens:', error.message);
            return;
        }

        if (!deviceTokens || deviceTokens.length === 0) {
            console.log('⚠️  No device tokens found for user');
            return;
        }

        console.log(`✅ Found ${deviceTokens.length} device tokens`);
        console.log('');

        // Test notification with proper FCM structure
        console.log('2. Sending test notification with FCM compliant payload...');

        const testNotification = {
            id: 'fcm_test_' + Date.now(),
            type: 'test',
            title: 'FCM Fixed Test',
            message: 'This notification uses the corrected FCM payload structure for background delivery',
            priority: 'high',
            student_id: 'test_student',
            created_at: new Date().toISOString()
        };

        // Send to first device token
        const firstToken = deviceTokens[0];
        console.log(`📱 Sending to ${firstToken.platform} device: ${firstToken.device_token.substring(0, 20)}...`);

        const result = await pushNotificationService.sendToDevice(
            firstToken.device_token,
            testNotification,
            firstToken.platform
        );

        console.log('');
        console.log('3. Result:');
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('');
            console.log('✅ FCM Fixed notification sent successfully!');
            console.log('📱 Check your mobile device notification panel');
            console.log('');
            console.log('🔧 Key FCM Fixes Applied:');
            console.log('   ✅ Android priority: high (required for background)');
            console.log('   ✅ iOS content-available: 1 (required for background)');
            console.log('   ✅ All data values converted to strings');
            console.log('   ✅ Proper notification channels');
            console.log('   ✅ Click action configured');
            console.log('');
            console.log('📱 Next Steps:');
            console.log('   1. Check your mobile device notification panel');
            console.log('   2. Test with app completely closed');
            console.log('   3. Verify notification permissions');
            console.log('   4. Check battery optimization settings');
        } else {
            console.log('❌ Failed to send notification');
            console.log('Error:', result.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testFixedNotifications();
