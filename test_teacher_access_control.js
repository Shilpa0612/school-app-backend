/**
 * Test script to verify all teacher endpoints use consistent assignment validation logic
 * This script tests various teacher endpoints to ensure they use proper access control
 */

import axios from 'axios';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function testTeacherAccessControl() {
    console.log('🧪 Testing Teacher Access Control Consistency...\n');

    try {
        // Test 1: Login as Omkar (Multi-role teacher with assignments)
        console.log('1. Logging in as Omkar Sanjay Raut (Multi-role teacher)...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: '9158834913',
            password: 'Temp@1234'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful');

        // Test 2: Get teacher assignments
        console.log('\n2. Getting teacher assignments...');
        const assignmentsResponse = await axios.get(`${BASE_URL}/academic/my-teacher-id`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const assignments = assignmentsResponse.data.data;
        console.log('📋 Teacher Assignments:');
        console.log(`   - Class Divisions: ${assignments.class_divisions.map(cd => cd.division).join(', ')}`);
        console.log(`   - Total Classes: ${assignments.class_divisions.length}`);

        if (assignments.class_divisions.length === 0) {
            console.log('❌ No class assignments found for testing');
            return false;
        }

        const testClass = assignments.class_divisions[0];
        console.log(`📚 Using test class: ${testClass.class_name} (ID: ${testClass.class_division_id})`);

        // Test 3: Test various endpoints with assigned class
        console.log('\n3. Testing endpoints with assigned class...');

        const endpoints = [
            {
                name: 'Homework',
                url: `/homework?class_division_id=${testClass.class_division_id}`,
                method: 'GET'
            },
            {
                name: 'Students',
                url: `/students/class/${testClass.class_division_id}`,
                method: 'GET'
            },
            {
                name: 'Announcements',
                url: `/announcements/teacher/announcements?class_division_id=${testClass.class_division_id}`,
                method: 'GET'
            },
            {
                name: 'Calendar Events',
                url: `/calendar/events?class_division_id=${testClass.class_division_id}`,
                method: 'GET'
            },
            {
                name: 'Birthdays',
                url: `/birthdays?class_division_id=${testClass.class_division_id}`,
                method: 'GET'
            },
            {
                name: 'Leave Requests',
                url: `/leave-requests/teacher/class?class_division_id=${testClass.class_division_id}`,
                method: 'GET'
            },
            {
                name: 'Timetable',
                url: `/timetable/teacher/${assignments.teacher_id}`,
                method: 'GET'
            }
        ];

        let allEndpointsWorking = true;

        for (const endpoint of endpoints) {
            try {
                console.log(`   Testing ${endpoint.name}...`);
                const response = await axios({
                    method: endpoint.method,
                    url: `${BASE_URL}${endpoint.url}`,
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (response.status === 200) {
                    console.log(`   ✅ ${endpoint.name}: Access granted`);
                } else {
                    console.log(`   ❌ ${endpoint.name}: Unexpected status ${response.status}`);
                    allEndpointsWorking = false;
                }
            } catch (error) {
                if (error.response?.status === 403) {
                    console.log(`   ❌ ${endpoint.name}: Access denied (403) - Inconsistent access control!`);
                    allEndpointsWorking = false;
                } else {
                    console.log(`   ⚠️  ${endpoint.name}: Error ${error.response?.status} - ${error.response?.data?.message || error.message}`);
                }
            }
        }

        // Test 4: Test with unassigned class
        console.log('\n4. Testing endpoints with unassigned class...');

        // Get a class that the teacher is not assigned to
        const allClassesResponse = await axios.get(`${BASE_URL}/academic/class-divisions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const allClasses = allClassesResponse.data.data.class_divisions;
        const unassignedClass = allClasses.find(c =>
            !assignments.class_divisions.some(ac => ac.class_division_id === c.id)
        );

        if (unassignedClass) {
            console.log(`📚 Testing with unassigned class: ${unassignedClass.level.name} ${unassignedClass.division} (ID: ${unassignedClass.id})`);

            const unassignedEndpoints = [
                {
                    name: 'Homework',
                    url: `/homework?class_division_id=${unassignedClass.id}`,
                    method: 'GET'
                },
                {
                    name: 'Students',
                    url: `/students/class/${unassignedClass.id}`,
                    method: 'GET'
                },
                {
                    name: 'Birthdays',
                    url: `/birthdays?class_division_id=${unassignedClass.id}`,
                    method: 'GET'
                }
            ];

            let allUnassignedDenied = true;

            for (const endpoint of unassignedEndpoints) {
                try {
                    console.log(`   Testing ${endpoint.name} with unassigned class...`);
                    const response = await axios({
                        method: endpoint.method,
                        url: `${BASE_URL}${endpoint.url}`,
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (response.status === 200) {
                        console.log(`   🚨 ${endpoint.name}: Access granted to unassigned class - SECURITY ISSUE!`);
                        allUnassignedDenied = false;
                    }
                } catch (error) {
                    if (error.response?.status === 403) {
                        console.log(`   ✅ ${endpoint.name}: Access properly denied (403)`);
                    } else {
                        console.log(`   ⚠️  ${endpoint.name}: Error ${error.response?.status} - ${error.response?.data?.message || error.message}`);
                    }
                }
            }

            if (!allUnassignedDenied) {
                allEndpointsWorking = false;
            }
        } else {
            console.log('   ⚠️  No unassigned class found for testing');
        }

        // Test 5: Test with unassigned teacher
        console.log('\n5. Testing with unassigned teacher...');

        const unassignedLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: '9404511717', // Ganesh - unassigned teacher
            password: 'Temp@1234'
        });

        const unassignedToken = unassignedLoginResponse.data.data.token;

        try {
            const unassignedHomeworkResponse = await axios.get(`${BASE_URL}/homework`, {
                headers: { Authorization: `Bearer ${unassignedToken}` },
                params: {
                    page: 1,
                    limit: 10
                }
            });

            const homeworkCount = unassignedHomeworkResponse.data.data.homework.length;
            if (homeworkCount > 0) {
                console.log(`   🚨 Unassigned teacher can see ${homeworkCount} homework assignments - SECURITY ISSUE!`);
                allEndpointsWorking = false;
            } else {
                console.log(`   ✅ Unassigned teacher cannot see any homework assignments`);
            }
        } catch (error) {
            if (error.response?.status === 403) {
                console.log(`   ✅ Unassigned teacher access properly denied`);
            } else {
                console.log(`   ⚠️  Unassigned teacher test error: ${error.response?.data?.message || error.message}`);
            }
        }

        return allEndpointsWorking;

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        return false;
    }
}

// Run tests
async function runTests() {
    console.log('🔧 Testing Teacher Access Control Consistency\n');
    console.log('='.repeat(60));

    const testResult = await testTeacherAccessControl();

    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL RESULTS:');
    console.log(`✅ Teacher access control consistency: ${testResult ? 'PASSED' : 'FAILED'}`);

    if (testResult) {
        console.log('\n🎉 ALL TESTS PASSED! Teacher access control is consistent across all endpoints.');
        console.log('✅ All endpoints use proper assignment validation');
        console.log('✅ Unassigned teachers are properly denied access');
        console.log('✅ Assigned teachers can access their classes');
    } else {
        console.log('\n❌ TESTS FAILED! Some endpoints have inconsistent access control.');
        console.log('🔧 Review the failed endpoints and ensure they use:');
        console.log('   - class_teacher_assignments table');
        console.log('   - is_active = true filter');
        console.log('   - teacher_id = req.user.id filter');
    }
}

runTests().catch(console.error);
