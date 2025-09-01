// Test script for announcement edit status behavior
// This script tests the new logic where:
// - Principal creates → Approved by default
// - Principal edits own approved → Stays approved
// - Teacher creates → Pending
// - Teacher edits own pending → Stays pending

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com';

// Test scenarios
const testScenarios = [
    {
        name: 'Principal creates announcement (should be approved)',
        role: 'principal',
        expectedInitialStatus: 'approved'
    },
    {
        name: 'Principal edits own approved announcement (should stay approved)',
        role: 'principal',
        editOwnApproved: true,
        expectedEditStatus: 'approved'
    },
    {
        name: 'Principal creates announcement for teachers (should be approved)',
        role: 'principal',
        targetRoles: ['teacher'],
        expectedInitialStatus: 'approved'
    },
    {
        name: 'Principal edits teacher announcement (should become approved)',
        role: 'principal',
        editTeacherAnnouncement: true,
        expectedEditStatus: 'approved'
    },
    {
        name: 'Teacher creates announcement (should be pending)',
        role: 'teacher',
        expectedInitialStatus: 'pending'
    },
    {
        name: 'Teacher edits own pending announcement (should stay pending)',
        role: 'teacher',
        editOwnPending: true,
        expectedEditStatus: 'pending'
    }
];

async function testAnnouncementEditStatus() {
    console.log('🧪 Testing Announcement Edit Status Behavior\n');

    for (const scenario of testScenarios) {
        console.log(`\n📋 Scenario: ${scenario.name}`);
        console.log('='.repeat(60));

        try {
            // Step 1: Create announcement
            console.log('\n1. Creating announcement...');
            const createResponse = await fetch(`${BASE_URL}/api/announcements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getTokenForRole(scenario.role)}`
                },
                body: JSON.stringify({
                    title: `Test Announcement - ${scenario.name}`,
                    content: 'This is a test announcement for status behavior testing.',
                    announcement_type: 'general',
                    priority: 'normal',
                    target_roles: scenario.targetRoles || ['teacher', 'parent']
                })
            });

            const createData = await createResponse.json();
            console.log('   Create response status:', createResponse.status);

            if (createResponse.ok && createData.data?.announcement) {
                const announcementId = createData.data.announcement.id;
                const initialStatus = createData.data.announcement.status;

                console.log('   ✅ Announcement created with ID:', announcementId);
                console.log('   📊 Initial status:', initialStatus);
                console.log('   🎯 Expected status:', scenario.expectedInitialStatus);

                if (initialStatus === scenario.expectedInitialStatus) {
                    console.log('   ✅ SUCCESS: Initial status is correct!');
                } else {
                    console.log('   ❌ FAILED: Initial status is incorrect!');
                }

                // Step 2: Edit announcement (if applicable)
                if (scenario.editOwnApproved || scenario.editOwnPending || scenario.editTeacherAnnouncement) {
                    console.log('\n2. Editing announcement...');

                    const editResponse = await fetch(`${BASE_URL}/api/announcements/${announcementId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${getTokenForRole(scenario.role)}`
                        },
                        body: JSON.stringify({
                            title: `Updated Test Announcement - ${scenario.name}`,
                            content: 'This announcement has been updated to test status behavior.'
                        })
                    });

                    const editData = await editResponse.json();
                    console.log('   Edit response status:', editResponse.status);

                    if (editResponse.ok) {
                        const newStatus = editData.data.announcement.status;
                        const statusChanged = editData.data.status_changed;
                        const requiresReapproval = editData.data.requires_reapproval;

                        console.log('   ✅ Announcement edited successfully');
                        console.log('   📊 New status:', newStatus);
                        console.log('   📊 Status changed:', statusChanged);
                        console.log('   📊 Requires reapproval:', requiresReapproval);
                        console.log('   🎯 Expected status:', scenario.expectedEditStatus);

                        if (newStatus === scenario.expectedEditStatus) {
                            console.log('   ✅ SUCCESS: Edit status is correct!');
                        } else {
                            console.log('   ❌ FAILED: Edit status is incorrect!');
                        }

                        console.log('   📝 Response message:', editData.message);
                    } else {
                        console.log('   ❌ Failed to edit announcement');
                        console.log('   Error:', editData);
                    }
                }

                // Step 3: Clean up
                console.log('\n3. Cleaning up - deleting test announcement...');
                const deleteResponse = await fetch(`${BASE_URL}/api/announcements/${announcementId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${getTokenForRole(scenario.role)}`
                    }
                });

                if (deleteResponse.ok) {
                    console.log('   ✅ Test announcement deleted successfully');
                } else {
                    console.log('   ⚠️ Warning: Could not delete test announcement');
                }

            } else {
                console.log('   ❌ Failed to create announcement');
                console.log('   Error:', createData);
            }

        } catch (error) {
            console.log('   ❌ Error during test:', error.message);
        }

        console.log('\n' + '='.repeat(60));
    }

    console.log('\n🎉 Announcement edit status testing completed!');
}

// Helper function to get token for different roles
function getTokenForRole(role) {
    // You'll need to replace these with actual tokens for testing
    const tokens = {
        'principal': 'YOUR_PRINCIPAL_TOKEN_HERE',
        'teacher': 'YOUR_TEACHER_TOKEN_HERE',
        'admin': 'YOUR_ADMIN_TOKEN_HERE'
    };

    return tokens[role] || tokens['teacher'];
}

// Run the test
if (require.main === module) {
    console.log('🚀 Starting announcement edit status tests...');
    console.log('⚠️  Please update the tokens in getTokenForRole() function before running!');
    testAnnouncementEditStatus().catch(console.error);
}

module.exports = { testAnnouncementEditStatus };
