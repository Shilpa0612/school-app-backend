/**
 * Test script to verify the parent homework filtering fix
 * This script tests the /api/homework endpoint with student_id parameter
 */

import axios from 'axios';

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

async function testParentHomeworkFiltering() {
    console.log('🧪 Testing Parent Homework Filtering Fix...\n');

    try {
        // Test 1: Login as Parent (Amit - has children in Grade 1 A and Grade 7 A)
        console.log('1. Logging in as Parent Amit (has children in Grade 1 A and Grade 7 A)...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: '8087478036',
            password: 'password123'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful');

        // Test 2: Get parent's children
        console.log('\n2. Getting parent\'s children...');
        const childrenResponse = await axios.get(`${BASE_URL}/users/children`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const children = childrenResponse.data.data.children;
        console.log('👶 Parent\'s Children:');
        children.forEach(child => {
            console.log(`   - ${child.full_name} (ID: ${child.id}) - Class: ${child.current_class?.name || 'Unknown'}`);
        });

        // Test 3: Test homework access without student_id (should see all children's homework)
        console.log('\n3. Testing homework access without student_id (all children)...');
        const allHomeworkResponse = await axios.get(`${BASE_URL}/homework`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                page: 1,
                limit: 50
            }
        });

        const allHomework = allHomeworkResponse.data.data.homework;
        console.log(`📚 Found ${allHomework.length} homework assignments for all children`);

        // Analyze homework by class
        const homeworkByClass = {};
        allHomework.forEach(hw => {
            const className = hw.class_division?.level?.name + ' ' + hw.class_division?.division;
            if (!homeworkByClass[className]) {
                homeworkByClass[className] = [];
            }
            homeworkByClass[className].push({
                id: hw.id,
                title: hw.title,
                subject: hw.subject
            });
        });

        console.log('📊 Homework by class:');
        Object.keys(homeworkByClass).forEach(className => {
            console.log(`   - ${className}: ${homeworkByClass[className].length} assignments`);
        });

        // Test 4: Test homework access with specific student_id (Grade 1 A child)
        const grade1Child = children.find(child =>
            child.current_class?.name === 'Grade 1' && child.current_class?.division === 'A'
        );

        if (grade1Child) {
            console.log(`\n4. Testing homework access for specific child: ${grade1Child.full_name} (Grade 1 A)...`);
            const specificHomeworkResponse = await axios.get(`${BASE_URL}/homework`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    student_id: grade1Child.id,
                    page: 1,
                    limit: 50
                }
            });

            const specificHomework = specificHomeworkResponse.data.data.homework;
            console.log(`📚 Found ${specificHomework.length} homework assignments for ${grade1Child.full_name}`);

            // Verify all homework is for Grade 1 A only
            const unauthorizedHomework = specificHomework.filter(hw => {
                const className = hw.class_division?.level?.name + ' ' + hw.class_division?.division;
                return className !== 'Grade 1 A';
            });

            if (unauthorizedHomework.length > 0) {
                console.log('\n🚨 SECURITY ISSUE: Parent can see homework from unauthorized classes:');
                unauthorizedHomework.forEach(hw => {
                    const className = hw.class_division?.level?.name + ' ' + hw.class_division?.division;
                    console.log(`   - "${hw.title}" (Class: ${className})`);
                });
                return false;
            } else {
                console.log('\n✅ SECURITY FIX SUCCESSFUL: Parent can only see homework for the specified child\'s class');
            }
        }

        // Test 5: Test unauthorized student_id access
        console.log('\n5. Testing unauthorized student_id access...');
        try {
            const unauthorizedResponse = await axios.get(`${BASE_URL}/homework`, {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    student_id: '00000000-0000-0000-0000-000000000000', // Non-existent student ID
                    page: 1,
                    limit: 50
                }
            });

            console.log('🚨 SECURITY ISSUE: Parent can access homework with invalid student_id');
            return false;
        } catch (error) {
            if (error.response?.status === 403) {
                console.log('✅ SECURITY FIX SUCCESSFUL: Parent cannot access homework with invalid student_id');
            } else {
                console.log('❌ Unexpected error:', error.response?.data || error.message);
                return false;
            }
        }

        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        return false;
    }
}

async function testParentWithSingleChild() {
    console.log('\n🧪 Testing Parent with Single Child...\n');

    try {
        // Test with Anil Saluba Misal (has child in Grade 2 A only)
        console.log('1. Logging in as Parent Anil Saluba Misal (has child in Grade 2 A only)...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            phone_number: '8484952644',
            password: 'password123'
        });

        const token = loginResponse.data.data.token;
        console.log('✅ Login successful');

        // Test 2: Get parent's children
        console.log('\n2. Getting parent\'s children...');
        const childrenResponse = await axios.get(`${BASE_URL}/users/children`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const children = childrenResponse.data.data.children;
        console.log('👶 Parent\'s Children:');
        children.forEach(child => {
            console.log(`   - ${child.full_name} (ID: ${child.id}) - Class: ${child.current_class?.name || 'Unknown'}`);
        });

        // Test 3: Test homework access for the child
        const child = children[0]; // Should be only one child
        console.log(`\n3. Testing homework access for child: ${child.full_name}...`);
        const homeworkResponse = await axios.get(`${BASE_URL}/homework`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
                student_id: child.id,
                page: 1,
                limit: 50
            }
        });

        const homework = homeworkResponse.data.data.homework;
        console.log(`📚 Found ${homework.length} homework assignments for ${child.full_name}`);

        // Verify all homework is for Grade 2 A only
        const unauthorizedHomework = homework.filter(hw => {
            const className = hw.class_division?.level?.name + ' ' + hw.class_division?.division;
            return className !== 'Grade 2 A';
        });

        if (unauthorizedHomework.length > 0) {
            console.log('\n🚨 SECURITY ISSUE: Parent can see homework from unauthorized classes:');
            unauthorizedHomework.forEach(hw => {
                const className = hw.class_division?.level?.name + ' ' + hw.class_division?.division;
                console.log(`   - "${hw.title}" (Class: ${className})`);
            });
            return false;
        } else {
            console.log('\n✅ SECURITY FIX SUCCESSFUL: Parent can only see homework for their child\'s class');
            return true;
        }

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        return false;
    }
}

// Run tests
async function runTests() {
    console.log('🔧 Testing Parent Homework Filtering Fix\n');
    console.log('='.repeat(60));

    const test1Result = await testParentHomeworkFiltering();
    const test2Result = await testParentWithSingleChild();

    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL RESULTS:');
    console.log(`✅ Multi-child parent test: ${test1Result ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Single-child parent test: ${test2Result ? 'PASSED' : 'FAILED'}`);

    if (test1Result && test2Result) {
        console.log('\n🎉 ALL TESTS PASSED! The homework filtering fix is working correctly.');
    } else {
        console.log('\n❌ SOME TESTS FAILED! The fix needs further investigation.');
    }
}

runTests().catch(console.error);
