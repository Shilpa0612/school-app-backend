import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 FCM Configuration Check');
console.log('===========================');
console.log('');

console.log('Backend Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
console.log('Backend Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
console.log('');

console.log('📱 To test if FCM notifications are working:');
console.log('');
console.log('1. Send a test notification via API:');
console.log('   curl -X POST http://localhost:3000/api/device-tokens/test \\');
console.log('     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"title":"Test","message":"FCM Test"}\'');
console.log('');
console.log('2. Check server logs for:');
console.log('   ✅ "Push notification sent successfully" (success)');
console.log('   ❌ "SenderId mismatch" (configuration issue)');
console.log('   ❌ "messaging/invalid-registration-token" (token issue)');
console.log('');
console.log('3. Check your device for the notification');
console.log('');

console.log('🚨 Current Issues:');
console.log('- google-services.json missing firebase_messaging service');
console.log('- This prevents background notifications from working');
console.log('- Need to add firebase_messaging service manually');
console.log('');

console.log('🔧 Fix:');
console.log('1. Update google-services.json with firebase_messaging service');
console.log('2. Rebuild mobile app');
console.log('3. Re-register device tokens');
console.log('4. Test background notifications');
console.log('');

console.log('✅ Check complete!');
