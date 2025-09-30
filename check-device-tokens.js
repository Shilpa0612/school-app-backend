import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

async function checkDeviceTokens() {
    try {
        console.log('🔍 Checking Device Tokens in Database...');
        console.log('');

        const userId = '34e0bb46-ec50-4fec-ac30-4e33f3ced66c';

        // Check the user_device_tokens table
        console.log('1. Checking user_device_tokens table...');
        const { data: deviceTokens, error: tokensError } = await adminSupabase
            .from('user_device_tokens')
            .select('*')
            .eq('user_id', userId);

        if (tokensError) {
            console.error('❌ Error fetching device tokens:', tokensError.message);
            return;
        }

        console.log(`✅ Found ${deviceTokens?.length || 0} device tokens`);

        if (deviceTokens && deviceTokens.length > 0) {
            console.log('');
            console.log('📱 Device Tokens:');
            deviceTokens.forEach((token, index) => {
                console.log(`   ${index + 1}. Platform: ${token.platform}`);
                console.log(`      Token: ${token.device_token.substring(0, 30)}...`);
                console.log(`      Active: ${token.is_active}`);
                console.log(`      Created: ${token.created_at}`);
                console.log(`      Last Used: ${token.last_used_at}`);
                console.log('');
            });
        }

        // Check if there are any other tables that might store tokens
        console.log('2. Checking for other token-related tables...');

        // Try to get table names
        const { data: tables, error: tablesError } = await adminSupabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .like('table_name', '%token%');

        if (!tablesError && tables) {
            console.log('📋 Token-related tables found:');
            tables.forEach(table => {
                console.log(`   - ${table.table_name}`);
            });
        }

        // Test sending notification with real tokens
        if (deviceTokens && deviceTokens.length > 0) {
            console.log('');
            console.log('3. Testing notification with real device tokens...');

            const pushModule = await import('./src/services/pushNotificationService.js');
            const pushService = pushModule.default;

            const testNotification = {
                id: 'real_token_test_' + Date.now(),
                type: 'test',
                title: 'Real Token Test',
                message: 'Testing with actual device tokens from database',
                priority: 'high',
                student_id: 'test_student',
                created_at: new Date().toISOString()
            };

            // Test with first token
            const firstToken = deviceTokens[0];
            console.log(`📱 Testing with ${firstToken.platform} token...`);

            const result = await pushService.sendToDevice(
                firstToken.device_token,
                testNotification,
                firstToken.platform
            );

            console.log('📱 Notification Result:');
            console.log(JSON.stringify(result, null, 2));

            if (result.success) {
                console.log('');
                console.log('✅ Real token test successful!');
                console.log('📱 Check your mobile device notification panel');
            } else {
                console.log('❌ Real token test failed');
                console.log('Error:', result.error);
            }
        }

    } catch (error) {
        console.error('❌ Error checking device tokens:', error.message);
        console.error('Stack:', error.stack);
    }
}

checkDeviceTokens();
