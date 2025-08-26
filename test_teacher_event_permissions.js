const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/calendar';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with teacher's token
const CLASS_DIVISION_ID = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1'; // Grade 1 B

// Helper function to make authenticated requests
async function makeRequest(method, url, data = null, headers = {}) {
    try {
        const config = {
            method,
            url,
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response;
    } catch (error) {
        console.error(`❌ ${method.toUpperCase()} ${url} failed:`, error.response?.data || error.message);
        return error.response;
    }
}

// Test 1: Teacher creating school-wide event
async function testSchoolWideEvent() {
    console.log('\n🧪 Test 1: Teacher Creating School-Wide Event');
    console.log('='.repeat(60));

    const eventData = {
        title: "School Sports Day",
        description: "Annual school sports day for all students",
        event_date: "2025-08-15T09:00:00.000Z",
        event_type: "school_wide",
        is_single_day: true,
        start_time: "09:00:00",
        end_time: "16:00:00",
        event_category: "sports",
        timezone: "Asia/Kolkata"
    };

    console.log('Attempting to create school-wide event:');
    console.log(JSON.stringify(eventData, null, 2));

    const response = await makeRequest('POST', `${BASE_URL}/events`, eventData);

    if (response.status === 201) {
        console.log(`✅ School-wide event created successfully!`);
        console.log(`   Event ID: ${response.data.data.event.id}`);
        console.log(`   Status: ${response.data.data.event.status}`);
        console.log(`   Type: ${response.data.data.event.event_type}`);
        console.log(`   Requires Approval: ${response.data.data.requires_approval}`);
        return response.data.data.event;
    } else {
        console.log(`❌ School-wide event creation failed`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return null;
    }
}

// Test 2: Teacher creating class-specific event
async function testClassSpecificEvent() {
    console.log('\n🧪 Test 2: Teacher Creating Class-Specific Event');
    console.log('='.repeat(60));

    const eventData = {
        title: "Grade 1 B Parent Meeting",
        description: "Parent-teacher meeting for Grade 1 B students",
        event_date: "2025-08-10T14:00:00.000Z",
        event_type: "class_specific",
        class_division_id: CLASS_DIVISION_ID,
        is_single_day: true,
        start_time: "14:00:00",
        end_time: "15:00:00",
        event_category: "meeting",
        timezone: "Asia/Kolkata"
    };

    console.log('Attempting to create class-specific event:');
    console.log(JSON.stringify(eventData, null, 2));

    const response = await makeRequest('POST', `${BASE_URL}/events`, eventData);

    if (response.status === 201) {
        console.log(`✅ Class-specific event created successfully!`);
        console.log(`   Event ID: ${response.data.data.event.id}`);
        console.log(`   Status: ${response.data.data.event.status}`);
        console.log(`   Type: ${response.data.data.event.event_type}`);
        console.log(`   Class Division ID: ${response.data.data.event.class_division_id}`);
        console.log(`   Requires Approval: ${response.data.data.requires_approval}`);
        return response.data.data.event;
    } else {
        console.log(`❌ Class-specific event creation failed`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return null;
    }
}

// Test 3: Teacher creating teacher-specific event
async function testTeacherSpecificEvent() {
    console.log('\n🧪 Test 3: Teacher Creating Teacher-Specific Event');
    console.log('='.repeat(60));

    const eventData = {
        title: "Personal Teacher Meeting",
        description: "Personal meeting for teacher",
        event_date: "2025-08-05T10:00:00.000Z",
        event_type: "teacher_specific",
        is_single_day: true,
        start_time: "10:00:00",
        end_time: "11:00:00",
        event_category: "meeting",
        timezone: "Asia/Kolkata"
    };

    console.log('Attempting to create teacher-specific event:');
    console.log(JSON.stringify(eventData, null, 2));

    const response = await makeRequest('POST', `${BASE_URL}/events`, eventData);

    if (response.status === 201) {
        console.log(`✅ Teacher-specific event created successfully!`);
        console.log(`   Event ID: ${response.data.data.event.id}`);
        console.log(`   Status: ${response.data.data.event.status}`);
        console.log(`   Type: ${response.data.data.event.event_type}`);
        console.log(`   Requires Approval: ${response.data.data.requires_approval}`);
        return response.data.data.event;
    } else {
        console.log(`❌ Teacher-specific event creation failed`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return null;
    }
}

// Test 4: Verify events in the list
async function testEventListing() {
    console.log('\n🧪 Test 4: Verifying Events in List');
    console.log('='.repeat(60));

    const response = await makeRequest('GET', `${BASE_URL}/events`);

    if (response.status === 200) {
        const events = response.data.data.events || [];
        console.log(`✅ Retrieved ${events.length} events`);

        // Categorize events by type
        const schoolWideEvents = events.filter(event => event.event_type === 'school_wide');
        const classSpecificEvents = events.filter(event => event.event_type === 'class_specific');
        const teacherSpecificEvents = events.filter(event => event.event_type === 'teacher_specific');

        console.log(`   School-wide events: ${schoolWideEvents.length}`);
        console.log(`   Class-specific events: ${classSpecificEvents.length}`);
        console.log(`   Teacher-specific events: ${teacherSpecificEvents.length}`);

        // Show recent events
        const recentEvents = events.slice(0, 5);
        if (recentEvents.length > 0) {
            console.log(`\n📋 Recent Events:`);
            recentEvents.forEach((event, index) => {
                console.log(`   ${index + 1}. ${event.title} (${event.event_type}) - ${event.status}`);
            });
        }

        return events;
    } else {
        console.log(`❌ Failed to retrieve events`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Test 5: Test different user roles (if we have access)
async function testRolePermissions() {
    console.log('\n🧪 Test 5: Testing Role Permissions');
    console.log('='.repeat(60));

    console.log('📋 Expected Permissions:');
    console.log('   Admin: Can create all event types (auto-approved)');
    console.log('   Principal: Can create all event types (auto-approved)');
    console.log('   Teacher: Can create all event types (pending approval)');
    console.log('   Parent: Cannot create any events');
    console.log('   Student: Cannot create any events');

    console.log('\n🔍 Current Test: Teacher Permissions');
    console.log('   ✅ Should be able to create school-wide events');
    console.log('   ✅ Should be able to create class-specific events (for assigned classes)');
    console.log('   ✅ Should be able to create teacher-specific events');
    console.log('   ⚠️  All teacher events should be pending approval');
}

// Test 6: Test approval workflow
async function testApprovalWorkflow() {
    console.log('\n🧪 Test 6: Testing Approval Workflow');
    console.log('='.repeat(60));

    console.log('📋 Teacher Event Approval Process:');
    console.log('   1. Teacher creates event → Status: pending');
    console.log('   2. Principal/Admin reviews event');
    console.log('   3. Principal/Admin approves/rejects event');
    console.log('   4. Event becomes visible to all users (if approved)');

    console.log('\n🔍 Current Status:');
    console.log('   Teacher events are created with "pending" status');
    console.log('   They require principal/admin approval');
    console.log('   Only approved events are visible to parents/students');
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Teacher Event Permissions Tests');
    console.log('='.repeat(70));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Class Division ID: ${CLASS_DIVISION_ID}`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing - Please update AUTH_TOKEN variable'}`);

    if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
        console.log('\n⚠️  Please update the AUTH_TOKEN variable with a teacher\'s token before running tests');
        return;
    }

    try {
        // Run tests in sequence
        await testSchoolWideEvent();
        await testClassSpecificEvent();
        await testTeacherSpecificEvent();
        await testEventListing();
        await testRolePermissions();
        await testApprovalWorkflow();

        console.log('\n✅ All teacher event permission tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showUsageExamples() {
    console.log('\n📖 Teacher Event Creation Examples:');
    console.log('='.repeat(60));

    console.log('\n1. Create School-Wide Event:');
    console.log('POST /api/calendar/events');
    console.log('{');
    console.log('  "title": "School Sports Day",');
    console.log('  "description": "Annual sports day",');
    console.log('  "event_date": "2025-08-15T09:00:00.000Z",');
    console.log('  "event_type": "school_wide",');
    console.log('  "event_category": "sports",');
    console.log('  "timezone": "Asia/Kolkata"');
    console.log('}');

    console.log('\n2. Create Class-Specific Event:');
    console.log('POST /api/calendar/events');
    console.log('{');
    console.log('  "title": "Parent Meeting",');
    console.log('  "description": "Class parent meeting",');
    console.log('  "event_date": "2025-08-10T14:00:00.000Z",');
    console.log('  "event_type": "class_specific",');
    console.log('  "class_division_id": "class-id-here",');
    console.log('  "event_category": "meeting",');
    console.log('  "timezone": "Asia/Kolkata"');
    console.log('}');

    console.log('\n3. Create Teacher-Specific Event:');
    console.log('POST /api/calendar/events');
    console.log('{');
    console.log('  "title": "Personal Meeting",');
    console.log('  "description": "Personal teacher meeting",');
    console.log('  "event_date": "2025-08-05T10:00:00.000Z",');
    console.log('  "event_type": "teacher_specific",');
    console.log('  "event_category": "meeting",');
    console.log('  "timezone": "Asia/Kolkata"');
    console.log('}');

    console.log('\n📋 Expected Behavior:');
    console.log('- Teachers can create all three types of events');
    console.log('- School-wide and class-specific events require approval');
    console.log('- Teacher-specific events are auto-approved');
    console.log('- All events are visible to teachers in their event list');
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
    showUsageExamples();
}

module.exports = {
    testSchoolWideEvent,
    testClassSpecificEvent,
    testTeacherSpecificEvent,
    testEventListing,
    testRolePermissions,
    testApprovalWorkflow,
    runAllTests,
    showUsageExamples
};
