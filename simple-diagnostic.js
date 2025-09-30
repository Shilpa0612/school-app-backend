#!/usr/bin/env node

import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

console.log('🔍 Simple Notification Diagnostic');
console.log('=================================\n');

async function runSimpleDiagnostic() {
    try {
        console.log('1. Testing database connection...');

        const { data, error } = await adminSupabase
            .from('device_tokens')
            .select('count')
            .limit(1);

        if (error) {
            console.log('❌ Database connection failed:', error.message);
            return;
        }

        console.log('✅ Database connection successful');

        console.log('\n2. Checking device tokens...');

        const { data: tokens, error: tokenError } = await adminSupabase
            .from('device_tokens')
            .select('id, user_id, device_token, platform, is_active')
            .limit(5);

        if (tokenError) {
            console.log('❌ Device tokens table issue:', tokenError.message);
            return;
        }

        if (tokens.length === 0) {
            console.log('⚠️  No device tokens found in database');
            console.log('   This means no devices are registered for notifications');
        } else {
            console.log(`✅ Found ${tokens.length} device tokens in database`);
            tokens.forEach((token, index) => {
                console.log(`   ${index + 1}. User: ${token.user_id}, Platform: ${token.platform}, Active: ${token.is_active}`);
            });
        }

        console.log('\n3. Testing Firebase...');

        try {
            const admin = await import('firebase-admin');

            if (!admin.default.apps.length) {
                console.log('❌ Firebase Admin not initialized');
                return;
            }

            console.log('✅ Firebase Admin SDK initialized');
        } catch (error) {
            console.log('❌ Firebase Admin SDK error:', error.message);
        }

        console.log('\n🎉 Diagnostic completed!');

    } catch (error) {
        console.error('❌ Diagnostic failed:', error.message);
    }
}

runSimpleDiagnostic();
