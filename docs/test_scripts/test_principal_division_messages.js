const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const PRINCIPAL_TOKEN = 'your_principal_jwt_token_here'; // Replace with actual token
const CLASS_DIVISION_ID = 'your_class_division_id_here'; // Replace with actual class division ID

// Test cases
const testCases = [
    {
        name: 'Get all messages for division',
        url: `${BASE_URL}/users/principal/division/${CLASS_DIVISION_ID}/messages`,
        method: 'GET'
    },
    {
        name: 'Get messages with pagination',
        url: `${BASE_URL}/users/principal/division/${CLASS_DIVISION_ID}/messages?page=1&limit=10`,
        method: 'GET'
    },
    {
        name: 'Get messages with date filter',
        url: `${BASE_URL}/users/principal/division/${CLASS_DIVISION_ID}/messages?start_date=2024-01-01&end_date=2024-12-31`,
        method: 'GET'
    },
    {
        name: 'Get text messages only',
        url: `${BASE_URL}/users/principal/division/${CLASS_DIVISION_ID}/messages?message_type=text`,
        method: 'GET'
    },
    {
        name: 'Get messages with all filters',
        url: `${BASE_URL}/users/principal/division/${CLASS_DIVISION_ID}/messages?page=1&limit=5&start_date=2024-06-01&end_date=2024-06-30&message_type=text`,
        method: 'GET'
    }
];

// Error test cases
const errorTestCases = [
    {
        name: 'Invalid class division ID format',
        url: `${BASE_URL}/users/principal/division/invalid-uuid/messages`,
        method: 'GET',
        expectError: true
    },
    {
        name: 'Non-existent class division ID',
        url: `${BASE_URL}/users/principal/division/123e4567-e89b-12d3-a456-426614174000/messages`,
        method: 'GET',
        expectError: true
    }
];

async function runTest(testCase) {
    try {
        console.log(`\n🧪 Running test: ${testCase.name}`);
        console.log(`📡 ${testCase.method} ${testCase.url}`);

        const response = await axios({
            method: testCase.method,
            url: testCase.url,
            headers: {
                'Authorization': `Bearer ${PRINCIPAL_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (testCase.expectError) {
            console.log('❌ Expected error but got success response');
            return false;
        }

        console.log(`✅ Status: ${response.status}`);
        console.log(`📊 Response structure:`);

        const data = response.data;
        if (data.status === 'success') {
            console.log(`   - Class Division: ${data.data.class_division?.class_name || 'N/A'}`);
            console.log(`   - Total Teachers: ${data.data.summary?.total_teachers || 0}`);
            console.log(`   - Total Threads: ${data.data.summary?.total_threads || 0}`);
            console.log(`   - Total Messages: ${data.data.total_messages || 0}`);
            console.log(`   - Messages Found: ${data.data.summary?.messages_found || 0}`);
            console.log(`   - Pagination: Page ${data.data.pagination?.page || 1} of ${data.data.pagination?.total_pages || 1}`);

            // Show sample teachers
            if (data.data.teachers && data.data.teachers.length > 0) {
                console.log(`   - Sample Teachers:`);
                data.data.teachers.slice(0, 3).forEach(teacher => {
                    console.log(`     • ${teacher.full_name} (${teacher.assignment_type}) - ${teacher.subject || 'N/A'}`);
                });
            }

            // Show sample threads
            if (data.data.threads && data.data.threads.length > 0) {
                console.log(`   - Sample Threads:`);
                data.data.threads.slice(0, 2).forEach(thread => {
                    console.log(`     • ${thread.thread_title} (${thread.messages?.length || 0} messages)`);
                });
            }
        } else {
            console.log(`❌ API Error: ${data.message || 'Unknown error'}`);
            return false;
        }

        return true;

    } catch (error) {
        if (testCase.expectError) {
            console.log(`✅ Expected error received: ${error.response?.data?.message || error.message}`);
            return true;
        } else {
            console.log(`❌ Unexpected error: ${error.response?.data?.message || error.message}`);
            if (error.response?.status) {
                console.log(`   Status: ${error.response.status}`);
            }
            return false;
        }
    }
}

async function runAllTests() {
    console.log('🚀 Starting Principal Division Messages API Tests');
    console.log('='.repeat(60));

    if (PRINCIPAL_TOKEN === 'your_principal_jwt_token_here') {
        console.log('❌ Please update PRINCIPAL_TOKEN with a valid JWT token');
        return;
    }

    if (CLASS_DIVISION_ID === 'your_class_division_id_here') {
        console.log('❌ Please update CLASS_DIVISION_ID with a valid class division UUID');
        return;
    }

    let passedTests = 0;
    let totalTests = testCases.length + errorTestCases.length;

    // Run success test cases
    console.log('\n📋 Running Success Test Cases:');
    for (const testCase of testCases) {
        const passed = await runTest(testCase);
        if (passed) passedTests++;
    }

    // Run error test cases
    console.log('\n📋 Running Error Test Cases:');
    for (const testCase of errorTestCases) {
        const passed = await runTest(testCase);
        if (passed) passedTests++;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);

    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! The API endpoint is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Please check the implementation.');
    }
}

// Helper function to test with different tokens
async function testWithDifferentRoles() {
    console.log('\n🔐 Testing Access Control:');

    const testRoles = [
        { role: 'teacher', token: 'teacher_token_here' },
        { role: 'parent', token: 'parent_token_here' },
        { role: 'admin', token: 'admin_token_here' }
    ];

    for (const roleTest of testRoles) {
        if (roleTest.token === `${roleTest.role}_token_here`) {
            console.log(`⏭️  Skipping ${roleTest.role} test - no token provided`);
            continue;
        }

        try {
            const response = await axios({
                method: 'GET',
                url: `${BASE_URL}/users/principal/division/${CLASS_DIVISION_ID}/messages`,
                headers: {
                    'Authorization': `Bearer ${roleTest.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (roleTest.role === 'admin') {
                console.log(`✅ ${roleTest.role}: Access granted (expected)`);
            } else {
                console.log(`❌ ${roleTest.role}: Access granted (unexpected - should be denied)`);
            }
        } catch (error) {
            if (error.response?.status === 403) {
                console.log(`✅ ${roleTest.role}: Access denied (expected)`);
            } else {
                console.log(`❌ ${roleTest.role}: Unexpected error: ${error.message}`);
            }
        }
    }
}

// Run the tests
if (require.main === module) {
    runAllTests()
        .then(() => {
            console.log('\n🔐 Testing Access Control...');
            return testWithDifferentRoles();
        })
        .then(() => {
            console.log('\n✨ All tests completed!');
        })
        .catch(error => {
            console.error('💥 Test runner error:', error.message);
        });
}

module.exports = {
    runAllTests,
    testWithDifferentRoles,
    runTest
};
