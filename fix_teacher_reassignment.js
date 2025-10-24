/**
 * Fix script to properly deactivate old teacher assignments
 * This addresses the critical vulnerability where old teachers retain access
 */

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function fixTeacherReassignment() {
    console.log('🔧 FIXING TEACHER REASSIGNMENT ACCESS CONTROL\n');
    console.log('='.repeat(60));

    try {
        // Login as Admin to fix the assignment
        console.log('1. Logging in as Admin...');
        const adminLoginResponse = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: '1234567890', // Admin
                password: 'Shilpa@123'
            })
        });

        const adminLoginData = await adminLoginResponse.json();
        const adminToken = adminLoginData.data.token;

        console.log('✅ Admin login successful');

        // Get the old teacher's assignments for Grade 5 A
        console.log('\n2. Checking old teacher assignments...');

        // Login as old teacher to get their assignments
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

        const assignmentsResponse = await fetch(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        const assignmentsData = await assignmentsResponse.json();
        const assignments = assignmentsData.data;

        console.log(`📋 Old teacher has ${assignments.assigned_classes.length} assignments`);

        // Find Grade 5 A assignment
        const grade5Assignment = assignments.assigned_classes.find(a =>
            a.class_name.includes('Grade 5 A')
        );

        if (grade5Assignment) {
            console.log(`❌ Found Grade 5 A assignment: ${grade5Assignment.assignment_id}`);
            console.log(`   - Assignment Type: ${grade5Assignment.assignment_type}`);
            console.log(`   - Is Primary: ${grade5Assignment.is_primary}`);

            // Delete the assignment using the admin endpoint
            console.log('\n3. Deactivating old teacher assignment...');
            const deleteResponse = await fetch(`${BASE_URL}/academic/class-divisions/4f1c7d77-b748-4a3f-b86f-9b820829c35a/assignments/${grade5Assignment.assignment_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            if (deleteResponse.status === 200) {
                console.log('✅ Old teacher assignment deactivated successfully');
            } else {
                const deleteData = await deleteResponse.json();
                console.log(`❌ Failed to deactivate assignment: ${deleteData.message}`);
            }
        } else {
            console.log('✅ No Grade 5 A assignment found for old teacher');
        }

        // Verify the fix
        console.log('\n4. Verifying the fix...');
        const verifyAssignmentsResponse = await fetch(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        const verifyAssignmentsData = await verifyAssignmentsResponse.json();
        const verifyAssignments = verifyAssignmentsData.data;

        const verifyGrade5Assignment = verifyAssignments.assigned_classes.find(a =>
            a.class_name.includes('Grade 5 A')
        );

        if (verifyGrade5Assignment) {
            console.log(`❌ VERIFICATION FAILED: Old teacher still has Grade 5 A assignment`);
        } else {
            console.log(`✅ VERIFICATION SUCCESS: Old teacher no longer has Grade 5 A assignment`);
        }

        // Test access to Grade 5 A
        console.log('\n5. Testing access to Grade 5 A...');
        const testAccessResponse = await fetch(`${BASE_URL}/students/class/4f1c7d77-b748-4a3f-b86f-9b820829c35a`, {
            headers: { Authorization: `Bearer ${oldTeacherToken}` }
        });

        if (testAccessResponse.status === 403) {
            console.log('✅ Old teacher access properly denied to Grade 5 A');
        } else {
            console.log('❌ Old teacher still has access to Grade 5 A');
        }

    } catch (error) {
        console.error('❌ Fix failed:', error.message);
    }
}

fixTeacherReassignment().catch(console.error);
