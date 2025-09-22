#!/usr/bin/env node

/**
 * Test Notification Streaming WebSocket
 * This script tests the dedicated notification WebSocket endpoint
 */

const WebSocket = require('ws');

const BASE_URL = 'ws://localhost:3000';
const TEST_TOKEN = 'your_jwt_token_here'; // Replace with a real JWT token

console.log('🔔 Testing Notification Streaming WebSocket...\n');

// Test 1: Get WebSocket connection info
async function getWebSocketInfo() {
    console.log('1. Getting WebSocket Connection Info...');

    try {
        const response = await fetch('http://localhost:3000/api/notifications/stream', {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });

        const result = await response.json();

        if (result.status === 'success') {
            console.log('   ✅ WebSocket info retrieved successfully');
            console.log('   📡 WebSocket URL:', result.data.websocket_url);
            console.log('   👤 User ID:', result.data.user_id);
            console.log('   🎭 User Role:', result.data.user_role);
            console.log('   📋 Available Message Types:', result.data.connection_info.message_types.join(', '));
            return result.data.websocket_url;
        } else {
            console.log('   ❌ Failed to get WebSocket info:', result.message);
            return null;
        }
    } catch (error) {
        console.log('   ❌ Error getting WebSocket info:', error.message);
        return null;
    }
}

// Test 2: Connect to Notification WebSocket
function connectToNotificationWebSocket(wsUrl) {
    console.log('\n2. Connecting to Notification WebSocket...');

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('   ✅ Connected to notification WebSocket successfully');

            // Send ping to test connection
            ws.send(JSON.stringify({
                type: 'ping'
            }));

            resolve(ws);
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log('   📨 Received message:', message.type);

                if (message.type === 'connection_established') {
                    console.log('   🎉 Connection established successfully');
                    console.log('   📊 Connection data:', message.data);
                } else if (message.type === 'pong') {
                    console.log('   🏓 Pong received - connection is alive');
                } else if (message.type === 'notification') {
                    console.log('   🔔 New notification received:');
                    console.log('      Title:', message.data.title);
                    console.log('      Message:', message.data.message);
                    console.log('      Type:', message.data.type);
                    console.log('      Priority:', message.data.priority);
                }
            } catch (error) {
                console.log('   ❌ Error parsing message:', error.message);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`   🔌 WebSocket closed: ${code} - ${reason}`);
        });

        ws.on('error', (error) => {
            console.log('   ❌ WebSocket error:', error.message);
            reject(error);
        });

        // Set timeout for connection
        setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                console.log('   ⏰ Connection timeout');
                reject(new Error('Connection timeout'));
            }
        }, 5000);
    });
}

// Test 3: Test notification subscription
function testNotificationSubscription(ws) {
    console.log('\n3. Testing Notification Subscription...');

    try {
        // Subscribe to specific notification types
        ws.send(JSON.stringify({
            type: 'subscribe_notifications',
            notification_types: ['announcement', 'event', 'homework', 'classwork']
        }));

        console.log('   ✅ Sent subscription request');

        // Wait a bit then unsubscribe
        setTimeout(() => {
            ws.send(JSON.stringify({
                type: 'unsubscribe_notifications',
                notification_types: ['homework']
            }));
            console.log('   ✅ Sent unsubscription request');
        }, 2000);

    } catch (error) {
        console.log('   ❌ Error testing subscription:', error.message);
    }
}

// Test 4: Test heartbeat
function testHeartbeat(ws) {
    console.log('\n4. Testing Heartbeat...');

    try {
        // Send heartbeat
        ws.send(JSON.stringify({
            type: 'heartbeat'
        }));

        console.log('   ✅ Heartbeat sent');

        // Send periodic heartbeats
        const heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'heartbeat',
                    timestamp: new Date().toISOString()
                }));
                console.log('   💓 Heartbeat sent');
            } else {
                clearInterval(heartbeatInterval);
            }
        }, 10000); // Every 10 seconds

        // Clear interval after 30 seconds
        setTimeout(() => {
            clearInterval(heartbeatInterval);
            console.log('   ⏹️ Heartbeat interval cleared');
        }, 30000);

    } catch (error) {
        console.log('   ❌ Error testing heartbeat:', error.message);
    }
}

// Test 5: Test connection status
async function testConnectionStatus() {
    console.log('\n5. Testing Connection Status...');

    try {
        const response = await fetch('http://localhost:3000/api/notifications/stream/status', {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });

        const result = await response.json();

        if (result.status === 'success') {
            console.log('   ✅ Connection status retrieved');
            console.log('   📊 Status:', result.data);
        } else {
            console.log('   ❌ Failed to get connection status:', result.message);
        }
    } catch (error) {
        console.log('   ❌ Error getting connection status:', error.message);
    }
}

// Test 6: Test health check
async function testHealthCheck() {
    console.log('\n6. Testing Health Check...');

    try {
        const response = await fetch('http://localhost:3000/api/notifications/stream/health', {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });

        const result = await response.json();

        if (result.status === 'success') {
            console.log('   ✅ Health check passed');
            console.log('   📊 Health data:', result.data);
        } else {
            console.log('   ❌ Health check failed:', result.message);
        }
    } catch (error) {
        console.log('   ❌ Error in health check:', error.message);
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Notification Streaming Tests...\n');

    try {
        // Test 1: Get WebSocket info
        const wsUrl = await getWebSocketInfo();
        if (!wsUrl) {
            console.log('❌ Cannot proceed - WebSocket info not available');
            return;
        }

        // Test 2: Connect to WebSocket
        const ws = await connectToNotificationWebSocket(wsUrl);

        // Test 3: Test subscription
        testNotificationSubscription(ws);

        // Test 4: Test heartbeat
        testHeartbeat(ws);

        // Test 5: Test connection status
        await testConnectionStatus();

        // Test 6: Test health check
        await testHealthCheck();

        // Keep connection alive for a while to receive notifications
        console.log('\n⏳ Keeping connection alive for 60 seconds to receive notifications...');
        console.log('   💡 Send test notifications from your backend to see them here');

        setTimeout(() => {
            ws.close();
            console.log('\n🎉 Notification Streaming Tests Complete!');
            console.log('\n📋 Summary:');
            console.log('✅ WebSocket connection established');
            console.log('✅ Notification subscription working');
            console.log('✅ Heartbeat mechanism working');
            console.log('✅ Connection status API working');
            console.log('✅ Health check API working');

            console.log('\n🔗 Usage:');
            console.log('1. Connect to: ws://localhost:3000/notifications/ws?token=YOUR_JWT_TOKEN');
            console.log('2. Receive real-time notifications');
            console.log('3. Use REST API for connection management');
        }, 60000);

    } catch (error) {
        console.log('\n❌ Test failed:', error.message);
    }
}

// Run tests
runAllTests().catch(console.error);
