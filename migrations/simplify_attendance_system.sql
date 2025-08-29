-- Migration: Simplify Attendance System
-- Date: 2025-08-28
-- Description: Remove period complexity and simplify attendance to just full_day, half_day, absent

-- 1. Drop attendance_periods table (no longer needed)
DROP TABLE IF EXISTS public.attendance_periods CASCADE;

-- 2. Modify daily_attendance table to remove period_id
ALTER TABLE public.daily_attendance 
DROP COLUMN IF EXISTS period_id;

-- 3. Update the unique constraint to remove period_id
ALTER TABLE public.daily_attendance 
DROP CONSTRAINT IF EXISTS daily_attendance_class_division_id_academic_year_id_attendance_date_period_id_key;

-- 4. Add new unique constraint without period_id
ALTER TABLE public.daily_attendance 
ADD CONSTRAINT daily_attendance_class_division_id_academic_year_id_attendance_date_key 
UNIQUE(class_division_id, academic_year_id, attendance_date);

-- 5. Update student_attendance_records status constraint to use simplified statuses
ALTER TABLE public.student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_check;

ALTER TABLE public.student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('full_day', 'half_day', 'absent'));

-- 6. Update indexes to remove period-related indexes
DROP INDEX IF EXISTS idx_daily_attendance_class_date;
CREATE INDEX idx_daily_attendance_class_date ON public.daily_attendance(class_division_id, attendance_date);

-- 7. Keep attendance_holidays table (useful for marking holidays)
-- No changes needed - holidays are still useful

-- 8. Update RLS policies to remove period references
DROP POLICY IF EXISTS "Teachers can view attendance for their assigned classes" ON public.daily_attendance;
CREATE POLICY "Teachers can view attendance for their assigned classes" ON public.daily_attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.class_teacher_assignments cta
            WHERE cta.class_division_id = daily_attendance.class_division_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM public.class_divisions cd
            WHERE cd.id = daily_attendance.class_division_id
            AND cd.teacher_id = auth.uid()
        )
    );

-- 9. Add comments to explain the simplified system
COMMENT ON TABLE public.daily_attendance IS 'Simplified daily attendance records - no periods, just daily attendance';
COMMENT ON COLUMN public.daily_attendance.attendance_date IS 'Date of attendance (no period complexity)';
COMMENT ON TABLE public.student_attendance_records IS 'Student attendance records with simplified status: full_day, half_day, absent';

-- 10. Create a function to get attendance summary for simplified system
CREATE OR REPLACE FUNCTION get_simplified_attendance_summary(
    p_student_id uuid,
    p_academic_year_id uuid,
    p_start_date date,
    p_end_date date
)
RETURNS TABLE(
    total_days integer,
    full_days integer,
    half_days integer,
    absent_days integer,
    attendance_percentage numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH attendance_stats AS (
        SELECT 
            COUNT(*) as total_days,
            COUNT(CASE WHEN sar.status = 'full_day' THEN 1 END) as full_days,
            COUNT(CASE WHEN sar.status = 'half_day' THEN 1 END) as half_days,
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
        stats.full_days,
        stats.half_days,
        stats.absent_days,
        CASE 
            WHEN stats.total_days > 0 THEN 
                ROUND(((stats.full_days + (stats.half_days * 0.5)) / stats.total_days) * 100, 2)
            ELSE 0 
        END as attendance_percentage
    FROM attendance_stats stats;
END;
$$ LANGUAGE plpgsql;

-- 11. Grant permissions
GRANT EXECUTE ON FUNCTION get_simplified_attendance_summary TO authenticated;

-- 12. Add comments to the function
COMMENT ON FUNCTION get_simplified_attendance_summary IS 'Get attendance summary for simplified system (full_day, half_day, absent)';
