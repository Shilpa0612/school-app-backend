/**
 * Test script to verify the teacher announcement filtering fix
 * This script tests the /api/announcements/teacher/announcements endpoint
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// Helper function to make HTTP requests
async function makeRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.message || 'Request failed');
        error.response = { data, status: response.status };
        throw error;
    }

    return { data };
}

async function testTeacherAnnouncementFiltering() {
    console.log('🧪 Testing Teacher Announcement Filtering Fix...\n');

    try {
        // Test 1: Login as Omkar (Multi-role teacher)
        console.log('1. Logging in as Omkar Sanjay Raut (Multi-role teacher)...');
        const loginResponse = await makeRequest(`${BASE_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
                phone_number: '9158834913',
                password: 'Temp@1234'
            })
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful');

        // Test 2: Get teacher assignments
        console.log('\n2. Getting teacher assignments...');
        const assignmentsResponse = await makeRequest(`${BASE_URL}/academic/my-teacher-id`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        const assignments = assignmentsResponse.data.data;
        console.log('📋 Teacher Assignments:');
        console.log(`   - Class Divisions: ${assignments.class_divisions.map(cd => cd.division).join(', ')}`);
        console.log(`   - Total Classes: ${assignments.class_divisions.length}`);

        // Test 3: Get teacher announcements
        console.log('\n3. Getting teacher announcements...');
        const announcementsResponse = await makeRequest(`${BASE_URL}/announcements/teacher/announcements?page=1&limit=50`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        const announcements = announcementsResponse.data.data.announcements;
        console.log(`📢 Found ${announcements.length} announcements`);

        // Test 4: Analyze announcement targeting
        console.log('\n4. Analyzing announcement targeting...');
        const teacherClassIds = assignments.class_divisions.map(cd => cd.id);

        let unauthorizedAnnouncements = [];
        let authorizedAnnouncements = [];

        announcements.forEach(announcement => {
            const hasTeacherRole = announcement.target_roles?.includes('teacher') || false;
            const hasEmptyRoles = !announcement.target_roles || announcement.target_roles.length === 0;
            const hasClassTargeting = announcement.target_classes && announcement.target_classes.length > 0;
            const hasAuthorizedClass = hasClassTargeting &&
                announcement.target_classes.some(classId => teacherClassIds.includes(classId));

            // Check if announcement should be visible
            const shouldBeVisible = hasTeacherRole || hasAuthorizedClass;

            if (!shouldBeVisible && !hasEmptyRoles) {
                unauthorizedAnnouncements.push({
                    id: announcement.id,
                    title: announcement.title,
                    target_roles: announcement.target_roles,
                    target_classes: announcement.target_classes,
                    reason: 'Not targeted to teacher role or assigned classes'
                });
            } else {
                authorizedAnnouncements.push({
                    id: announcement.id,
                    title: announcement.title,
                    target_roles: announcement.target_roles,
                    target_classes: announcement.target_classes
                });
            }
        });

        // Test 5: Report results
        console.log('\n📊 RESULTS:');
        console.log(`✅ Authorized announcements: ${authorizedAnnouncements.length}`);
        console.log(`❌ Unauthorized announcements: ${unauthorizedAnnouncements.length}`);

        if (unauthorizedAnnouncements.length > 0) {
            console.log('\n🚨 SECURITY ISSUE: Teacher can see unauthorized announcements:');
            unauthorizedAnnouncements.forEach(ann => {
                console.log(`   - "${ann.title}" (${ann.reason})`);
            });
            return false;
        } else {
            console.log('\n✅ SECURITY FIX SUCCESSFUL: Teacher can only see authorized announcements');
            return true;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        return false;
    }
}

async function testUnassignedTeacher() {
    console.log('\n🧪 Testing Unassigned Teacher Access...\n');

    try {
        // Test with Ganesh (Unassigned teacher)
        console.log('1. Logging in as Ganesh Madhukar Dabhade (Unassigned teacher)...');
        const loginResponse = await makeRequest(`${BASE_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
                phone_number: '9404511717',
                password: 'Temp@1234'
            })
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful');

        // Test 2: Get teacher announcements
        console.log('\n2. Getting teacher announcements...');
        const announcementsResponse = await makeRequest(`${BASE_URL}/announcements/teacher/announcements?page=1&limit=50`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        const announcements = announcementsResponse.data.data.announcements;
        console.log(`📢 Found ${announcements.length} announcements`);

        // Test 3: Check if unassigned teacher can see class-specific announcements
        const classSpecificAnnouncements = announcements.filter(ann =>
            ann.target_classes && ann.target_classes.length > 0
        );

        if (classSpecificAnnouncements.length > 0) {
            console.log('\n🚨 SECURITY ISSUE: Unassigned teacher can see class-specific announcements:');
            classSpecificAnnouncements.forEach(ann => {
                console.log(`   - "${ann.title}" (Classes: ${ann.target_classes.join(', ')})`);
            });
            return false;
        } else {
            console.log('\n✅ SECURITY FIX SUCCESSFUL: Unassigned teacher cannot see class-specific announcements');
            return true;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        return false;
    }
}

// Run tests
async function runTests() {
    console.log('🔧 Testing Teacher Announcement Filtering Fix\n');
    console.log('='.repeat(60));

    const test1Result = await testTeacherAnnouncementFiltering();
    const test2Result = await testUnassignedTeacher();

    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL RESULTS:');
    console.log(`✅ Multi-role teacher test: ${test1Result ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Unassigned teacher test: ${test2Result ? 'PASSED' : 'FAILED'}`);

    if (test1Result && test2Result) {
        console.log('\n🎉 ALL TESTS PASSED! The announcement filtering fix is working correctly.');
    } else {
        console.log('\n❌ SOME TESTS FAILED! The fix needs further investigation.');
    }
}

runTests().catch(console.error);
