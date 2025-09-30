console.log('Starting FCM Direct Test...');

import('./src/config/supabase.js')
    .then(async (supabaseModule) => {
        console.log('Supabase imported successfully');

        const { adminSupabase } = supabaseModule;

        // Test database connection
        console.log('Testing database connection...');
        const { data, error } = await adminSupabase
            .from('user_device_tokens')
            .select('device_token, platform')
            .eq('user_id', '34e0bb46-ec50-4fec-ac30-4e33f3ced66c')
            .eq('is_active', true)
            .limit(1);

        if (error) {
            console.error('Database error:', error.message);
            return;
        }

        console.log('Device tokens found:', data?.length || 0);

        if (data && data.length > 0) {
            console.log('First token:', data[0].device_token.substring(0, 20) + '...');
            console.log('Platform:', data[0].platform);

            // Now test the notification service
            const pushModule = await import('./src/services/pushNotificationService.js');
            console.log('Push service imported successfully');

            const testNotification = {
                id: 'direct_test_' + Date.now(),
                type: 'test',
                title: 'Direct FCM Test',
                message: 'Testing FCM with corrected payload',
                priority: 'high',
                student_id: 'test',
                created_at: new Date().toISOString()
            };

            console.log('Sending notification...');
            const result = await pushModule.default.sendToDevice(
                data[0].device_token,
                testNotification,
                data[0].platform
            );

            console.log('Result:', result);

        } else {
            console.log('No device tokens found');
        }

    })
    .catch(error => {
        console.error('Import error:', error.message);
        console.error('Stack:', error.stack);
    });
