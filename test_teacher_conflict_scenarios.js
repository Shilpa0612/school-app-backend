/**
 * Test script for teacher conflict scenarios
 * Tests what happens when the same teacher is assigned to multiple classes at the same time
 */

import { config } from 'dotenv';
config();

const API_BASE_URL = process.env.API_BASE_URL || 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api';

// Example test data - replace with actual IDs from your database
const testData = {
    auth_token: 'your-auth-token-here', // Replace with actual token
    config_id: '550e8400-e29b-41d4-a716-446655440000', // Replace with actual config ID
    teacher_id: '550e8400-e29b-41d4-a716-446655440001', // Replace with actual teacher ID
    class1_id: '550e8400-e29b-41d4-a716-446655440002', // Replace with actual class ID
    class2_id: '550e8400-e29b-41d4-a716-446655440003', // Replace with actual class ID
};

async function testTeacherConflictScenarios() {
    console.log('🧪 Testing Teacher Conflict Scenarios\n');
    console.log('='.repeat(60));

    console.log('\n📋 Scenario: Same teacher assigned to different classes at same time');
    console.log('-'.repeat(50));

    // Step 1: Create first timetable entry
    console.log('\n1️⃣ Creating first timetable entry...');
    const firstEntry = await createTimetableEntry({
        config_id: testData.config_id,
        class_division_id: testData.class1_id,
        period_number: 2,
        day_of_week: 1, // Monday
        subject: 'Mathematics',
        teacher_id: testData.teacher_id,
        notes: 'First assignment'
    });

    if (firstEntry.success) {
        console.log('✅ First entry created successfully');
        console.log(`   Teacher assigned to Class 1, Period 2, Monday`);
    } else {
        console.log('❌ Failed to create first entry:', firstEntry.error);
        return;
    }

    // Step 2: Try to create conflicting entry (same teacher, same period, same day, different class)
    console.log('\n2️⃣ Attempting to create conflicting entry...');
    const conflictEntry = await createTimetableEntry({
        config_id: testData.config_id,
        class_division_id: testData.class2_id, // Different class
        period_number: 2, // Same period
        day_of_week: 1, // Same day (Monday)
        subject: 'Science',
        teacher_id: testData.teacher_id, // Same teacher
        notes: 'Conflicting assignment'
    });

    if (!conflictEntry.success) {
        console.log('✅ Conflict detected correctly!');
        console.log('📄 Error Response:');
        console.log(JSON.stringify(conflictEntry.error, null, 2));

        // Analyze the error response
        analyzeErrorResponse(conflictEntry.error);
    } else {
        console.log('❌ PROBLEM: Conflict was NOT detected! Entry was created incorrectly.');
        console.log('📄 Response:', JSON.stringify(conflictEntry.data, null, 2));
    }

    // Step 3: Test different period (should work)
    console.log('\n3️⃣ Testing different period (should work)...');
    const validEntry = await createTimetableEntry({
        config_id: testData.config_id,
        class_division_id: testData.class2_id,
        period_number: 3, // Different period
        day_of_week: 1, // Same day
        subject: 'Science',
        teacher_id: testData.teacher_id, // Same teacher
        notes: 'Valid assignment - different period'
    });

    if (validEntry.success) {
        console.log('✅ Valid entry created successfully');
        console.log('   Same teacher, same day, but different period - OK');
    } else {
        console.log('❌ Unexpected error for valid entry:', validEntry.error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Teacher conflict testing completed');
}

async function createTimetableEntry(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/timetable/entries`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${testData.auth_token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        return {
            success: response.ok,
            data: response.ok ? result : null,
            error: !response.ok ? result : null,
            status: response.status
        };
    } catch (error) {
        return {
            success: false,
            error: { message: error.message },
            status: 500
        };
    }
}

function analyzeErrorResponse(error) {
    console.log('\n🔍 Error Response Analysis:');
    console.log('─'.repeat(30));

    const checks = [
        { field: 'status', expected: 'error', actual: error.status },
        { field: 'message', expected: 'Teacher schedule conflict', actual: error.message },
        { field: 'error_code', expected: 'TEACHER_CONFLICT', actual: error.error_code },
        { field: 'details', expected: 'contains conflict info', actual: !!error.details },
        { field: 'suggestion', expected: 'actionable advice', actual: !!error.suggestion },
        { field: 'conflict_data', expected: 'conflict details', actual: !!error.conflict_data }
    ];

    checks.forEach(check => {
        const passed = typeof check.expected === 'string'
            ? check.actual === check.expected
            : check.actual === check.expected;

        const status = passed ? '✅' : '❌';
        console.log(`${status} ${check.field}: ${check.actual} ${passed ? '' : `(expected: ${check.expected})`}`);
    });

    if (error.conflict_data) {
        console.log('\n📊 Conflict Data:');
        Object.entries(error.conflict_data).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
    }
}

// Instructions for running the test
console.log('📝 Before running this test:');
console.log('1. Replace testData values with actual IDs from your database');
console.log('2. Replace auth_token with a valid JWT token');
console.log('3. Ensure the teacher and classes exist in your database');
console.log('4. Run: node test_teacher_conflict_scenarios.js\n');

// Uncomment the line below to run the test
// testTeacherConflictScenarios().catch(console.error);
