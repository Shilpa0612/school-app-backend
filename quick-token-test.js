import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function quickTokenTest() {
    try {
        console.log('🔍 Quick Token Management Test');
        console.log('==============================');
        console.log('');

        // Get a user with multiple tokens
        const { data: users, error: usersError } = await adminSupabase
            .from('user_device_tokens')
            .select('user_id')
            .eq('is_active', true)
            .limit(1);

        if (usersError || !users || users.length === 0) {
            console.log('❌ No active tokens found in database');
            return;
        }

        const testUserId = users[0].user_id;
        console.log(`Testing with user: ${testUserId}`);
        console.log('');

        // Check current tokens
        console.log('1. Current active tokens:');
        const { data: currentTokens, error: currentError } = await adminSupabase
            .from('user_device_tokens')
            .select('id, platform, device_token, is_active, last_used')
            .eq('user_id', testUserId)
            .eq('is_active', true)
            .order('last_used', { ascending: false });

        if (currentError) {
            console.log('   ❌ Error:', currentError.message);
            return;
        }

        console.log(`   Found ${currentTokens.length} active tokens:`);
        currentTokens.forEach((token, index) => {
            console.log(`   ${index + 1}. ${token.platform}: ${token.device_token.substring(0, 30)}...`);
        });

        console.log('');
        console.log('2. Token counts by platform:');
        const platformCounts = {};
        currentTokens.forEach(token => {
            platformCounts[token.platform] = (platformCounts[token.platform] || 0) + 1;
        });

        Object.entries(platformCounts).forEach(([platform, count]) => {
            console.log(`   ${platform}: ${count} tokens`);
        });

        console.log('');
        console.log('3. Issues found:');
        let hasIssues = false;
        Object.entries(platformCounts).forEach(([platform, count]) => {
            if (count > 1) {
                console.log(`   ⚠️  ${platform}: ${count} tokens (should be 1)`);
                hasIssues = true;
            } else {
                console.log(`   ✅ ${platform}: ${count} token (correct)`);
            }
        });

        if (!hasIssues) {
            console.log('   ✅ No duplicate token issues found!');
        } else {
            console.log('');
            console.log('4. Next steps:');
            console.log('   - Use POST /api/device-tokens/cleanup-duplicates to fix duplicates');
            console.log('   - Or register a new token to auto-cleanup old ones');
        }

        console.log('');
        console.log('✅ Test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

quickTokenTest();
