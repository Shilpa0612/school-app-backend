const axios = require('axios');

async function testPrincipalChats() {
    try {
        console.log('Testing principal/chats API with filtering...');

        // You'll need to replace this with actual auth token for a principal/admin user
        const authToken = 'your-principal-auth-token-here'; // Replace with actual principal auth token

        // Test different filter combinations
        const testCases = [
            {
                name: 'All Chats (Default)',
                params: {}
            },
            {
                name: 'Direct Chats Only',
                params: { chat_type: 'direct' }
            },
            {
                name: 'Group Chats Only',
                params: { chat_type: 'group' }
            },
            {
                name: 'Chats Including Principal',
                params: { includes_me: 'yes' }
            },
            {
                name: 'Chats Excluding Principal',
                params: { includes_me: 'no' }
            },
            {
                name: 'Date Range Filter',
                params: {
                    start_date: '2024-01-01',
                    end_date: '2024-12-31'
                }
            },
            {
                name: 'Combined Filters',
                params: {
                    chat_type: 'direct',
                    includes_me: 'yes',
                    page: 1,
                    limit: 10
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n🧪 Testing: ${testCase.name}`);
            console.log('='.repeat(50));

            const queryParams = new URLSearchParams(testCase.params);
            const url = `http://localhost:3000/api/users/principal/chats?${queryParams.toString()}`;

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response Status:', response.status);

            if (response.data.status === 'success') {
                const data = response.data.data;
                const threads = data.threads;
                const summary = data.summary;
                const filters = data.filters;
                const pagination = data.pagination;

                console.log(`\n📊 Results for ${testCase.name}:`);
                console.log(`  Total Threads: ${summary.total_threads}`);
                console.log(`  Direct Chats: ${summary.direct_chats}`);
                console.log(`  Group Chats: ${summary.group_chats}`);
                console.log(`  Includes Principal: ${summary.includes_principal}`);
                console.log(`  Excludes Principal: ${summary.excludes_principal}`);
                console.log(`  Total Messages: ${summary.total_messages}`);
                console.log(`  Avg Messages/Thread: ${summary.average_messages_per_thread}`);

                console.log(`\n👥 Participant Statistics:`);
                console.log(`  Total Unique Participants: ${summary.participant_stats.total_unique}`);
                console.log(`  Teachers: ${summary.participant_stats.teachers}`);
                console.log(`  Parents: ${summary.participant_stats.parents}`);
                console.log(`  Students: ${summary.participant_stats.students}`);
                console.log(`  Admins: ${summary.participant_stats.admins}`);

                console.log(`\n🔍 Applied Filters:`);
                console.log(`  Start Date: ${filters.start_date || 'None'}`);
                console.log(`  End Date: ${filters.end_date || 'None'}`);
                console.log(`  Class Division: ${filters.class_division_id || 'None'}`);
                console.log(`  Chat Type: ${filters.chat_type}`);
                console.log(`  Includes Me: ${filters.includes_me}`);
                console.log(`  Page: ${filters.page}`);
                console.log(`  Limit: ${filters.limit}`);

                console.log(`\n📄 Pagination:`);
                console.log(`  Current Page: ${pagination.page}`);
                console.log(`  Total Pages: ${pagination.total_pages}`);
                console.log(`  Total Items: ${pagination.total}`);
                console.log(`  Has Next: ${pagination.has_next}`);
                console.log(`  Has Prev: ${pagination.has_prev}`);

                if (threads.length > 0) {
                    console.log(`\n💬 Sample Threads (showing first 3):`);
                    threads.slice(0, 3).forEach((thread, index) => {
                        console.log(`\n  Thread ${index + 1}:`);
                        console.log(`    ID: ${thread.thread_id}`);
                        console.log(`    Title: ${thread.title}`);
                        console.log(`    Type: ${thread.thread_type}`);
                        console.log(`    Messages: ${thread.message_count}`);
                        console.log(`    Participants: ${thread.participants.count}`);
                        console.log(`    Principal Participant: ${thread.is_principal_participant ? 'Yes' : 'No'}`);
                        console.log(`    Created: ${new Date(thread.created_at).toLocaleDateString()}`);
                        console.log(`    Updated: ${new Date(thread.updated_at).toLocaleDateString()}`);

                        console.log(`    Badges:`);
                        console.log(`      Includes Principal: ${thread.badges.includes_principal}`);
                        console.log(`      Is Group: ${thread.badges.is_group}`);
                        console.log(`      Is Direct: ${thread.badges.is_direct}`);
                        console.log(`      Has Teachers: ${thread.badges.has_teachers}`);
                        console.log(`      Has Parents: ${thread.badges.has_parents}`);
                        console.log(`      Has Students: ${thread.badges.has_students}`);
                        console.log(`      Has Admins: ${thread.badges.has_admins}`);

                        if (thread.last_message) {
                            console.log(`    Last Message:`);
                            console.log(`      Content: ${thread.last_message.content.substring(0, 50)}...`);
                            console.log(`      Sender: ${thread.last_message.sender.full_name}`);
                            console.log(`      Time: ${new Date(thread.last_message.created_at).toLocaleString()}`);
                        }

                        if (thread.class_info) {
                            console.log(`    Class Info:`);
                            console.log(`      Name: ${thread.class_info.name}`);
                            console.log(`      Academic Year: ${thread.class_info.academic_year}`);
                        }
                    });
                } else {
                    console.log('\n❌ No threads found with current filters');
                }
            } else {
                console.error('❌ API returned error:', response.data.message);
            }
        }

    } catch (error) {
        console.error('❌ Error testing API:', error.response?.data || error.message);
    }
}

// Test specific filter combinations
async function testSpecificFilters() {
    try {
        console.log('\n🎯 Testing Specific Filter Combinations...');

        const authToken = 'your-principal-auth-token-here';

        // Test class division filter
        console.log('\n🏫 Testing Class Division Filter:');
        const classResponse = await axios.get('http://localhost:3000/api/users/principal/chats?class_division_id=test-class-id', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (classResponse.data.status === 'success') {
            console.log(`  Threads with class filter: ${classResponse.data.data.summary.total_threads}`);
        }

        // Test date range with specific format
        console.log('\n📅 Testing Date Range Filter:');
        const dateResponse = await axios.get('http://localhost:3000/api/users/principal/chats?start_date=2024-08-01&end_date=2024-08-31', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (dateResponse.data.status === 'success') {
            console.log(`  Threads in date range: ${dateResponse.data.data.summary.total_threads}`);
        }

    } catch (error) {
        console.error('❌ Error testing specific filters:', error.response?.data || error.message);
    }
}

// Run the tests
async function main() {
    await testPrincipalChats();
    await testSpecificFilters();
}

main();
