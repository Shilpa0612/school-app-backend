const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api/announcements';
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

// Test data
const testAnnouncements = {
    circular: {
        title: 'School Holiday Notice - Republic Day',
        content: 'School will be closed on Monday, 26th January 2024 for Republic Day celebration. All students and staff are requested to participate in the flag hoisting ceremony at 8:00 AM.',
        announcement_type: 'circular',
        priority: 'high',
        target_roles: ['teacher', 'parent', 'student'],
        is_featured: true
    },
    general: {
        title: 'Annual Sports Day Announcement',
        content: 'Annual sports day will be held on 15th December 2024. All students are invited to participate in various sports events. Registration forms are available at the sports office.',
        announcement_type: 'general',
        priority: 'normal',
        target_roles: ['teacher', 'parent', 'student'],
        is_featured: false
    },
    urgent: {
        title: 'Emergency School Closure',
        content: 'Due to heavy rainfall and flooding in the area, school will remain closed tomorrow. Please stay safe and monitor official announcements.',
        announcement_type: 'urgent',
        priority: 'urgent',
        target_roles: ['teacher', 'parent', 'student'],
        is_featured: true
    }
};

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

// Test 1: Create Announcements
async function testCreateAnnouncements() {
    console.log('\n🧪 Test 1: Creating Announcements');
    console.log('='.repeat(50));

    const createdAnnouncements = [];

    for (const [type, announcement] of Object.entries(testAnnouncements)) {
        console.log(`\nCreating ${type} announcement...`);

        const response = await makeRequest('POST', BASE_URL, announcement);

        if (response.status === 201) {
            console.log(`✅ ${type} announcement created successfully`);
            console.log(`   ID: ${response.data.data.announcement.id}`);
            console.log(`   Status: ${response.data.data.announcement.status}`);
            console.log(`   Auto-approved: ${response.data.data.auto_approved}`);
            createdAnnouncements.push(response.data.data.announcement);
        } else {
            console.log(`❌ Failed to create ${type} announcement`);
        }
    }

    return createdAnnouncements;
}

// Test 2: Get All Announcements
async function testGetAnnouncements() {
    console.log('\n🧪 Test 2: Getting All Announcements');
    console.log('='.repeat(50));

    const response = await makeRequest('GET', BASE_URL);

    if (response.status === 200) {
        const data = response.data.data;
        console.log(`✅ Retrieved ${data.announcements.length} announcements`);
        console.log(`   Total: ${data.pagination.total}`);
        console.log(`   Page: ${data.pagination.page}/${data.pagination.total_pages}`);

        data.announcements.forEach((announcement, index) => {
            console.log(`\n   Announcement ${index + 1}:`);
            console.log(`     ID: ${announcement.id}`);
            console.log(`     Title: ${announcement.title}`);
            console.log(`     Type: ${announcement.announcement_type}`);
            console.log(`     Status: ${announcement.status}`);
            console.log(`     Priority: ${announcement.priority}`);
            console.log(`     Created by: ${announcement.creator?.full_name} (${announcement.creator?.role})`);
            if (announcement.approver) {
                console.log(`     Approved by: ${announcement.approver.full_name} (${announcement.approver.role})`);
            }
        });
    } else {
        console.log('❌ Failed to get announcements');
    }
}

// Test 3: Filter Announcements
async function testFilterAnnouncements() {
    console.log('\n🧪 Test 3: Filtering Announcements');
    console.log('='.repeat(50));

    const filters = [
        { name: 'Circular announcements', params: { announcement_type: 'circular' } },
        { name: 'High priority announcements', params: { priority: 'high' } },
        { name: 'Featured announcements', params: { is_featured: 'true' } },
        { name: 'Pending announcements', params: { status: 'pending' } },
        { name: 'Approved announcements', params: { status: 'approved' } }
    ];

    for (const filter of filters) {
        console.log(`\nTesting filter: ${filter.name}`);

        const queryParams = new URLSearchParams(filter.params);
        const response = await makeRequest('GET', `${BASE_URL}?${queryParams.toString()}`);

        if (response.status === 200) {
            const count = response.data.data.announcements.length;
            console.log(`   ✅ Found ${count} announcements`);
        } else {
            console.log(`   ❌ Filter failed`);
        }
    }
}

// Test 4: Get Single Announcement
async function testGetSingleAnnouncement(announcementId) {
    console.log('\n🧪 Test 4: Getting Single Announcement');
    console.log('='.repeat(50));

    const response = await makeRequest('GET', `${BASE_URL}/${announcementId}`);

    if (response.status === 200) {
        const announcement = response.data.data.announcement;
        console.log(`✅ Retrieved announcement: ${announcement.title}`);
        console.log(`   Content: ${announcement.content.substring(0, 100)}...`);
        console.log(`   Type: ${announcement.announcement_type}`);
        console.log(`   Status: ${announcement.status}`);
        console.log(`   Priority: ${announcement.priority}`);
        console.log(`   Target Roles: ${announcement.target_roles.join(', ')}`);
        console.log(`   Created: ${new Date(announcement.created_at).toLocaleString()}`);
        console.log(`   Updated: ${new Date(announcement.updated_at).toLocaleString()}`);

        if (announcement.attachments && announcement.attachments.length > 0) {
            console.log(`   Attachments: ${announcement.attachments.length} files`);
        }
    } else {
        console.log('❌ Failed to get single announcement');
    }
}

// Test 5: Update Announcement
async function testUpdateAnnouncement(announcementId) {
    console.log('\n🧪 Test 5: Updating Announcement');
    console.log('='.repeat(50));

    const updateData = {
        title: 'Updated: School Holiday Notice - Republic Day',
        content: 'Updated content: School will be closed on Monday, 26th January 2024 for Republic Day celebration. All students and staff are requested to participate in the flag hoisting ceremony at 8:00 AM. Please note the updated timing.',
        priority: 'urgent',
        is_featured: true
    };

    const response = await makeRequest('PUT', `${BASE_URL}/${announcementId}`, updateData);

    if (response.status === 200) {
        const announcement = response.data.data.announcement;
        console.log(`✅ Announcement updated successfully`);
        console.log(`   New title: ${announcement.title}`);
        console.log(`   New priority: ${announcement.priority}`);
        console.log(`   Featured: ${announcement.is_featured}`);
        console.log(`   Updated at: ${new Date(announcement.updated_at).toLocaleString()}`);
    } else {
        console.log('❌ Failed to update announcement');
    }
}

// Test 6: Approval Workflow (for non-principal/admin users)
async function testApprovalWorkflow() {
    console.log('\n🧪 Test 6: Approval Workflow');
    console.log('='.repeat(50));

    // Create a pending announcement (simulating non-principal user)
    const pendingAnnouncement = {
        title: 'Test Pending Announcement',
        content: 'This is a test announcement that should be pending approval.',
        announcement_type: 'general',
        priority: 'normal',
        target_roles: ['teacher', 'parent']
    };

    console.log('Creating announcement that should be pending...');
    const createResponse = await makeRequest('POST', BASE_URL, pendingAnnouncement);

    if (createResponse.status === 201) {
        const announcement = createResponse.data.data.announcement;
        console.log(`✅ Created pending announcement: ${announcement.id}`);
        console.log(`   Status: ${announcement.status}`);

        // Test approval (if user has permission)
        if (announcement.status === 'pending') {
            console.log('\nTesting approval...');
            const approvalData = {
                action: 'approve'
            };

            const approvalResponse = await makeRequest('PATCH', `${BASE_URL}/${announcement.id}/approval`, approvalData);

            if (approvalResponse.status === 200) {
                console.log(`✅ Announcement approved successfully`);
                console.log(`   New status: ${approvalResponse.data.data.announcement.status}`);
            } else {
                console.log(`❌ Approval failed: ${approvalResponse.data?.message || 'Unknown error'}`);
            }
        }
    } else {
        console.log('❌ Failed to create pending announcement');
    }
}

// Test 7: Get Pending Approvals
async function testGetPendingApprovals() {
    console.log('\n🧪 Test 7: Getting Pending Approvals');
    console.log('='.repeat(50));

    const response = await makeRequest('GET', `${BASE_URL}/pending/approvals`);

    if (response.status === 200) {
        const data = response.data.data;
        console.log(`✅ Retrieved ${data.pending_announcements.length} pending announcements`);
        console.log(`   Total pending: ${data.pagination.total}`);

        data.pending_announcements.forEach((announcement, index) => {
            console.log(`\n   Pending ${index + 1}:`);
            console.log(`     ID: ${announcement.id}`);
            console.log(`     Title: ${announcement.title}`);
            console.log(`     Type: ${announcement.announcement_type}`);
            console.log(`     Created by: ${announcement.creator?.full_name} (${announcement.creator?.role})`);
            console.log(`     Created: ${new Date(announcement.created_at).toLocaleString()}`);
        });
    } else {
        console.log('❌ Failed to get pending approvals');
    }
}

// Test 8: Delete Announcement
async function testDeleteAnnouncement(announcementId) {
    console.log('\n🧪 Test 8: Deleting Announcement');
    console.log('='.repeat(50));

    const response = await makeRequest('DELETE', `${BASE_URL}/${announcementId}`);

    if (response.status === 200) {
        console.log(`✅ Announcement deleted successfully`);
    } else {
        console.log('❌ Failed to delete announcement');
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 Starting Announcements API Tests');
    console.log('='.repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Missing - Please update AUTH_TOKEN variable'}`);

    if (!AUTH_TOKEN || AUTH_TOKEN === 'your-auth-token-here') {
        console.log('\n⚠️  Please update the AUTH_TOKEN variable with a valid token before running tests');
        return;
    }

    try {
        // Run tests in sequence
        const createdAnnouncements = await testCreateAnnouncements();
        await testGetAnnouncements();
        await testFilterAnnouncements();

        if (createdAnnouncements.length > 0) {
            await testGetSingleAnnouncement(createdAnnouncements[0].id);
            await testUpdateAnnouncement(createdAnnouncements[0].id);
        }

        await testApprovalWorkflow();
        await testGetPendingApprovals();

        // Clean up - delete test announcements
        console.log('\n🧹 Cleaning up test announcements...');
        for (const announcement of createdAnnouncements) {
            await testDeleteAnnouncement(announcement.id);
        }

        console.log('\n✅ All tests completed!');

    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testCreateAnnouncements,
    testGetAnnouncements,
    testFilterAnnouncements,
    testGetSingleAnnouncement,
    testUpdateAnnouncement,
    testApprovalWorkflow,
    testGetPendingApprovals,
    testDeleteAnnouncement,
    runAllTests
};
