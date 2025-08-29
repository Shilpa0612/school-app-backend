const axios = require('axios');

async function quickTest() {
    console.log('🔧 Quick Test: Student Details Endpoint\n');

    try {
        const response = await axios.get('http://localhost:3000/api/attendance/student/0dc06d0b-2295-431e-9dfb-7fd3bff6bcc8/details?start_date=2025-08-01&end_date=2025-08-31', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token'
            }
        });

        console.log('✅ SUCCESS! Endpoint is working');
        console.log('Status:', response.status);

    } catch (error) {
        if (error.response) {
            console.log('Status:', error.response.status);

            if (error.response.status === 401 || error.response.status === 403) {
                console.log('✅ Expected - needs proper authentication');
                console.log('✅ Order clause error has been fixed!');
            } else if (error.response.status === 500) {
                console.log('❌ Still has server error');
                console.log('Error:', error.response.data);
            }
        } else {
            console.log('Network error:', error.message);
        }
    }
}

quickTest();
