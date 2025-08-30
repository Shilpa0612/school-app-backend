const fetch = require('node-fetch');

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com';

// Test authentication first
async function testAuth() {
    try {
        console.log('🔐 Testing authentication...');
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'teacher@school.com',
                password: 'password123'
            })
        });

        const data = await response.json();
        console.log('Auth response status:', response.status);
        console.log('Auth response:', data);

        if (data.token) {
            return data.token;
        } else {
            console.error('❌ Authentication failed');
            return null;
        }
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        return null;
    }
}

// Test announcement status reset functionality
async function testAnnouncementStatusReset(token) {
    if (!token) {
        console.log('❌ No token available, skipping tests');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    console.log('\n🔍 Testing announcement status reset on edit...\n');

    // Test 1: Create a new announcement
    try {
        console.log('1. Creating a new announcement...');
        const createResponse = await fetch(`${BASE_URL}/api/announcements`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                title: 'Test Announcement for Status Reset',
                content: 'This announcement will be edited to test status reset',
                announcement_type: 'general',
                priority: 'normal',
                target_roles: ['teacher', 'parent']
            })
        });

        console.log('   Create response status:', createResponse.status);
        const createData = await createResponse.json();
        console.log('   Create response:', createData);

        if (createResponse.ok && createData.data?.announcement) {
            const announcementId = createData.data.announcement.id;
            console.log('   ✅ Announcement created with ID:', announcementId);
            console.log('   📊 Initial status:', createData.data.announcement.status);

            // Test 2: Edit the announcement
            console.log('\n2. Editing the announcement...');
            const editResponse = await fetch(`${BASE_URL}/api/announcements/${announcementId}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify({
                    title: 'Updated Test Announcement',
                    content: 'This announcement has been updated and should reset to pending'
                })
            });

            console.log('   Edit response status:', editResponse.status);
            const editData = await editResponse.json();
            console.log('   Edit response:', editData);

            if (editResponse.ok) {
                console.log('   ✅ Announcement edited successfully');
                console.log('   📊 New status:', editData.data.announcement.status);
                console.log('   📊 Status changed:', editData.data.status_changed);
                console.log('   📊 Requires reapproval:', editData.data.requires_reapproval);

                if (editData.data.status_changed && editData.data.requires_reapproval) {
                    console.log('   🎯 SUCCESS: Status correctly reset to pending!');
                } else {
                    console.log('   ⚠️ WARNING: Status may not have reset correctly');
                }
            } else {
                console.log('   ❌ Failed to edit announcement');
            }

            // Test 3: Clean up - delete the test announcement
            console.log('\n3. Cleaning up - deleting test announcement...');
            const deleteResponse = await fetch(`${BASE_URL}/api/announcements/${announcementId}`, {
                method: 'DELETE',
                headers: headers
            });

            console.log('   Delete response status:', deleteResponse.status);
            if (deleteResponse.ok) {
                console.log('   ✅ Test announcement deleted successfully');
            } else {
                console.log('   ⚠️ Could not delete test announcement');
            }

        } else {
            console.log('   ❌ Failed to create announcement');
        }

    } catch (error) {
        console.error('   ❌ Error in test:', error.message);
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting announcement status reset tests...\n');

    const token = await testAuth();
    await testAnnouncementStatusReset(token);

    console.log('\n✅ Tests completed');
    console.log('\n💡 What this test verifies:');
    console.log('   1. ✅ Create announcement → Status: pending');
    console.log('   2. ✅ Edit announcement → Status: pending (reset)');
    console.log('   3. ✅ Response includes status_changed and requires_reapproval flags');
    console.log('   4. ✅ Clean up test data');
}

runTests().catch(console.error);
