#!/usr/bin/env node

/**
 * Quick Diagnostic Tool - No Database Required
 * Checks basic configuration without requiring server or database
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';

dotenv.config();

console.log('🔍 Quick Notification Diagnostic');
console.log('=================================\n');

// Check if .env file exists
function checkEnvFile() {
    console.log('1. Checking .env file...');

    if (existsSync('.env')) {
        console.log('✅ .env file exists');
        return true;
    } else {
        console.log('❌ .env file not found');
        console.log('   Please create a .env file with your configuration');
        return false;
    }
}

// Check environment variables
function checkEnvironmentVariables() {
    console.log('\n2. Checking Environment Variables...');

    const requiredVars = [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'JWT_SECRET'
    ];

    const firebaseVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL'
    ];

    let allPresent = true;
    let firebasePresent = true;

    console.log('\n   📊 Basic Configuration:');
    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName}: Present`);
        } else {
            console.log(`   ❌ ${varName}: Missing`);
            allPresent = false;
        }
    });

    console.log('\n   🔥 Firebase Configuration:');
    firebaseVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName}: Present`);
        } else {
            console.log(`   ❌ ${varName}: Missing`);
            firebasePresent = false;
        }
    });

    if (!allPresent) {
        console.log('\n❌ Missing required environment variables!');
        console.log('   You need these for basic server functionality');
        return false;
    }

    if (!firebasePresent) {
        console.log('\n⚠️  Firebase environment variables missing!');
        console.log('   You need these for push notifications to work');
        console.log('   Without Firebase, notifications will only work via WebSocket');
        return false;
    }

    console.log('\n✅ All environment variables present');
    return true;
}

// Check Firebase Admin SDK
async function checkFirebaseAdmin() {
    console.log('\n3. Checking Firebase Admin SDK...');

    try {
        const admin = await import('firebase-admin');
        console.log('✅ Firebase Admin SDK available');

        // Try to initialize with current config
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            try {
                const serviceAccount = {
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                };

                if (!admin.default.apps.length) {
                    admin.default.initializeApp({
                        credential: admin.default.credential.cert(serviceAccount),
                        projectId: process.env.FIREBASE_PROJECT_ID,
                    });
                }

                console.log('✅ Firebase Admin initialized successfully');
                return true;
            } catch (error) {
                console.log('❌ Firebase Admin initialization failed:', error.message);
                return false;
            }
        } else {
            console.log('⚠️  Cannot test Firebase Admin - missing environment variables');
            return false;
        }
    } catch (error) {
        console.log('❌ Firebase Admin SDK not available:', error.message);
        console.log('   Run: npm install firebase-admin');
        return false;
    }
}

// Provide setup instructions
function provideSetupInstructions() {
    console.log('\n4. Setup Instructions...');

    console.log('\n📝 To fix missing configuration:');
    console.log('   1. Copy env.template to .env:');
    console.log('      cp env.template .env');
    console.log('   2. Edit .env with your actual values:');
    console.log('      - SUPABASE_URL: Your Supabase project URL');
    console.log('      - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key');
    console.log('      - JWT_SECRET: A random secret key');
    console.log('      - FIREBASE_*: Your Firebase service account details');

    console.log('\n🔧 To get Firebase credentials:');
    console.log('   1. Go to Firebase Console (https://console.firebase.google.com)');
    console.log('   2. Select your project');
    console.log('   3. Go to Project Settings > Service Accounts');
    console.log('   4. Click "Generate new private key"');
    console.log('   5. Download the JSON file');
    console.log('   6. Extract the values for your .env file');

    console.log('\n📱 For push notifications to work when app is closed:');
    console.log('   1. Ensure Firebase is properly configured (above)');
    console.log('   2. Follow android-notification-setup.md guide');
    console.log('   3. Test with real device tokens');
    console.log('   4. Check device notification settings');
}

// Main function
async function runQuickDiagnostic() {
    console.log('🚀 Starting Quick Diagnostic...\n');

    const envFileExists = checkEnvFile();
    const envVarsOk = checkEnvironmentVariables();
    const firebaseOk = await checkFirebaseAdmin();

    console.log('\n' + '='.repeat(50));
    console.log('📊 Quick Diagnostic Results:');
    console.log(`   📄 .env file: ${envFileExists ? '✅' : '❌'}`);
    console.log(`   🔧 Environment vars: ${envVarsOk ? '✅' : '❌'}`);
    console.log(`   🔥 Firebase: ${firebaseOk ? '✅' : '❌'}`);

    if (envFileExists && envVarsOk && firebaseOk) {
        console.log('\n🎉 Configuration looks good!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Start your server: npm start');
        console.log('   2. Run: node diagnose-notification-issue.js');
        console.log('   3. Run: node test-background-notifications.js');
        console.log('   4. Test with your mobile app');
    } else {
        console.log('\n❌ Configuration issues found.');
        provideSetupInstructions();
    }
}

// Run diagnostic
runQuickDiagnostic().catch(console.error);
