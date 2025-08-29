-- Step-by-Step Fix for Attendance Duplicates
-- Run these commands one by one in your database

-- STEP 1: Check what duplicates exist
SELECT 
    class_division_id,
    academic_year_id,
    attendance_date,
    COUNT(*) as duplicate_count,
    array_agg(id) as record_ids
FROM daily_attendance
GROUP BY class_division_id, academic_year_id, attendance_date
HAVING COUNT(*) > 1;

-- STEP 2: Create backup (optional but recommended)
CREATE TABLE daily_attendance_backup AS 
SELECT * FROM daily_attendance;

-- STEP 3: For each duplicate group, keep the record with most student records
-- Replace the UUIDs below with actual IDs from STEP 1 results

-- Example: If you have duplicates for class_division_id = '4ded8472-fe26-4cf3-ad25-23f601960a0b'
-- and date = '2025-08-28', you would run:

-- First, see which record has more student records:
SELECT 
    da.id,
    da.period_id,
    COUNT(sar.id) as student_count
FROM daily_attendance da
LEFT JOIN student_attendance_records sar ON da.id = sar.daily_attendance_id
WHERE da.class_division_id = '4ded8472-fe26-4cf3-ad25-23f601960a0b'
AND da.attendance_date = '2025-08-28'
GROUP BY da.id, da.period_id;

-- STEP 4: Delete the duplicate with fewer student records
-- Replace 'duplicate_id_to_delete' with the actual ID you want to delete
-- DELETE FROM daily_attendance WHERE id = 'duplicate_id_to_delete';

-- STEP 5: Clean up orphaned student records
DELETE FROM student_attendance_records 
WHERE daily_attendance_id NOT IN (SELECT id FROM daily_attendance);

-- STEP 6: Verify no duplicates remain
SELECT 
    class_division_id,
    academic_year_id,
    attendance_date,
    COUNT(*) as record_count
FROM daily_attendance
GROUP BY class_division_id, academic_year_id, attendance_date
HAVING COUNT(*) > 1;

-- STEP 7: If no duplicates, you can now run the simplification migration
