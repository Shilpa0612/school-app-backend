import fs from 'fs';

console.log('🔍 Checking Log Files for FCM Messages');
console.log('======================================');
console.log('');

// Check if log files exist
const logFiles = ['error.log', 'combined.log'];

logFiles.forEach(file => {
    console.log(`📄 Checking ${file}:`);

    if (fs.existsSync(file)) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            // Look for FCM-related messages
            const fcmLines = lines.filter(line =>
                line.includes('Push notification') ||
                line.includes('SenderId') ||
                line.includes('messaging/') ||
                line.includes('FCM') ||
                line.includes('Firebase')
            );

            if (fcmLines.length > 0) {
                console.log(`   Found ${fcmLines.length} FCM-related log entries:`);
                fcmLines.slice(-5).forEach(line => { // Show last 5 entries
                    console.log(`   ${line}`);
                });
            } else {
                console.log('   No FCM-related messages found');
            }
        } catch (error) {
            console.log(`   Error reading ${file}: ${error.message}`);
        }
    } else {
        console.log(`   File ${file} does not exist`);
    }
    console.log('');
});

console.log('💡 To see real-time logs:');
console.log('   1. Start your server: npm start');
console.log('   2. Send a test notification via API');
console.log('   3. Watch the console output for FCM messages');
console.log('');
console.log('📱 Test API command:');
console.log('   curl -X POST http://localhost:3000/api/device-tokens/test \\');
console.log('     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"title":"Test","message":"FCM Test"}\'');
