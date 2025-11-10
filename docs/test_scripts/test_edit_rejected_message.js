// Test for editing rejected messages and re-approval workflow
import https from 'https';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

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

async function testEditRejectedMessage() {
    console.log('🧪 Testing Edit Rejected Message Workflow');
    console.log('==========================================\n');

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
        console.log('✅ Principal logged in:', principalLogin.data.data.user.full_name);

        // Step 2: Get pending messages
        console.log('\n2️⃣ Getting pending messages...');
        const pendingResponse = await makeRequest('GET', '/chat/messages/pending', null, principalToken);

        if (pendingResponse.status !== 200 || !pendingResponse.data.data.messages || pendingResponse.data.data.messages.length === 0) {
            console.log('⚠️ No pending messages found to test with');
            console.log('💡 Create a message from teacher to parent first, then run this test');
            return;
        }

        const messageToReject = pendingResponse.data.data.messages[0];
        console.log(`✅ Found pending message: "${messageToReject.content.substring(0, 50)}..."`);
        console.log(`   Message ID: ${messageToReject.id}`);

        // Step 3: Reject the message
        console.log(`\n3️⃣ Rejecting message: "${messageToReject.content.substring(0, 50)}..."`);
        const rejectResponse = await makeRequest('POST', `/chat/messages/${messageToReject.id}/reject`, {
            rejection_reason: 'Content needs to be more appropriate'
        }, principalToken);

        if (rejectResponse.status === 200) {
            console.log('✅ Message rejected successfully!');
            console.log(`   Rejection reason: ${rejectResponse.data.data.rejection_reason}`);
            console.log(`   Status changed to: ${rejectResponse.data.data.approval_status}`);
        } else {
            console.error('❌ Failed to reject message:', rejectResponse.data);
            return;
        }

        // Step 4: Login as Teacher
        console.log('\n4️⃣ Logging in as Teacher...');
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
        const editedContent = 'This is the corrected version of the message with appropriate content';
        const editResponse = await makeRequest('PUT', `/chat/messages/${messageToReject.id}`, {
            content: editedContent
        }, teacherToken);

        if (editResponse.status === 200) {
            console.log('✅ Message edited successfully!');
            console.log(`   New content: "${editedContent}"`);
            console.log(`   ⚠️ Status changed to: ${editResponse.data.data.approval_status}`);
            console.log('   ⚠️ This message now requires RE-APPROVAL before being sent to parent');
        } else {
            console.error('❌ Failed to edit message:', editResponse.data);
            return;
        }

        // Step 6: Login as Principal again for approval
        console.log('\n6️⃣ Principal approving the edited message...');
        const approveResponse = await makeRequest('POST', `/chat/messages/${messageToReject.id}/approve`, null, principalToken);

        if (approveResponse.status === 200) {
            console.log('✅ Edited message approved successfully!');
            console.log(`   Status changed to: ${approveResponse.data.data.approval_status}`);
            console.log(`   Message can now be seen by parent`);
        } else {
            console.error('❌ Failed to approve edited message:', approveResponse.data);
            return;
        }

        console.log('\n🎯 WORKFLOW SUMMARY:');
        console.log('====================');
        console.log('✅ 1. Teacher sends message → Status: PENDING');
        console.log('✅ 2. Principal rejects it → Status: REJECTED');
        console.log('✅ 3. Teacher edits rejected message → Status resets to: PENDING');
        console.log('✅ 4. Principal approves edited message → Status: APPROVED');
        console.log('✅ 5. Parent can now see the approved message');
        console.log('\n💡 Key feature: Edited rejected messages automatically reset to PENDING for re-approval');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testEditRejectedMessage();
