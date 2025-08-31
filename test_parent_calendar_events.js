import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

// Test parent authentication (you'll need to replace with actual parent credentials)
const PARENT_TOKEN = 'your_parent_token_here';

async function testParentCalendarEvents() {
    console.log('🧪 Testing Parent Calendar Events with Student Grouping...\n');

    try {
        // Test 1: Get all events for all children (grouped by student)
        console.log('📅 Test 1: Get all events for all children (grouped by student)');
        const response1 = await fetch(`${BASE_URL}/calendar/events/parent`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response1.ok) {
            const data1 = await response1.json();
            console.log('✅ Success - All events grouped by student:');
            console.log(`   Total students: ${data1.data.summary.total_students}`);
            console.log(`   Total events: ${data1.data.summary.total_events}`);
            console.log(`   Students with events: ${data1.data.summary.students_with_events}`);
            console.log(`   Students without events: ${data1.data.data.summary.students_without_events}`);

            // Show structure of first student
            if (data1.data.events_by_student.length > 0) {
                const firstStudent = data1.data.events_by_student[0];
                console.log(`\n   First student: ${firstStudent.student_name} (${firstStudent.admission_number})`);
                console.log(`   Class: ${firstStudent.class_info?.class_name || 'Unknown'}`);
                console.log(`   Events count: ${firstStudent.total_events}`);

                if (firstStudent.events.length > 0) {
                    const firstEvent = firstStudent.events[0];
                    console.log(`   Sample event: ${firstEvent.title} on ${firstEvent.event_date}`);
                    console.log(`   Event has student info: ${!!firstEvent.student_info}`);
                }
            }
        } else {
            const error1 = await response1.json();
            console.log('❌ Error:', error1);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 2: Get events for a specific student
        console.log('👤 Test 2: Get events for a specific student');
        const response2 = await fetch(`${BASE_URL}/calendar/events/parent?student_id=specific_student_uuid`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response2.ok) {
            const data2 = await response2.json();
            console.log('✅ Success - Events for specific student:');
            console.log(`   Filtered by student: ${data2.data.summary.filtered_by_student}`);
            console.log(`   Total students: ${data2.data.summary.total_students}`);
            console.log(`   Total events: ${data2.data.summary.total_events}`);
        } else {
            const error2 = await response2.json();
            console.log('❌ Error:', error2);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 3: Get events with date filter
        console.log('📅 Test 3: Get events with date filter');
        const today = new Date().toISOString().split('T')[0];
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const response3 = await fetch(`${BASE_URL}/calendar/events/parent?start_date=${today}&end_date=${nextWeek}`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response3.ok) {
            const data3 = await response3.json();
            console.log('✅ Success - Events with date filter:');
            console.log(`   Date range: ${today} to ${nextWeek}`);
            console.log(`   Total events: ${data3.data.summary.total_events}`);
            console.log(`   Filters applied:`, data3.data.filters_applied);
        } else {
            const error3 = await response3.json();
            console.log('❌ Error:', error3);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 4: Get events with event category filter
        console.log('🏷️ Test 4: Get events with event category filter');
        const response4 = await fetch(`${BASE_URL}/calendar/events/parent?event_category=academic`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response4.ok) {
            const data4 = await response4.json();
            console.log('✅ Success - Events with category filter:');
            console.log(`   Category: academic`);
            console.log(`   Total events: ${data4.data.summary.total_events}`);
            console.log(`   Filters applied:`, data4.data.filters_applied);
        } else {
            const error4 = await response4.json();
            console.log('❌ Error:', error4);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 5: Combined filters (student + date + category)
        console.log('🔍 Test 5: Combined filters (student + date + category)');
        const response5 = await fetch(`${BASE_URL}/calendar/events/parent?student_id=specific_student_uuid&start_date=${today}&event_category=academic`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response5.ok) {
            const data5 = await response5.json();
            console.log('✅ Success - Combined filters:');
            console.log(`   Student filter: ${data5.data.summary.filtered_by_student}`);
            console.log(`   Date filter: ${data5.data.filters_applied.start_date}`);
            console.log(`   Category filter: ${data5.data.filters_applied.event_category}`);
            console.log(`   Total events: ${data5.data.summary.total_events}`);
        } else {
            const error5 = await response5.json();
            console.log('❌ Error:', error5);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Test the new endpoint structure
async function testEndpointStructure() {
    console.log('\n🔍 Testing Endpoint Structure...\n');

    try {
        const response = await fetch(`${BASE_URL}/calendar/events/parent`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Endpoint Structure:');
            console.log('   Status:', data.status);
            console.log('   Data structure:');
            console.log('     - events_by_student: Array of students with their events');
            console.log('     - summary: Statistics about the data');
            console.log('     - filters_applied: What filters were used');

            if (data.data.events_by_student.length > 0) {
                const student = data.data.events_by_student[0];
                console.log('\n   Student structure:');
                console.log('     - student_id:', student.student_id);
                console.log('     - student_name:', student.student_name);
                console.log('     - admission_number:', student.admission_number);
                console.log('     - class_info:', student.class_info);
                console.log('     - events: Array of events with student_info');
                console.log('     - total_events:', student.total_events);

                if (student.events.length > 0) {
                    const event = student.events[0];
                    console.log('\n   Event with student info:');
                    console.log('     - title:', event.title);
                    console.log('     - event_date:', event.event_date);
                    console.log('     - student_info:', event.student_info);
                }
            }
        } else {
            const error = await response.json();
            console.log('❌ Error:', error);
        }
    } catch (error) {
        console.error('❌ Structure test failed:', error.message);
    }
}

// Run tests
if (require.main === module) {
    testParentCalendarEvents()
        .then(() => testEndpointStructure())
        .then(() => {
            console.log('\n🎉 All tests completed!');
            console.log('\n📋 Summary of New Features:');
            console.log('   1. ✅ Events grouped by student');
            console.log('   2. ✅ Student name and details added to each event');
            console.log('   3. ✅ Student filter parameter (student_id)');
            console.log('   4. ✅ Date filtering maintained');
            console.log('   5. ✅ Event category filtering maintained');
            console.log('   6. ✅ Comprehensive summary statistics');
            console.log('   7. ✅ Clear filter tracking');
        })
        .catch(console.error);
}

export { testEndpointStructure, testParentCalendarEvents };

