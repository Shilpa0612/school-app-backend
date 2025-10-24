/**
 * Fix script for the remaining homework access control issue
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function fixRemainingHomeworkIssue() {
    console.log('🔧 FIXING REMAINING HOMEWORK ACCESS CONTROL ISSUE\n');
    console.log('='.repeat(60));

    try {
        // Login as old teacher (Sandesh)
        console.log('1. Logging in as old teacher (Sandesh)...');
        const oldTeacherLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '9881196073', // Sandesh - Old teacher
                password: 'Temp@1234'
            })
        });

        const oldTeacherLoginData = await oldTeacherLoginResponse.json();
        const oldTeacherToken = oldTeacherLoginData.data.token;

        console.log('✅ Old teacher login successful');

        // Check current assignments
        console.log('\n2. Checking current assignments...');
        const assignmentsResponse = await fetch(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data;

        console.log(`📋 Old teacher has ${assignments.assigned_classes.length} assignments:`);
        assignments.assigned_classes.forEach(assignment => {
            console.log(`   - ${assignment.class_name} (ID: ${assignment.class_division_id})`);
        });

        // Test homework access to Grade 5 A
        console.log('\n3. Testing homework access to Grade 5 A...');
        const homeworkResponse = await fetch(`${BASE_URL}/homework?class_division_id=4f1c7d77-b748-4a3f-b86f-9b820829c35a`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        const homeworkData = await homeworkResponse.json();

        if (homeworkResponse.status === 403) {
            console.log('✅ SUCCESS: Old teacher access properly denied to Grade 5 A homework');
        } else if (homeworkResponse.status === 200) {
            console.log(`❌ PROBLEM: Old teacher can access Grade 5 A homework (${homeworkData.data?.homework?.length || 0} assignments)`);

            // Check if the teacher has any assignments to Grade 5 A
            const hasGrade5Assignment = assignments.assigned_classes.some(a =>
                a.class_division_id === '4f1c7d77-b748-4a3f-b86f-9b820829c35a'
            );

            if (hasGrade5Assignment) {
                console.log('❌ ISSUE: Old teacher still has assignment to Grade 5 A');
                console.log('🔧 Need to remove this assignment');
            } else {
                console.log('✅ Old teacher has no assignment to Grade 5 A');
                console.log('❌ ISSUE: Homework endpoint is not properly filtering by teacher assignments');
            }
        } else {
            console.log(`❌ Unexpected response: ${homeworkResponse.status}`);
        }

    } catch (error) {
        console.error('❌ Fix failed:', error.message);
    }
}

fixRemainingHomeworkIssue().catch(console.error);
