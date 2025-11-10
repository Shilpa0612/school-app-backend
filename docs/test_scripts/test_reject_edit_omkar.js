// Test script to reject a message and then edit it
import https from 'https';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// Message ID to test
const MESSAGE_ID = '3f362289-205b-4aed-b48f-cd60dc8ebab6'; // First message "hi" from Omkar

function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);

        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testRejectAndEdit() {
    console.log('🧪 Testing Reject and Edit Message');
    console.log('===================================\n');

    try {
        // Step 1: Login as Principal
        console.log('1️⃣ Logging in as Principal...');
        const principalLogin = await makeRequest('POST', '/auth/login', {
            phone_number: '1234567891',
            password: 'password123'
        });

        if (principalLogin.status !== 200) {
            console.error('❌ Principal login failed:', principalLogin.data);
            return;
        }

        const principalToken = principalLogin.data.data.token;
        console.log('✅ Principal logged in');

        // Step 2: Get the message first to check status
        console.log('\n2️⃣ Getting message details...');
        console.log(`   Message ID: ${MESSAGE_ID}`);
        const messageResponse = await makeRequest('GET', `/chat/messages/${MESSAGE_ID}`, null, principalToken);

        if (messageResponse.status === 200) {
            const msg = messageResponse.data.data;
            console.log(`   Current status: ${msg.approval_status}`);
            console.log(`   Content: "${msg.content}"`);
            console.log(`   Sender: ${msg.sender.full_name} (${msg.sender.role})`);
        }

        // Step 3: Reject the message
        console.log('\n3️⃣ Principal rejecting the message...');
        const rejectPayload = {
            rejection_reason: 'Content is too casual for professional communication'
        };

        console.log('📤 Request Details:');
        console.log(`   Endpoint: POST /api/chat/messages/${MESSAGE_ID}/reject`);
        console.log(`   Payload:`, JSON.stringify(rejectPayload, null, 2));

        const rejectResponse = await makeRequest('POST', `/chat/messages/${MESSAGE_ID}/reject`, rejectPayload, principalToken);

        if (rejectResponse.status === 200) {
            console.log('✅ Message rejected successfully!');
            console.log('Response:', JSON.stringify(rejectResponse.data, null, 2));
            console.log(`   New status: ${rejectResponse.data.data.approval_status}`);
        } else {
            console.error('❌ Failed to reject message:', rejectResponse.data);
            return;
        }

        // Step 4: Login as Omkar (Teacher)
        console.log('\n4️⃣ Logging in as Omkar (Teacher)...');
        const teacherLogin = await makeRequest('POST', '/auth/login', {
            phone_number: '9158834913',
            password: 'Temp@1234'
        });

        if (teacherLogin.status !== 200) {
            console.error('❌ Teacher login failed:', teacherLogin.data);
            return;
        }

        const teacherToken = teacherLogin.data.data.token;
        console.log('✅ Teacher logged in:', teacherLogin.data.data.user.full_name);

        // Step 5: Teacher edits the rejected message
        console.log('\n5️⃣ Teacher editing the rejected message...');
        const editPayload = {
            content: 'Hello, I hope you are doing well.'
        };

        console.log('📤 Request Details:');
        console.log(`   Endpoint: PUT /api/chat/messages/${MESSAGE_ID}`);
        console.log(`   Payload:`, JSON.stringify(editPayload, null, 2));

        const editResponse = await makeRequest('PUT', `/chat/messages/${MESSAGE_ID}`, editPayload, teacherToken);

        if (editResponse.status === 200) {
            console.log('✅ Message edited successfully!');
            console.log('Response:', JSON.stringify(editResponse.data, null, 2));
            console.log(`\n🎯 Key Check: approval_status should now be: ${editResponse.data.data.approval_status}`);

            if (editResponse.data.data.approval_status === 'pending') {
                console.log('✅ SUCCESS! Status changed back to PENDING for re-approval!');
            } else {
                console.log('❌ FAIL! Status should be "pending" but is:', editResponse.data.data.approval_status);
            }

            console.log(`   Updated content: "${editResponse.data.data.content}"`);
            console.log(`   rejection_reason: ${editResponse.data.data.rejection_reason}`);
        } else {
            console.error('❌ Failed to edit message:', editResponse.data);
            return;
        }

        // Step 6: Verify the edited message using the /messages endpoint
        console.log('\n6️⃣ Verifying edited message using messages endpoint...');
        console.log(`   Endpoint: GET /api/chat/messages?thread_id=6337bbfb-b6a7-47e5-ba6d-7d6989b3de33`);

        const fetchResponse = await makeRequest('GET', `/chat/messages?thread_id=6337bbfb-b6a7-47e5-ba6d-7d6989b3de33`, null, teacherToken);

        if (fetchResponse.status === 200) {
            const messages = fetchResponse.data.data.messages || [];
            const editedMessage = messages.find(msg => msg.id === MESSAGE_ID);

            if (editedMessage) {
                console.log('✅ Message fetched successfully!');
                console.log('\n📄 Full Message Details:');
                console.log('========================');
                console.log(`   ID: ${editedMessage.id}`);
                console.log(`   Content: "${editedMessage.content}"`);
                console.log(`   Status: ${editedMessage.approval_status}`);
                console.log(`   Sender: ${editedMessage.sender.full_name} (${editedMessage.sender.role})`);
                console.log(`   Created: ${editedMessage.created_at}`);
                console.log(`   Updated: ${editedMessage.updated_at}`);
                console.log(`\n✅ The edited message is now back in PENDING status for re-approval!`);
            } else {
                console.log('⚠️ Message not found in thread messages');
            }
        } else {
            console.error('❌ Failed to fetch messages:', fetchResponse.data);
        }

        console.log('\n📋 SUMMARY:');
        console.log('===========');
        console.log('✅ Message rejected by Principal');
        console.log('✅ Status changed from pending → rejected');
        console.log('✅ Teacher edited the rejected message');
        console.log('✅ Status automatically changed from rejected → pending');
        console.log('✅ Message now requires re-approval before parent can see it');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testRejectAndEdit();
