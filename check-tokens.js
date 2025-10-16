import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function checkTokens() {
    console.log('🔍 Checking Device Tokens in Database');
    console.log('=====================================');
    console.log('');

    try {
        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform, user_id, is_active')
            .eq('is_active', true)
            .limit(5);

        if (error) {
            console.log('❌ Error:', error.message);
            return;
        }

        if (!tokens || tokens.length === 0) {
            console.log('❌ No active tokens found');
            return;
        }

        console.log(`Found ${tokens.length} active tokens:`);
        console.log('');

        tokens.forEach((token, index) => {
            console.log(`${index + 1}. Platform: ${token.platform}`);
            console.log(`   Token: ${token.device_token.substring(0, 50)}...`);
            console.log(`   User: ${token.user_id}`);
            console.log(`   Is FCM Token: ${isFCMToken(token.device_token) ? '✅ Yes' : '❌ No'}`);
            console.log('');
        });

        // Check for fake tokens
        const fakeTokens = tokens.filter(t => t.device_token.startsWith('fake_'));
        if (fakeTokens.length > 0) {
            console.log('🚨 FAKE TOKENS DETECTED!');
            console.log('These are not real FCM tokens and will cause SenderId mismatch.');
        }

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

function isFCMToken(token) {
    return token &&
        token.length > 50 &&
        token.includes(':') &&
        !token.startsWith('fake_') &&
        token.includes('APA91b');
}

checkTokens();
