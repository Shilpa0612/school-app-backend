const axios = require('axios');

async function testChildrenTeachers() {
    try {
        console.log('Testing children/teachers API with chat information...');

        // You'll need to replace this with actual auth token for a parent user
        const authToken = 'your-parent-auth-token-here'; // Replace with actual parent auth token

        const response = await axios.get('http://localhost:3000/api/users/children/teachers', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('API Response Status:', response.status);
        console.log('API Response Data:', JSON.stringify(response.data, null, 2));

        // Check if chat information is included
        if (response.data.status === 'success' && response.data.data.teachers_by_child) {
            const teachersByChild = response.data.data.teachers_by_child;
            console.log(`\nFound ${teachersByChild.length} children with teachers`);

            teachersByChild.forEach((childData, childIndex) => {
                console.log(`\nChild ${childIndex + 1}: Student ID ${childData.student_id}`);
                console.log(`  Class Division ID: ${childData.class_division_id || 'Not assigned'}`);
                console.log(`  Teachers: ${childData.teachers.length}`);

                childData.teachers.forEach((teacher, teacherIndex) => {
                    console.log(`    Teacher ${teacherIndex + 1}: ${teacher.full_name}`);
                    console.log(`      Assignment ID: ${teacher.assignment_id}`);
                    console.log(`      Teacher ID: ${teacher.teacher_id}`);
                    console.log(`      Assignment Type: ${teacher.assignment_type}`);
                    console.log(`      Subject: ${teacher.subject || 'N/A'}`);
                    console.log(`      Is Primary: ${teacher.is_primary}`);
                    console.log(`      Email: ${teacher.email || 'N/A'}`);
                    console.log(`      Phone: ${teacher.phone_number || 'N/A'}`);

                    console.log(`      Chat Info:`);
                    console.log(`        Has Thread: ${teacher.chat_info.has_thread}`);
                    if (teacher.chat_info.has_thread) {
                        console.log(`        Thread ID: ${teacher.chat_info.thread_id}`);
                        console.log(`        Message Count: ${teacher.chat_info.message_count}`);
                        console.log(`        Thread Title: ${teacher.chat_info.thread_title}`);
                        console.log(`        Participants: ${teacher.chat_info.participants.length}`);
                        teacher.chat_info.participants.forEach(participant => {
                            console.log(`          - ${participant.user.full_name} (${participant.user.role})`);
                        });
                    }
                });
            });

            // Check summary statistics
            const summary = response.data.data.summary;
            if (summary) {
                console.log(`\nSummary Statistics:`);
                console.log(`  Total Children: ${summary.total_children}`);
                console.log(`  Total Teachers: ${summary.total_teachers}`);
                console.log(`  Teachers with Chat: ${summary.teachers_with_chat}`);
                console.log(`  Teachers without Chat: ${summary.teachers_without_chat}`);
            }

            // Check principal info
            const principal = response.data.data.principal;
            if (principal) {
                console.log(`\nPrincipal:`);
                console.log(`  ID: ${principal.id}`);
                console.log(`  Name: ${principal.full_name}`);
            }
        }

    } catch (error) {
        console.error('Error testing API:', error.response?.data || error.message);
    }
}

// Run the test
testChildrenTeachers();
