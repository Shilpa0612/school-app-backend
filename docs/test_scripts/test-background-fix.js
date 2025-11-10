import dotenv from 'dotenv';
import { adminSupabase } from '../../src/config/supabase.js';
import pushNotificationService from '../../src/services/pushNotificationService.js';

dotenv.config();

async function testBackgroundFix() {
    try {
        console.log('🧪 Testing Background Notification Fix');
        console.log('=====================================');
        console.log('');

        // Get a user with active tokens
        const { data: users, error: usersError } = await adminSupabase
            .from('user_device_tokens')
            .select('user_id')
            .eq('is_active', true)
            .limit(1);

        if (usersError || !users || users.length === 0) {
            console.log('❌ No active tokens found');
            return;
        }

        const testUserId = users[0].user_id;
        console.log(`Testing with user: ${testUserId}`);
        console.log('');

        // Check current tokens
        const { data: tokens, error: tokensError } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform, created_at')
            .eq('user_id', testUserId)
            .eq('is_active', true);

        if (tokensError) {
            console.log('❌ Error fetching tokens:', tokensError.message);
            return;
        }

        console.log(`Found ${tokens.length} active tokens:`);
        tokens.forEach((token, index) => {
            console.log(`  ${index + 1}. ${token.platform}: ${token.device_token.substring(0, 30)}...`);
            console.log(`     Created: ${token.created_at}`);
        });

        console.log('');
        console.log('📱 Testing background notification...');

        const testNotification = {
            id: 'background-test-' + Date.now(),
            type: 'system',
            title: 'Background Test',
            message: 'This should appear even when app is swiped away',
            priority: 'normal',
            created_at: new Date().toISOString()
        };

        const result = await pushNotificationService.sendToUser(testUserId, testNotification);

        if (result.success) {
            console.log('✅ Notification sent successfully');
            console.log(`   Sent: ${result.sent}, Failed: ${result.failed}`);
            console.log('');
            console.log('📋 Next steps:');
            console.log('1. Swipe the app away from recent tabs');
            console.log('2. Wait for the notification to appear');
            console.log('3. If it appears, the fix worked!');
            console.log('4. If not, check the google-services.json has firebase_messaging service');
        } else {
            console.log('❌ Failed to send notification:', result.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testBackgroundFix();
