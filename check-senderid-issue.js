import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 SenderId Mismatch Diagnosis');
console.log('==============================');
console.log('');

console.log('Backend Firebase Project ID:', process.env.FIREBASE_PROJECT_ID);
console.log('Backend Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
console.log('');

console.log('🚨 SENDERID MISMATCH ERROR EXPLANATION:');
console.log('');
console.log('This error occurs when:');
console.log('1. Your backend uses Firebase Project A');
console.log('2. Your mobile app uses Firebase Project B');
console.log('3. Device tokens from Project B cannot receive messages from Project A');
console.log('');

console.log('🔧 SOLUTION STEPS:');
console.log('');
console.log('1. Check your mobile app google-services.json:');
console.log('   - File location: android/app/google-services.json');
console.log('   - Must be downloaded from Firebase Console (not Google Cloud)');
console.log('   - Project ID must match your backend FIREBASE_PROJECT_ID');
console.log('');

console.log('2. Verify the project_id in google-services.json matches:');
console.log('   Backend .env FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
console.log('   Mobile app google-services.json project_id: [CHECK THIS]');
console.log('');

console.log('3. If they don\'t match:');
console.log('   - Download correct google-services.json from Firebase Console');
console.log('   - Replace the file in your mobile app');
console.log('   - Rebuild your mobile app');
console.log('   - Re-register device tokens');
console.log('');

console.log('4. Test the fix:');
console.log('   - Send a test notification');
console.log('   - Check server logs for SenderId mismatch');
console.log('   - Should work without errors');
console.log('');

console.log('✅ Diagnosis complete!');
