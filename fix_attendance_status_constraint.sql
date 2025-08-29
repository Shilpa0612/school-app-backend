-- Fix attendance status constraint to allow 'present' and 'absent' values
-- This script will update the database constraint to accept the standard attendance status values

-- First, let's check what the current constraint looks like
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'student_attendance_records_status_check';

-- Drop the existing constraint if it exists
ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_check;

-- Add the new constraint that allows 'present' and 'absent'
ALTER TABLE student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('present', 'absent', 'late', 'half_day'));

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'student_attendance_records_status_check';

-- Test the constraint with valid values
DO $$
BEGIN
    -- Test with 'present' - should work
    BEGIN
        INSERT INTO student_attendance_records (
            daily_attendance_id, 
            student_id, 
            status, 
            remarks, 
            marked_by
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            '00000000-0000-0000-0000-000000000000',
            'present',
            'Test record',
            '00000000-0000-0000-0000-000000000000'
        );
        RAISE NOTICE '✅ "present" status works!';
        -- Clean up
        DELETE FROM student_attendance_records WHERE status = 'present' AND remarks = 'Test record';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ "present" status failed: %', SQLERRM;
    END;

    -- Test with 'absent' - should work
    BEGIN
        INSERT INTO student_attendance_records (
            daily_attendance_id, 
            student_id, 
            status, 
            remarks, 
            marked_by
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            '00000000-0000-0000-0000-000000000000',
            'absent',
            'Test record',
            '00000000-0000-0000-0000-000000000000'
        );
        RAISE NOTICE '✅ "absent" status works!';
        -- Clean up
        DELETE FROM student_attendance_records WHERE status = 'absent' AND remarks = 'Test record';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ "absent" status failed: %', SQLERRM;
    END;

    -- Test with 'late' - should work
    BEGIN
        INSERT INTO student_attendance_records (
            daily_attendance_id, 
            student_id, 
            status, 
            remarks, 
            marked_by
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            '00000000-0000-0000-0000-000000000000',
            'late',
            'Test record',
            '00000000-0000-0000-0000-000000000000'
        );
        RAISE NOTICE '✅ "late" status works!';
        -- Clean up
        DELETE FROM student_attendance_records WHERE status = 'late' AND remarks = 'Test record';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ "late" status failed: %', SQLERRM;
    END;

    -- Test with 'half_day' - should work
    BEGIN
        INSERT INTO student_attendance_records (
            daily_attendance_id, 
            student_id, 
            status, 
            remarks, 
            marked_by
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            '00000000-0000-0000-0000-000000000000',
            'half_day',
            'Test record',
            '00000000-0000-0000-0000-000000000000'
        );
        RAISE NOTICE '✅ "half_day" status works!';
        -- Clean up
        DELETE FROM student_attendance_records WHERE status = 'half_day' AND remarks = 'Test record';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ "half_day" status failed: %', SQLERRM;
    END;

    RAISE NOTICE '🎉 All attendance status values are now working!';
END $$;
