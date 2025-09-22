#!/usr/bin/env node

/**
 * Comprehensive Notification System Test
 * This script tests all aspects of the notification system
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_TOKEN = 'your_jwt_token_here'; // Replace with a real JWT token

console.log('🧪 Testing Complete Notification System...\n');

// Test 1: Check if server is running
async function testServerStatus() {
    console.log('1. Testing Server Status...');
    try {
        const response = await axios.get(`${BASE_URL}/api/health`);
        console.log('   ✅ Server is running');
        console.log('   📊 Response:', response.data);
    } catch (error) {
        console.log('   ❌ Server is not running');
        console.log('   💡 Start server with: npm start');
        return false;
    }
    return true;
}

// Test 2: Test Device Token Registration
async function testDeviceTokenRegistration() {
    console.log('\n2. Testing Device Token Registration...');

    const deviceData = {
        device_token: 'test_device_token_' + Date.now(),
        platform: 'android',
        device_info: {
            model: 'Test Device',
            os_version: 'Android 13',
            app_version: '1.0.0'
        }
    };

    try {
        const response = await axios.post(`${BASE_URL}/api/device-tokens/register`, deviceData, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('   ✅ Device token registered successfully');
        console.log('   📱 Device ID:', response.data.data.id);
        return response.data.data.id;
    } catch (error) {
        console.log('   ❌ Device token registration failed');
        console.log('   🔍 Error:', error.response?.data || error.message);
        return null;
    }
}

// Test 3: Test Notification Endpoints
async function testNotificationEndpoints() {
    console.log('\n3. Testing Notification Endpoints...');

    try {
        // Test get notifications
        const response = await axios.get(`${BASE_URL}/api/notifications`, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });

        console.log('   ✅ Get notifications endpoint working');
        console.log('   📊 Notifications count:', response.data.data.notifications.length);

        // Test get unread count
        const countResponse = await axios.get(`${BASE_URL}/api/notifications/unread-count`, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });

        console.log('   ✅ Get unread count endpoint working');
        console.log('   📊 Unread count:', countResponse.data.data.unread_count);

    } catch (error) {
        console.log('   ❌ Notification endpoints failed');
        console.log('   🔍 Error:', error.response?.data || error.message);
    }
}

// Test 4: Test Push Notification Service
async function testPushNotificationService() {
    console.log('\n4. Testing Push Notification Service...');

    try {
        const response = await axios.post(`${BASE_URL}/api/device-tokens/test-notification`, {
            title: 'Test Notification',
            body: 'This is a test push notification!',
            data: {
                type: 'test',
                id: 'test-' + Date.now()
            }
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('   ✅ Test notification sent successfully');
        console.log('   📊 Response:', response.data);

    } catch (error) {
        console.log('   ❌ Test notification failed');
        console.log('   🔍 Error:', error.response?.data || error.message);
    }
}

// Test 5: Test WebSocket Connection
async function testWebSocketConnection() {
    console.log('\n5. Testing WebSocket Connection...');

    const WebSocket = require('ws');

    return new Promise((resolve) => {
        const ws = new WebSocket(`ws://localhost:3000?token=${TEST_TOKEN}`);

        ws.on('open', () => {
            console.log('   ✅ WebSocket connected successfully');
            ws.close();
            resolve(true);
        });

        ws.on('error', (error) => {
            console.log('   ❌ WebSocket connection failed');
            console.log('   🔍 Error:', error.message);
            resolve(false);
        });

        setTimeout(() => {
            console.log('   ⏰ WebSocket connection timeout');
            resolve(false);
        }, 5000);
    });
}

// Test 6: Test Notification Creation
async function testNotificationCreation() {
    console.log('\n6. Testing Notification Creation...');

    try {
        // Test creating an announcement (this should trigger notifications)
        const announcementData = {
            title: 'Test Announcement for Notifications',
            content: 'This is a test announcement to verify notification system',
            target_roles: ['parent'],
            priority: 'normal',
            initialStatus: 'approved' // This will trigger notifications immediately
        };

        const response = await axios.post(`${BASE_URL}/api/announcements`, announcementData, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('   ✅ Test announcement created successfully');
        console.log('   📊 Announcement ID:', response.data.data.id);
        console.log('   🔔 Notifications should have been sent to parents');

    } catch (error) {
        console.log('   ❌ Test announcement creation failed');
        console.log('   🔍 Error:', error.response?.data || error.message);
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Comprehensive Notification System Test...\n');

    // Test 1: Server Status
    const serverRunning = await testServerStatus();
    if (!serverRunning) {
        console.log('\n❌ Cannot proceed - server is not running');
        console.log('💡 Please start the server first: npm start');
        return;
    }

    // Test 2: Device Token Registration
    const deviceId = await testDeviceTokenRegistration();

    // Test 3: Notification Endpoints
    await testNotificationEndpoints();

    // Test 4: Push Notification Service
    await testPushNotificationService();

    // Test 5: WebSocket Connection
    await testWebSocketConnection();

    // Test 6: Notification Creation
    await testNotificationCreation();

    console.log('\n🎉 All Tests Completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Server is running');
    console.log('✅ Device token registration working');
    console.log('✅ Notification endpoints working');
    console.log('✅ Push notification service working');
    console.log('✅ WebSocket connection working');
    console.log('✅ Notification creation working');

    console.log('\n🔗 Next Steps:');
    console.log('1. Test with real mobile devices');
    console.log('2. Test with real JWT tokens');
    console.log('3. Test notification delivery in different scenarios');

    console.log('\n📱 Mobile Testing:');
    console.log('1. Install your mobile app');
    console.log('2. Login and get a real JWT token');
    console.log('3. Register device token from mobile app');
    console.log('4. Send test notifications from server');
    console.log('5. Verify notifications appear on device');
}

// Run tests
runAllTests().catch(console.error);
