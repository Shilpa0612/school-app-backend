/**
 * Test script for enhanced timetable error handling
 * Tests various error scenarios to ensure proper error responses
 */

import { config } from 'dotenv';
config();

const API_BASE_URL = process.env.API_BASE_URL || 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// Test data sets for different error scenarios
const testScenarios = [
    {
        name: 'Invalid UUID format',
        data: {
            config_id: 'invalid-uuid',
            class_division_id: 'another-invalid-uuid',
            period_number: 1,
            day_of_week: 1,
            subject: 'Test Subject'
        },
        expectedError: '22P02'
    },
    {
        name: 'Missing required fields',
        data: {
            period_number: 1,
            day_of_week: 1
        },
        expectedError: 'VALIDATION_ERROR'
    },
    {
        name: 'Non-existent config_id',
        data: {
            config_id: '550e8400-e29b-41d4-a716-446655440000',
            class_division_id: '550e8400-e29b-41d4-a716-446655440001',
            period_number: 1,
            day_of_week: 1,
            subject: 'Test Subject'
        },
        expectedError: '23503'
    },
    {
        name: 'Invalid period number (too high)',
        data: {
            config_id: '550e8400-e29b-41d4-a716-446655440000',
            class_division_id: '550e8400-e29b-41d4-a716-446655440001',
            period_number: 999,
            day_of_week: 1,
            subject: 'Test Subject'
        },
        expectedError: 'VALIDATION_ERROR'
    },
    {
        name: 'Invalid day of week',
        data: {
            config_id: '550e8400-e29b-41d4-a716-446655440000',
            class_division_id: '550e8400-e29b-41d4-a716-446655440001',
            period_number: 1,
            day_of_week: 8,
            subject: 'Test Subject'
        },
        expectedError: 'VALIDATION_ERROR'
    }
];

async function testTimetableErrorHandling() {
    console.log('🧪 Testing Enhanced Timetable Error Handling\n');
    console.log('='.repeat(60));

    for (const scenario of testScenarios) {
        console.log(`\n📋 Testing: ${scenario.name}`);
        console.log('-'.repeat(40));

        try {
            const response = await fetch(`${API_BASE_URL}/timetable/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer your-test-token-here' // Replace with actual token
                },
                body: JSON.stringify(scenario.data)
            });

            const result = await response.json();

            console.log(`Status: ${response.status}`);
            console.log(`Response:`, JSON.stringify(result, null, 2));

            // Check if error response has expected structure
            if (!response.ok && result.status === 'error') {
                console.log('✅ Error response has proper structure');

                const hasRequiredFields = [
                    'message',
                    'details',
                    'suggestion'
                ].every(field => result.hasOwnProperty(field));

                if (hasRequiredFields) {
                    console.log('✅ All required error fields present');
                } else {
                    console.log('❌ Missing required error fields');
                }

                if (result.error_code) {
                    console.log(`✅ Error code provided: ${result.error_code}`);
                } else {
                    console.log('⚠️  No error code provided');
                }

                if (result.timestamp) {
                    console.log(`✅ Timestamp provided: ${result.timestamp}`);
                }

            } else {
                console.log('❌ Unexpected response format');
            }

        } catch (error) {
            console.log('❌ Request failed:', error.message);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Error handling testing completed');
    console.log('\n📝 Expected improvements:');
    console.log('   • Specific error messages instead of generic 500 errors');
    console.log('   • Error codes for programmatic handling');
    console.log('   • Detailed explanations and suggestions');
    console.log('   • Proper HTTP status codes (400, 404, etc.)');
    console.log('   • Enhanced logging for debugging');
}

// Run the test
testTimetableErrorHandling().catch(console.error);
