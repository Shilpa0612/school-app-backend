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

// Test 1: Check if class division exists
async function testClassDivisionExists() {
    console.log('\n🧪 Test 1: Checking if Class Division Exists');
    console.log('='.repeat(60));
    console.log(`Class Division ID: ${CLASS_DIVISION_ID}`);

    // Try to get class division details
    const response = await makeRequest('GET', `/api/academic/class-divisions/${CLASS_DIVISION_ID}`);

    if (response.status === 200) {
        const classDivision = response.data.data.class_division;
        console.log(`✅ Class division found!`);
        console.log(`   ID: ${classDivision.id}`);
        console.log(`   Division: ${classDivision.division}`);
        console.log(`   Class Level: ${classDivision.class_level.name}`);
        console.log(`   Academic Year: ${classDivision.academic_year.year_name}`);
        console.log(`   Teacher: ${classDivision.teacher?.full_name || 'Not assigned'}`);
        return classDivision;
    } else {
        console.log(`❌ Class division not found`);
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
        title: "Test Class Event",
        description: "Testing class-specific event creation",
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

        if (response.data?.message?.includes('Invalid class_division_id')) {
            console.log(`   🔍 This confirms the class division validation is failing`);
        }

        return null;
    }
}

// Test 3: Test school-wide event creation
async function testSchoolWideEvent() {
    console.log('\n🧪 Test 3: Testing School-Wide Event Creation');
    console.log('='.repeat(60));

    const eventData = {
        title: "Test School Event",
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

// Test 4: Test teacher-specific event creation
async function testTeacherSpecificEvent() {
    console.log('\n🧪 Test 4: Testing Teacher-Specific Event Creation');
    console.log('='.repeat(60));

    const eventData = {
        title: "Test Teacher Event",
        description: "Testing teacher-specific event creation",
        event_date: "2025-08-03T11:00:00.000Z",
        event_type: "teacher_specific",
        is_single_day: true,
        start_time: "11:00:00",
        end_time: "12:00:00",
        event_category: "test",
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

// Test 5: List all class divisions
async function testListClassDivisions() {
    console.log('\n🧪 Test 5: Listing All Class Divisions');
    console.log('='.repeat(60));

    const response = await makeRequest('GET', '/api/academic/class-divisions');

    if (response.status === 200) {
        const classDivisions = response.data.data.class_divisions || [];
        console.log(`✅ Found ${classDivisions.length} class divisions`);

        // Find the target class division
        const targetClass = classDivisions.find(cd => cd.id === CLASS_DIVISION_ID);

        if (targetClass) {
            console.log(`✅ Target class division found in list:`);
            console.log(`   ID: ${targetClass.id}`);
            console.log(`   Division: ${targetClass.division}`);
            console.log(`   Class Level: ${targetClass.class_level.name}`);
            console.log(`   Academic Year: ${targetClass.academic_year.year_name}`);
        } else {
            console.log(`❌ Target class division NOT found in list`);
            console.log(`   Looking for: ${CLASS_DIVISION_ID}`);

            // Show first few class divisions for reference
            if (classDivisions.length > 0) {
                console.log(`\n📋 First few class divisions:`);
                classDivisions.slice(0, 5).forEach((cd, index) => {
                    console.log(`   ${index + 1}. ${cd.id} - ${cd.class_level.name} ${cd.division}`);
                });
            }
        }

        return classDivisions;
    } else {
        console.log(`❌ Failed to get class divisions`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Class Division Validation Tests');
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
        await testClassDivisionExists();
        await testListClassDivisions();
        await testClassSpecificEvent();
        await testSchoolWideEvent();
        await testTeacherSpecificEvent();

        console.log('\n✅ All class division validation tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showUsageExamples() {
    console.log('\n📖 Class Division Validation Summary:');
    console.log('='.repeat(60));

    console.log('\n🔍 What we\'re testing:');
    console.log('   - Whether the class division ID exists in the database');
    console.log('   - Whether the class division can be accessed via API');
    console.log('   - Whether event creation works for all event types');
    console.log('   - Whether the validation logic is working correctly');

    console.log('\n📋 Expected Results:');
    console.log('   - Class division should exist and be accessible');
    console.log('   - All event types should be creatable');
    console.log('   - Events should be created with pending status');
    console.log('   - No assignment validation should be required');

    console.log('\n🔧 If tests fail:');
    console.log('   - Check if the class division ID is correct');
    console.log('   - Verify the database has the class division data');
    console.log('   - Check if there are permission issues');
    console.log('   - Look at server logs for detailed error messages');
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
    showUsageExamples();
}

module.exports = {
    testClassDivisionExists,
    testClassSpecificEvent,
    testSchoolWideEvent,
    testTeacherSpecificEvent,
    testListClassDivisions,
    runAllTests,
    showUsageExamples
};
