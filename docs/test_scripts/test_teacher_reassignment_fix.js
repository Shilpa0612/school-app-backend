/**
 * Test script to verify the teacher reassignment access control fix
 * This script tests the teacher reassignment functionality
 */

import axios from 'axios';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function testTeacherReassignment() {
    console.log('🧪 Testing Teacher Reassignment Access Control Fix...\n');

    try {
        // Test 1: Login as Principal
        console.log('1. Logging in as Principal...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: '9765432109',
            password: 'Temp@1234'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful');

        // Test 2: Get a class division to work with
        console.log('\n2. Getting class divisions...');
        const classesResponse = await axios.get(`${BASE_URL}/academic/class-divisions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const classes = classesResponse.data.data.class_divisions;
        const testClass = classes.find(c => c.division === 'A' && c.level?.name === 'Grade 1');

        if (!testClass) {
            console.log('❌ No suitable test class found');
            return false;
        }

        console.log(`📚 Using test class: ${testClass.level.name} ${testClass.division} (ID: ${testClass.id})`);

        // Test 3: Get current teachers for this class
        console.log('\n3. Getting current teachers for the class...');
        const teachersResponse = await axios.get(`${BASE_URL}/academic/class-divisions/${testClass.id}/teachers`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const currentTeachers = teachersResponse.data.data.teachers;
        console.log(`👨‍🏫 Current teachers: ${currentTeachers.length}`);
        currentTeachers.forEach(teacher => {
            console.log(`   - ${teacher.teacher.full_name} (${teacher.assignment_type})`);
        });

        // Test 4: Get available teachers
        console.log('\n4. Getting available teachers...');
        const allTeachersResponse = await axios.get(`${BASE_URL}/academic/teachers`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const allTeachers = allTeachersResponse.data.data.teachers;
        const availableTeacher = allTeachers.find(t =>
            !currentTeachers.some(ct => ct.teacher_id === t.teacher_id)
        );

        if (!availableTeacher) {
            console.log('❌ No available teacher found for testing');
            return false;
        }

        console.log(`👨‍🏫 Using available teacher: ${availableTeacher.full_name} (ID: ${availableTeacher.teacher_id})`);

        // Test 5: Assign the new teacher
        console.log('\n5. Assigning new teacher to the class...');
        const assignResponse = await axios.post(`${BASE_URL}/academic/class-divisions/${testClass.id}/assign-teacher`, {
            teacher_id: availableTeacher.teacher_id,
            assignment_type: 'subject_teacher',
            subject: 'Math',
            is_primary: false
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ Teacher assigned successfully');
        const newAssignment = assignResponse.data.data.assignment;
        console.log(`   - Assignment ID: ${newAssignment.id}`);

        // Test 6: Verify the new teacher can access the class
        console.log('\n6. Testing new teacher access to the class...');
        const newTeacherLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: availableTeacher.phone_number,
            password: 'Temp@1234'
        });

        const newTeacherToken = newTeacherLoginResponse.data.data.token;

        // Test homework access
        const homeworkResponse = await axios.get(`${BASE_URL}/homework`, {
            headers: { Authorization: `Bearer ${newTeacherToken}` },
            params: {
                class_division_id: testClass.id,
                page: 1,
                limit: 10
            }
        });

        console.log(`✅ New teacher can access homework for the class (${homeworkResponse.data.data.homework.length} assignments)`);

        // Test 7: Reassign to a different teacher
        console.log('\n7. Testing teacher reassignment...');
        const anotherTeacher = allTeachers.find(t =>
            t.teacher_id !== availableTeacher.teacher_id &&
            !currentTeachers.some(ct => ct.teacher_id === t.teacher_id)
        );

        if (!anotherTeacher) {
            console.log('❌ No second teacher available for reassignment test');
            return false;
        }

        console.log(`🔄 Reassigning to: ${anotherTeacher.full_name} (ID: ${anotherTeacher.teacher_id})`);

        const reassignResponse = await axios.put(`${BASE_URL}/academic/class-divisions/${testClass.id}/assignments/${newAssignment.id}/reassign`, {
            teacher_id: anotherTeacher.teacher_id,
            subject: 'Math',
            assignment_type: 'subject_teacher',
            is_primary: false
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('✅ Teacher reassigned successfully');
        console.log(`   - Previous teacher: ${reassignResponse.data.data.previous_teacher}`);
        console.log(`   - Action: ${reassignResponse.data.data.action}`);

        // Test 8: Verify old teacher lost access
        console.log('\n8. Testing old teacher access (should be denied)...');
        try {
            const oldTeacherHomeworkResponse = await axios.get(`${BASE_URL}/homework`, {
                headers: { Authorization: `Bearer ${newTeacherToken}` },
                params: {
                    class_division_id: testClass.id,
                    page: 1,
                    limit: 10
                }
            });

            // If we get here, the old teacher still has access - this is a security issue
            console.log('🚨 SECURITY ISSUE: Old teacher still has access to the class!');
            console.log(`   - Old teacher can see ${oldTeacherHomeworkResponse.data.data.homework.length} homework assignments`);
            return false;

        } catch (error) {
            if (error.response?.status === 403) {
                console.log('✅ SECURITY FIX SUCCESSFUL: Old teacher access properly denied');
            } else {
                console.log('❌ Unexpected error:', error.response?.data || error.message);
                return false;
            }
        }

        // Test 9: Verify new teacher has access
        console.log('\n9. Testing new teacher access...');
        const newTeacherLoginResponse2 = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: anotherTeacher.phone_number,
            password: 'Temp@1234'
        });

        const newTeacherToken2 = newTeacherLoginResponse2.data.data.token;

        const newTeacherHomeworkResponse = await axios.get(`${BASE_URL}/homework`, {
            headers: { Authorization: `Bearer ${newTeacherToken2}` },
            params: {
                class_division_id: testClass.id,
                page: 1,
                limit: 10
            }
        });

        console.log(`✅ New teacher can access homework for the class (${newTeacherHomeworkResponse.data.data.homework.length} assignments)`);

        // Test 10: Clean up - remove the test assignment
        console.log('\n10. Cleaning up test assignment...');
        const finalTeachersResponse = await axios.get(`${BASE_URL}/academic/class-divisions/${testClass.id}/teachers`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const finalTeachers = finalTeachersResponse.data.data.teachers;
        const testAssignment = finalTeachers.find(t => t.teacher_id === anotherTeacher.teacher_id);

        if (testAssignment) {
            await axios.delete(`${BASE_URL}/academic/class-divisions/${testClass.id}/assignments/${testAssignment.assignment_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Test assignment cleaned up');
        }

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        return false;
    }
}

// Run tests
async function runTests() {
    console.log('🔧 Testing Teacher Reassignment Access Control Fix\n');
    console.log('='.repeat(60));

    const testResult = await testTeacherReassignment();

    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL RESULTS:');
    console.log(`✅ Teacher reassignment test: ${testResult ? 'PASSED' : 'FAILED'}`);

    if (testResult) {
        console.log('\n🎉 ALL TESTS PASSED! The teacher reassignment fix is working correctly.');
        console.log('✅ Old teachers properly lose access when reassigned');
        console.log('✅ New teachers properly gain access when assigned');
    } else {
        console.log('\n❌ TESTS FAILED! The fix needs further investigation.');
    }
}

runTests().catch(console.error);
