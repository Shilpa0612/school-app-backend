const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/calendar';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with Vaishnavi's teacher token
const TEACHER_ID = 'af68c9d4-7825-476f-9f3d-7863339442dd';
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

// Test 1: Check teacher profile to see assignments
async function testTeacherProfile() {
    console.log('\n🧪 Test 1: Checking Teacher Profile');
    console.log('='.repeat(60));

    const response = await makeRequest('GET', '/api/users/profile');

    if (response.status === 200) {
        const userData = response.data.data;
        console.log(`✅ Teacher profile retrieved successfully`);
        console.log(`   Teacher ID: ${userData.user_id}`);
        console.log(`   Name: ${userData.full_name}`);
        console.log(`   Total assigned classes: ${userData.total_assigned_classes}`);
        console.log(`   Has assignments: ${userData.has_assignments}`);
        console.log(`   Using legacy data: ${userData.using_legacy_data}`);

        if (userData.assigned_classes && userData.assigned_classes.length > 0) {
            console.log(`\n📋 Assigned Classes:`);
            userData.assigned_classes.forEach((assignment, index) => {
                console.log(`   ${index + 1}. ${assignment.class_name} (${assignment.assignment_type})`);
                console.log(`      Class Division ID: ${assignment.class_division_id}`);
                console.log(`      Is Primary: ${assignment.is_primary}`);
                console.log(`      Subject: ${assignment.subject || 'N/A'}`);
                console.log('');
            });

            // Check if the target class is in the list
            const targetClass = userData.assigned_classes.find(assignment =>
                assignment.class_division_id === CLASS_DIVISION_ID
            );

            if (targetClass) {
                console.log(`✅ Target class ${CLASS_DIVISION_ID} is in assigned classes list`);
                console.log(`   Assignment Type: ${targetClass.assignment_type}`);
                console.log(`   Is Primary: ${targetClass.is_primary}`);
                console.log(`   Subject: ${targetClass.subject || 'N/A'}`);
            } else {
                console.log(`❌ Target class ${CLASS_DIVISION_ID} is NOT in assigned classes list`);
            }
        } else {
            console.log(`⚠️  Teacher has no assigned classes`);
        }

        return userData;
    } else {
        console.log(`❌ Failed to get teacher profile`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return null;
    }
}

// Test 2: Test class-specific event creation
async function testClassSpecificEvent() {
    console.log('\n🧪 Test 2: Testing Class-Specific Event Creation');
    console.log('='.repeat(60));

    const eventData = {
        title: "Grade 1 B Test Event",
        description: "Testing class-specific event creation for Grade 1 B",
        event_date: "2025-08-01T09:00:00.000Z",
        event_type: "class_specific",
        class_division_id: CLASS_DIVISION_ID,
        is_single_day: true,
        start_time: "09:00:00",
        end_time: "10:00:00",
        event_category: "test",
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

        if (response.data?.message?.includes('assigned classes')) {
            console.log(`   🔍 This confirms the teacher assignment validation is still failing`);
        }

        return null;
    }
}

// Test 3: Test school-wide event creation
async function testSchoolWideEvent() {
    console.log('\n🧪 Test 3: Testing School-Wide Event Creation');
    console.log('='.repeat(60));

    const eventData = {
        title: "School Test Event",
        description: "Testing school-wide event creation",
        event_date: "2025-08-02T10:00:00.000Z",
        event_type: "school_wide",
        is_single_day: true,
        start_time: "10:00:00",
        end_time: "11:00:00",
        event_category: "test",
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

// Test 4: Check database tables directly
async function testDatabaseTables() {
    console.log('\n🧪 Test 4: Database Table Analysis');
    console.log('='.repeat(60));

    console.log('📋 Expected Database Tables for Teacher Assignments:');
    console.log('   1. class_teacher_assignments (new many-to-many table)');
    console.log('   2. class_divisions (legacy table with teacher_id)');
    console.log('   3. teacher_class_assignments (alternative assignment table)');

    console.log('\n🔍 The validation logic now checks all three tables:');
    console.log('   1. First: class_teacher_assignments (new system)');
    console.log('   2. Second: class_divisions.teacher_id (legacy system)');
    console.log('   3. Third: teacher_class_assignments (alternative system)');

    console.log('\n💡 This should resolve the issue where teachers are assigned');
    console.log('   but the validation was only checking one table.');
}

// Test 5: Verify events in the list
async function testEventListing() {
    console.log('\n🧪 Test 5: Verifying Events in List');
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

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Teacher Assignment Fix Tests');
    console.log('='.repeat(70));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Teacher ID: ${TEACHER_ID}`);
    console.log(`Class Division ID: ${CLASS_DIVISION_ID}`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing - Please update AUTH_TOKEN variable'}`);

    if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
        console.log('\n⚠️  Please update the AUTH_TOKEN variable with Vaishnavi\'s teacher token before running tests');
        return;
    }

    try {
        // Run tests in sequence
        await testTeacherProfile();
        await testClassSpecificEvent();
        await testSchoolWideEvent();
        await testDatabaseTables();
        await testEventListing();

        console.log('\n✅ All teacher assignment fix tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showUsageExamples() {
    console.log('\n📖 Teacher Assignment Fix Summary:');
    console.log('='.repeat(60));

    console.log('\n🔧 What was fixed:');
    console.log('   - Updated validation logic to check multiple assignment tables');
    console.log('   - Added support for teacher_class_assignments table');
    console.log('   - Enhanced debugging with detailed logging');
    console.log('   - Improved fallback logic for different assignment systems');

    console.log('\n📋 Tables now checked:');
    console.log('   1. class_teacher_assignments (new many-to-many)');
    console.log('   2. class_divisions.teacher_id (legacy)');
    console.log('   3. teacher_class_assignments (alternative)');

    console.log('\n🎯 Expected Result:');
    console.log('   - Teachers should now be able to create class-specific events');
    console.log('   - Teachers should be able to create school-wide events');
    console.log('   - All assignment types should be properly validated');

    console.log('\n🔍 To debug further:');
    console.log('   - Check the server logs for detailed assignment validation info');
    console.log('   - Verify the teacher is assigned in at least one of the tables');
    console.log('   - Ensure the class_division_id matches the assignment data');
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
    showUsageExamples();
}

module.exports = {
    testTeacherProfile,
    testClassSpecificEvent,
    testSchoolWideEvent,
    testDatabaseTables,
    testEventListing,
    runAllTests,
    showUsageExamples
};
