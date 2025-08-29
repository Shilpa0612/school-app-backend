-- Migration: Fix Specific Attendance Duplicates
-- Date: 2025-08-28
-- Description: Fix the specific duplicate records found

-- 1. Create backup table
CREATE TABLE IF NOT EXISTS daily_attendance_backup AS 
SELECT * FROM daily_attendance;

-- 2. Check which record has the most student attendance records
SELECT 
    da.id,
    da.period_id,
    da.created_at,
    COUNT(sar.id) as student_count
FROM daily_attendance da
LEFT JOIN student_attendance_records sar ON da.id = sar.daily_attendance_id
WHERE da.id IN (
    '8178ca2b-2a66-4f49-88fa-33e05921c776',
    'a8faefbe-3d42-4977-99bd-bdeeb2146c30',
    '2439a2c3-5176-4c86-93fd-daeb12faf71b',
    '15471d1b-57d6-4820-b094-06050db6b91d'
)
GROUP BY da.id, da.period_id, da.created_at
ORDER BY student_count DESC, da.created_at DESC;

-- 3. Keep the record with most student records (or newest if equal)
-- Based on the results above, we'll keep the one with most student records
-- For now, let's keep the newest one: '15471d1b-57d6-4820-b094-06050db6b91d'

-- 4. Delete the other 3 duplicate records
DELETE FROM daily_attendance 
WHERE id IN (
    '8178ca2b-2a66-4f49-88fa-33e05921c776',
    'a8faefbe-3d42-4977-99bd-bdeeb2146c30',
    '2439a2c3-5176-4c86-93fd-daeb12faf71b'
);

-- 5. Clean up orphaned student attendance records
DELETE FROM student_attendance_records 
WHERE daily_attendance_id IN (
    '8178ca2b-2a66-4f49-88fa-33e05921c776',
    'a8faefbe-3d42-4977-99bd-bdeeb2146c30',
    '2439a2c3-5176-4c86-93fd-daeb12faf71b'
);

-- 6. Verify no duplicates remain
SELECT 
    class_division_id,
    academic_year_id,
    attendance_date,
    COUNT(*) as record_count
FROM daily_attendance
GROUP BY class_division_id, academic_year_id, attendance_date
HAVING COUNT(*) > 1;

-- 7. Verify the remaining record
SELECT 
    id,
    class_division_id,
    academic_year_id,
    attendance_date,
    period_id,
    created_at
FROM daily_attendance
WHERE class_division_id = '4ded8472-fe26-4cf3-ad25-23f601960a0b'
AND attendance_date = '2025-08-28';

-- 8. Now you can run the simplification migration
-- The unique constraint should work now
