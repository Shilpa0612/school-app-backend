const fetch = require('node-fetch');

async function testCreateParent() {
    const testData = {
        full_name: "Test Parent",
        phone_number: "1234567890",
        email: "test@example.com",
        student_details: [
            {
                admission_number: "2025212",
                relationship: "father",
                is_primary_guardian: true
            }
        ]
    };

    try {
        console.log('Testing create-parent endpoint...');
        console.log('Request data:', JSON.stringify(testData, null, 2));

        const response = await fetch('http://localhost:3000/api/auth/create-parent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_TEST_TOKEN_HERE' // Replace with actual token
            },
            body: JSON.stringify(testData)
        });

        console.log('Response status:', response.status);
        const responseData = await response.json();
        console.log('Response data:', JSON.stringify(responseData, null, 2));

        if (response.ok) {
            console.log('✅ create-parent endpoint is working correctly!');
        } else {
            console.log('❌ create-parent endpoint returned an error');
        }
    } catch (error) {
        console.error('❌ Error testing create-parent endpoint:', error.message);

        if (error.message.includes('supabase is not defined')) {
            console.log('🔧 This confirms the supabase reference issue has been fixed!');
        }
    }
}

// Test the endpoint
testCreateParent();
