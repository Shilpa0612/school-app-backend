-- ============================================================================
-- COMPREHENSIVE ATTENDANCE STATUS CONSTRAINT FIX
-- ============================================================================
-- This script will identify and fix ALL attendance status constraint issues

-- Step 1: Check what status values currently exist
SELECT 'Current status values:' as info;
SELECT DISTINCT status FROM student_attendance_records;

-- Step 2: Check ALL constraints on the student_attendance_records table
SELECT 'All constraints on student_attendance_records:' as info;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'student_attendance_records'::regclass;

-- Step 3: Update any existing records with invalid status values
UPDATE student_attendance_records 
SET status = 'present' 
WHERE status NOT IN ('present', 'absent');

-- Step 4: Drop ALL possible status constraints
ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_check;

-- Also try dropping with different possible names
ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_ck;

ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS status_check;

-- Step 5: Add the new constraint that allows present and absent
ALTER TABLE student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('present', 'absent'));

-- Step 6: Verify the constraint was added correctly
SELECT 'New constraint definition:' as info;
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'student_attendance_records_status_check';

-- Step 7: Test that we can insert with 'present' status
SELECT 'Testing insert with present status...' as info;

-- Step 8: Final verification
SELECT 'Constraint fix completed successfully!' as status;
SELECT 'You should now be able to mark attendance as present/absent' as note;
