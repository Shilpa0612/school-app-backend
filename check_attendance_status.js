// Check valid status values for student_attendance_records
const { adminSupabase } = require('./src/config/supabase.js');

async function checkAttendanceStatus() {
    try {
        console.log('🔍 Checking valid status values for student_attendance_records...\n');

        // Try to get the table constraints
        const { data: constraints, error: constraintError } = await adminSupabase
            .from('information_schema.check_constraints')
            .select('*')
            .eq('constraint_name', 'student_attendance_records_status_check');

        if (constraintError) {
            console.log('Could not get constraint info:', constraintError.message);
        } else {
            console.log('Constraints found:', constraints);
        }

        // Try to get existing records to see what status values are used
        const { data: records, error: recordsError } = await adminSupabase
            .from('student_attendance_records')
            .select('status')
            .limit(10);

        if (recordsError) {
            console.log('Error getting records:', recordsError.message);
        } else {
            const uniqueStatuses = [...new Set(records.map(r => r.status))];
            console.log('Existing status values in database:', uniqueStatuses);
        }

        // Try to insert a test record with 'present' status
        console.log('\n🧪 Testing with "present" status...');
        try {
            const { data: testRecord, error: testError } = await adminSupabase
                .from('student_attendance_records')
                .insert([{
                    daily_attendance_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
                    student_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
                    status: 'present',
                    remarks: 'Test record',
                    marked_by: '00000000-0000-0000-0000-000000000000' // Dummy ID
                }])
                .select()
                .single();

            if (testError) {
                console.log('❌ "present" status failed:', testError.message);
            } else {
                console.log('✅ "present" status works!');
                // Clean up test record
                await adminSupabase
                    .from('student_attendance_records')
                    .delete()
                    .eq('id', testRecord.id);
            }
        } catch (testError) {
            console.log('❌ "present" status failed:', testError.message);
        }

        // Try to insert a test record with 'full_day' status
        console.log('\n🧪 Testing with "full_day" status...');
        try {
            const { data: testRecord, error: testError } = await adminSupabase
                .from('student_attendance_records')
                .insert([{
                    daily_attendance_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
                    student_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
                    status: 'full_day',
                    remarks: 'Test record',
                    marked_by: '00000000-0000-0000-0000-000000000000' // Dummy ID
                }])
                .select()
                .single();

            if (testError) {
                console.log('❌ "full_day" status failed:', testError.message);
            } else {
                console.log('✅ "full_day" status works!');
                // Clean up test record
                await adminSupabase
                    .from('student_attendance_records')
                    .delete()
                    .eq('id', testRecord.id);
            }
        } catch (testError) {
            console.log('❌ "full_day" status failed:', testError.message);
        }

        // Try to insert a test record with 'absent' status
        console.log('\n🧪 Testing with "absent" status...');
        try {
            const { data: testRecord, error: testError } = await adminSupabase
                .from('student_attendance_records')
                .insert([{
                    daily_attendance_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
                    student_id: '00000000-0000-0000-0000-000000000000', // Dummy ID
                    status: 'absent',
                    remarks: 'Test record',
                    marked_by: '00000000-0000-0000-0000-000000000000' // Dummy ID
                }])
                .select()
                .single();

            if (testError) {
                console.log('❌ "absent" status failed:', testError.message);
            } else {
                console.log('✅ "absent" status works!');
                // Clean up test record
                await adminSupabase
                    .from('student_attendance_records')
                    .delete()
                    .eq('id', testRecord.id);
            }
        } catch (testError) {
            console.log('❌ "absent" status failed:', testError.message);
        }

    } catch (error) {
        console.error('Error checking attendance status:', error);
    }
}

checkAttendanceStatus();
