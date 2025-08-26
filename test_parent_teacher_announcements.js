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

// Test 1: Get My Announcements (Parent/Teacher)
async function testGetMyAnnouncements() {
    console.log('\n🧪 Test 1: Getting My Announcements (Parent/Teacher)');
    console.log('='.repeat(60));

    const response = await makeRequest('GET', `${BASE_URL}/my-announcements`);

    if (response.status === 200) {
        const data = response.data.data;
        console.log(`✅ Retrieved ${data.announcements.length} targeted announcements`);
        console.log(`   Total: ${data.pagination.total}`);
        console.log(`   Page: ${data.pagination.page}/${data.pagination.total_pages}`);

        // Summary statistics
        console.log(`\n📊 Summary Statistics:`);
        console.log(`   Total Targeted: ${data.summary.total_targeted}`);
        console.log(`   Read Count: ${data.summary.read_count}`);
        console.log(`   Unread Count: ${data.summary.unread_count}`);
        console.log(`   User Role: ${data.summary.user_role}`);

        // Display announcements
        data.announcements.forEach((announcement, index) => {
            console.log(`\n   Announcement ${index + 1}:`);
            console.log(`     ID: ${announcement.id}`);
            console.log(`     Title: ${announcement.title}`);
            console.log(`     Type: ${announcement.announcement_type}`);
            console.log(`     Priority: ${announcement.priority}`);
            console.log(`     Is Read: ${announcement.is_read ? 'Yes' : 'No'}`);
            console.log(`     Delivery Status: ${announcement.delivery_status}`);
            console.log(`     Created by: ${announcement.creator?.full_name} (${announcement.creator?.role})`);
            if (announcement.read_at) {
                console.log(`     Read at: ${new Date(announcement.read_at).toLocaleString()}`);
            }
        });

        return data.announcements;
    } else {
        console.log('❌ Failed to get my announcements');
        return [];
    }
}

// Test 2: Filter My Announcements
async function testFilterMyAnnouncements() {
    console.log('\n🧪 Test 2: Filtering My Announcements');
    console.log('='.repeat(50));

    const filters = [
        { name: 'Circular announcements', params: { announcement_type: 'circular' } },
        { name: 'High priority announcements', params: { priority: 'high' } },
        { name: 'Featured announcements', params: { is_featured: 'true' } },
        { name: 'Unread announcements only', params: { unread_only: 'true' } }
    ];

    for (const filter of filters) {
        console.log(`\nTesting filter: ${filter.name}`);

        const queryParams = new URLSearchParams(filter.params);
        const response = await makeRequest('GET', `${BASE_URL}/my-announcements?${queryParams.toString()}`);

        if (response.status === 200) {
            const count = response.data.data.announcements.length;
            console.log(`   ✅ Found ${count} announcements`);

            if (count > 0) {
                const firstAnnouncement = response.data.data.announcements[0];
                console.log(`   Sample: ${firstAnnouncement.title} (${firstAnnouncement.announcement_type})`);
            }
        } else {
            console.log(`   ❌ Filter failed`);
        }
    }
}

// Test 3: Mark Announcement as Read
async function testMarkAsRead(announcementId) {
    console.log('\n🧪 Test 3: Marking Announcement as Read');
    console.log('='.repeat(50));

    if (!announcementId) {
        console.log('⚠️  No announcement ID provided, skipping test');
        return;
    }

    const response = await makeRequest('PATCH', `${BASE_URL}/${announcementId}/read`);

    if (response.status === 200) {
        console.log(`✅ Announcement marked as read successfully`);
        console.log(`   Message: ${response.data.message}`);
    } else {
        console.log('❌ Failed to mark announcement as read');
        console.log(`   Error: ${response.data?.message || 'Unknown error'}`);
    }
}

// Test 4: Pagination Test
async function testPagination() {
    console.log('\n🧪 Test 4: Testing Pagination');
    console.log('='.repeat(50));

    const response = await makeRequest('GET', `${BASE_URL}/my-announcements?page=1&limit=5`);

    if (response.status === 200) {
        const data = response.data.data;
        console.log(`✅ Pagination test successful`);
        console.log(`   Current page: ${data.pagination.page}`);
        console.log(`   Items per page: ${data.pagination.limit}`);
        console.log(`   Total items: ${data.pagination.total}`);
        console.log(`   Total pages: ${data.pagination.total_pages}`);
        console.log(`   Has next: ${data.pagination.has_next}`);
        console.log(`   Has prev: ${data.pagination.has_prev}`);
        console.log(`   Items returned: ${data.announcements.length}`);
    } else {
        console.log('❌ Pagination test failed');
    }
}

// Test 5: Combined Filters
async function testCombinedFilters() {
    console.log('\n🧪 Test 5: Testing Combined Filters');
    console.log('='.repeat(50));

    const combinedParams = {
        announcement_type: 'circular',
        priority: 'high',
        is_featured: 'true',
        page: 1,
        limit: 10
    };

    const queryParams = new URLSearchParams(combinedParams);
    const response = await makeRequest('GET', `${BASE_URL}/my-announcements?${queryParams.toString()}`);

    if (response.status === 200) {
        const data = response.data.data;
        console.log(`✅ Combined filters test successful`);
        console.log(`   Found ${data.announcements.length} announcements`);
        console.log(`   Applied filters:`, data.filters);

        data.announcements.forEach((announcement, index) => {
            console.log(`   ${index + 1}. ${announcement.title} (${announcement.priority})`);
        });
    } else {
        console.log('❌ Combined filters test failed');
    }
}

// Test 6: Error Handling
async function testErrorHandling() {
    console.log('\n🧪 Test 6: Testing Error Handling');
    console.log('='.repeat(50));

    // Test with invalid announcement ID
    const response = await makeRequest('PATCH', `${BASE_URL}/invalid-uuid/read`);

    if (response.status === 404) {
        console.log('✅ Error handling test passed - Invalid ID returns 404');
    } else {
        console.log('❌ Error handling test failed');
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Parent/Teacher Announcements API Tests');
    console.log('='.repeat(70));
    console.log(`Base URL: ${BASE_URL}/my-announcements`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing - Please update AUTH_TOKEN variable'}`);

    if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
        console.log('\n⚠️  Please update the AUTH_TOKEN variable with a valid parent/teacher token before running tests');
        return;
    }

    try {
        // Run tests in sequence
        const announcements = await testGetMyAnnouncements();
        await testFilterMyAnnouncements();

        if (announcements.length > 0) {
            await testMarkAsRead(announcements[0].id);
        }

        await testPagination();
        await testCombinedFilters();
        await testErrorHandling();

        console.log('\n✅ All Parent/Teacher Announcements tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Usage examples
function showUsageExamples() {
    console.log('\n📖 Usage Examples:');
    console.log('='.repeat(50));

    console.log('\n1. Get all my announcements:');
    console.log('GET /api/announcements/my-announcements');

    console.log('\n2. Get only unread announcements:');
    console.log('GET /api/announcements/my-announcements?unread_only=true');

    console.log('\n3. Filter by type and priority:');
    console.log('GET /api/announcements/my-announcements?announcement_type=circular&priority=high');

    console.log('\n4. Get featured announcements with pagination:');
    console.log('GET /api/announcements/my-announcements?is_featured=true&page=1&limit=10');

    console.log('\n5. Mark announcement as read:');
    console.log('PATCH /api/announcements/{id}/read');

    console.log('\n📋 Available Query Parameters:');
    console.log('- announcement_type: circular, general, urgent, academic, administrative');
    console.log('- priority: low, normal, high, urgent');
    console.log('- is_featured: true, false');
    console.log('- unread_only: true, false');
    console.log('- page: page number (default: 1)');
    console.log('- limit: items per page (default: 20, max: 100)');
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
    showUsageExamples();
}

module.exports = {
    testGetMyAnnouncements,
    testFilterMyAnnouncements,
    testMarkAsRead,
    testPagination,
    testCombinedFilters,
    testErrorHandling,
    runAllTests,
    showUsageExamples
};
