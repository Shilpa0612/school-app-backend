const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/announcements';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Helper function to make authenticated requests
async function makeRequest(method, url, data = null, headers = {}) {
    try {
        const config = {
            method,
            url,
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response;
    } catch (error) {
        console.error(`❌ ${method.toUpperCase()} ${url} failed:`, error.response?.data || error.message);
        return error.response;
    }
}

// Test 1: Basic Date Range Filters
async function testBasicDateFilters() {
    console.log('\n🧪 Test 1: Basic Date Range Filters');
    console.log('='.repeat(50));

    const dateFilters = [
        {
            name: 'Announcements from this month',
            params: {
                start_date: '2024-01-01T00:00:00Z',
                end_date: '2024-01-31T23:59:59Z'
            }
        },
        {
            name: 'Announcements created after January 1st',
            params: {
                created_after: '2024-01-01T00:00:00Z'
            }
        },
        {
            name: 'Announcements created before December 31st',
            params: {
                created_before: '2024-12-31T23:59:59Z'
            }
        },
        {
            name: 'Published announcements after January 1st',
            params: {
                published_after: '2024-01-01T00:00:00Z'
            }
        }
    ];

    for (const filter of dateFilters) {
        console.log(`\nTesting: ${filter.name}`);

        const queryParams = new URLSearchParams(filter.params);
        const response = await makeRequest('GET', `${BASE_URL}?${queryParams.toString()}`);

        if (response.status === 200) {
            const count = response.data.data.announcements.length;
            console.log(`   ✅ Found ${count} announcements`);
            console.log(`   Applied filters:`, response.data.data.filters);
        } else {
            console.log(`   ❌ Filter failed`);
        }
    }
}

// Test 2: Combined Date and Other Filters
async function testCombinedFilters() {
    console.log('\n🧪 Test 2: Combined Date and Other Filters');
    console.log('='.repeat(50));

    const combinedFilters = [
        {
            name: 'High priority announcements from this month',
            params: {
                priority: 'high',
                start_date: '2024-01-01T00:00:00Z',
                end_date: '2024-01-31T23:59:59Z'
            }
        },
        {
            name: 'Featured circular announcements from last week',
            params: {
                announcement_type: 'circular',
                is_featured: 'true',
                start_date: '2024-01-15T00:00:00Z',
                end_date: '2024-01-22T23:59:59Z'
            }
        },
        {
            name: 'Urgent announcements created after January 1st',
            params: {
                priority: 'urgent',
                created_after: '2024-01-01T00:00:00Z'
            }
        }
    ];

    for (const filter of combinedFilters) {
        console.log(`\nTesting: ${filter.name}`);

        const queryParams = new URLSearchParams(filter.params);
        const response = await makeRequest('GET', `${BASE_URL}?${queryParams.toString()}`);

        if (response.status === 200) {
            const count = response.data.data.announcements.length;
            console.log(`   ✅ Found ${count} announcements`);
            console.log(`   Applied filters:`, response.data.data.filters);
        } else {
            console.log(`   ❌ Filter failed`);
        }
    }
}

// Test 3: Parent/Teacher Date Filters
async function testParentTeacherDateFilters() {
    console.log('\n🧪 Test 3: Parent/Teacher Date Filters');
    console.log('='.repeat(50));

    const parentTeacherFilters = [
        {
            name: 'My unread announcements from this month',
            params: {
                unread_only: 'true',
                start_date: '2024-01-01T00:00:00Z',
                end_date: '2024-01-31T23:59:59Z'
            }
        },
        {
            name: 'My urgent announcements created after January 1st',
            params: {
                priority: 'urgent',
                created_after: '2024-01-01T00:00:00Z'
            }
        },
        {
            name: 'My circular announcements from last week',
            params: {
                announcement_type: 'circular',
                start_date: '2024-01-15T00:00:00Z',
                end_date: '2024-01-22T23:59:59Z'
            }
        }
    ];

    for (const filter of parentTeacherFilters) {
        console.log(`\nTesting: ${filter.name}`);

        const queryParams = new URLSearchParams(filter.params);
        const response = await makeRequest('GET', `${BASE_URL}/my-announcements?${queryParams.toString()}`);

        if (response.status === 200) {
            const count = response.data.data.announcements.length;
            console.log(`   ✅ Found ${count} announcements`);
            console.log(`   Applied filters:`, response.data.data.filters);
        } else {
            console.log(`   ❌ Filter failed`);
        }
    }
}

// Test 4: Date Range Patterns
async function testDatePatterns() {
    console.log('\n🧪 Test 4: Common Date Range Patterns');
    console.log('='.repeat(50));

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const datePatterns = [
        {
            name: 'Today\'s announcements',
            params: {
                start_date: today.toISOString(),
                end_date: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString()
            }
        },
        {
            name: 'Yesterday\'s announcements',
            params: {
                start_date: yesterday.toISOString(),
                end_date: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString()
            }
        },
        {
            name: 'Last 7 days announcements',
            params: {
                created_after: lastWeek.toISOString()
            }
        },
        {
            name: 'Last 30 days announcements',
            params: {
                created_after: lastMonth.toISOString()
            }
        }
    ];

    for (const pattern of datePatterns) {
        console.log(`\nTesting: ${pattern.name}`);

        const queryParams = new URLSearchParams(pattern.params);
        const response = await makeRequest('GET', `${BASE_URL}?${queryParams.toString()}`);

        if (response.status === 200) {
            const count = response.data.data.announcements.length;
            console.log(`   ✅ Found ${count} announcements`);
            console.log(`   Date range: ${pattern.params.start_date || pattern.params.created_after} to ${pattern.params.end_date || 'now'}`);
        } else {
            console.log(`   ❌ Pattern failed`);
        }
    }
}

// Test 5: Invalid Date Formats
async function testInvalidDateFormats() {
    console.log('\n🧪 Test 5: Invalid Date Format Handling');
    console.log('='.repeat(50));

    const invalidFormats = [
        {
            name: 'Invalid date format (DD-MM-YYYY)',
            params: {
                start_date: '01-01-2024'
            }
        },
        {
            name: 'Invalid date format (MM/DD/YYYY)',
            params: {
                start_date: '01/01/2024'
            }
        },
        {
            name: 'Invalid date format (YYYY-MM-DD)',
            params: {
                start_date: '2024-01-01'
            }
        }
    ];

    for (const format of invalidFormats) {
        console.log(`\nTesting: ${format.name}`);

        const queryParams = new URLSearchParams(format.params);
        const response = await makeRequest('GET', `${BASE_URL}?${queryParams.toString()}`);

        if (response.status === 400) {
            console.log(`   ✅ Correctly rejected invalid format`);
            console.log(`   Error: ${response.data?.message || 'Invalid format'}`);
        } else {
            console.log(`   ❌ Should have rejected invalid format`);
        }
    }
}

// Test 6: Edge Cases
async function testEdgeCases() {
    console.log('\n🧪 Test 6: Date Filter Edge Cases');
    console.log('='.repeat(50));

    const edgeCases = [
        {
            name: 'Same start and end date',
            params: {
                start_date: '2024-01-15T00:00:00Z',
                end_date: '2024-01-15T23:59:59Z'
            }
        },
        {
            name: 'End date before start date',
            params: {
                start_date: '2024-01-31T00:00:00Z',
                end_date: '2024-01-01T23:59:59Z'
            }
        },
        {
            name: 'Future date range',
            params: {
                start_date: '2025-01-01T00:00:00Z',
                end_date: '2025-12-31T23:59:59Z'
            }
        }
    ];

    for (const edgeCase of edgeCases) {
        console.log(`\nTesting: ${edgeCase.name}`);

        const queryParams = new URLSearchParams(edgeCase.params);
        const response = await makeRequest('GET', `${BASE_URL}?${queryParams.toString()}`);

        if (response.status === 200) {
            const count = response.data.data.announcements.length;
            console.log(`   ✅ Query successful, found ${count} announcements`);
        } else {
            console.log(`   ❌ Query failed: ${response.data?.message || 'Unknown error'}`);
        }
    }
}

// Main test function
async function runAllDateFilterTests() {
    console.log('🚀 Starting Announcements Date Filter Tests');
    console.log('='.repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing - Please update AUTH_TOKEN variable'}`);

    if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
        console.log('\n⚠️  Please update the AUTH_TOKEN variable with a valid token before running tests');
        return;
    }

    try {
        // Run tests in sequence
        await testBasicDateFilters();
        await testCombinedFilters();
        await testParentTeacherDateFilters();
        await testDatePatterns();
        await testInvalidDateFormats();
        await testEdgeCases();

        console.log('\n✅ All date filter tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showDateFilterExamples() {
    console.log('\n📖 Date Filter Usage Examples:');
    console.log('='.repeat(50));

    console.log('\n1. Basic date range:');
    console.log('GET /api/announcements?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z');

    console.log('\n2. Recent announcements:');
    console.log('GET /api/announcements?created_after=2024-01-01T00:00:00Z');

    console.log('\n3. Published announcements:');
    console.log('GET /api/announcements?published_after=2024-01-01T00:00:00Z');

    console.log('\n4. Combined with other filters:');
    console.log('GET /api/announcements?priority=high&start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z');

    console.log('\n5. Parent/Teacher with date filters:');
    console.log('GET /api/announcements/my-announcements?unread_only=true&created_after=2024-01-01T00:00:00Z');

    console.log('\n📋 Date Format Requirements:');
    console.log('- Use ISO 8601 format: YYYY-MM-DDTHH:mm:ssZ');
    console.log('- Include timezone (Z for UTC)');
    console.log('- Use start/end of day for date-only queries');
    console.log('- Examples: 2024-01-15T00:00:00Z, 2024-01-15T23:59:59Z');
}

// Run tests if called directly
if (require.main === module) {
    runAllDateFilterTests();
    showDateFilterExamples();
}

module.exports = {
    testBasicDateFilters,
    testCombinedFilters,
    testParentTeacherDateFilters,
    testDatePatterns,
    testInvalidDateFormats,
    testEdgeCases,
    runAllDateFilterTests,
    showDateFilterExamples
};
