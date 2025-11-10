const WebSocket = require('ws');

// Test WebSocket connections to verify the fix
async function testWebSocketConnections() {
    const baseUrl = 'ws://localhost:3000';

    console.log('🧪 Testing WebSocket Fix');
    console.log('='.repeat(50));

    // Test 1: General chat WebSocket
    console.log('\n1. Testing general chat WebSocket...');
    try {
        const chatWs = new WebSocket(baseUrl);

        chatWs.on('open', () => {
            console.log('✅ General chat WebSocket connected successfully');
            chatWs.close();
        });

        chatWs.on('error', (error) => {
            console.log('❌ General chat WebSocket error:', error.message);
        });

        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
        console.log('❌ General chat WebSocket test failed:', error.message);
    }

    // Test 2: Notification WebSocket
    console.log('\n2. Testing notification WebSocket...');
    try {
        const notificationWs = new WebSocket(`${baseUrl}/notifications/ws`);

        notificationWs.on('open', () => {
            console.log('✅ Notification WebSocket connected successfully');
            notificationWs.close();
        });

        notificationWs.on('error', (error) => {
            console.log('❌ Notification WebSocket error:', error.message);
        });

        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
        console.log('❌ Notification WebSocket test failed:', error.message);
    }

    // Test 3: Multiple connections (should not cause duplicate upgrade error)
    console.log('\n3. Testing multiple simultaneous connections...');
    try {
        const connections = [];
        const connectionCount = 5;

        for (let i = 0; i < connectionCount; i++) {
            const ws = new WebSocket(baseUrl);
            connections.push(ws);

            ws.on('open', () => {
                console.log(`✅ Connection ${i + 1} established`);
            });

            ws.on('error', (error) => {
                console.log(`❌ Connection ${i + 1} error:`, error.message);
            });
        }

        // Wait for all connections
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Close all connections
        connections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        console.log(`✅ Multiple connections test completed (${connectionCount} connections)`);

    } catch (error) {
        console.log('❌ Multiple connections test failed:', error.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('🎉 WebSocket fix testing completed!');
    console.log('\nIf you see "server.handleUpgrade() was called more than once" error,');
    console.log('the fix did not work. Otherwise, the WebSocket server should be working correctly.');
}

// Run the test
if (require.main === module) {
    testWebSocketConnections()
        .then(() => {
            console.log('\n✨ Test completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Test failed:', error.message);
            process.exit(1);
        });
}

module.exports = { testWebSocketConnections };
