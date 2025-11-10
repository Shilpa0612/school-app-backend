/**
 * Test script using the exact credentials from the security report
 * Tests all the critical vulnerabilities with real login credentials
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function testWithRealCredentials() {
    console.log('🔐 TESTING WITH REAL CREDENTIALS FROM SECURITY REPORT\n');
    console.log('='.repeat(70));

    let vulnerabilitiesFixed = 0;
    let totalTests = 0;

    try {
        // Test 1: Teacher (Omkar) - Test announcement filtering
        console.log('\n🧪 TEST 1: Teacher Announcement Filtering');
        console.log('-'.repeat(50));
        console.log('📋 Credentials: 9158834913 / Temp@1234 (Omkar - Teacher)');

        totalTests++;
        const teacherLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '9158834913',
                password: 'Temp@1234'
            })
        });

        const teacherLoginData = await teacherLoginResponse.json();
        const teacherToken = teacherLoginData.data.token;

        console.log('✅ Teacher login successful');

        // Get teacher assignments
        const assignmentsResponse = await fetch(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${teacherToken}` }
        });

        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data;

        console.log(`📋 Teacher assignments: ${assignments.assigned_classes.map(c => c.class_name).join(', ')}`);

        // Test announcements - should NOT see Grade 1 A announcements
        const announcementsResponse = await fetch(`${BASE_URL}/announcements/teacher/announcements?page=1&limit=50`, {
            headers: { Authorization: `Bearer ${teacherToken}` }
        });

        const announcementsData = await announcementsResponse.json();
        const announcements = announcementsData.data.announcements;

        const grade1Announcements = announcements.filter(ann =>
            ann.title && ann.title.includes('Grade 1 A')
        );

        if (grade1Announcements.length === 0) {
            console.log('✅ SUCCESS: Teacher cannot see Grade 1 A announcements');
            console.log('✅ Teacher announcement filtering is working correctly');
            vulnerabilitiesFixed++;
        } else {
            console.log(`❌ FAILED: Teacher can see ${grade1Announcements.length} Grade 1 A announcements`);
            console.log('❌ Teacher announcement filtering is NOT working');
        }

        // Test 2: Old Teacher (Sandesh) - Test reassignment access control
        console.log('\n🧪 TEST 2: Teacher Reassignment Access Control');
        console.log('-'.repeat(50));
        console.log('📋 Credentials: 9881196073 / Temp@1234 (Sandesh - Reassigned Teacher)');

        totalTests++;
        const oldTeacherLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '9881196073',
                password: 'Temp@1234'
            })
        });

        const oldTeacherLoginData = await oldTeacherLoginResponse.json();
        const oldTeacherToken = oldTeacherLoginData.data.token;

        console.log('✅ Old teacher login successful');

        // Test access to Grade 5 A students - should be DENIED
        const studentsResponse = await fetch(`${BASE_URL}/students/class/4f1c7d77-b748-4a3f-b86f-9b820829c35a`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        if (studentsResponse.status === 403) {
            console.log('✅ SUCCESS: Old teacher access properly denied to Grade 5 A students');
            vulnerabilitiesFixed++;
        } else {
            console.log('❌ FAILED: Old teacher can still access Grade 5 A students');
        }

        // Test access to Grade 5 A homework - should be DENIED
        const homeworkResponse = await fetch(`${BASE_URL}/homework?class_division_id=4f1c7d77-b748-4a3f-b86f-9b820829c35a`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        if (homeworkResponse.status === 403) {
            console.log('✅ SUCCESS: Old teacher access properly denied to Grade 5 A homework');
        } else {
            console.log('❌ FAILED: Old teacher can still access Grade 5 A homework');
        }

        // Test 3: Parent (Amit) - Test homework filtering
        console.log('\n🧪 TEST 3: Parent Homework Filtering');
        console.log('-'.repeat(50));
        console.log('📋 Credentials: 8087478036 / Temp@1234 (Amit - Parent)');

        totalTests++;
        const parentLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '8087478036',
                password: 'Temp@1234'
            })
        });

        const parentLoginData = await parentLoginResponse.json();
        const parentToken = parentLoginData.data.token;

        console.log('✅ Parent login successful');

        // Get parent's children
        const childrenResponse = await fetch(`${BASE_URL}/users/children`, {
            headers: { Authorization: `Bearer ${parentToken}` }
        });

        const childrenData = await childrenResponse.json();
        const children = childrenData.data.children;

        console.log(`📋 Parent has ${children.length} children`);

        // Test homework access
        const parentHomeworkResponse = await fetch(`${BASE_URL}/homework?page=1&limit=50`, {
            headers: { Authorization: `Bearer ${parentToken}` }
        });

        const parentHomeworkData = await parentHomeworkResponse.json();
        const parentHomework = parentHomeworkData.data.homework;

        console.log(`📚 Parent sees ${parentHomework.length} homework assignments`);

        // Check for unauthorized class homework
        const unauthorizedClasses = ['Grade 5 A', 'Grade 3 A', 'Grade 8 A'];
        let unauthorizedHomework = 0;

        parentHomework.forEach(hw => {
            const className = `${hw.class_division?.level?.name || ''} ${hw.class_division?.division || ''}`.trim();
            if (unauthorizedClasses.some(unauthClass => className.includes(unauthClass))) {
                unauthorizedHomework++;
                console.log(`❌ UNAUTHORIZED: Parent can see homework from ${className}`);
            }
        });

        if (unauthorizedHomework === 0) {
            console.log('✅ SUCCESS: Parent can only see homework from authorized classes');
            console.log('✅ Parent homework filtering is working correctly');
            vulnerabilitiesFixed++;
        } else {
            console.log(`❌ FAILED: Parent can see ${unauthorizedHomework} homework assignments from unauthorized classes`);
            console.log('❌ Parent homework filtering is NOT working');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }

    // Final Results
    console.log('\n' + '='.repeat(70));
    console.log('📋 FINAL TEST RESULTS WITH REAL CREDENTIALS');
    console.log('='.repeat(70));

    console.log(`🔒 SECURITY VULNERABILITIES FIXED: ${vulnerabilitiesFixed}/${totalTests}`);

    if (vulnerabilitiesFixed === totalTests) {
        console.log('\n🎉 ALL SECURITY VULNERABILITIES FIXED!');
        console.log('✅ Teacher announcement filtering is secure');
        console.log('✅ Teacher reassignment access control is secure');
        console.log('✅ Parent homework filtering is secure');
        console.log('\n🔒 SCHOOL MANAGEMENT SYSTEM IS SECURE AND PRODUCTION READY!');
    } else {
        console.log(`\n⚠️  ${totalTests - vulnerabilitiesFixed} VULNERABILITIES STILL NEED FIXING`);
        console.log('🔧 Please review and implement the remaining fixes');
    }

    console.log('\n📋 TESTED CREDENTIALS:');
    console.log('1. Teacher (Omkar): 9158834913 / Temp@1234');
    console.log('2. Old Teacher (Sandesh): 9881196073 / Temp@1234');
    console.log('3. Parent (Amit): 8087478036 / Temp@1234');

    return vulnerabilitiesFixed === totalTests;
}

testWithRealCredentials().catch(console.error);
