import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';
import pushNotificationService from './src/services/pushNotificationService.js';

dotenv.config();

async function sendTestNotification() {
    try {
        console.log('Sending test notification...');

        // Get device tokens for the user
        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform')
            .eq('user_id', '34e0bb46-ec50-4fec-ac30-4e33f3ced66c')
            .eq('is_active', true);

        if (error) {
            console.error('Error getting tokens:', error);
            return;
        }

        if (!tokens || tokens.length === 0) {
            console.log('No device tokens found');
            return;
        }

        console.log(`Found ${tokens.length} device tokens`);

        // Create test notification
        const testNotification = {
            id: 'test_' + Date.now(),
            type: 'test',
            title: 'Test Background Notification',
            message: 'This should appear even when the app is closed',
            priority: 'high',
            created_at: new Date().toISOString()
        };

        // Send to user
        const result = await pushNotificationService.sendToUser(
            '34e0bb46-ec50-4fec-ac30-4e33f3ced66c',
            testNotification
        );

        console.log('Result:', result);

    } catch (error) {
        console.error('Error:', error);
    }
}

sendTestNotification();
