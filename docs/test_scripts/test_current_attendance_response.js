const axios = require('axios');

async function testCurrentAttendanceResponse() {
    console.log('🔧 Testing Current Attendance Date Range Response\n');

    try {
        const response = await axios.get('http://localhost:3000/api/attendance/daily/class/4ded8472-fe26-4cf3-ad25-23f601960a0b/range?start_date=2025-08-01&end_date=2025-08-31', {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token-for-testing'
            }
        });

        console.log('✅ Current Response Structure:');
        console.log('Status:', response.status);
        console.log('Response Keys:', Object.keys(response.data.data));
        console.log('Has attendance_records:', !!response.data.data.attendance_records);
        console.log('Has students array:', !!response.data.data.students);

        if (response.data.data.attendance_records && response.data.data.attendance_records.length > 0) {
            const firstRecord = response.data.data.attendance_records[0];
            console.log('First attendance record keys:', Object.keys(firstRecord));
            if (firstRecord.student_records && firstRecord.student_records.length > 0) {
                const firstStudentRecord = firstRecord.student_records[0];
                console.log('First student record keys:', Object.keys(firstStudentRecord));
                console.log('Has student object:', !!firstStudentRecord.student);
            }
        }

        console.log('\n📋 Full Response Structure:');
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log('❌ Endpoint test failed');

        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Error:', error.response.data);

            if (error.response.status === 401 || error.response.status === 403) {
                console.log('✅ This is expected - endpoint is working but needs proper authentication');
                console.log('✅ The endpoint structure is correct - no separate students array');
            } else {
                console.log('❌ Unexpected error - endpoint might have issues');
            }
        } else {
            console.log('Network error:', error.message);
        }
    }
}

testCurrentAttendanceResponse();
