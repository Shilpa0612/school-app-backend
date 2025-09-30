#!/usr/bin/env node

/**
 * Notification Issue Diagnostic Tool
 * Helps identify why notifications don't work when app is closed
 */

import dotenv from 'dotenv';
import { adminSupabase } from './src/config/supabase.js';

dotenv.config();

console.log('🔍 Diagnosing Notification Issues');
console.log('=================================\n');

// Diagnostic checks
async function checkEnvironmentVariables() {
    console.log('1. Checking Environment Variables...');

    const requiredVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL'
    ];

    let issues = [];

    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName}: Present`);
        } else {
            console.log(`   ❌ ${varName}: Missing`);
            issues.push(`Missing ${varName}`);
        }
    });

    if (issues.length > 0) {
        console.log('\n❌ Environment Issues Found:');
        issues.forEach(issue => console.log(`   - ${issue}`));
        return false;
    }

    console.log('✅ All environment variables present');
    return true;
}

async function checkDatabaseConnection() {
    console.log('\n2. Checking Database Connection...');

    try {
        const { data, error } = await adminSupabase
            .from('device_tokens')
            .select('count')
            .limit(1);

        if (error) {
            console.log('❌ Database connection failed:', error.message);
            return false;
        }

        console.log('✅ Database connection successful');
        return true;
    } catch (error) {
        console.log('❌ Database error:', error.message);
        return false;
    }
}

async function checkDeviceTokensTable() {
    console.log('\n3. Checking Device Tokens Table...');

    try {
        // Check if table exists and has data
        const { data, error } = await adminSupabase
            .from('device_tokens')
            .select('id, user_id, device_token, platform, is_active')
            .limit(5);

        if (error) {
            console.log('❌ Device tokens table issue:', error.message);
            return false;
        }

        if (data.length === 0) {
            console.log('⚠️  No device tokens found in database');
            console.log('   This means no devices are registered for notifications');
            return false;
        }

        console.log(`✅ Found ${data.length} device tokens in database`);
        data.forEach((token, index) => {
            console.log(`   ${index + 1}. User: ${token.user_id}, Platform: ${token.platform}, Active: ${token.is_active}`);
        });

        return true;
    } catch (error) {
        console.log('❌ Error checking device tokens:', error.message);
        return false;
    }
}

async function checkFirebaseAdmin() {
    console.log('\n4. Checking Firebase Admin SDK...');

    try {
        const admin = await import('firebase-admin');

        if (!admin.default.apps.length) {
            console.log('❌ Firebase Admin not initialized');
            return false;
        }

        console.log('✅ Firebase Admin SDK initialized');
        return true;
    } catch (error) {
        console.log('❌ Firebase Admin SDK error:', error.message);
        return false;
    }
}

async function checkNotificationService() {
    console.log('\n5. Checking Notification Service...');

    try {
        const { default: notificationService } = await import('./src/services/enhancedNotificationService.js');

        if (!notificationService) {
            console.log('❌ Notification service not found');
            return false;
        }

        console.log('✅ Notification service loaded successfully');
        return true;
    } catch (error) {
        console.log('❌ Notification service error:', error.message);
        return false;
    }
}

async function checkRecentNotifications() {
    console.log('\n6. Checking Recent Notifications...');

    try {
        // Check if there's a notifications table
        const { data, error } = await adminSupabase
            .from('parent_notifications')
            .select('id, title, content, created_at, status')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.log('⚠️  No notifications table found or error:', error.message);
            return true; // Not critical
        }

        if (data.length === 0) {
            console.log('⚠️  No recent notifications found');
            return true;
        }

        console.log(`✅ Found ${data.length} recent notifications`);
        data.forEach((notification, index) => {
            console.log(`   ${index + 1}. ${notification.title} (${notification.status}) - ${notification.created_at}`);
        });

        return true;
    } catch (error) {
        console.log('⚠️  Error checking notifications:', error.message);
        return true; // Not critical
    }
}

async function provideSolutions() {
    console.log('\n7. Common Solutions for Background Notification Issues...');

    console.log('\n📱 Mobile App Issues:');
    console.log('   1. Check Android notification channels are properly configured');
    console.log('   2. Verify notification permissions are granted');
    console.log('   3. Disable battery optimization for your app');
    console.log('   4. Ensure background app refresh is enabled');
    console.log('   5. Test with app completely closed (not just backgrounded)');

    console.log('\n🔧 Backend Issues:');
    console.log('   1. Verify Firebase service account key is correct');
    console.log('   2. Check notification payload structure');
    console.log('   3. Ensure device tokens are being registered');
    console.log('   4. Test with valid device tokens');
    console.log('   5. Check Firebase console for delivery reports');

    console.log('\n🌐 Network Issues:');
    console.log('   1. Check internet connectivity on device');
    console.log('   2. Verify Firebase endpoints are accessible');
    console.log('   3. Check for firewall or proxy issues');
    console.log('   4. Test with different network (WiFi vs Mobile)');

    console.log('\n📊 Testing Steps:');
    console.log('   1. Run: node firebase-config-check.js');
    console.log('   2. Run: node test-background-notifications.js');
    console.log('   3. Test with real device tokens');
    console.log('   4. Check Firebase console logs');
    console.log('   5. Monitor device notification settings');
}

// Main diagnostic function
async function runDiagnostics() {
    console.log('🚀 Starting Notification Diagnostics...\n');

    const checks = [
        { name: 'Environment Variables', fn: checkEnvironmentVariables },
        { name: 'Database Connection', fn: checkDatabaseConnection },
        { name: 'Device Tokens Table', fn: checkDeviceTokensTable },
        { name: 'Firebase Admin SDK', fn: checkFirebaseAdmin },
        { name: 'Notification Service', fn: checkNotificationService },
        { name: 'Recent Notifications', fn: checkRecentNotifications }
    ];

    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const check of checks) {
        try {
            const result = await check.fn();
            if (result === true) {
                passed++;
            } else if (result === false) {
                failed++;
            } else {
                warnings++;
            }
        } catch (error) {
            console.error(`❌ Check "${check.name}" failed with error:`, error.message);
            failed++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Diagnostic Results:');
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️  Warnings: ${warnings}`);

    if (failed === 0) {
        console.log('\n🎉 All critical checks passed!');
        console.log('If notifications still don\'t work when app is closed:');
        console.log('1. Check mobile app configuration (see android-notification-setup.md)');
        console.log('2. Test with real device tokens');
        console.log('3. Verify device notification settings');
    } else {
        console.log('\n❌ Critical issues found that need to be fixed.');
        console.log('Please address the failed checks above before testing notifications.');
    }

    await provideSolutions();
}

// Run diagnostics if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runDiagnostics().catch(console.error);
}

export {
    checkDatabaseConnection,
    checkDeviceTokensTable, checkEnvironmentVariables, checkFirebaseAdmin,
    checkNotificationService,
    checkRecentNotifications,
    runDiagnostics
};

