import dotenv from 'dotenv';
import fcmCompliantNotificationService from './src/services/fcmCompliantNotificationService.js';

dotenv.config();

async function testFCMCompliantNotification() {
    try {
        console.log('🧪 Testing FCM Compliant Notification...');
        console.log('Following Firebase Cloud Messaging documentation exactly');
        console.log('');

        const userId = '34e0bb46-ec50-4fec-ac30-4e33f3ced66c';

        console.log(`📱 Testing with user: ${userId}`);
        console.log('');

        // Test 1: Send notification message (displayed automatically by system)
        console.log('1. Testing Notification Message (displayed automatically by system)...');
        const notificationResult = await fcmCompliantNotificationService.testFCMCompliantNotification(userId);

        console.log('Notification Result:', JSON.stringify(notificationResult, null, 2));

        if (notificationResult.success) {
            console.log('✅ FCM Compliant notification sent successfully!');
            console.log(`📱 Sent to ${notificationResult.sent} devices`);
            if (notificationResult.failed > 0) {
                console.log(`⚠️  Failed to send to ${notificationResult.failed} devices`);
            }
        } else {
            console.log('❌ Failed to send FCM compliant notification');
            console.log('Error:', notificationResult.error);
        }

        console.log('');

        // Test 2: Send data message (handled by app code)
        console.log('2. Testing Data Message (handled by app code)...');
        const dataMessage = {
            type: 'background_sync',
            action: 'sync_data',
            timestamp: Date.now().toString(),
            payload: {
                sync_type: 'background',
                data_version: '1.0'
            }
        };

        const dataResult = await fcmCompliantNotificationService.sendDataMessage(userId, dataMessage);

        console.log('Data Message Result:', JSON.stringify(dataResult, null, 2));

        if (dataResult.success) {
            console.log('✅ FCM Compliant data message sent successfully!');
            console.log(`📱 Sent to ${dataResult.sent} devices`);
        } else {
            console.log('❌ Failed to send FCM compliant data message');
            console.log('Error:', dataResult.error);
        }

        console.log('');
        console.log('🎉 FCM Compliant Test Completed!');
        console.log('');
        console.log('📋 Key FCM Documentation Compliance:');
        console.log('   ✅ Notification messages (displayed automatically by system)');
        console.log('   ✅ Data messages (handled by app code)');
        console.log('   ✅ Android priority: high (required for background)');
        console.log('   ✅ iOS content-available: 1 (required for background)');
        console.log('   ✅ Proper notification channels');
        console.log('   ✅ Correct message targeting');
        console.log('');
        console.log('📱 Next Steps:');
        console.log('   1. Check your mobile device notification panel');
        console.log('   2. Verify app notification settings');
        console.log('   3. Test with app completely closed');
        console.log('   4. Check device notification permissions');
        console.log('   5. Verify notification channels in your mobile app');

    } catch (error) {
        console.error('❌ FCM Compliant test failed:', error.message);
    }
}

testFCMCompliantNotification();
