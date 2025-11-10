import dotenv from 'dotenv';
import fcmCompliantNotificationService from './src/services/fcmCompliantNotificationService.js';

dotenv.config();

console.log('Starting FCM Simple Test...');

try {
    console.log('1. Testing basic import...');
    console.log('FCM Service imported successfully');

    console.log('2. Testing with real user ID...');
    const userId = '34e0bb46-ec50-4fec-ac30-4e33f3ced66c';

    console.log('3. Sending test notification...');
    const result = await fcmCompliantNotificationService.testFCMCompliantNotification(userId);

    console.log('4. Result:', JSON.stringify(result, null, 2));

} catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
}
