/**
 * Debug script to check teacher assignments
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function debugTeacherAssignments() {
    console.log('🔍 DEBUGGING TEACHER ASSIGNMENTS\n');

    try {
        // Login as old teacher (Sandesh)
        console.log('1. Logging in as old teacher (Sandesh)...');
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

        // Get teacher assignments
        console.log('\n2. Getting teacher assignments...');
        const assignmentsResponse = await fetch(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data;

        console.log('📋 Teacher Assignments:');
        console.log(`   - Total assigned classes: ${assignments.assigned_classes.length}`);
        console.log(`   - Primary classes: ${assignments.primary_classes.length}`);
        console.log(`   - Secondary classes: ${assignments.secondary_classes.length}`);

        assignments.assigned_classes.forEach(assignment => {
            console.log(`   - ${assignment.class_name} (${assignment.assignment_type}) - Active: ${assignment.is_active || 'unknown'}`);
        });

        // Check if teacher has access to Grade 5 A
        const grade5Assignment = assignments.assigned_classes.find(a =>
            a.class_name.includes('Grade 5 A')
        );

        if (grade5Assignment) {
            console.log(`\n❌ PROBLEM: Old teacher still has assignment to Grade 5 A`);
            console.log(`   - Assignment ID: ${grade5Assignment.assignment_id}`);
            console.log(`   - Assignment Type: ${grade5Assignment.assignment_type}`);
            console.log(`   - Is Primary: ${grade5Assignment.is_primary}`);
            console.log(`   - Assigned Date: ${grade5Assignment.assigned_date}`);
        } else {
            console.log(`\n✅ Old teacher has no assignment to Grade 5 A`);
        }

        // Test specific class access
        console.log('\n3. Testing specific class access...');
        const specificClassResponse = await fetch(`${BASE_URL}/students/class/4f1c7d77-b748-4a3f-b86f-9b820829c35a`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        const specificClassData = await specificClassResponse.json();

        if (specificClassResponse.status === 200) {
            console.log(`❌ PROBLEM: Old teacher can access Grade 5 A students (${specificClassData.data?.length || 0} students)`);
        } else {
            console.log(`✅ Old teacher access properly denied to Grade 5 A students`);
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugTeacherAssignments().catch(console.error);
