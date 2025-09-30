import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

// Generate JWT token
const testUser = {
    user_id: '34e0bb46-ec50-4fec-ac30-4e33f3ced66c',
    role: 'parent'
};

const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '1h' });

console.log('🔑 Generated JWT Token:');
console.log(token);
console.log('');

// Test the API with authentication
const testNotification = async () => {
    try {
        console.log('🧪 Testing FCM with Authentication...');

        const response = await fetch('http://localhost:3000/api/device-tokens/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: 'FCM Fixed Test',
                message: 'Testing FCM with corrected payload structure for background notifications'
            })
        });

        const result = await response.json();

        console.log('📱 API Response:');
        console.log(JSON.stringify(result, null, 2));

        if (result.status === 'success') {
            console.log('');
            console.log('✅ FCM Test Successful!');
            console.log('📱 Check your mobile device notification panel');
            console.log('');
            console.log('🔧 FCM Fixes Applied:');
            console.log('   ✅ Android priority: high (required for background)');
            console.log('   ✅ iOS content-available: 1 (required for background)');
            console.log('   ✅ All data values converted to strings');
            console.log('   ✅ Proper notification channels');
            console.log('   ✅ Click action configured');
        } else {
            console.log('❌ FCM Test Failed');
            console.log('Error:', result.message);
        }

    } catch (error) {
        console.error('❌ Test Error:', error.message);
    }
};

testNotification();
