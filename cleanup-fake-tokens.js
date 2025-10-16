import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function cleanupFakeTokens() {
    console.log('🧹 Cleaning Up Fake Tokens');
    console.log('===========================');
    console.log('');

    try {
        // Get all active tokens
        const { data: tokens, error: fetchError } = await adminSupabase
            .from('user_device_tokens')
            .select('id, device_token, platform, user_id')
            .eq('is_active', true);

        if (fetchError) {
            console.log('❌ Error fetching tokens:', fetchError.message);
            return;
        }

        if (!tokens || tokens.length === 0) {
            console.log('❌ No tokens found');
            return;
        }

        console.log(`Found ${tokens.length} active tokens:`);

        // Identify fake tokens
        const fakeTokens = tokens.filter(token =>
            token.device_token.startsWith('fake_') ||
            token.device_token.length < 50 ||
            !token.device_token.includes(':')
        );

        const realTokens = tokens.filter(token =>
            !token.device_token.startsWith('fake_') &&
            token.device_token.length > 50 &&
            token.device_token.includes(':') &&
            token.device_token.includes('APA91b')
        );

        console.log(`   Fake tokens: ${fakeTokens.length}`);
        console.log(`   Real tokens: ${realTokens.length}`);
        console.log('');

        if (fakeTokens.length === 0) {
            console.log('✅ No fake tokens found. All tokens are valid!');
            return;
        }

        // Show fake tokens that will be removed
        console.log('🚨 Fake tokens to be removed:');
        fakeTokens.forEach((token, index) => {
            console.log(`   ${index + 1}. ${token.platform}: ${token.device_token}`);
        });
        console.log('');

        // Remove fake tokens
        const fakeTokenIds = fakeTokens.map(token => token.id);

        const { error: deleteError } = await adminSupabase
            .from('user_device_tokens')
            .update({ is_active: false })
            .in('id', fakeTokenIds);

        if (deleteError) {
            console.log('❌ Error removing fake tokens:', deleteError.message);
            return;
        }

        console.log(`✅ Successfully removed ${fakeTokens.length} fake tokens`);
        console.log('');

        // Show remaining real tokens
        console.log('✅ Remaining real tokens:');
        realTokens.forEach((token, index) => {
            console.log(`   ${index + 1}. ${token.platform}: ${token.device_token.substring(0, 30)}...`);
        });

        console.log('');
        console.log('🎯 Next steps:');
        console.log('1. Test notifications with the remaining real tokens');
        console.log('2. If you have a mobile app, register new real tokens');
        console.log('3. The SenderId mismatch error should be resolved');

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

cleanupFakeTokens();
