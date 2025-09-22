#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

console.log('🔍 Debugging Environment Variables...\n');

console.log('Environment Variables Found:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? '✅ Found' : '❌ Missing');
console.log('FIREBASE_PRIVATE_KEY_ID:', process.env.FIREBASE_PRIVATE_KEY_ID ? '✅ Found' : '❌ Missing');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? '✅ Found' : '❌ Missing');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? '✅ Found' : '❌ Missing');
console.log('FIREBASE_CLIENT_ID:', process.env.FIREBASE_CLIENT_ID ? '✅ Found' : '❌ Missing');
console.log('FIREBASE_CLIENT_CERT_URL:', process.env.FIREBASE_CLIENT_CERT_URL ? '✅ Found' : '❌ Missing');

console.log('\nFirst few characters of each variable:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID?.substring(0, 20) + '...');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL?.substring(0, 30) + '...');

console.log('\nAll environment variables starting with FIREBASE:');
Object.keys(process.env)
    .filter(key => key.startsWith('FIREBASE'))
    .forEach(key => {
        console.log(`${key}: ${process.env[key]?.substring(0, 50)}...`);
    });
