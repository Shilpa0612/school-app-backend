-- ============================================================================
-- TARGETED ATTENDANCE CONSTRAINT FIX
-- ============================================================================
-- Based on the actual constraint found: 
-- CHECK (((status)::text = ANY ((ARRAY['full_day'::character varying, 'half_day'::character varying, 'absent'::character varying])::text[])))

-- Step 1: Update existing records to use 'present' instead of 'full_day'
UPDATE student_attendance_records 
SET status = 'present' 
WHERE status = 'full_day';

-- Step 2: Update 'half_day' records to 'present' as well
UPDATE student_attendance_records 
SET status = 'present' 
WHERE status = 'half_day';

-- Step 3: Drop the existing constraint
ALTER TABLE student_attendance_records 
DROP CONSTRAINT student_attendance_records_status_check;

-- Step 4: Add the new constraint that allows 'present' and 'absent'
ALTER TABLE student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('present', 'absent'));

-- Step 5: Verify the fix
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

-- Step 6: Final confirmation
SELECT '=== TARGETED FIX COMPLETED ===' as status;
SELECT 'You should now be able to mark attendance as present/absent' as note;
