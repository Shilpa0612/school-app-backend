import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
const TEACHER_TOKEN = 'your_teacher_jwt_token_here'; // Replace with actual token

async function testTeacherAnnouncements() {
    console.log('🧪 Testing Teacher Announcements Endpoint\n');

    try {
        // Test 1: Get teacher announcements with default filters
        console.log('📋 Test 1: Get Teacher Announcements (Default)');
        const response1 = await fetch(`${BASE_URL}/announcements/teacher/announcements`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response1.ok) {
            const data1 = await response1.json();
            console.log('✅ Success:', {
                status: response1.status,
                total_announcements: data1.data?.announcements?.length || 0,
                teacher_subjects: data1.data?.teacher_info?.subjects || [],
                teacher_classes: data1.data?.teacher_info?.class_divisions || []
            });
        } else {
            console.log('❌ Failed:', response1.status, response1.statusText);
        }

        // Test 2: Get teacher announcements with subject filtering
        console.log('\n📋 Test 2: Get Teacher Announcements (Subject Filter)');
        const response2 = await fetch(`${BASE_URL}/announcements/teacher/announcements?subject_filter=true&limit=10`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response2.ok) {
            const data2 = await response2.json();
            console.log('✅ Success:', {
                status: response2.status,
                total_announcements: data2.data?.announcements?.length || 0,
                pagination: data2.data?.pagination || {}
            });
        } else {
            console.log('❌ Failed:', response2.status, response2.statusText);
        }

        // Test 3: Get unread announcements only
        console.log('\n📋 Test 3: Get Unread Teacher Announcements');
        const response3 = await fetch(`${BASE_URL}/announcements/teacher/announcements?unread_only=true`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response3.ok) {
            const data3 = await response3.json();
            console.log('✅ Success:', {
                status: response3.status,
                unread_announcements: data3.data?.announcements?.length || 0
            });
        } else {
            console.log('❌ Failed:', response3.status, response3.statusText);
        }

        // Test 4: Get announcements by type
        console.log('\n📋 Test 4: Get Academic Announcements');
        const response4 = await fetch(`${BASE_URL}/announcements/teacher/announcements?announcement_type=academic`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response4.ok) {
            const data4 = await response4.json();
            console.log('✅ Success:', {
                status: response4.status,
                academic_announcements: data4.data?.announcements?.length || 0
            });
        } else {
            console.log('❌ Failed:', response4.status, response4.statusText);
        }

        // Test 5: Get announcements by publish date range
        console.log('\n📋 Test 5: Get Announcements by Publish Date Range');
        const today = new Date().toISOString();
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const response5 = await fetch(`${BASE_URL}/announcements/teacher/announcements?publish_at_from=${lastWeek}&publish_at_to=${today}`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response5.ok) {
            const data5 = await response5.json();
            console.log('✅ Success:', {
                status: response5.status,
                date_filtered_announcements: data5.data?.announcements?.length || 0,
                filters: data5.data?.filters
            });
        } else {
            console.log('❌ Failed:', response5.status, response5.statusText);
        }

        // Test 6: Get announcements by specific class division
        console.log('\n📋 Test 6: Get Announcements by Class Division');
        const response6 = await fetch(`${BASE_URL}/announcements/teacher/announcements?class_division_id=123e4567-e89b-12d3-a456-426614174000`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response6.ok) {
            const data6 = await response6.json();
            console.log('✅ Success:', {
                status: response6.status,
                class_filtered_announcements: data6.data?.announcements?.length || 0,
                filters: data6.data?.filters
            });
        } else {
            console.log('❌ Failed:', response6.status, response6.statusText);
        }

        // Test 7: Get announcements by specific subject
        console.log('\n📋 Test 7: Get Announcements by Subject');
        const response7 = await fetch(`${BASE_URL}/announcements/teacher/announcements?subject_name=Mathematics`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response7.ok) {
            const data7 = await response7.json();
            console.log('✅ Success:', {
                status: response7.status,
                subject_filtered_announcements: data7.data?.announcements?.length || 0,
                filters: data7.data?.filters
            });
        } else {
            console.log('❌ Failed:', response7.status, response7.statusText);
        }

        // Test 8: Combined filters with pagination
        console.log('\n📋 Test 8: Combined Filters with Pagination');
        const response8 = await fetch(`${BASE_URL}/announcements/teacher/announcements?announcement_type=academic&priority=high&page=1&limit=5&unread_only=true`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response8.ok) {
            const data8 = await response8.json();
            console.log('✅ Success:', {
                status: response8.status,
                combined_filtered_announcements: data8.data?.announcements?.length || 0,
                pagination: data8.data?.pagination,
                filters: data8.data?.filters
            });
        } else {
            console.log('❌ Failed:', response8.status, response8.statusText);
        }

        console.log('\n✅ All Teacher Announcements tests completed!');

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

// Test announcement creation with subjects
async function testCreateAnnouncementWithSubjects() {
    console.log('\n🧪 Testing Announcement Creation with Subjects\n');

    try {
        const announcementData = {
            title: "Mathematics Test Schedule - January 2025",
            content: "Dear students, the Mathematics test will be held on January 20th, 2025. Please prepare thoroughly for chapters 5-8.",
            announcement_type: "academic",
            priority: "high",
            target_roles: ["teacher", "student"],
            target_subjects: ["Mathematics", "Advanced Mathematics"],
            target_classes: [], // Empty for all classes
            is_featured: true
        };

        console.log('📋 Test: Create Announcement with Subjects');
        const response = await fetch(`${BASE_URL}/announcements`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(announcementData)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Success:', {
                status: response.status,
                announcement_id: data.data?.announcement?.id,
                target_subjects: data.data?.announcement?.target_subjects,
                status: data.data?.announcement?.status
            });
        } else {
            const errorData = await response.json();
            console.log('❌ Failed:', response.status, errorData.message || response.statusText);
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

// Run tests
async function runAllTests() {
    console.log('🚀 Starting Teacher Announcements API Tests\n');

    await testTeacherAnnouncements();
    await testCreateAnnouncementWithSubjects();

    console.log('\n🎉 All tests completed!');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests();
}

export { testCreateAnnouncementWithSubjects, testTeacherAnnouncements };

