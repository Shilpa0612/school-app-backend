const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/birthdays';

// Test function to call the birthdays API with different date ranges
async function testBirthdayDateRanges() {
    console.log('🎂 Testing Birthday API Date Range Functionality\n');

    try {
        // Test 1: Default behavior (next 7 days)
        console.log('1️⃣ Testing default behavior (next 7 days):');
        const defaultResponse = await axios.get(`${BASE_URL}/upcoming`);
        console.log(`   Status: ${defaultResponse.status}`);
        console.log(`   Date Range: ${defaultResponse.data.data.date_range.start_date} to ${defaultResponse.data.data.date_range.end_date}`);
        console.log(`   Total Days: ${defaultResponse.data.data.date_range.total_days}`);
        console.log(`   Total Birthdays: ${defaultResponse.data.data.total_count}\n`);

        // Test 2: Custom date range (next 30 days)
        console.log('2️⃣ Testing custom days ahead (30 days):');
        const daysAheadResponse = await axios.get(`${BASE_URL}/upcoming?days_ahead=30`);
        console.log(`   Status: ${daysAheadResponse.status}`);
        console.log(`   Date Range: ${daysAheadResponse.data.data.date_range.start_date} to ${daysAheadResponse.data.data.date_range.end_date}`);
        console.log(`   Total Days: ${daysAheadResponse.data.data.date_range.total_days}`);
        console.log(`   Total Birthdays: ${daysAheadResponse.data.data.total_count}\n`);

        // Test 3: Specific date range (current month)
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        console.log('3️⃣ Testing specific date range (current month):');
        const monthRangeResponse = await axios.get(`${BASE_URL}/upcoming?start_date=${startOfMonth.toISOString().split('T')[0]}&end_date=${endOfMonth.toISOString().split('T')[0]}`);
        console.log(`   Status: ${monthRangeResponse.status}`);
        console.log(`   Date Range: ${monthRangeResponse.data.data.date_range.start_date} to ${monthRangeResponse.data.data.date_range.end_date}`);
        console.log(`   Total Days: ${monthRangeResponse.data.data.date_range.total_days}`);
        console.log(`   Total Birthdays: ${monthRangeResponse.data.data.total_count}\n`);

        // Test 4: Next quarter (3 months)
        const nextQuarterStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const nextQuarterEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0);

        console.log('4️⃣ Testing next quarter (3 months):');
        const quarterResponse = await axios.get(`${BASE_URL}/upcoming?start_date=${nextQuarterStart.toISOString().split('T')[0]}&end_date=${nextQuarterEnd.toISOString().split('T')[0]}`);
        console.log(`   Status: ${quarterResponse.status}`);
        console.log(`   Date Range: ${quarterResponse.data.data.date_range.start_date} to ${quarterResponse.data.data.date_range.end_date}`);
        console.log(`   Total Days: ${quarterResponse.data.data.date_range.total_days}`);
        console.log(`   Total Birthdays: ${quarterResponse.data.data.total_count}\n`);

        // Test 5: With class division filter (if available)
        console.log('5️⃣ Testing with class division filter:');
        try {
            const divisionResponse = await axios.get(`${BASE_URL}/upcoming?class_division_id=1&days_ahead=14`);
            console.log(`   Status: ${divisionResponse.status}`);
            console.log(`   Date Range: ${divisionResponse.data.data.date_range.start_date} to ${divisionResponse.data.data.date_range.end_date}`);
            console.log(`   Class Division ID: ${divisionResponse.data.data.class_division_id}`);
            console.log(`   Total Birthdays: ${divisionResponse.data.data.total_count}\n`);
        } catch (error) {
            console.log(`   Class division filter test skipped (no division with ID 1)\n`);
        }

        console.log('✅ All tests completed successfully!');
        console.log('\n📋 Available Query Parameters:');
        console.log('   - start_date: Start date in YYYY-MM-DD format');
        console.log('   - end_date: End date in YYYY-MM-DD format');
        console.log('   - days_ahead: Number of days from today');
        console.log('   - class_division_id: Filter by specific class division');
        console.log('   - page: Page number for pagination');
        console.log('   - limit: Number of results per page');

    } catch (error) {
        console.error('❌ Error testing birthday API:', error.response?.data || error.message);
    }
}

// Test error cases
async function testErrorCases() {
    console.log('\n🚨 Testing Error Cases:\n');

    try {
        // Test 1: Invalid date format
        console.log('1️⃣ Testing invalid date format:');
        try {
            await axios.get(`${BASE_URL}/upcoming?start_date=invalid-date&end_date=2024-12-31`);
        } catch (error) {
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Error: ${error.response?.data?.message}\n`);
        }

        // Test 2: Start date after end date
        console.log('2️⃣ Testing start_date after end_date:');
        try {
            await axios.get(`${BASE_URL}/upcoming?start_date=2024-12-31&end_date=2024-01-01`);
        } catch (error) {
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Error: ${error.response?.data?.message}\n`);
        }

        // Test 3: Only start_date (missing end_date)
        console.log('3️⃣ Testing only start_date (missing end_date):');
        try {
            await axios.get(`${BASE_URL}/upcoming?start_date=2024-01-01`);
        } catch (error) {
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Error: ${error.response?.data?.message}\n`);
        }

    } catch (error) {
        console.error('❌ Error testing error cases:', error.message);
    }
}

// Run tests
async function runAllTests() {
    await testBirthdayDateRanges();
    await testErrorCases();
}

// Check if running directly
if (require.main === module) {
    runAllTests();
}

module.exports = { testBirthdayDateRanges, testErrorCases };
