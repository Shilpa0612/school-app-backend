-- Simple fix for attendance status constraint
-- This will allow 'present' and 'absent' status values

-- Drop the existing constraint
ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_check;

-- Add the new constraint that allows present and absent
ALTER TABLE student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('present', 'absent'));

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'student_attendance_records_status_check';
