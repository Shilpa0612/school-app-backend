import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';
import pushNotificationService from './src/services/pushNotificationService.js';

dotenv.config();

async function testTokenManagement() {
    try {
        console.log('🧪 Testing Token Management System...');
        console.log('');

        // Test user ID (replace with a real user ID from your database)
        const testUserId = '17a5713d-2882-4ff3-ac95-86fce2568207';

        console.log('1. 📊 Current Token Statistics:');
        const statsResult = await pushNotificationService.getTokenStats(testUserId);
        if (statsResult.success) {
            console.log('   Current stats:', JSON.stringify(statsResult.stats, null, 2));
        } else {
            console.log('   ❌ Failed to get stats:', statsResult.error);
        }

        console.log('');
        console.log('2. 🧹 Cleaning up duplicate tokens...');
        const cleanupResult = await pushNotificationService.cleanupDuplicateTokens(testUserId);
        if (cleanupResult.success) {
            console.log(`   ✅ Cleaned up ${cleanupResult.cleaned} duplicate tokens`);
        } else {
            console.log('   ❌ Failed to cleanup:', cleanupResult.error);
        }

        console.log('');
        console.log('3. 📊 Token Statistics After Cleanup:');
        const statsAfterResult = await pushNotificationService.getTokenStats(testUserId);
        if (statsAfterResult.success) {
            console.log('   After cleanup stats:', JSON.stringify(statsAfterResult.stats, null, 2));
        } else {
            console.log('   ❌ Failed to get stats after cleanup:', statsAfterResult.error);
        }

        console.log('');
        console.log('4. 🔍 Checking current active tokens:');
        const { data: activeTokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('id, device_token, platform, is_active, last_used, created_at')
            .eq('user_id', testUserId)
            .eq('is_active', true)
            .order('last_used', { ascending: false });

        if (error) {
            console.log('   ❌ Error fetching tokens:', error.message);
        } else {
            console.log(`   Found ${activeTokens.length} active tokens:`);
            activeTokens.forEach((token, index) => {
                console.log(`   ${index + 1}. Platform: ${token.platform}`);
                console.log(`      Token: ${token.device_token.substring(0, 30)}...`);
                console.log(`      Last Used: ${token.last_used}`);
                console.log('');
            });
        }

        console.log('');
        console.log('5. 🧪 Testing token registration (should deactivate old tokens):');
        const testToken = `test_token_${Date.now()}`;
        const registerResult = await pushNotificationService.registerDeviceToken(
            testUserId,
            testToken,
            'android',
            { test: true, timestamp: new Date().toISOString() }
        );

        if (registerResult.success) {
            console.log('   ✅ New token registered successfully');
            console.log(`   Device ID: ${registerResult.deviceId}`);
        } else {
            console.log('   ❌ Failed to register token:', registerResult.error);
        }

        console.log('');
        console.log('6. 📊 Final Token Statistics:');
        const finalStatsResult = await pushNotificationService.getTokenStats(testUserId);
        if (finalStatsResult.success) {
            console.log('   Final stats:', JSON.stringify(finalStatsResult.stats, null, 2));
        } else {
            console.log('   ❌ Failed to get final stats:', finalStatsResult.error);
        }

        console.log('');
        console.log('✅ Token management test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testTokenManagement();
