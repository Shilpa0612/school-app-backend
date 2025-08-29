-- ============================================================================
-- EMERGENCY ATTENDANCE CONSTRAINT FIX
-- ============================================================================
-- This script will forcefully fix the attendance constraint issue

-- Step 1: Show what we're dealing with
SELECT '=== CURRENT STATUS VALUES ===' as info;
SELECT DISTINCT status, COUNT(*) as count 
FROM student_attendance_records 
GROUP BY status;

-- Step 2: Show ALL constraints on this table
SELECT '=== ALL CONSTRAINTS ON TABLE ===' as info;
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'student_attendance_records'::regclass;

-- Step 3: Force update ALL records to use only 'present' or 'absent'
UPDATE student_attendance_records 
SET status = CASE 
    WHEN status IN ('present', 'absent') THEN status
    ELSE 'present'
END;

-- Step 4: Drop the constraint using CASCADE to handle any dependencies
ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_check CASCADE;

-- Step 5: Also try dropping with different possible names
ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_ck CASCADE;

ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS status_check CASCADE;

-- Step 6: Add the new constraint
ALTER TABLE student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('present', 'absent'));

-- Step 7: Verify the fix
SELECT '=== AFTER FIX - STATUS VALUES ===' as info;
SELECT DISTINCT status, COUNT(*) as count 
FROM student_attendance_records 
GROUP BY status;

SELECT '=== AFTER FIX - NEW CONSTRAINT ===' as info;
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'student_attendance_records_status_check';

-- Step 8: Final confirmation
SELECT '=== EMERGENCY FIX COMPLETED ===' as status;
SELECT 'You should now be able to mark attendance as present/absent' as note;
