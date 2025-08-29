-- Migration: Simplify Attendance to Two Statuses
-- Date: 2025-08-28
-- Description: Update attendance system to use only 'present' and 'absent' statuses

-- 1. Update student_attendance_records status constraint
ALTER TABLE public.student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_check;

ALTER TABLE public.student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('present', 'absent'));

-- 2. Update existing records to convert 'full_day' to 'present' and 'half_day' to 'present'
UPDATE public.student_attendance_records 
SET status = 'present' 
WHERE status IN ('full_day', 'half_day');

-- 3. Update the attendance summary function
CREATE OR REPLACE FUNCTION get_simplified_attendance_summary(
    p_student_id uuid,
    p_academic_year_id uuid,
    p_start_date date,
    p_end_date date
)
RETURNS TABLE(
    total_days integer,
    present_days integer,
    absent_days integer,
    attendance_percentage numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH attendance_stats AS (
        SELECT 
            COUNT(*) as total_days,
            COUNT(CASE WHEN sar.status = 'present' THEN 1 END) as present_days,
            COUNT(CASE WHEN sar.status = 'absent' THEN 1 END) as absent_days
        FROM public.daily_attendance da
        JOIN public.student_attendance_records sar ON da.id = sar.daily_attendance_id
        WHERE sar.student_id = p_student_id
        AND da.academic_year_id = p_academic_year_id
        AND da.attendance_date BETWEEN p_start_date AND p_end_date
        AND da.is_holiday = false
    )
    SELECT 
        stats.total_days,
        stats.present_days,
        stats.absent_days,
        CASE 
            WHEN stats.total_days > 0 THEN 
                ROUND((stats.present_days::numeric / stats.total_days) * 100, 2)
            ELSE 0 
        END as attendance_percentage
    FROM attendance_stats stats;
END;
$$ LANGUAGE plpgsql;

-- 4. Update function comment
COMMENT ON FUNCTION get_simplified_attendance_summary IS 'Get attendance summary for simplified system (present, absent)';

-- 5. Add comments to tables
COMMENT ON TABLE public.student_attendance_records IS 'Student attendance records with simplified status: present, absent';
COMMENT ON COLUMN public.student_attendance_records.status IS 'Attendance status: present or absent';

-- Migration completed successfully!
