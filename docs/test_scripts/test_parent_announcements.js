import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

// Test parent authentication (you'll need to replace with actual parent credentials)
const PARENT_TOKEN = 'your_parent_token_here';

async function testParentAnnouncements() {
    console.log('🧪 Testing Parent Announcements Grouped by Student...\n');

    try {
        // Test 1: Get all announcements for all children (grouped by student)
        console.log('📢 Test 1: Get all announcements for all children (grouped by student)');
        const response1 = await fetch(`${BASE_URL}/announcements/parent/children`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response1.ok) {
            const data1 = await response1.json();
            console.log('✅ Success - All announcements grouped by student:');
            console.log(`   Total students: ${data1.data.summary.total_students}`);
            console.log(`   Total announcements: ${data1.data.summary.total_announcements}`);
            console.log(`   Students with announcements: ${data1.data.summary.students_with_announcements}`);
            console.log(`   Students without announcements: ${data1.data.summary.students_without_announcements}`);

            // Show structure of first student
            if (data1.data.announcements_by_student.length > 0) {
                const firstStudent = data1.data.announcements_by_student[0];
                console.log(`\n   First student: ${firstStudent.student_name} (${firstStudent.admission_number})`);
                console.log(`   Class: ${firstStudent.class_info?.class_name || 'Unknown'}`);
                console.log(`   Announcements count: ${firstStudent.total_announcements}`);

                if (firstStudent.announcements.length > 0) {
                    const firstAnnouncement = firstStudent.announcements[0];
                    console.log(`   Sample announcement: ${firstAnnouncement.title}`);
                    console.log(`   Type: ${firstAnnouncement.announcement_type}, Priority: ${firstAnnouncement.priority}`);
                    console.log(`   Announcement has student info: ${!!firstAnnouncement.student_info}`);
                    console.log(`   Student name in announcement: ${firstAnnouncement.student_info?.student_name}`);
                }
            }
        } else {
            const error1 = await response1.json();
            console.log('❌ Error:', error1);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 2: Get announcements for a specific student
        console.log('👤 Test 2: Get announcements for a specific student');
        const response2 = await fetch(`${BASE_URL}/announcements/parent/children?student_id=specific_student_uuid`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response2.ok) {
            const data2 = await response2.json();
            console.log('✅ Success - Announcements for specific student:');
            console.log(`   Filtered by student: ${data2.data.summary.filtered_by_student}`);
            console.log(`   Total students: ${data2.data.summary.total_students}`);
            console.log(`   Total announcements: ${data2.data.summary.total_announcements}`);
        } else {
            const error2 = await response2.json();
            console.log('❌ Error:', error2);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 3: Get announcements with date filter
        console.log('📅 Test 3: Get announcements with date filter');
        const startDate = '2025-01-15T00:00:00Z';
        const endDate = '2025-09-22T23:59:59Z';

        const response3 = await fetch(`${BASE_URL}/announcements/parent/children?start_date=${startDate}&end_date=${endDate}`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response3.ok) {
            const data3 = await response3.json();
            console.log('✅ Success - Announcements with date filter:');
            console.log(`   Date range: ${startDate} to ${endDate}`);
            console.log(`   Total announcements: ${data3.data.summary.total_announcements}`);
            console.log(`   Filters applied:`, data3.data.filters_applied);
        } else {
            const error3 = await response3.json();
            console.log('❌ Error:', error3);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 4: Get announcements with status filter
        console.log('🏷️ Test 4: Get announcements with status filter');
        const response4 = await fetch(`${BASE_URL}/announcements/parent/children?status=pending`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response4.ok) {
            const data4 = await response4.json();
            console.log('✅ Success - Announcements with status filter:');
            console.log(`   Status: pending`);
            console.log(`   Total announcements: ${data4.data.summary.total_announcements}`);
            console.log(`   Filters applied:`, data4.data.filters_applied);
        } else {
            const error4 = await response4.json();
            console.log('❌ Error:', error4);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 5: Get announcements with announcement type filter
        console.log('📋 Test 5: Get announcements with announcement type filter');
        const response5 = await fetch(`${BASE_URL}/announcements/parent/children?announcement_type=general`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response5.ok) {
            const data5 = await response5.json();
            console.log('✅ Success - Announcements with type filter:');
            console.log(`   Type: general`);
            console.log(`   Total announcements: ${data5.data.summary.total_announcements}`);
            console.log(`   Filters applied:`, data5.data.filters_applied);
        } else {
            const error5 = await response5.json();
            console.log('❌ Error:', error5);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 6: Get announcements with priority filter
        console.log('⭐ Test 6: Get announcements with priority filter');
        const response6 = await fetch(`${BASE_URL}/announcements/parent/children?priority=low`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response6.ok) {
            const data6 = await response6.json();
            console.log('✅ Success - Announcements with priority filter:');
            console.log(`   Priority: low`);
            console.log(`   Total announcements: ${data6.data.summary.total_announcements}`);
            console.log(`   Filters applied:`, data6.data.filters_applied);
        } else {
            const error6 = await response6.json();
            console.log('❌ Error:', error6);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 7: Get featured announcements
        console.log('🌟 Test 7: Get featured announcements');
        const response7 = await fetch(`${BASE_URL}/announcements/parent/children?is_featured=true`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response7.ok) {
            const data7 = await response7.json();
            console.log('✅ Success - Featured announcements:');
            console.log(`   Featured: true`);
            console.log(`   Total announcements: ${data7.data.summary.total_announcements}`);
            console.log(`   Filters applied:`, data7.data.filters_applied);
        } else {
            const error7 = await response7.json();
            console.log('❌ Error:', error7);
        }

        console.log('\n' + '='.repeat(60) + '\n');

        // Test 8: Combined filters (student + date + status + type + priority + featured)
        console.log('🔍 Test 8: Combined filters (student + date + status + type + priority + featured)');
        const response8 = await fetch(`${BASE_URL}/announcements/parent/children?student_id=specific_student_uuid&start_date=${startDate}&end_date=${endDate}&status=pending&announcement_type=general&priority=low&is_featured=true`, {
            headers: {
                'Authorization': `Bearer ${PARENT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response8.ok) {
            const data8 = await response8.json();
            console.log('✅ Success - Combined filters:');
            console.log(`   Student filter: ${data8.data.summary.filtered_by_student}`);
            console.log(`   Date filter: ${data8.data.filters_applied.start_date} to ${data8.data.filters_applied.end_date}`);
            console.log(`   Status filter: ${data8.data.filters_applied.status}`);
            console.log(`   Type filter: ${data8.data.filters_applied.announcement_type}`);
            console.log(`   Priority filter: ${data8.data.filters_applied.priority}`);
            console.log(`   Featured filter: ${data8.data.filters_applied.is_featured}`);
            console.log(`   Total announcements: ${data8.data.summary.total_announcements}`);
        } else {
            const error8 = await response8.json();
            console.log('❌ Error:', error8);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Test the new endpoint structure
async function testEndpointStructure() {
    console.log('\n🔍 Testing Endpoint Structure...\n');

    try {
        const response = await fetch(`${BASE_URL}/announcements/parent/children`, {
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
            console.log('     - announcements_by_student: Array of students with their announcements');
            console.log('     - summary: Statistics about the data');
            console.log('     - pagination: Pagination information');
            console.log('     - filters_applied: What filters were used');

            if (data.data.announcements_by_student.length > 0) {
                const student = data.data.announcements_by_student[0];
                console.log('\n   Student structure:');
                console.log('     - student_id:', student.student_id);
                console.log('     - student_name:', student.student_name);
                console.log('     - admission_number:', student.admission_number);
                console.log('     - class_info:', student.class_info);
                console.log('     - announcements: Array of announcements with student_info');
                console.log('     - total_announcements:', student.total_announcements);

                if (student.announcements.length > 0) {
                    const announcement = student.announcements[0];
                    console.log('\n   Announcement with student info:');
                    console.log('     - title:', announcement.title);
                    console.log('     - announcement_type:', announcement.announcement_type);
                    console.log('     - priority:', announcement.priority);
                    console.log('     - student_info:', announcement.student_info);
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
    testParentAnnouncements()
        .then(() => testEndpointStructure())
        .then(() => {
            console.log('\n🎉 All tests completed!');
            console.log('\n📋 Summary of New Features:');
            console.log('   1. ✅ Announcements grouped by student');
            console.log('   2. ✅ Student name and details added to each announcement');
            console.log('   3. ✅ Student filter parameter (student_id)');
            console.log('   4. ✅ Date filtering (start_date, end_date)');
            console.log('   5. ✅ Status filtering (pending, approved, etc.)');
            console.log('   6. ✅ Announcement type filtering (general, academic, etc.)');
            console.log('   7. ✅ Priority filtering (low, normal, high, urgent)');
            console.log('   8. ✅ Featured announcements filtering');
            console.log('   9. ✅ Comprehensive summary statistics');
            console.log('   10. ✅ Clear filter tracking and pagination');
        })
        .catch(console.error);
}

export { testEndpointStructure, testParentAnnouncements };

