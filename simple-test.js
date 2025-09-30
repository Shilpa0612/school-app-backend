import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

console.log('Testing notification system...');

async function test() {
    try {
        console.log('1. Testing database connection...');

        const { data, error } = await adminSupabase
            .from('user_device_tokens')
            .select('count')
            .limit(1);

        if (error) {
            console.log('Database error:', error.message);
            return;
        }

        console.log('Database connection successful');

        console.log('2. Checking device tokens...');

        const { data: tokens, error: tokenError } = await adminSupabase
            .from('user_device_tokens')
            .select('id, user_id, device_token, platform, is_active')
            .limit(5);

        if (tokenError) {
            console.log('Token error:', tokenError.message);
            return;
        }

        console.log(`Found ${tokens.length} device tokens`);

        if (tokens.length > 0) {
            console.log('Device tokens:');
            tokens.forEach((token, index) => {
                console.log(`${index + 1}. User: ${token.user_id}, Platform: ${token.platform}, Active: ${token.is_active}`);
            });
        } else {
            console.log('No device tokens found - this is why notifications don\'t work when app is closed');
        }

        console.log('3. Testing Firebase...');

        try {
            const admin = await import('firebase-admin');
            console.log('Firebase Admin SDK available');

            if (admin.default.apps.length > 0) {
                console.log('Firebase already initialized');
            } else {
                console.log('Firebase not initialized yet');
            }
        } catch (error) {
            console.log('Firebase error:', error.message);
        }

        console.log('Test completed successfully!');

    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

test();
