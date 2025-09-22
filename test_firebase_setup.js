#!/usr/bin/env node

/**
 * Simple Firebase Setup Test
 * This script tests if Firebase credentials are properly configured
 */

console.log('🔥 Testing Firebase Setup...\n');

// Test 1: Check Environment Variables
console.log('1. Checking Environment Variables...');
const requiredEnvVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_CLIENT_ID',
    'FIREBASE_CLIENT_CERT_URL'
];

let missingVars = [];
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        missingVars.push(varName);
    } else {
        console.log(`   ✅ ${varName}: ${process.env[varName].substring(0, 20)}...`);
    }
});

if (missingVars.length > 0) {
    console.log(`   ❌ Missing environment variables: ${missingVars.join(', ')}`);
    console.log('\n📝 Please add these to your .env file:');
    missingVars.forEach(varName => {
        console.log(`   ${varName}=your_value_here`);
    });
    process.exit(1);
}

console.log('   ✅ All environment variables found!\n');

// Test 2: Test Firebase Admin SDK Import
console.log('2. Testing Firebase Admin SDK Import...');
try {
    const admin = require('firebase-admin');
    console.log('   ✅ Firebase Admin SDK imported successfully');
} catch (error) {
    console.log('   ❌ Firebase Admin SDK not installed');
    console.log('   📦 Run: npm install firebase-admin');
    process.exit(1);
}

// Test 3: Test Firebase Initialization
console.log('\n3. Testing Firebase Initialization...');
try {
    const admin = require('firebase-admin');

    // Initialize Firebase Admin SDK
    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
    };

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.FIREBASE_PROJECT_ID
        });
    }

    console.log('   ✅ Firebase initialized successfully');
    console.log(`   📱 Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
    console.log(`   📧 Service Account: ${process.env.FIREBASE_CLIENT_EMAIL}`);

} catch (error) {
    console.log('   ❌ Firebase initialization failed');
    console.log('   🔍 Error:', error.message);

    if (error.message.includes('private_key')) {
        console.log('   💡 Tip: Make sure FIREBASE_PRIVATE_KEY has proper \\n escapes');
    }
    if (error.message.includes('project_id')) {
        console.log('   💡 Tip: Check FIREBASE_PROJECT_ID matches your Firebase project');
    }
    process.exit(1);
}

// Test 4: Test Push Notification Service
console.log('\n4. Testing Push Notification Service...');
try {
    const pushService = require('./src/services/pushNotificationService.js');
    console.log('   ✅ Push Notification Service loaded successfully');
} catch (error) {
    console.log('   ❌ Push Notification Service not found');
    console.log('   🔍 Error:', error.message);
}

console.log('\n🎉 Firebase Setup Test Complete!');
console.log('\n📋 Next Steps:');
console.log('1. Start your server: npm start');
console.log('2. Test device registration: node test_push_notifications.js');
console.log('3. Test with real mobile devices');

console.log('\n🔗 Useful Commands:');
console.log('   Test push notifications: node test_push_notifications.js');
console.log('   Test device registration: curl -X POST http://localhost:3000/api/device-tokens/register \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -H "Authorization: Bearer YOUR_TOKEN" \\');
console.log('     -d \'{"device_token": "test_token", "platform": "android"}\'');
