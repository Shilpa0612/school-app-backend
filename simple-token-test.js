console.log('Starting simple token test...');

import('./src/config/supabase.js')
    .then(async (supabaseModule) => {
        console.log('Supabase imported');

        const { adminSupabase } = supabaseModule;
        const userId = '34e0bb46-ec50-4fec-ac30-4e33f3ced66c';

        console.log('Fetching tokens for user:', userId);

        const { data, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform, is_active')
            .eq('user_id', userId)
            .eq('is_active', true);

        if (error) {
            console.error('Database error:', error.message);
            return;
        }

        console.log('Found tokens:', data?.length || 0);

        if (data && data.length > 0) {
            data.forEach((token, index) => {
                console.log(`Token ${index + 1}:`);
                console.log(`  Platform: ${token.platform}`);
                console.log(`  Token: ${token.device_token.substring(0, 50)}...`);
                console.log(`  Active: ${token.is_active}`);
            });

            // Test with first token
            console.log('\nTesting notification with first token...');

            const pushModule = await import('./src/services/pushNotificationService.js');
            const pushService = pushModule.default;

            const testNotification = {
                id: 'simple_test_' + Date.now(),
                type: 'test',
                title: 'Simple Token Test',
                message: 'Testing with real device token',
                priority: 'high',
                student_id: 'test',
                created_at: new Date().toISOString()
            };

            const result = await pushService.sendToDevice(
                data[0].device_token,
                testNotification,
                data[0].platform
            );

            console.log('Result:', JSON.stringify(result, null, 2));

        } else {
            console.log('No active tokens found');
        }

    })
    .catch(error => {
        console.error('Error:', error.message);
    });
