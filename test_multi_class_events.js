// Test Multi-Class Events Functionality
// This script demonstrates the new multi-class events system

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';

// Test data
const testEvent = {
    title: "Math & English Quiz Competition",
    description: "Inter-class competition for Math and English classes",
    event_date: "2024-12-20T10:00:00Z",
    event_type: "multi_class_specific",
    class_division_ids: ["uuid-1a", "uuid-2b", "uuid-4d"],
    event_category: "academic"
};

// Helper function to make authenticated requests
async function makeRequest(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
            ...options.headers
        },
        ...options
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        console.log(`\n${options.method || 'GET'} ${endpoint}`);
        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(data, null, 2));

        return { response, data };
    } catch (error) {
        console.error(`Error in ${options.method || 'GET'} ${endpoint}:`, error.message);
        return { response: null, data: null };
    }
}

// Test functions
async function testMultiClassEventCreation() {
    console.log('\n🧪 Testing Multi-Class Event Creation...');

    const { data } = await makeRequest('/calendar/events', {
        method: 'POST',
        body: JSON.stringify(testEvent)
    });

    if (data && data.status === 'success') {
        console.log('✅ Multi-class event created successfully!');
        console.log(`📅 Event ID: ${data.data.event.id}`);
        console.log(`🏫 Classes: ${data.data.class_count}`);
        return data.data.event.id;
    } else {
        console.log('❌ Failed to create multi-class event');
        return null;
    }
}

async function testMultiClassEventFetching() {
    console.log('\n🧪 Testing Multi-Class Event Fetching...');

    const { data } = await makeRequest('/calendar/events');

    if (data && data.status === 'success') {
        const multiClassEvents = data.data.events.filter(event => event.is_multi_class);
        console.log(`✅ Found ${multiClassEvents.length} multi-class events`);

        multiClassEvents.forEach((event, index) => {
            console.log(`\n📅 Event ${index + 1}:`);
            console.log(`   Title: ${event.title}`);
            console.log(`   Type: ${event.event_type}`);
            console.log(`   Classes: ${event.class_division_ids?.length || 0}`);
            if (event.classes) {
                event.classes.forEach(cls => {
                    console.log(`     - ${cls.class_level.name} ${cls.division}`);
                });
            }
        });
    } else {
        console.log('❌ Failed to fetch events');
    }
}

async function testTeacherMultiClassEvents() {
    console.log('\n🧪 Testing Teacher Multi-Class Events...');

    const { data } = await makeRequest('/calendar/events/teacher');

    if (data && data.status === 'success') {
        const multiClassEvents = data.data.events.filter(event => event.is_multi_class);
        console.log(`✅ Teacher can see ${multiClassEvents.length} multi-class events`);

        if (multiClassEvents.length > 0) {
            console.log('\n📋 Multi-class events visible to teacher:');
            multiClassEvents.forEach(event => {
                console.log(`   - ${event.title} (${event.class_division_ids?.length || 0} classes)`);
            });
        }
    } else {
        console.log('❌ Failed to fetch teacher events');
    }
}

async function testParentMultiClassEvents() {
    console.log('\n🧪 Testing Parent Multi-Class Events...');

    const { data } = await makeRequest('/calendar/events/parent');

    if (data && data.status === 'success') {
        const multiClassEvents = data.data.events.filter(event => event.is_multi_class);
        console.log(`✅ Parent can see ${multiClassEvents.length} multi-class events`);

        if (multiClassEvents.length > 0) {
            console.log('\n📋 Multi-class events visible to parent:');
            multiClassEvents.forEach(event => {
                console.log(`   - ${event.title} (${event.class_division_ids?.length || 0} classes)`);
            });
        }
    } else {
        console.log('❌ Failed to fetch parent events');
    }
}

async function testEventUpdate() {
    console.log('\n🧪 Testing Event Update to Multi-Class...');

    // First create a single class event
    const singleClassEvent = {
        title: "Single Class Event",
        description: "This will be converted to multi-class",
        event_date: "2024-12-25T10:00:00Z",
        event_type: "class_specific",
        class_division_id: "uuid-1a",
        event_category: "general"
    };

    const { data: createData } = await makeRequest('/calendar/events', {
        method: 'POST',
        body: JSON.stringify(singleClassEvent)
    });

    if (createData && createData.status === 'success') {
        const eventId = createData.data.event.id;
        console.log(`✅ Single class event created: ${eventId}`);

        // Now update it to multi-class
        const updateData = {
            class_division_ids: ["uuid-1a", "uuid-2b"],
            is_multi_class: true
        };

        const { data: updateResponse } = await makeRequest(`/calendar/events/${eventId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });

        if (updateResponse && updateResponse.status === 'success') {
            console.log('✅ Event successfully updated to multi-class!');
            console.log(`   New class count: ${updateResponse.data.event.class_division_ids?.length || 0}`);
        } else {
            console.log('❌ Failed to update event to multi-class');
        }
    } else {
        console.log('❌ Failed to create single class event for update test');
    }
}

// Main test execution
async function runTests() {
    console.log('🚀 Starting Multi-Class Events Tests...\n');

    try {
        // Test 1: Create multi-class event
        const eventId = await testMultiClassEventCreation();

        if (eventId) {
            // Test 2: Fetch all events (including multi-class)
            await testMultiClassEventFetching();

            // Test 3: Test teacher access to multi-class events
            await testTeacherMultiClassEvents();

            // Test 4: Test parent access to multi-class events
            await testParentMultiClassEvents();

            // Test 5: Test updating event to multi-class
            await testEventUpdate();
        }

        console.log('\n🎉 All tests completed!');

    } catch (error) {
        console.error('\n💥 Test execution failed:', error.message);
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests();
}

export {
    runTests, testEventUpdate, testMultiClassEventCreation,
    testMultiClassEventFetching, testParentMultiClassEvents, testTeacherMultiClassEvents
};

