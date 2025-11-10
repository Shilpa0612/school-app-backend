const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/calendar';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual teacher token

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

// Test 1: Check Teacher Assignment
async function testTeacherAssignment() {
    console.log('\n🧪 Test 1: Checking Teacher Assignment');
    console.log('='.repeat(50));

    // First, let's check what classes the teacher is assigned to
    const response = await makeRequest('GET', `${BASE_URL}/events/teacher`);

    if (response.status === 200) {
        console.log(`✅ Teacher assignment check successful`);
        console.log(`   Response status: ${response.status}`);

        // Check if the response contains teacher assignment info
        if (response.data && response.data.data) {
            console.log(`   Teacher can access events for assigned classes`);
        }
    } else {
        console.log(`❌ Teacher assignment check failed`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
    }
}

// Test 2: Create Class-Specific Event
async function testCreateClassEvent() {
    console.log('\n🧪 Test 2: Creating Class-Specific Event');
    console.log('='.repeat(50));

    const eventData = {
        title: 'Class Test Event',
        description: 'This is a test event for the class',
        event_date: '2024-02-15T10:00:00Z',
        event_type: 'class_specific',
        class_division_id: 'your-class-division-id', // Replace with actual class ID
        is_single_day: true,
        start_time: '09:00:00',
        end_time: '10:00:00',
        event_category: 'academic',
        timezone: 'Asia/Kolkata'
    };

    console.log('Creating class-specific event...');
    console.log('Event data:', JSON.stringify(eventData, null, 2));

    const response = await makeRequest('POST', `${BASE_URL}/events`, eventData);

    if (response.status === 201) {
        console.log(`✅ Class-specific event created successfully`);
        console.log(`   Event ID: ${response.data.data.event.id}`);
        console.log(`   Status: ${response.data.data.event.status}`);
        console.log(`   Message: ${response.data.message}`);

        return response.data.data.event;
    } else {
        console.log(`❌ Failed to create class-specific event`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);

        if (response.data?.message?.includes('assigned classes')) {
            console.log(`   🔍 This suggests the teacher is not assigned to the specified class`);
        }

        return null;
    }
}

// Test 3: Create School-Wide Event (Should Fail)
async function testCreateSchoolWideEvent() {
    console.log('\n🧪 Test 3: Attempting to Create School-Wide Event (Should Fail)');
    console.log('='.repeat(50));

    const eventData = {
        title: 'School-Wide Test Event',
        description: 'This is a test school-wide event',
        event_date: '2024-02-20T10:00:00Z',
        event_type: 'school_wide',
        is_single_day: true,
        event_category: 'general',
        timezone: 'Asia/Kolkata'
    };

    console.log('Attempting to create school-wide event...');

    const response = await makeRequest('POST', `${BASE_URL}/events`, eventData);

    if (response.status === 403) {
        console.log(`✅ Correctly prevented school-wide event creation`);
        console.log(`   Expected error: ${response.data?.message}`);
    } else {
        console.log(`❌ Unexpected response for school-wide event`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    }
}

// Test 4: Create Teacher-Specific Event
async function testCreateTeacherSpecificEvent() {
    console.log('\n🧪 Test 4: Creating Teacher-Specific Event');
    console.log('='.repeat(50));

    const eventData = {
        title: 'Teacher Meeting',
        description: 'Personal teacher meeting event',
        event_date: '2024-02-25T14:00:00Z',
        event_type: 'teacher_specific',
        is_single_day: true,
        event_category: 'meeting',
        timezone: 'Asia/Kolkata'
    };

    console.log('Creating teacher-specific event...');

    const response = await makeRequest('POST', `${BASE_URL}/events`, eventData);

    if (response.status === 201) {
        console.log(`✅ Teacher-specific event created successfully`);
        console.log(`   Event ID: ${response.data.data.event.id}`);
        console.log(`   Status: ${response.data.data.event.status}`);
        console.log(`   Message: ${response.data.message}`);

        return response.data.data.event;
    } else {
        console.log(`❌ Failed to create teacher-specific event`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);

        return null;
    }
}

// Test 5: Get Events for Assigned Classes
async function testGetClassEvents() {
    console.log('\n🧪 Test 5: Getting Events for Assigned Classes');
    console.log('='.repeat(50));

    const response = await makeRequest('GET', `${BASE_URL}/events/teacher`);

    if (response.status === 200) {
        const events = response.data.data.events || [];
        console.log(`✅ Retrieved ${events.length} events for assigned classes`);

        if (events.length > 0) {
            console.log(`   Sample events:`);
            events.slice(0, 3).forEach((event, index) => {
                console.log(`   ${index + 1}. ${event.title} (${event.event_type}) - ${event.event_date}`);
            });
        } else {
            console.log(`   No events found for assigned classes`);
        }
    } else {
        console.log(`❌ Failed to get events for assigned classes`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
    }
}

// Test 6: Check Database Tables
async function testDatabaseTables() {
    console.log('\n🧪 Test 6: Checking Database Table Structure');
    console.log('='.repeat(50));

    console.log('Checking if class_teacher_assignments table exists...');

    // This would require a database connection, but for now we'll just show what to check
    console.log(`   🔍 Verify these tables exist:`);
    console.log(`   - class_teacher_assignments (should exist)`);
    console.log(`   - teacher_class_assignments (legacy table, may not exist)`);
    console.log(`   - class_divisions (should exist)`);

    console.log(`   🔍 Check teacher assignment in class_teacher_assignments:`);
    console.log(`   SELECT * FROM class_teacher_assignments WHERE teacher_id = 'your-teacher-id' AND is_active = true;`);
}

// Test 7: Debug Teacher Assignment
async function debugTeacherAssignment() {
    console.log('\n🧪 Test 7: Debugging Teacher Assignment');
    console.log('='.repeat(50));

    console.log('To debug teacher assignment issues:');
    console.log('');
    console.log('1. Check if teacher exists in users table:');
    console.log('   SELECT id, full_name, role FROM users WHERE id = \'your-teacher-id\';');
    console.log('');
    console.log('2. Check teacher assignments:');
    console.log('   SELECT * FROM class_teacher_assignments WHERE teacher_id = \'your-teacher-id\';');
    console.log('');
    console.log('3. Check class divisions:');
    console.log('   SELECT * FROM class_divisions WHERE id = \'your-class-division-id\';');
    console.log('');
    console.log('4. Check if teacher is assigned to specific class:');
    console.log('   SELECT * FROM class_teacher_assignments WHERE teacher_id = \'your-teacher-id\' AND class_division_id = \'your-class-division-id\' AND is_active = true;');
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Class Teacher Event Creation Tests');
    console.log('='.repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing - Please update AUTH_TOKEN variable'}`);

    if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
        console.log('\n⚠️  Please update the AUTH_TOKEN variable with a valid teacher token before running tests');
        return;
    }

    try {
        // Run tests in sequence
        await testTeacherAssignment();
        await testCreateClassEvent();
        await testCreateSchoolWideEvent();
        await testCreateTeacherSpecificEvent();
        await testGetClassEvents();
        await testDatabaseTables();
        await debugTeacherAssignment();

        console.log('\n✅ All class teacher event tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showUsageExamples() {
    console.log('\n📖 Class Teacher Event Creation Examples:');
    console.log('='.repeat(50));

    console.log('\n1. Create class-specific event:');
    console.log('POST /api/calendar/events');
    console.log('{');
    console.log('  "title": "Class Test",');
    console.log('  "description": "Class test event",');
    console.log('  "event_date": "2024-02-15T10:00:00Z",');
    console.log('  "event_type": "class_specific",');
    console.log('  "class_division_id": "uuid",');
    console.log('  "event_category": "academic"');
    console.log('}');

    console.log('\n2. Create teacher-specific event:');
    console.log('POST /api/calendar/events');
    console.log('{');
    console.log('  "title": "Teacher Meeting",');
    console.log('  "description": "Personal meeting",');
    console.log('  "event_date": "2024-02-20T14:00:00Z",');
    console.log('  "event_type": "teacher_specific",');
    console.log('  "event_category": "meeting"');
    console.log('}');

    console.log('\n3. Get events for assigned classes:');
    console.log('GET /api/calendar/events/teacher');

    console.log('\n📋 Troubleshooting Steps:');
    console.log('1. Verify teacher is assigned to the class in class_teacher_assignments table');
    console.log('2. Check if class_division_id is correct');
    console.log('3. Ensure teacher has teacher role in users table');
    console.log('4. Verify is_active = true in class_teacher_assignments');
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
    showUsageExamples();
}

module.exports = {
    testTeacherAssignment,
    testCreateClassEvent,
    testCreateSchoolWideEvent,
    testCreateTeacherSpecificEvent,
    testGetClassEvents,
    testDatabaseTables,
    debugTeacherAssignment,
    runAllTests,
    showUsageExamples
};
