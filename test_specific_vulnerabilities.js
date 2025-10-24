/**
 * Test script to verify the specific security vulnerabilities mentioned
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function testSpecificVulnerabilities() {
    console.log('🚨 TESTING SPECIFIC SECURITY VULNERABILITIES\n');
    console.log('='.repeat(60));

    let vulnerabilitiesFound = 0;

    try {
        // Test 1: Teacher Reassignment Access Control Failure
        console.log('\n🚨 VULNERABILITY #1: Teacher Reassignment Access Control Failure');
        console.log('-'.repeat(60));

        const oldTeacherLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '9881196073', // Sandesh - Old teacher (reassigned)
                password: 'Temp@1234'
            })
        });

        const oldTeacherLoginData = await oldTeacherLoginResponse.json();
        const oldTeacherToken = oldTeacherLoginData.data.token;

        console.log('✅ Old teacher (Sandesh) login successful');

        // Test access to Grade 5 A students
        const studentsResponse = await fetch(`${BASE_URL}/students/class/4f1c7d77-b748-4a3f-b86f-9b820829c35a`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        const studentsData = await studentsResponse.json();

        if (studentsResponse.status === 200 && studentsData.data && studentsData.data.length > 0) {
            console.log(`❌ VULNERABILITY FOUND: Old teacher can access ${studentsData.data.length} students in Grade 5 A`);
            console.log('❌ Expected: Old teacher should be denied access');
            vulnerabilitiesFound++;
        } else {
            console.log('✅ Old teacher access properly denied to Grade 5 A students');
        }

        // Test access to Grade 5 A homework
        const homeworkResponse = await fetch(`${BASE_URL}/homework?class_division_id=4f1c7d77-b748-4a3f-b86f-9b820829c35a`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        const homeworkData = await homeworkResponse.json();

        if (homeworkResponse.status === 200 && homeworkData.data && homeworkData.data.homework && homeworkData.data.homework.length > 0) {
            console.log(`❌ VULNERABILITY FOUND: Old teacher can access ${homeworkData.data.homework.length} homework assignments in Grade 5 A`);
            console.log('❌ Expected: Old teacher should be denied access');
            vulnerabilitiesFound++;
        } else {
            console.log('✅ Old teacher access properly denied to Grade 5 A homework');
        }

        // Test 2: Teacher Announcement Filtering Failure
        console.log('\n🚨 VULNERABILITY #2: Teacher Announcement Filtering Failure');
        console.log('-'.repeat(60));

        const teacherLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '9158834913', // Omkar - Teacher
                password: 'Temp@1234'
            })
        });

        const teacherLoginData = await teacherLoginResponse.json();
        const teacherToken = teacherLoginData.data.token;

        console.log('✅ Teacher (Omkar) login successful');

        // Get teacher assignments
        const assignmentsResponse = await fetch(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${teacherToken}` }
        });

        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data;

        console.log(`📋 Teacher assignments: ${assignments.assigned_classes.map(c => c.class_name).join(', ')}`);

        // Test announcements
        const announcementsResponse = await fetch(`${BASE_URL}/announcements/teacher/announcements?page=1&limit=50`, {
            headers: { Authorization: `Bearer ${teacherToken}` }
        });

        const announcementsData = await announcementsResponse.json();
        const announcements = announcementsData.data.announcements;

        console.log(`📢 Found ${announcements.length} announcements`);

        // Check for Grade 1 A announcements (should not be visible)
        const grade1Announcements = announcements.filter(ann =>
            ann.title && ann.title.includes('Grade 1 A')
        );

        if (grade1Announcements.length > 0) {
            console.log(`❌ VULNERABILITY FOUND: Teacher can see ${grade1Announcements.length} Grade 1 A announcements`);
            console.log('❌ Expected: Teacher should not see Grade 1 A announcements (not assigned to Grade 1 A)');
            vulnerabilitiesFound++;
        } else {
            console.log('✅ Teacher cannot see Grade 1 A announcements (properly filtered)');
        }

        // Test 3: Parent Homework Filtering Failure
        console.log('\n🚨 VULNERABILITY #3: Parent Homework Filtering Failure');
        console.log('-'.repeat(60));

        const parentLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '8087478036', // Amit - Parent
                password: 'Temp@1234'
            })
        });

        const parentLoginData = await parentLoginResponse.json();
        const parentToken = parentLoginData.data.token;

        console.log('✅ Parent (Amit) login successful');

        // Test homework access
        const parentHomeworkResponse = await fetch(`${BASE_URL}/homework?page=1&limit=50`, {
            headers: { Authorization: `Bearer ${parentToken}` }
        });

        const parentHomeworkData = await parentHomeworkResponse.json();
        const parentHomework = parentHomeworkData.data.homework;

        console.log(`📚 Found ${parentHomework.length} homework assignments`);

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

        if (unauthorizedHomework > 0) {
            console.log(`❌ VULNERABILITY FOUND: Parent can see ${unauthorizedHomework} homework assignments from unauthorized classes`);
            console.log('❌ Expected: Parent should only see homework from their children\'s classes (Grade 1 A, Grade 7 A)');
            vulnerabilitiesFound++;
        } else {
            console.log('✅ Parent can only see homework from authorized classes');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        vulnerabilitiesFound++;
    }

    // Final Results
    console.log('\n' + '='.repeat(60));
    console.log('📋 VULNERABILITY ASSESSMENT RESULTS');
    console.log('='.repeat(60));

    if (vulnerabilitiesFound === 0) {
        console.log('🎉 NO VULNERABILITIES FOUND!');
        console.log('✅ All security fixes are working correctly');
    } else {
        console.log(`🚨 ${vulnerabilitiesFound} VULNERABILITIES FOUND!`);
        console.log('❌ Security fixes need to be implemented');
        console.log('🔧 Please implement the fixes mentioned in the security report');
    }

    return vulnerabilitiesFound === 0;
}

// Run the vulnerability test
testSpecificVulnerabilities().catch(console.error);
