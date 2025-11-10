import dotenv from 'dotenv';
import backgroundNotificationService from '../../src/services/backgroundNotificationService.js';

dotenv.config();

async function testBackgroundNotification() {
    try {
        console.log('🧪 Testing Background Notification...');

        const userId = '34e0bb46-ec50-4fec-ac30-4e33f3ced66c';

        console.log(`Sending test notification to user: ${userId}`);

        const result = await backgroundNotificationService.testBackgroundNotification(userId);

        console.log('Result:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('✅ Background notification sent successfully!');
            console.log(`📱 Sent to ${result.sent} devices`);
            if (result.failed > 0) {
                console.log(`⚠️  Failed to send to ${result.failed} devices`);
            }
        } else {
            console.log('❌ Failed to send background notification');
            console.log('Error:', result.error);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testBackgroundNotification();
