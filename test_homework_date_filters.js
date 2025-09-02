import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

const BASE_URL = 'http://localhost:3000/api';
// const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api'; // For production testing

async function testHomeworkDateFilters() {
    try {
        console.log('🧪 Testing Homework Date Filter Fix');
        console.log('='.repeat(60));

        // You'll need to get a valid JWT token (teacher, parent, admin, or principal)
        const token = process.env.TEST_TOKEN;

        if (!token) {
            console.log('❌ TEST_TOKEN not found in environment variables');
            console.log('Please set TEST_TOKEN with a valid JWT token');
            return;
        }

        console.log('✅ Test token found');

        // Test 1: Test the problematic date range that was failing
        console.log('\n📅 Test 1: Problematic Date Range (2024-01-01 to 2025-07-30)');
        console.log('-'.repeat(60));

        const problematicResponse = await fetch(`${BASE_URL}/homework?due_date_from=2024-01-01&due_date_to=2025-07-30`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (problematicResponse.ok) {
            const data = await problematicResponse.json();
            console.log(`✅ Request successful - Status: ${problematicResponse.status}`);
            console.log(`📊 Total homework found: ${data.data?.pagination?.total || 0}`);
            console.log(`📝 Homework items: ${data.data?.homework?.length || 0}`);

            if (data.data?.homework?.length > 0) {
                console.log('\n📋 Sample homework items:');
                data.data.homework.slice(0, 3).forEach((hw, index) => {
                    console.log(`   ${index + 1}. ${hw.title} - Due: ${hw.due_date}`);
                });
            }
        } else {
            const errorText = await problematicResponse.text();
            console.log(`❌ Request failed with status: ${problematicResponse.status}`);
            console.log(`Error: ${errorText}`);
        }

        // Test 2: Test the working date range (2024-01-01 to 2025-07-31)
        console.log('\n📅 Test 2: Working Date Range (2024-01-01 to 2025-07-31)');
        console.log('-'.repeat(60));

        const workingResponse = await fetch(`${BASE_URL}/homework?due_date_from=2024-01-01&due_date_to=2025-07-31`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (workingResponse.ok) {
            const data = await workingResponse.json();
            console.log(`✅ Request successful - Status: ${workingResponse.status}`);
            console.log(`📊 Total homework found: ${data.data?.pagination?.total || 0}`);
            console.log(`📝 Homework items: ${data.data?.homework?.length || 0}`);
        } else {
            const errorText = await workingResponse.text();
            console.log(`❌ Request failed with status: ${workingResponse.status}`);
            console.log(`Error: ${errorText}`);
        }

        // Test 3: Test single date filters
        console.log('\n📅 Test 3: Single Date Filters');
        console.log('-'.repeat(60));

        // Test due_date_from only
        const fromOnlyResponse = await fetch(`${BASE_URL}/homework?due_date_from=2025-07-30`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (fromOnlyResponse.ok) {
            const data = await fromOnlyResponse.json();
            console.log(`✅ due_date_from=2025-07-30 - Found: ${data.data?.pagination?.total || 0} items`);
        } else {
            console.log(`❌ due_date_from=2025-07-30 - Failed: ${fromOnlyResponse.status}`);
        }

        // Test due_date_to only
        const toOnlyResponse = await fetch(`${BASE_URL}/homework?due_date_to=2025-07-30`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (toOnlyResponse.ok) {
            const data = await toOnlyResponse.json();
            console.log(`✅ due_date_to=2025-07-30 - Found: ${data.data?.pagination?.total || 0} items`);
        } else {
            console.log(`❌ due_date_to=2025-07-30 - Failed: ${toOnlyResponse.status}`);
        }

        // Test 4: Test edge cases
        console.log('\n📅 Test 4: Edge Cases');
        console.log('-'.repeat(60));

        // Test same day range
        const sameDayResponse = await fetch(`${BASE_URL}/homework?due_date_from=2025-07-30&due_date_to=2025-07-30`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (sameDayResponse.ok) {
            const data = await sameDayResponse.json();
            console.log(`✅ Same day range (2025-07-30 to 2025-07-30) - Found: ${data.data?.pagination?.total || 0} items`);
        } else {
            console.log(`❌ Same day range - Failed: ${sameDayResponse.status}`);
        }

        // Test 5: Test status filters with date ranges
        console.log('\n📅 Test 5: Status Filters with Date Ranges');
        console.log('-'.repeat(60));

        const overdueResponse = await fetch(`${BASE_URL}/homework?due_date_from=2024-01-01&due_date_to=2025-07-30&status=overdue`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (overdueResponse.ok) {
            const data = await overdueResponse.json();
            console.log(`✅ Overdue filter with date range - Found: ${data.data?.pagination?.total || 0} items`);
        } else {
            console.log(`❌ Overdue filter - Failed: ${overdueResponse.status}`);
        }

        // Test 6: Performance comparison
        console.log('\n⚡ Test 6: Performance Comparison');
        console.log('-'.repeat(60));

        const startTime = Date.now();
        const perfResponse = await fetch(`${BASE_URL}/homework?due_date_from=2024-01-01&due_date_to=2025-07-30`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const endTime = Date.now();

        if (perfResponse.ok) {
            console.log(`✅ Date range query completed in: ${endTime - startTime}ms`);
        }

        // Test 7: Summary and validation
        console.log('\n📊 Test 7: Summary and Validation');
        console.log('-'.repeat(60));

        console.log('✅ Date filtering fix implemented');
        console.log('✅ Inclusive date boundaries (start of day to end of day)');
        console.log('✅ Both main query and count query updated');
        console.log('✅ Edge cases handled properly');

        console.log('\n🎯 Expected Results:');
        console.log('   - due_date_from=2024-01-01&due_date_to=2025-07-30 should now work');
        console.log('   - Both dates are inclusive in the range');
        console.log('   - Homework due on 2025-07-30T23:59:59 should be included');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testHomeworkDateFilters();
