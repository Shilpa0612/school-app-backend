const axios = require('axios');

async function testTeacherLinkedParents() {
    try {
        console.log('Testing teacher-linked-parents API with chat information...');

        // You'll need to replace these with actual values from your database
        const teacherId = 'your-teacher-id-here'; // Replace with actual teacher ID
        const authToken = 'your-auth-token-here'; // Replace with actual auth token

        const response = await axios.get(`http://localhost:3000/api/users/teacher-linked-parents?teacher_id=${teacherId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('API Response Status:', response.status);
        console.log('API Response Data:', JSON.stringify(response.data, null, 2));

        // Check if chat information is included
        if (response.data.status === 'success' && response.data.data.linked_parents) {
            const parents = response.data.data.linked_parents;
            console.log(`\nFound ${parents.length} linked parents`);

            parents.forEach((parent, index) => {
                console.log(`\nParent ${index + 1}: ${parent.full_name}`);
                console.log(`  Email: ${parent.email}`);
                console.log(`  Chat Info:`);
                console.log(`    Has Thread: ${parent.chat_info.has_thread}`);
                if (parent.chat_info.has_thread) {
                    console.log(`    Thread ID: ${parent.chat_info.thread_id}`);
                    console.log(`    Message Count: ${parent.chat_info.message_count}`);
                    console.log(`    Thread Title: ${parent.chat_info.thread_title}`);
                    console.log(`    Participants: ${parent.chat_info.participants.length}`);
                    parent.chat_info.participants.forEach(participant => {
                        console.log(`      - ${participant.user.full_name} (${participant.user.role})`);
                    });
                }
            });

            // Check summary statistics
            const summary = response.data.data.summary;
            console.log(`\nSummary Statistics:`);
            console.log(`  Total Parents: ${summary.total_linked_parents}`);
            console.log(`  Parents with Chat: ${summary.parents_with_chat}`);
            console.log(`  Parents without Chat: ${summary.parents_without_chat}`);
        }

    } catch (error) {
        console.error('Error testing API:', error.response?.data || error.message);
    }
}

// Run the test
testTeacherLinkedParents();
