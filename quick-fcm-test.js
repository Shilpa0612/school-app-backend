import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function quickFCMTest() {
    try {
        console.log('🔍 Quick FCM Test');
        console.log('=================');
        console.log('');

        // Check if we have active tokens
        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform, user_id, is_active')
            .eq('is_active', true)
            .limit(3);

        if (error) {
            console.log('❌ Error fetching tokens:', error.message);
            return;
        }

        if (!tokens || tokens.length === 0) {
            console.log('❌ No active tokens found');
            return;
        }

        console.log(`✅ Found ${tokens.length} active tokens:`);
        tokens.forEach((token, index) => {
            console.log(`   ${index + 1}. ${token.platform}: ${token.device_token.substring(0, 30)}...`);
        });

        console.log('');
        console.log('📱 To test FCM notifications:');
        console.log('1. Send a test notification via API:');
        console.log('   curl -X POST http://localhost:3000/api/device-tokens/test \\');
        console.log('     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
        console.log('     -H "Content-Type: application/json" \\');
        console.log('     -d \'{"title":"Test","message":"FCM Test"}\'');
        console.log('');
        console.log('2. Check server logs for:');
        console.log('   - "Push notification sent successfully" (success)');
        console.log('   - "SenderId mismatch" (configuration issue)');
        console.log('   - "messaging/invalid-registration-token" (token issue)');
        console.log('');
        console.log('3. Check your device for the notification');
        console.log('');

        // Check if Firebase is properly configured
        console.log('🔧 Firebase Configuration Check:');
        console.log(`   FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID}`);
        console.log(`   FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? 'Set' : 'Missing'}`);
        console.log(`   FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Missing'}`);
        console.log('');

        console.log('✅ Test setup complete!');
        console.log('   Run the curl command above to test FCM notifications');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

quickFCMTest();
