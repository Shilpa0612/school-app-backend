import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
const TEACHER_TOKEN = 'your_teacher_jwt_token_here'; // Replace with actual token

async function testDivisionParents() {
    console.log('🧪 Testing Division Parents Endpoint\n');

    try {
        // Test 1: Get parents for a valid class division
        console.log('📋 Test 1: Get Parents for Valid Class Division');
        const classDivisionId = '123e4567-e89b-12d3-a456-426614174000'; // Replace with actual UUID

        const response1 = await fetch(`${BASE_URL}/users/division/${classDivisionId}/parents`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response1.ok) {
            const data1 = await response1.json();
            console.log('✅ Success:', {
                status: response1.status,
                class_division_id: data1.data?.class_division_id,
                total_students: data1.data?.total_students,
                total_parents: data1.data?.total_parents,
                students_with_parents: data1.data?.summary?.students_with_parents,
                students_without_parents: data1.data?.summary?.students_without_parents
            });

            // Show sample student data
            if (data1.data?.students?.length > 0) {
                const sampleStudent = data1.data.students[0];
                console.log('📚 Sample Student Data:', {
                    student_name: sampleStudent.student.name,
                    roll_number: sampleStudent.student.roll_number,
                    parent_count: sampleStudent.parents.length,
                    primary_guardian: sampleStudent.parents.find(p => p.is_primary_guardian)?.name || 'None'
                });
            }
        } else {
            const errorData = await response1.json();
            console.log('❌ Failed:', response1.status, errorData.message || response1.statusText);
        }

        // Test 2: Test with invalid UUID format
        console.log('\n📋 Test 2: Test with Invalid UUID Format');
        const response2 = await fetch(`${BASE_URL}/users/division/invalid-uuid/parents`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response2.ok) {
            console.log('❌ Unexpected success with invalid UUID');
        } else {
            const errorData = await response2.json();
            console.log('✅ Correctly rejected invalid UUID:', {
                status: response2.status,
                message: errorData.message
            });
        }

        // Test 3: Test with non-existent class division
        console.log('\n📋 Test 3: Test with Non-existent Class Division');
        const nonExistentId = '00000000-0000-0000-0000-000000000000';
        const response3 = await fetch(`${BASE_URL}/users/division/${nonExistentId}/parents`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response3.ok) {
            const data3 = await response3.json();
            console.log('✅ Success (empty result):', {
                status: response3.status,
                total_students: data3.data?.total_students,
                total_parents: data3.data?.total_parents
            });
        } else {
            const errorData = await response3.json();
            console.log('❌ Failed:', response3.status, errorData.message || response3.statusText);
        }

        // Test 4: Test unauthorized access (teacher without access to division)
        console.log('\n📋 Test 4: Test Unauthorized Access');
        const unauthorizedId = '11111111-1111-1111-1111-111111111111'; // Different division
        const response4 = await fetch(`${BASE_URL}/users/division/${unauthorizedId}/parents`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response4.ok) {
            console.log('❌ Unexpected success with unauthorized access');
        } else {
            const errorData = await response4.json();
            console.log('✅ Correctly rejected unauthorized access:', {
                status: response4.status,
                message: errorData.message
            });
        }

        console.log('\n✅ All Division Parents tests completed!');

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

// Test data structure validation
async function validateDataStructure() {
    console.log('\n🔍 Validating Data Structure\n');

    try {
        const classDivisionId = '123e4567-e89b-12d3-a456-426614174000'; // Replace with actual UUID

        const response = await fetch(`${BASE_URL}/users/division/${classDivisionId}/parents`, {
            headers: {
                'Authorization': `Bearer ${TEACHER_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();

            console.log('📊 Data Structure Validation:');

            // Check required fields
            const requiredFields = ['class_division_id', 'students', 'total_students', 'total_parents', 'summary'];
            requiredFields.forEach(field => {
                const exists = data.data && data.data[field] !== undefined;
                console.log(`  ${exists ? '✅' : '❌'} ${field}: ${exists ? 'Present' : 'Missing'}`);
            });

            // Check student structure
            if (data.data?.students?.length > 0) {
                const sampleStudent = data.data.students[0];
                console.log('\n📚 Student Structure Validation:');

                const studentFields = ['id', 'name', 'roll_number'];
                studentFields.forEach(field => {
                    const exists = sampleStudent.student && sampleStudent.student[field] !== undefined;
                    console.log(`  ${exists ? '✅' : '❌'} student.${field}: ${exists ? 'Present' : 'Missing'}`);
                });

                // Check parent structure
                if (sampleStudent.parents?.length > 0) {
                    const sampleParent = sampleStudent.parents[0];
                    console.log('\n👨‍👩‍👧‍👦 Parent Structure Validation:');

                    const parentFields = ['id', 'name', 'email', 'phone_number', 'relationship', 'is_primary_guardian'];
                    parentFields.forEach(field => {
                        const exists = sampleParent[field] !== undefined;
                        console.log(`  ${exists ? '✅' : '❌'} parent.${field}: ${exists ? 'Present' : 'Missing'}`);
                    });
                }
            }

            // Check summary structure
            if (data.data?.summary) {
                console.log('\n📋 Summary Structure Validation:');
                const summaryFields = ['students_with_parents', 'students_without_parents'];
                summaryFields.forEach(field => {
                    const exists = data.data.summary[field] !== undefined;
                    console.log(`  ${exists ? '✅' : '❌'} summary.${field}: ${exists ? 'Present' : 'Missing'}`);
                });
            }

        } else {
            console.log('❌ Could not validate data structure - request failed');
        }

    } catch (error) {
        console.error('❌ Data structure validation failed:', error.message);
    }
}

// Run tests
async function runAllTests() {
    console.log('🚀 Starting Division Parents API Tests\n');

    await testDivisionParents();
    await validateDataStructure();

    console.log('\n🎉 All tests completed!');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests();
}

export { testDivisionParents, validateDataStructure };

