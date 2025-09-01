// Test script for chat threads endpoint
// This script tests that ALL users (teacher, principal, admin, parent) only see threads where they are participants

const BASE_URL = 'https://ajws-school-ba8ae5e3f955.herokuapp.com';

async function testChatThreads() {
    console.log('🧪 Testing Chat Threads Endpoint\n');

    // Test scenarios
    const testScenarios = [
        {
            name: 'Get all threads (should show only user\'s threads)',
            endpoint: '/api/chat/threads',
            description: 'This should only show threads where the user is a participant'
        },
        {
            name: 'Get my threads (explicit endpoint)',
            endpoint: '/api/chat/my-threads',
            description: 'This should only show threads where the user is a participant'
        }
    ];

    for (const scenario of testScenarios) {
        console.log(`\n📋 Scenario: ${scenario.name}`);
        console.log('='.repeat(80));
        console.log(`Description: ${scenario.description}`);
        console.log(`Endpoint: ${scenario.endpoint}`);

        try {
            // Test with different user roles
            const userRoles = [
                { name: 'Teacher', token: 'YOUR_TEACHER_TOKEN_HERE' },
                { name: 'Principal', token: 'YOUR_PRINCIPAL_TOKEN_HERE' },
                { name: 'Admin', token: 'YOUR_ADMIN_TOKEN_HERE' },
                { name: 'Parent', token: 'YOUR_PARENT_TOKEN_HERE' }
            ];

            let responses = {};

            for (const userRole of userRoles) {
                console.log(`\n🔑 Testing with ${userRole.name} Token...`);
                const response = await testEndpoint(scenario.endpoint, userRole.token);

                if (response.ok) {
                    const data = await response.json();
                    console.log(`   ✅ ${userRole.name} response received`);
                    console.log('   📊 Status:', response.status);
                    console.log('   📊 Threads count:', data.data?.threads?.length || 0);
                    console.log('   📊 Total threads:', data.data?.pagination?.total || 0);

                    if (data.data?.debug_info) {
                        console.log('   🐛 Debug info:', data.data.debug_info);
                    }

                    if (data.data?.summary) {
                        console.log('   📋 Summary:', data.data.summary);
                    }

                    // Check if threads are actually the user's
                    if (data.data?.threads && data.data.threads.length > 0) {
                        console.log('   🔍 Checking thread participants...');
                        data.data.threads.forEach((thread, index) => {
                            const hasUserAsParticipant = thread.participants?.some(p =>
                                p.user_id === data.data.summary?.user_id ||
                                p.user?.id === data.data.summary?.user_id
                            );

                            if (hasUserAsParticipant) {
                                console.log(`   ✅ Thread ${index + 1}: User is participant`);
                            } else {
                                console.log(`   ❌ Thread ${index + 1}: User is NOT participant!`);
                            }
                        });
                    }

                    responses[userRole.name] = data;

                } else {
                    console.log(`   ❌ ${userRole.name} request failed`);
                    console.log('   Status:', response.status);
                    const errorData = await response.json();
                    console.log('   Error:', errorData);
                }
            }

            // Compare results between different users
            console.log('\n🔍 Comparing results between users...');
            const userNames = Object.keys(responses);

            for (let i = 0; i < userNames.length; i++) {
                for (let j = i + 1; j < userNames.length; j++) {
                    const user1 = userNames[i];
                    const user2 = userNames[j];

                    if (responses[user1] && responses[user2]) {
                        const user1ThreadIds = responses[user1].data?.threads?.map(t => t.id) || [];
                        const user2ThreadIds = responses[user2].data?.threads?.map(t => t.id) || [];

                        const commonThreads = user1ThreadIds.filter(id => user2ThreadIds.includes(id));
                        console.log(`   ${user1} vs ${user2}: ${commonThreads.length} common threads`);

                        if (commonThreads.length > 0) {
                            console.log('   ⚠️  Common threads found (this might be expected for group chats)');
                        }
                    }
                }
            }

        } catch (error) {
            console.log('   ❌ Error during test:', error.message);
        }

        console.log('\n' + '='.repeat(80));
    }

    console.log('\n🎉 Chat threads testing completed!');
    console.log('\n📝 Next Steps:');
    console.log('1. Update the tokens in the script');
    console.log('2. Run the script to see debug information');
    console.log('3. Check if users are only seeing their own threads');
    console.log('4. Verify the debug_info shows correct filtering');
}

async function testEndpoint(endpoint, token) {
    if (token.includes('YOUR_') || token.includes('TOKEN_HERE')) {
        console.log('   ⚠️  Please update the token before running this test');
        return { ok: false, status: 401 };
    }

    return await fetch(`${BASE_URL}${endpoint}?page=1&limit=10`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
}

// Helper function to check if user is participant in thread
function isUserParticipant(thread, userId) {
    return thread.participants?.some(p =>
        p.user_id === userId || p.user?.id === userId
    );
}

// Run the test
if (require.main === module) {
    console.log('🚀 Starting chat threads testing...');
    console.log('⚠️  Please update the tokens in the script before running!');
    testChatThreads().catch(console.error);
}

module.exports = { testChatThreads, testEndpoint, isUserParticipant };
