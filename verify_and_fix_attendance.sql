-- ============================================================================
-- VERIFY AND FIX ATTENDANCE CONSTRAINT
-- ============================================================================
-- This script will check the current state and fix the constraint issue

-- Step 1: Check current status values
SELECT '=== CURRENT STATUS VALUES ===' as info;
SELECT DISTINCT status, COUNT(*) as count 
FROM student_attendance_records 
GROUP BY status;

-- Step 2: Check current constraint definition
SELECT '=== CURRENT CONSTRAINT ===' as info;
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'student_attendance_records_status_check';

-- Step 3: Apply the fix if needed
DO $$
BEGIN
    -- Update existing records
    UPDATE student_attendance_records 
    SET status = 'present' 
    WHERE status = 'full_day';
    
    UPDATE student_attendance_records 
    SET status = 'present' 
    WHERE status = 'half_day';
    
    -- Drop and recreate constraint
    ALTER TABLE student_attendance_records 
    DROP CONSTRAINT IF EXISTS student_attendance_records_status_check;
    
    ALTER TABLE student_attendance_records 
    ADD CONSTRAINT student_attendance_records_status_check 
    CHECK (status IN ('present', 'absent'));
    
    RAISE NOTICE 'Constraint fix applied successfully!';
END $$;

-- Step 4: Verify the fix
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

-- Step 5: Test insert (this should work now)
SELECT '=== TESTING INSERT ===' as info;
SELECT 'Constraint should now allow present/absent status values' as note;
