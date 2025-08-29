-- Migration: Fix Attendance Duplicates Before Simplification
-- Date: 2025-08-28
-- Description: Clean up duplicate attendance records before removing period_id

-- 1. First, let's see what duplicates exist
-- This query will show us the problematic records
SELECT 
    class_division_id,
    academic_year_id,
    attendance_date,
    COUNT(*) as duplicate_count,
    array_agg(id) as record_ids,
    array_agg(period_id) as period_ids
FROM public.daily_attendance
GROUP BY class_division_id, academic_year_id, attendance_date
HAVING COUNT(*) > 1
ORDER BY attendance_date DESC;

-- 2. Create a backup table before making changes
CREATE TABLE IF NOT EXISTS public.daily_attendance_backup AS 
SELECT * FROM public.daily_attendance;

-- 3. Strategy: Keep the record with the most student attendance records
-- Delete duplicates, keeping the one with the most student records

-- First, create a temporary table to identify which records to keep
CREATE TEMP TABLE records_to_keep AS
WITH ranked_records AS (
    SELECT 
        da.id,
        da.class_division_id,
        da.academic_year_id,
        da.attendance_date,
        da.period_id,
        COUNT(sar.id) as student_record_count,
        ROW_NUMBER() OVER (
            PARTITION BY da.class_division_id, da.academic_year_id, da.attendance_date
            ORDER BY COUNT(sar.id) DESC, da.created_at DESC
        ) as rn
    FROM public.daily_attendance da
    LEFT JOIN public.student_attendance_records sar ON da.id = sar.daily_attendance_id
    GROUP BY da.id, da.class_division_id, da.academic_year_id, da.attendance_date, da.period_id, da.created_at
)
SELECT id FROM ranked_records WHERE rn = 1;

-- 4. Delete duplicate records (keep only the ones with most student records)
DELETE FROM public.daily_attendance 
WHERE id NOT IN (SELECT id FROM records_to_keep);

-- 5. Clean up student attendance records that reference deleted daily_attendance records
DELETE FROM public.student_attendance_records 
WHERE daily_attendance_id NOT IN (SELECT id FROM public.daily_attendance);

-- 6. Verify no duplicates remain
SELECT 
    class_division_id,
    academic_year_id,
    attendance_date,
    COUNT(*) as record_count
FROM public.daily_attendance
GROUP BY class_division_id, academic_year_id, attendance_date
HAVING COUNT(*) > 1;

-- 7. If no duplicates remain, we can proceed with the simplification
-- (This will be run in the next migration)

-- 8. Clean up temporary table
DROP TABLE records_to_keep;
