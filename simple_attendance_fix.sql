-- ============================================================================
-- SIMPLE ATTENDANCE CONSTRAINT FIX
-- ============================================================================
-- Direct fix for the attendance constraint issue

-- Step 1: Show current state
SELECT 'Current status values:' as info;
SELECT DISTINCT status, COUNT(*) as count 
FROM student_attendance_records 
GROUP BY status;

-- Step 2: Show current constraint
SELECT 'Current constraint:' as info;
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'student_attendance_records_status_check';

-- Step 3: Update data
UPDATE student_attendance_records 
SET status = 'present' 
WHERE status = 'full_day';

UPDATE student_attendance_records 
SET status = 'present' 
WHERE status = 'half_day';

-- Step 4: Drop constraint
ALTER TABLE student_attendance_records 
DROP CONSTRAINT student_attendance_records_status_check;

-- Step 5: Add new constraint
ALTER TABLE student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('present', 'absent'));

-- Step 6: Verify
SELECT 'After fix - status values:' as info;
SELECT DISTINCT status, COUNT(*) as count 
FROM student_attendance_records 
GROUP BY status;

SELECT 'After fix - constraint:' as info;
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'student_attendance_records_status_check';

SELECT 'Fix completed!' as status;
