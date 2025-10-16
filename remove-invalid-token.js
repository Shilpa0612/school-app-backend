import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function removeInvalidToken() {
    console.log('🗑️ Removing Invalid FCM Token');
    console.log('==============================');
    console.log('');

    try {
        // Remove the invalid token
        const invalidToken = 'eAPuK3JJSSG4JP_G-7ri9D:APA91bE_aFHFvtyLYWkApzN_sou0dsXVcut7rJRYPi2Yj1wPevDZ3jT5do3M_FAO_InNLDmYnjbdVgG0ed1jjtgHXu1HbwiR7STCjsONZo7LzkyTkYZgic';

        const { error } = await adminSupabase
            .from('user_device_tokens')
            .update({ is_active: false })
            .eq('device_token', invalidToken);

        if (error) {
            console.log('❌ Error removing token:', error.message);
            return;
        }

        console.log('✅ Invalid token removed successfully');
        console.log('');
        console.log('🎯 Result:');
        console.log('- No more SenderId mismatch errors');
        console.log('- FCM notifications will be skipped (no valid tokens)');
        console.log('- Web application continues to work normally');
        console.log('');
        console.log('📱 To enable push notifications:');
        console.log('1. Create a mobile app with correct google-services.json');
        console.log('2. Register real FCM tokens from the mobile app');
        console.log('3. Test notifications');

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

removeInvalidToken();
