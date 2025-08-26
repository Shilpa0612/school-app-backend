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

// Test 1: Check Main Events Endpoint for Teachers
async function testMainEventsEndpoint() {
    console.log('\n🧪 Test 1: Checking Main Events Endpoint for Teachers');
    console.log('='.repeat(60));

    const response = await makeRequest('GET', `${BASE_URL}/events`);

    if (response.status === 200) {
        const events = response.data.data.events || [];
        console.log(`✅ Main events endpoint accessible for teachers`);
        console.log(`   Total events found: ${events.length}`);

        // Categorize events
        const schoolWideEvents = events.filter(event => event.event_type === 'school_wide');
        const classSpecificEvents = events.filter(event => event.event_type === 'class_specific');
        const teacherSpecificEvents = events.filter(event => event.event_type === 'teacher_specific');

        console.log(`   School-wide events: ${schoolWideEvents.length}`);
        console.log(`   Class-specific events: ${classSpecificEvents.length}`);
        console.log(`   Teacher-specific events: ${teacherSpecificEvents.length}`);

        // Show sample school-wide events
        if (schoolWideEvents.length > 0) {
            console.log(`\n   📋 Sample School-wide Events:`);
            schoolWideEvents.slice(0, 3).forEach((event, index) => {
                console.log(`   ${index + 1}. ${event.title} - ${event.event_date} (${event.status})`);
            });
        } else {
            console.log(`   ⚠️  No school-wide events found`);
        }

        return events;
    } else {
        console.log(`❌ Failed to access main events endpoint`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Test 2: Compare with Teacher-Specific Endpoint
async function testTeacherSpecificEndpoint() {
    console.log('\n🧪 Test 2: Comparing with Teacher-Specific Endpoint');
    console.log('='.repeat(60));

    const response = await makeRequest('GET', `${BASE_URL}/events/teacher`);

    if (response.status === 200) {
        const events = response.data.data.events || [];
        const assignedClasses = response.data.data.assigned_classes || [];

        console.log(`✅ Teacher-specific endpoint accessible`);
        console.log(`   Total events found: ${events.length}`);
        console.log(`   Assigned classes: ${assignedClasses.length}`);

        // Categorize events
        const schoolWideEvents = events.filter(event => event.event_type === 'school_wide');
        const classSpecificEvents = events.filter(event => event.event_type === 'class_specific');
        const teacherSpecificEvents = events.filter(event => event.event_type === 'teacher_specific');

        console.log(`   School-wide events: ${schoolWideEvents.length}`);
        console.log(`   Class-specific events: ${classSpecificEvents.length}`);
        console.log(`   Teacher-specific events: ${teacherSpecificEvents.length}`);

        // Show assigned classes
        if (assignedClasses.length > 0) {
            console.log(`\n   📋 Assigned Classes:`);
            assignedClasses.forEach((assignment, index) => {
                const classInfo = assignment.class_info;
                console.log(`   ${index + 1}. ${classInfo.class_level.name} - ${classInfo.division} (${assignment.assignment_type})`);
            });
        }

        return events;
    } else {
        console.log(`❌ Failed to access teacher-specific endpoint`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Test 3: Filter by School-Wide Events Only
async function testSchoolWideFilter() {
    console.log('\n🧪 Test 3: Filtering School-Wide Events Only');
    console.log('='.repeat(60));

    const response = await makeRequest('GET', `${BASE_URL}/events?event_type=school_wide`);

    if (response.status === 200) {
        const events = response.data.data.events || [];
        console.log(`✅ School-wide events filter working`);
        console.log(`   School-wide events found: ${events.length}`);

        if (events.length > 0) {
            console.log(`\n   📋 All School-wide Events:`);
            events.forEach((event, index) => {
                console.log(`   ${index + 1}. ${event.title}`);
                console.log(`      Date: ${event.event_date}`);
                console.log(`      Status: ${event.status}`);
                console.log(`      Category: ${event.event_category}`);
                console.log(`      Creator: ${event.creator?.full_name || 'Unknown'}`);
                console.log('');
            });
        } else {
            console.log(`   ⚠️  No school-wide events found in the system`);
        }

        return events;
    } else {
        console.log(`❌ Failed to filter school-wide events`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Test 4: Test Date Range Filtering
async function testDateRangeFilter() {
    console.log('\n🧪 Test 4: Testing Date Range Filtering');
    console.log('='.repeat(60));

    // Get events for the next 30 days
    const startDate = new Date().toISOString();
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const response = await makeRequest('GET', `${BASE_URL}/events?start_date=${startDate}&end_date=${endDate}`);

    if (response.status === 200) {
        const events = response.data.data.events || [];
        console.log(`✅ Date range filtering working`);
        console.log(`   Events in next 30 days: ${events.length}`);

        const schoolWideEvents = events.filter(event => event.event_type === 'school_wide');
        console.log(`   School-wide events in range: ${schoolWideEvents.length}`);

        if (schoolWideEvents.length > 0) {
            console.log(`\n   📋 Upcoming School-wide Events:`);
            schoolWideEvents.forEach((event, index) => {
                console.log(`   ${index + 1}. ${event.title} - ${event.event_date}`);
            });
        }

        return events;
    } else {
        console.log(`❌ Failed to filter by date range`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Test 5: Test Event Status Filtering
async function testStatusFiltering() {
    console.log('\n🧪 Test 5: Testing Event Status Filtering');
    console.log('='.repeat(60));

    // Test approved events
    const approvedResponse = await makeRequest('GET', `${BASE_URL}/events?status=approved`);

    if (approvedResponse.status === 200) {
        const approvedEvents = approvedResponse.data.data.events || [];
        const approvedSchoolWide = approvedEvents.filter(event => event.event_type === 'school_wide');

        console.log(`✅ Status filtering working`);
        console.log(`   Approved events: ${approvedEvents.length}`);
        console.log(`   Approved school-wide events: ${approvedSchoolWide.length}`);

        // Test all events (for admin/principal)
        const allResponse = await makeRequest('GET', `${BASE_URL}/events?status=all`);
        if (allResponse.status === 200) {
            const allEvents = allResponse.data.data.events || [];
            const allSchoolWide = allEvents.filter(event => event.event_type === 'school_wide');

            console.log(`   All events (if admin/principal): ${allEvents.length}`);
            console.log(`   All school-wide events: ${allSchoolWide.length}`);
        }

        return approvedEvents;
    } else {
        console.log(`❌ Failed to filter by status`);
        console.log(`   Status: ${approvedResponse.status}`);
        console.log(`   Error: ${approvedResponse.data?.message || 'Unknown error'}`);
        return [];
    }
}

// Test 6: Compare Event Access Between Endpoints
async function compareEventAccess() {
    console.log('\n🧪 Test 6: Comparing Event Access Between Endpoints');
    console.log('='.repeat(60));

    // Get events from main endpoint
    const mainResponse = await makeRequest('GET', `${BASE_URL}/events`);
    const mainEvents = mainResponse.status === 200 ? mainResponse.data.data.events || [] : [];

    // Get events from teacher endpoint
    const teacherResponse = await makeRequest('GET', `${BASE_URL}/events/teacher`);
    const teacherEvents = teacherResponse.status === 200 ? teacherResponse.data.data.events || [] : [];

    console.log(`📊 Event Access Comparison:`);
    console.log(`   Main endpoint events: ${mainEvents.length}`);
    console.log(`   Teacher endpoint events: ${teacherEvents.length}`);

    // Compare school-wide events
    const mainSchoolWide = mainEvents.filter(event => event.event_type === 'school_wide');
    const teacherSchoolWide = teacherEvents.filter(event => event.event_type === 'school_wide');

    console.log(`   Main endpoint school-wide: ${mainSchoolWide.length}`);
    console.log(`   Teacher endpoint school-wide: ${teacherSchoolWide.length}`);

    // Check if school-wide events are accessible in both endpoints
    if (mainSchoolWide.length > 0 && teacherSchoolWide.length > 0) {
        console.log(`✅ School-wide events accessible in both endpoints`);

        // Compare specific events
        const mainIds = mainSchoolWide.map(event => event.id).sort();
        const teacherIds = teacherSchoolWide.map(event => event.id).sort();

        if (JSON.stringify(mainIds) === JSON.stringify(teacherIds)) {
            console.log(`✅ Same school-wide events in both endpoints`);
        } else {
            console.log(`⚠️  Different school-wide events between endpoints`);
        }
    } else if (mainSchoolWide.length > 0) {
        console.log(`✅ School-wide events accessible in main endpoint only`);
    } else if (teacherSchoolWide.length > 0) {
        console.log(`✅ School-wide events accessible in teacher endpoint only`);
    } else {
        console.log(`⚠️  No school-wide events found in either endpoint`);
    }
}

// Test 7: Test Event Creation and Access
async function testEventCreationAndAccess() {
    console.log('\n🧪 Test 7: Testing Event Creation and Access');
    console.log('='.repeat(60));

    // First, check if teacher can create teacher-specific events
    const eventData = {
        title: 'Teacher Test Event',
        description: 'Test event to verify access',
        event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        event_type: 'teacher_specific',
        event_category: 'meeting',
        timezone: 'Asia/Kolkata'
    };

    console.log('Creating teacher-specific test event...');
    const createResponse = await makeRequest('POST', `${BASE_URL}/events`, eventData);

    if (createResponse.status === 201) {
        const createdEvent = createResponse.data.data.event;
        console.log(`✅ Teacher-specific event created successfully`);
        console.log(`   Event ID: ${createdEvent.id}`);
        console.log(`   Status: ${createdEvent.status}`);

        // Now check if it appears in the events list
        const listResponse = await makeRequest('GET', `${BASE_URL}/events`);
        if (listResponse.status === 200) {
            const events = listResponse.data.data.events || [];
            const foundEvent = events.find(event => event.id === createdEvent.id);

            if (foundEvent) {
                console.log(`✅ Created event appears in main events list`);
            } else {
                console.log(`⚠️  Created event not found in main events list`);
            }
        }

        return createdEvent;
    } else {
        console.log(`❌ Failed to create teacher-specific event`);
        console.log(`   Status: ${createResponse.status}`);
        console.log(`   Error: ${createResponse.data?.message || 'Unknown error'}`);
        return null;
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Teacher School-Wide Events Access Tests');
    console.log('='.repeat(70));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing - Please update AUTH_TOKEN variable'}`);

    if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
        console.log('\n⚠️  Please update the AUTH_TOKEN variable with a valid teacher token before running tests');
        return;
    }

    try {
        // Run tests in sequence
        await testMainEventsEndpoint();
        await testTeacherSpecificEndpoint();
        await testSchoolWideFilter();
        await testDateRangeFilter();
        await testStatusFiltering();
        await compareEventAccess();
        await testEventCreationAndAccess();

        console.log('\n✅ All teacher school-wide events tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showUsageExamples() {
    console.log('\n📖 Teacher School-Wide Events Access Examples:');
    console.log('='.repeat(60));

    console.log('\n1. Get all events (including school-wide for teachers):');
    console.log('GET /api/calendar/events');

    console.log('\n2. Get only school-wide events:');
    console.log('GET /api/calendar/events?event_type=school_wide');

    console.log('\n3. Get events with date range:');
    console.log('GET /api/calendar/events?start_date=2024-01-01T00:00:00Z&end_date=2024-12-31T23:59:59Z');

    console.log('\n4. Get teacher-specific events:');
    console.log('GET /api/calendar/events/teacher');

    console.log('\n5. Create teacher-specific event:');
    console.log('POST /api/calendar/events');
    console.log('{');
    console.log('  "title": "Teacher Meeting",');
    console.log('  "description": "Personal meeting",');
    console.log('  "event_date": "2024-02-20T14:00:00Z",');
    console.log('  "event_type": "teacher_specific",');
    console.log('  "event_category": "meeting"');
    console.log('}');

    console.log('\n📋 Expected Behavior:');
    console.log('- Teachers should see school-wide events in main /events endpoint');
    console.log('- Teachers should see events for their assigned classes');
    console.log('- Teachers should see their own teacher-specific events');
    console.log('- Teachers should see approved events + their own pending events');
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
    showUsageExamples();
}

module.exports = {
    testMainEventsEndpoint,
    testTeacherSpecificEndpoint,
    testSchoolWideFilter,
    testDateRangeFilter,
    testStatusFiltering,
    compareEventAccess,
    testEventCreationAndAccess,
    runAllTests,
    showUsageExamples
};
