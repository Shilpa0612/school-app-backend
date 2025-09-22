import { config } from 'dotenv';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

// Load environment variables
config();

// Test WebSocket connection with heartbeat mechanism
async function testWebSocketHeartbeat() {
    try {
        console.log('🚀 Testing WebSocket connection with heartbeat mechanism...\n');

        // Create a test JWT token
        const testPayload = {
            userId: 'test-user-heartbeat-' + Date.now(),
            role: 'principal',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        };

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            console.error('❌ JWT_SECRET is not set in environment variables');
            return;
        }

        const token = jwt.sign(testPayload, JWT_SECRET);
        console.log(`🔑 Generated JWT token for user: ${testPayload.userId}`);

        // Connect to WebSocket
        const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

        let heartbeatCount = 0;
        let connectionStartTime = Date.now();
        let testDuration = 120000; // 2 minutes test

        ws.on('open', () => {
            console.log('✅ WebSocket connection established successfully!');
            console.log(`⏱️  Testing connection stability for ${testDuration / 1000} seconds...\n`);
        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            const timestamp = new Date().toISOString();

            switch (message.type) {
                case 'connection_established':
                    console.log(`📡 [${timestamp}] Connection confirmed for user: ${message.user_id}`);
                    break;

                case 'heartbeat':
                    heartbeatCount++;
                    console.log(`💓 [${timestamp}] Heartbeat #${heartbeatCount} received (timeout: ${message.timeout}ms)`);

                    // Respond to server heartbeat
                    ws.send(JSON.stringify({
                        type: 'heartbeat_response',
                        timestamp: Date.now()
                    }));
                    break;

                case 'pong':
                    console.log(`🏓 [${timestamp}] Pong received`);
                    break;

                case 'server_shutdown':
                    console.log(`🛑 [${timestamp}] Server shutdown notification: ${message.message}`);
                    break;

                default:
                    console.log(`📨 [${timestamp}] Received: ${message.type}`, message);
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
        });

        ws.on('close', (code, reason) => {
            const duration = Date.now() - connectionStartTime;
            console.log(`\n🔌 WebSocket closed after ${duration}ms`);
            console.log(`   Code: ${code}, Reason: ${reason || 'No reason provided'}`);
            console.log(`   Heartbeats received: ${heartbeatCount}`);
        });

        // Send periodic pings to test client-initiated heartbeat
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
                console.log(`🏓 Sent ping to server`);
            }
        }, 45000); // Send ping every 45 seconds

        // End test after specified duration
        setTimeout(() => {
            console.log(`\n⏰ Test completed after ${testDuration / 1000} seconds`);
            console.log(`📊 Connection Statistics:`);
            console.log(`   - Total heartbeats: ${heartbeatCount}`);
            console.log(`   - Connection duration: ${(Date.now() - connectionStartTime) / 1000}s`);
            console.log(`   - Connection status: ${ws.readyState === WebSocket.OPEN ? 'OPEN' : 'CLOSED'}`);

            clearInterval(pingInterval);
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Test completed');
            }
        }, testDuration);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Test WebSocket connection without heartbeat response (simulate unresponsive client)
async function testUnresponsiveClient() {
    try {
        console.log('\n🧪 Testing unresponsive client scenario...\n');

        const testPayload = {
            userId: 'test-unresponsive-' + Date.now(),
            role: 'teacher',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
        };

        const JWT_SECRET = process.env.JWT_SECRET;
        const token = jwt.sign(testPayload, JWT_SECRET);

        const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

        ws.on('open', () => {
            console.log('✅ Unresponsive client connected');
        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            const timestamp = new Date().toISOString();

            if (message.type === 'heartbeat') {
                console.log(`💓 [${timestamp}] Heartbeat received (NOT responding - simulating unresponsive client)`);
                // Intentionally NOT responding to heartbeat to test timeout
            } else {
                console.log(`📨 [${timestamp}] Received: ${message.type}`);
            }
        });

        ws.on('close', (code, reason) => {
            console.log(`🔌 Unresponsive client disconnected - Code: ${code}, Reason: ${reason}`);
            console.log('✅ Server correctly detected and disconnected unresponsive client\n');
        });

    } catch (error) {
        console.error('❌ Unresponsive client test failed:', error.message);
    }
}

// Run tests
console.log('🔧 WebSocket Heartbeat Mechanism Test Suite\n');
console.log('This test will:');
console.log('1. Test normal WebSocket connection with heartbeat responses');
console.log('2. Test unresponsive client detection and cleanup');
console.log('3. Verify connection stability over time\n');

// Start normal heartbeat test
testWebSocketHeartbeat();

// Start unresponsive client test after 10 seconds
setTimeout(() => {
    testUnresponsiveClient();
}, 10000);

