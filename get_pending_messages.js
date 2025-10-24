// Simple script to get pending messages and provide endpoints
const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

console.log('🔍 Getting Current Pending Messages for Testing\n');

console.log('📋 Step 1: Login as Principal');
console.log('POST ' + BASE_URL + '/auth/login');
console.log('Content-Type: application/json');
console.log('');
console.log('{');
console.log('  "phone_number": "1234567891",');
console.log('  "password": "password123"');
console.log('}');
console.log('');

console.log('📋 Step 2: Get Pending Messages');
console.log('GET ' + BASE_URL + '/chat/messages/pending');
console.log('Authorization: Bearer <principal-token>');
console.log('');

console.log('📋 Step 3: Approve a Message (replace MESSAGE_ID)');
console.log('POST ' + BASE_URL + '/chat/messages/MESSAGE_ID/approve');
console.log('Authorization: Bearer <principal-token>');
console.log('Content-Type: application/json');
console.log('');
console.log('// No body required');
console.log('');

console.log('📋 Step 4: Reject a Message (replace MESSAGE_ID)');
console.log('POST ' + BASE_URL + '/chat/messages/MESSAGE_ID/reject');
console.log('Authorization: Bearer <principal-token>');
console.log('Content-Type: application/json');
console.log('');
console.log('{');
console.log('  "rejection_reason": "Inappropriate content for school communication"');
console.log('}');
console.log('');

console.log('📋 Step 5: Verify Parent Can See Approved Messages');
console.log('GET ' + BASE_URL + '/chat/messages?thread_id=THREAD_ID');
console.log('Authorization: Bearer <parent-token>');
console.log('');

console.log('🎯 Based on your previous response, here are the message IDs to test:');
console.log('');
console.log('✅ APPROVE this message:');
console.log('   Message ID: e314dd4a-cf9f-4377-84da-85a72b0635a8');
console.log('   Content: "hh"');
console.log('   Thread ID: 66344b6e-22f6-4719-81af-744b872a92ae');
console.log('');
console.log('❌ REJECT this message:');
console.log('   Message ID: e9fd7508-3455-497d-b106-ef17e869ef4d');
console.log('   Content: "bb"');
console.log('   Thread ID: 66344b6e-22f6-4719-81af-744b872a92ae');
console.log('');

console.log('🔔 Expected Notifications:');
console.log('✅ When APPROVING "hh" message:');
console.log('   - Parent gets WebSocket notification');
console.log('   - Parent gets Firebase push notification');
console.log('   - Parent gets in-app notification record');
console.log('   - Message appears in parent chat immediately');
console.log('');
console.log('❌ When REJECTING "bb" message:');
console.log('   - Teacher gets WebSocket notification');
console.log('   - Teacher gets system notification record');
console.log('   - Teacher sees rejection reason');
console.log('   - Message is hidden from parent');
console.log('');

console.log('🚀 Ready to test the notification system!');
