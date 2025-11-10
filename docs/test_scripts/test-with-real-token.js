import dotenv from 'dotenv';
import pushNotificationService from '../../src/services/pushNotificationService.js';

dotenv.config();

async function testWithRealToken() {
    try {
        console.log('🧪 Testing FCM with Real Token...');
        console.log('');
        
        // Replace this with your REAL FCM token from your mobile app
        const realToken = 'PASTE_YOUR_REAL_FCM_TOKEN_HERE';
        const platform = 'android'; // or 'ios'
        
        console.log('⚠️  IMPORTANT: Replace the realToken variable above with your actual FCM token');
        console.log('');
        
        if (realToken === 'PASTE_YOUR_REAL_FCM_TOKEN_HERE') {
            console.log('❌ Please replace the realToken with your actual FCM token first');
            console.log('');
            console.log('📱 How to get your real FCM token:');
            console.log('   1. Open your mobile app');
            console.log('   2. Check console logs for FCM token');
            console.log('   3. Copy the token and paste it in this script');
            console.log('   4. Run this script again');
            return;
        }
        
        const testNotification = {
            id: 'real_fcm_test_' + Date.now(),
            type: 'test',
            title: 'Real FCM Token Test',
            message: 'This notification is sent to your real device using FCM!',
            priority: 'high',
            student_id: 'test_student',
            created_at: new Date().toISOString()
        };
        
        console.log(`📱 Sending to ${platform} device...`);
        console.log(`Token: ${realToken.substring(0, 30)}...`);
        console.log('');
        
        const result = await pushNotificationService.sendToDevice(
            realToken,
            testNotification,
            platform
        );
        
        console.log('📱 Result:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('');
            console.log('🎉 SUCCESS! Real FCM token test passed!');
            console.log('📱 Check your mobile device notification panel');
            console.log('');
            console.log('✅ Your FCM implementation is working correctly!');
            console.log('');
            console.log('🔧 Next Steps:');
            console.log('   1. Implement proper token registration in your mobile app');
            console.log('   2. Replace fake tokens in database with real tokens');
            console.log('   3. Test background notifications with app closed');
        } else {
            console.log('❌ Real token test failed');
            console.log('Error:', result.error);
            
            if (result.error?.code === 'messaging/invalid-argument') {
                console.log('');
                console.log('💡 This might mean:');
                console.log('   - Token is still fake/invalid');
                console.log('   - Token is expired');
                console.log('   - Token is from wrong Firebase project');
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testWithRealToken();
