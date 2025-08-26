const axios = require('axios');

// Test configuration - using the specific teacher and class from the user's issue
const BASE_URL = 'http://localhost:3000/api/calendar';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with Vaishnavi's teacher token
const TEACHER_ID = 'af68c9d4-7825-476f-9f3d-7863339442dd';
const CLASS_DIVISION_ID = 'd5e2c45b-bce9-45c2-bb4e-caa6add083e1';

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

// Test 1: Check Teacher Assignment in Database
async function testTeacherAssignment() {
    console.log('\n🧪 Test 1: Checking Teacher Assignment in Database');
    console.log('='.repeat(60));
    console.log(`Teacher ID: ${TEACHER_ID}`);
    console.log(`Class Division ID: ${CLASS_DIVISION_ID}`);

    // Test the exact query that's failing
    const eventData = {
        title: "Test Event",
        description: "Test event for debugging",
        event_date: "2025-08-01T09:00:00.000Z",
        event_type: "class_specific",
        class_division_id: CLASS_DIVISION_ID,
        is_single_day: true,
        start_time: "09:00:00",
        end_time: "10:00:00",
        event_category: "general",
        timezone: "Asia/Kolkata"
    };

    console.log('\nAttempting to create event with data:');
    console.log(JSON.stringify(eventData, null, 2));

    const response = await makeRequest('POST', `${BASE_URL}/events`, eventData);

    if (response.status === 201) {
        console.log(`✅ Event created successfully!`);
        console.log(`   Event ID: ${response.data.data.event.id}`);
        console.log(`   Status: ${response.data.data.event.status}`);
        return response.data.data.event;
    } else {
        console.log(`❌ Event creation failed`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);

        if (response.data?.message?.includes('assigned classes')) {
            console.log(`   🔍 This confirms the teacher assignment validation is failing`);
        }

        return null;
    }
}

// Test 2: Check Teacher's Assigned Classes
async function testTeacherClasses() {
    console.log('\n🧪 Test 2: Checking Teacher\'s Assigned Classes');
    console.log('='.repeat(60));

    const response = await makeRequest('GET', `${BASE_URL}/events/teacher`);

    if (response.status === 200) {
        const assignedClasses = response.data.data.assigned_classes || [];
        console.log(`✅ Teacher has ${assignedClasses.length} assigned classes`);

        if (assignedClasses.length > 0) {
            console.log(`\n📋 Assigned Classes:`);
            assignedClasses.forEach((assignment, index) => {
                const classInfo = assignment.class_info;
                console.log(`   ${index + 1}. ${classInfo.class_level.name} - ${classInfo.division}`);
                console.log(`      Assignment Type: ${assignment.assignment_type}`);
                console.log(`      Class Division ID: ${assignment.class_division_id}`);
                console.log(`      Is Primary: ${assignment.is_primary}`);
                console.log(`      Subject: ${assignment.subject || 'N/A'}`);
                console.log('');
            });

            // Check if the target class is in the list
            const targetClass = assignedClasses.find(assignment =>
                assignment.class_division_id === CLASS_DIVISION_ID
            );

            if (targetClass) {
                console.log(`✅ Target class ${CLASS_DIVISION_ID} is in assigned classes list`);
                console.log(`   Assignment Type: ${targetClass.assignment_type}`);
                console.log(`   Is Primary: ${targetClass.is_primary}`);
            } else {
                console.log(`❌ Target class ${CLASS_DIVISION_ID} is NOT in assigned classes list`);
                console.log(`   This explains why event creation is failing`);
            }
        } else {
            console.log(`⚠️  Teacher has no assigned classes`);
        }

        return assignedClasses;
    } else {
        console.log(`❌ Failed to get teacher's assigned classes`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Test 3: Direct Database Query Simulation
async function testDirectQuery() {
    console.log('\n🧪 Test 3: Simulating Direct Database Query');
    console.log('='.repeat(60));

    console.log('The failing query should be:');
    console.log(`SELECT * FROM class_teacher_assignments`);
    console.log(`WHERE teacher_id = '${TEACHER_ID}'`);
    console.log(`AND class_division_id = '${CLASS_DIVISION_ID}'`);
    console.log(`AND is_active = true;`);

    console.log('\nExpected result: Should return at least one row');
    console.log('Based on user data, teacher should be assigned as:');
    console.log('- Class Teacher (primary)');
    console.log('- Subject Teacher (English)');

    console.log('\n🔍 Possible issues:');
    console.log('1. Table name mismatch (class_teacher_assignments vs teacher_class_assignments)');
    console.log('2. Column name mismatch');
    console.log('3. Data type mismatch (UUID vs string)');
    console.log('4. is_active field value');
    console.log('5. Query using .single() instead of array check');
}

// Test 4: Check User Profile
async function testUserProfile() {
    console.log('\n🧪 Test 4: Checking User Profile');
    console.log('='.repeat(60));

    // Try to get user profile to verify the teacher ID
    const response = await makeRequest('GET', '/api/users/profile');

    if (response.status === 200) {
        const user = response.data.data;
        console.log(`✅ User profile retrieved`);
        console.log(`   User ID: ${user.id}`);
        console.log(`   Name: ${user.full_name}`);
        console.log(`   Role: ${user.role}`);

        if (user.id !== TEACHER_ID) {
            console.log(`⚠️  User ID mismatch!`);
            console.log(`   Expected: ${TEACHER_ID}`);
            console.log(`   Actual: ${user.id}`);
            console.log(`   This could be causing the assignment lookup to fail`);
        } else {
            console.log(`✅ User ID matches expected teacher ID`);
        }

        return user;
    } else {
        console.log(`❌ Failed to get user profile`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return null;
    }
}

// Test 5: Test Different Event Types
async function testDifferentEventTypes() {
    console.log('\n🧪 Test 5: Testing Different Event Types');
    console.log('='.repeat(60));

    // Test 1: Teacher-specific event (should work)
    console.log('\n📝 Testing Teacher-Specific Event:');
    const teacherEventData = {
        title: "Teacher Meeting",
        description: "Personal teacher meeting",
        event_date: "2025-08-01T14:00:00.000Z",
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
        title: "School Event",
        description: "School-wide event",
        event_date: "2025-08-01T10:00:00.000Z",
        event_type: "school_wide",
        event_category: "general",
        timezone: "Asia/Kolkata"
    };

    const schoolResponse = await makeRequest('POST', `${BASE_URL}/events`, schoolEventData);
    if (schoolResponse.status === 403) {
        console.log(`✅ Correctly prevented school-wide event creation`);
    } else {
        console.log(`❌ Unexpected response for school-wide event: ${schoolResponse.status}`);
    }
}

// Test 6: Debug Query Logic
async function debugQueryLogic() {
    console.log('\n🧪 Test 6: Debugging Query Logic');
    console.log('='.repeat(60));

    console.log('Current validation logic in calendar.js:');
    console.log('1. Query: class_teacher_assignments table');
    console.log('2. Filter: teacher_id = req.user.id');
    console.log('3. Filter: class_division_id = provided class_division_id');
    console.log('4. Filter: is_active = true');
    console.log('5. Check: if teacherAssignments.length > 0');

    console.log('\n🔍 Potential Issues:');
    console.log('1. The query might be using .single() instead of array');
    console.log('2. UUID comparison might be failing');
    console.log('3. is_active field might be false or null');
    console.log('4. Table structure might be different');

    console.log('\n💡 Suggested Fix:');
    console.log('Change the query to use array check instead of .single():');
    console.log('const { data: teacherAssignments, error: assignmentError } = await supabase');
    console.log('  .from(\'class_teacher_assignments\')');
    console.log('  .select(\'*\')');
    console.log('  .eq(\'teacher_id\', req.user.id)');
    console.log('  .eq(\'class_division_id\', class_division_id)');
    console.log('  .eq(\'is_active\', true);');
    console.log('');
    console.log('Then check: if (!assignmentError && teacherAssignments && teacherAssignments.length > 0)');
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Teacher Assignment Debug Tests');
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
        await testUserProfile();
        await testTeacherClasses();
        await testTeacherAssignment();
        await testDifferentEventTypes();
        await testDirectQuery();
        await debugQueryLogic();

        console.log('\n✅ All debug tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showUsageExamples() {
    console.log('\n📖 Debug Information:');
    console.log('='.repeat(60));

    console.log('\n🔍 To debug this issue:');
    console.log('1. Update AUTH_TOKEN with Vaishnavi\'s actual token');
    console.log('2. Run this script to see detailed debug information');
    console.log('3. Check the database directly to verify teacher assignment');
    console.log('4. Verify the table structure and data types');

    console.log('\n📋 Expected Database Query:');
    console.log(`SELECT * FROM class_teacher_assignments`);
    console.log(`WHERE teacher_id = '${TEACHER_ID}'`);
    console.log(`AND class_division_id = '${CLASS_DIVISION_ID}'`);
    console.log(`AND is_active = true;`);

    console.log('\n📋 Expected Result:');
    console.log('Should return at least 2 rows:');
    console.log('- One for class_teacher assignment (is_primary = true)');
    console.log('- One for subject_teacher assignment (English)');
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
    showUsageExamples();
}

module.exports = {
    testTeacherAssignment,
    testTeacherClasses,
    testDirectQuery,
    testUserProfile,
    testDifferentEventTypes,
    debugQueryLogic,
    runAllTests,
    showUsageExamples
};
