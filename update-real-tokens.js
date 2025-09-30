import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function updateRealTokens() {
    try {
        console.log('🔄 Updating Database with Real FCM Tokens...');
        console.log('');

        const userId = '34e0bb46-ec50-4fec-ac30-4e33f3ced66c';

        // Replace these with your REAL FCM tokens from your mobile app
        const realAndroidToken = 'PASTE_YOUR_REAL_ANDROID_FCM_TOKEN_HERE';
        const realIosToken = 'PASTE_YOUR_REAL_IOS_FCM_TOKEN_HERE';

        console.log('⚠️  IMPORTANT: Replace the token variables above with your actual FCM tokens');
        console.log('');

        if (realAndroidToken === 'PASTE_YOUR_REAL_ANDROID_FCM_TOKEN_HERE') {
            console.log('❌ Please replace the token variables with your actual FCM tokens first');
            console.log('');
            console.log('📱 How to get your real FCM tokens:');
            console.log('   1. Implement FCM in your mobile app (see mobile-app-fcm-setup.md)');
            console.log('   2. Run your app and check console logs');
            console.log('   3. Copy the tokens and paste them in this script');
            console.log('   4. Run this script again');
            return;
        }

        // Update Android token
        if (realAndroidToken !== 'PASTE_YOUR_REAL_ANDROID_FCM_TOKEN_HERE') {
            console.log('📱 Updating Android token...');
            const { error: androidError } = await adminSupabase
                .from('user_device_tokens')
                .update({
                    device_token: realAndroidToken,
                    last_used_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('platform', 'android');

            if (androidError) {
                console.error('❌ Error updating Android token:', androidError.message);
            } else {
                console.log('✅ Android token updated successfully');
            }
        }

        // Update iOS token
        if (realIosToken !== 'PASTE_YOUR_REAL_IOS_FCM_TOKEN_HERE') {
            console.log('📱 Updating iOS token...');
            const { error: iosError } = await adminSupabase
                .from('user_device_tokens')
                .update({
                    device_token: realIosToken,
                    last_used_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('platform', 'ios');

            if (iosError) {
                console.error('❌ Error updating iOS token:', iosError.message);
            } else {
                console.log('✅ iOS token updated successfully');
            }
        }

        // Verify the updates
        console.log('');
        console.log('🔍 Verifying updated tokens...');
        const { data: updatedTokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (error) {
            console.error('❌ Error fetching updated tokens:', error.message);
            return;
        }

        console.log('📱 Updated tokens:');
        updatedTokens.forEach((token, index) => {
            console.log(`   ${index + 1}. Platform: ${token.platform}`);
            console.log(`      Token: ${token.device_token.substring(0, 50)}...`);
        });

        console.log('');
        console.log('🎉 Database updated successfully!');
        console.log('');
        console.log('📱 Next Steps:');
        console.log('   1. Run: node test-with-real-token.js');
        console.log('   2. Test notifications with your mobile app');
        console.log('   3. Verify background notifications work when app is closed');

    } catch (error) {
        console.error('❌ Error updating tokens:', error.message);
    }
}

updateRealTokens();
