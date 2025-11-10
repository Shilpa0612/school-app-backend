import { config } from 'dotenv';
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

// Load environment variables
config();

// Test WebSocket connection
async function testWebSocketConnection() {
    try {
        // First, let's get a valid JWT token by making a login request
        console.log('Testing WebSocket connection...');

        // Create a test JWT token (you should replace this with a real login)
        const testPayload = {
            userId: 'b9a49f00-a5ad-4824-852f-7ba46d5f09a6',
            role: 'principal',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        };

        // Use the same JWT_SECRET that your server is using
        const JWT_SECRET = process.env.JWT_SECRET;

        if (!JWT_SECRET) {
            console.error('❌ JWT_SECRET is not set in environment variables');
            return;
        }

        console.log('JWT_SECRET loaded:', JWT_SECRET.substring(0, 20) + '...');

        const token = jwt.sign(testPayload, JWT_SECRET);

        console.log('Generated JWT token:', token);
        console.log('Token payload:', testPayload);

        // Connect to WebSocket
        const ws = new WebSocket(`ws://localhost:3000?token=${token}`);

        ws.on('open', () => {
            console.log('✅ WebSocket connection established successfully!');

            // Send a ping message
            ws.send(JSON.stringify({ type: 'ping' }));
        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            console.log('📨 Received message:', message);

            if (message.type === 'pong') {
                console.log('✅ Ping-pong test successful!');
                ws.close();
            }
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
        });

        ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket closed with code: ${code}, reason: ${reason}`);
        });

        // Set a timeout to close the connection if no response
        setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
                console.log('⏰ Timeout reached, closing connection...');
                ws.close();
            }
        }, 5000);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testWebSocketConnection();
