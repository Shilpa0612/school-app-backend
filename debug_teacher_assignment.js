const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/calendar';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual teacher token
const CLASS_DIVISION_ID = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1'; // The class from the error

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

// Test 1: Check Teacher Assignment for Specific Class
async function testTeacherAssignment() {
    console.log('\n🧪 Test 1: Checking Teacher Assignment for Specific Class');
    console.log('='.repeat(70));
    console.log(`Class Division ID: ${CLASS_DIVISION_ID}`);

    const eventData = {
        title: "ABC",
        description: "ABCD",
        event_date: "2025-08-01T09:00:00.000Z",
        class_division_id: CLASS_DIVISION_ID,
        end_time: "10:00:00",
        event_category: "general",
        event_type: "class_specific",
        is_single_day: true,
        start_time: "09:00:00",
        timezone: "Asia/Kolkata"
    };

    console.log('Attempting to create class-specific event...');
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
            console.log(`   🔍 This confirms the teacher assignment check is failing`);
        }

        return null;
    }
}

// Test 2: Check Teacher's Assigned Classes
async function checkTeacherAssignments() {
    console.log('\n🧪 Test 2: Checking Teacher\'s Assigned Classes');
    console.log('='.repeat(70));

    const response = await makeRequest('GET', `${BASE_URL}/events/teacher`);

    if (response.status === 200) {
        const assignedClasses = response.data.data.assigned_classes || [];
        console.log(`✅ Teacher assignments retrieved`);
        console.log(`   Total assigned classes: ${assignedClasses.length}`);

        if (assignedClasses.length > 0) {
            console.log(`\n   📋 Assigned Classes:`);
            assignedClasses.forEach((assignment, index) => {
                const classInfo = assignment.class_info;
                console.log(`   ${index + 1}. Class ID: ${assignment.class_division_id}`);
                console.log(`      Class: ${classInfo.class_level.name} - ${classInfo.division}`);
                console.log(`      Assignment Type: ${assignment.assignment_type}`);
                console.log(`      Subject: ${assignment.subject || 'N/A'}`);
                console.log(`      Is Primary: ${assignment.is_primary}`);
                console.log('');
            });

            // Check if the specific class is in the list
            const targetClass = assignedClasses.find(assignment =>
                assignment.class_division_id === CLASS_DIVISION_ID
            );

            if (targetClass) {
                console.log(`✅ Target class found in teacher assignments!`);
                console.log(`   Class: ${targetClass.class_info.class_level.name} - ${targetClass.class_info.division}`);
                console.log(`   Assignment Type: ${targetClass.assignment_type}`);
            } else {
                console.log(`❌ Target class NOT found in teacher assignments`);
                console.log(`   Expected Class ID: ${CLASS_DIVISION_ID}`);
                console.log(`   Available Class IDs: ${assignedClasses.map(a => a.class_division_id).join(', ')}`);
            }
        } else {
            console.log(`⚠️  Teacher has no assigned classes`);
        }

        return assignedClasses;
    } else {
        console.log(`❌ Failed to get teacher assignments`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Test 3: Check Class Division Exists
async function checkClassDivision() {
    console.log('\n🧪 Test 3: Checking if Class Division Exists');
    console.log('='.repeat(70));

    // This would require a database query, but we can infer from the error
    console.log(`🔍 Class Division ID: ${CLASS_DIVISION_ID}`);
    console.log(`   This appears to be a valid UUID format`);
    console.log(`   The error suggests the class exists but teacher is not assigned`);

    console.log(`\n📋 Database Queries to Run:`);
    console.log(`1. Check if class division exists:`);
    console.log(`   SELECT * FROM class_divisions WHERE id = '${CLASS_DIVISION_ID}';`);

    console.log(`\n2. Check teacher assignments for this class:`);
    console.log(`   SELECT * FROM class_teacher_assignments WHERE class_division_id = '${CLASS_DIVISION_ID}' AND is_active = true;`);

    console.log(`\n3. Check if teacher is assigned to this class:`);
    console.log(`   SELECT * FROM class_teacher_assignments WHERE teacher_id = 'YOUR_TEACHER_ID' AND class_division_id = '${CLASS_DIVISION_ID}' AND is_active = true;`);

    console.log(`\n4. Check legacy assignment (if any):`);
    console.log(`   SELECT * FROM class_divisions WHERE id = '${CLASS_DIVISION_ID}' AND teacher_id = 'YOUR_TEACHER_ID';`);
}

// Test 4: Test Different Event Types
async function testDifferentEventTypes() {
    console.log('\n🧪 Test 4: Testing Different Event Types');
    console.log('='.repeat(70));

    // Test 1: Teacher-specific event (should work)
    console.log('\n📝 Testing Teacher-Specific Event:');
    const teacherEventData = {
        title: "Teacher Test Event",
        description: "Test teacher-specific event",
        event_date: "2025-08-01T10:00:00.000Z",
        event_type: "teacher_specific",
        event_category: "meeting",
        timezone: "Asia/Kolkata"
    };

    const teacherResponse = await makeRequest('POST', `${BASE_URL}/events`, teacherEventData);

    if (teacherResponse.status === 201) {
        console.log(`✅ Teacher-specific event created successfully`);
    } else {
        console.log(`❌ Teacher-specific event failed: ${teacherResponse.data?.message}`);
    }

    // Test 2: School-wide event (should fail for teachers)
    console.log('\n📝 Testing School-Wide Event:');
    const schoolEventData = {
        title: "School Test Event",
        description: "Test school-wide event",
        event_date: "2025-08-01T11:00:00.000Z",
        event_type: "school_wide",
        event_category: "general",
        timezone: "Asia/Kolkata"
    };

    const schoolResponse = await makeRequest('POST', `${BASE_URL}/events`, schoolEventData);

    if (schoolResponse.status === 403) {
        console.log(`✅ School-wide event correctly rejected (expected)`);
    } else {
        console.log(`❌ Unexpected response for school-wide event: ${schoolResponse.status}`);
    }
}

// Test 5: Debug Database State
async function debugDatabaseState() {
    console.log('\n🧪 Test 5: Debugging Database State');
    console.log('='.repeat(70));

    console.log(`🔍 Possible Issues:`);
    console.log(`1. Teacher assignment might be inactive (is_active = false)`);
    console.log(`2. Teacher assignment might not exist for this class`);
    console.log(`3. Class division might not exist`);
    console.log(`4. Teacher ID might be incorrect`);
    console.log(`5. Database connection issues`);

    console.log(`\n📋 Debugging Steps:`);
    console.log(`1. Verify teacher token is valid and belongs to a teacher`);
    console.log(`2. Check if teacher is actually assigned to the class`);
    console.log(`3. Verify the class_division_id is correct`);
    console.log(`4. Check if the assignment is active`);

    console.log(`\n🔧 SQL Queries to Debug:`);
    console.log(`-- Check teacher assignments:`);
    console.log(`SELECT cta.*, cd.division, cl.name as class_level`);
    console.log(`FROM class_teacher_assignments cta`);
    console.log(`JOIN class_divisions cd ON cta.class_division_id = cd.id`);
    console.log(`JOIN class_levels cl ON cd.class_level_id = cl.id`);
    console.log(`WHERE cta.teacher_id = 'YOUR_TEACHER_ID' AND cta.is_active = true;`);

    console.log(`\n-- Check specific class assignment:`);
    console.log(`SELECT * FROM class_teacher_assignments`);
    console.log(`WHERE teacher_id = 'YOUR_TEACHER_ID'`);
    console.log(`AND class_division_id = '${CLASS_DIVISION_ID}'`);
    console.log(`AND is_active = true;`);
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Teacher Assignment Debug Tests');
    console.log('='.repeat(80));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing - Please update AUTH_TOKEN variable'}`);
    console.log(`Class Division ID: ${CLASS_DIVISION_ID}`);

    if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
        console.log('\n⚠️  Please update the AUTH_TOKEN variable with a valid teacher token before running tests');
        return;
    }

    try {
        // Run tests in sequence
        await testTeacherAssignment();
        await checkTeacherAssignments();
        await checkClassDivision();
        await testDifferentEventTypes();
        await debugDatabaseState();

        console.log('\n✅ All teacher assignment debug tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showUsageExamples() {
    console.log('\n📖 Teacher Assignment Debug Examples:');
    console.log('='.repeat(60));

    console.log('\n1. Check teacher assignments:');
    console.log('GET /api/calendar/events/teacher');

    console.log('\n2. Create teacher-specific event (should work):');
    console.log('POST /api/calendar/events');
    console.log('{');
    console.log('  "title": "Teacher Meeting",');
    console.log('  "description": "Personal meeting",');
    console.log('  "event_date": "2025-08-01T14:00:00Z",');
    console.log('  "event_type": "teacher_specific",');
    console.log('  "event_category": "meeting"');
    console.log('}');

    console.log('\n3. Create class-specific event (failing):');
    console.log('POST /api/calendar/events');
    console.log('{');
    console.log('  "title": "ABC",');
    console.log('  "description": "ABCD",');
    console.log('  "event_date": "2025-08-01T09:00:00.000Z",');
    console.log('  "class_division_id": "d5e2c45b-bce9-45c2-bb4e-caa6add083e1",');
    console.log('  "event_type": "class_specific",');
    console.log('  "event_category": "general"');
    console.log('}');

    console.log('\n📋 Troubleshooting Steps:');
    console.log('1. Verify teacher is assigned to the class in class_teacher_assignments table');
    console.log('2. Check if assignment is_active = true');
    console.log('3. Verify class_division_id is correct');
    console.log('4. Ensure teacher has teacher role in users table');
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
    showUsageExamples();
}

module.exports = {
    testTeacherAssignment,
    checkTeacherAssignments,
    checkClassDivision,
    testDifferentEventTypes,
    debugDatabaseState,
    runAllTests,
    showUsageExamples
};
