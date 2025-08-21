-- Migration: Create Student Attendance System
-- Date: 2024-01-15
-- Description: Adds tables for tracking student attendance

-- 1. Create attendance_periods table for daily attendance periods
CREATE TABLE IF NOT EXISTS public.attendance_periods (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create daily_attendance table for tracking daily attendance
CREATE TABLE IF NOT EXISTS public.daily_attendance (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_division_id uuid NOT NULL REFERENCES public.class_divisions(id) ON DELETE CASCADE,
    academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    attendance_date date NOT NULL,
    period_id uuid REFERENCES public.attendance_periods(id) ON DELETE SET NULL,
    marked_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    is_holiday boolean DEFAULT false,
    holiday_reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_division_id, academic_year_id, attendance_date, period_id)
);

-- 3. Create student_attendance_records table for individual student attendance
CREATE TABLE IF NOT EXISTS public.student_attendance_records (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_attendance_id uuid NOT NULL REFERENCES public.daily_attendance(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.students_master(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day', 'excused')),
    remarks text,
    marked_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(daily_attendance_id, student_id)
);

-- 4. Create attendance_holidays table for marking holidays
CREATE TABLE IF NOT EXISTS public.attendance_holidays (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    holiday_date date NOT NULL UNIQUE,
    holiday_name text NOT NULL,
    holiday_type text NOT NULL CHECK (holiday_type IN ('national', 'state', 'school', 'exam')),
    description text,
    is_attendance_holiday boolean DEFAULT true,
    created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_attendance_class_date ON public.daily_attendance(class_division_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_academic_year ON public.daily_attendance(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_student ON public.student_attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_daily ON public.student_attendance_records(daily_attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_holidays_date ON public.attendance_holidays(holiday_date);

-- 6. Insert default attendance periods
INSERT INTO public.attendance_periods (name, start_time, end_time) VALUES
('Morning', '08:00:00', '08:30:00'),
('Afternoon', '13:00:00', '13:30:00'),
('Full Day', '08:00:00', '15:00:00')
ON CONFLICT DO NOTHING;

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.attendance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_holidays ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for attendance_periods
CREATE POLICY "Anyone can view attendance periods" ON public.attendance_periods
    FOR SELECT USING (true);

CREATE POLICY "Only admin and principal can manage attendance periods" ON public.attendance_periods
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- 9. Create RLS policies for daily_attendance
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

CREATE POLICY "Admin and principal can view all attendance" ON public.daily_attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can create attendance for their assigned classes" ON public.daily_attendance
    FOR INSERT WITH CHECK (
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

CREATE POLICY "Admin and principal can manage all attendance" ON public.daily_attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- 10. Create RLS policies for student_attendance_records
CREATE POLICY "Teachers can view attendance records for their classes" ON public.student_attendance_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.daily_attendance da
            JOIN public.class_teacher_assignments cta ON cta.class_division_id = da.class_division_id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM public.daily_attendance da
            JOIN public.class_divisions cd ON cd.id = da.class_division_id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cd.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Parents can view their children's attendance" ON public.student_attendance_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parent_student_mappings psm
            WHERE psm.student_id = student_attendance_records.student_id
            AND psm.parent_id = auth.uid()
        )
    );

CREATE POLICY "Admin and principal can view all attendance records" ON public.student_attendance_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can manage attendance records for their classes" ON public.student_attendance_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.daily_attendance da
            JOIN public.class_teacher_assignments cta ON cta.class_division_id = da.class_division_id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM public.daily_attendance da
            JOIN public.class_divisions cd ON cd.id = da.class_division_id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cd.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Admin and principal can manage all attendance records" ON public.student_attendance_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- 11. Create RLS policies for attendance_holidays
CREATE POLICY "Anyone can view holidays" ON public.attendance_holidays
    FOR SELECT USING (true);

CREATE POLICY "Only admin and principal can manage holidays" ON public.attendance_holidays
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- 12. Create functions for attendance management
CREATE OR REPLACE FUNCTION public.get_student_attendance_summary(
    p_student_id uuid,
    p_academic_year_id uuid,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL
)
RETURNS TABLE (
    total_days integer,
    present_days integer,
    absent_days integer,
    late_days integer,
    half_days integer,
    excused_days integer,
    attendance_percentage numeric
) AS $$
BEGIN
    -- Set default date range if not provided
    IF p_start_date IS NULL THEN
        p_start_date := (SELECT start_date FROM public.academic_years WHERE id = p_academic_year_id);
    END IF;
    
    IF p_end_date IS NULL THEN
        p_end_date := (SELECT end_date FROM public.academic_years WHERE id = p_academic_year_id);
    END IF;
    
    RETURN QUERY
    WITH attendance_stats AS (
        SELECT 
            COUNT(DISTINCT da.attendance_date) as total_days,
            COUNT(CASE WHEN sar.status = 'present' THEN 1 END) as present_days,
            COUNT(CASE WHEN sar.status = 'absent' THEN 1 END) as absent_days,
            COUNT(CASE WHEN sar.status = 'late' THEN 1 END) as late_days,
            COUNT(CASE WHEN sar.status = 'half_day' THEN 1 END) as half_days,
            COUNT(CASE WHEN sar.status = 'excused' THEN 1 END) as excused_days
        FROM public.daily_attendance da
        JOIN public.student_attendance_records sar ON da.id = sar.daily_attendance_id
        WHERE sar.student_id = p_student_id
        AND da.academic_year_id = p_academic_year_id
        AND da.attendance_date BETWEEN p_start_date AND p_end_date
        AND da.attendance_date NOT IN (
            SELECT holiday_date FROM public.attendance_holidays 
            WHERE is_attendance_holiday = true
        )
    )
    SELECT 
        total_days,
        present_days,
        absent_days,
        late_days,
        half_days,
        excused_days,
        CASE 
            WHEN total_days > 0 THEN 
                ROUND(((present_days + late_days + (half_days * 0.5))::numeric / total_days * 100), 2)
            ELSE 0 
        END as attendance_percentage
    FROM attendance_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Create function to check if date is a holiday
CREATE OR REPLACE FUNCTION public.is_attendance_holiday(p_date date)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.attendance_holidays 
        WHERE holiday_date = p_date 
        AND is_attendance_holiday = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Create function to get working days in date range
CREATE OR REPLACE FUNCTION public.get_working_days(p_start_date date, p_end_date date)
RETURNS integer AS $$
DECLARE
    working_days integer := 0;
    current_date date := p_start_date;
BEGIN
    WHILE current_date <= p_end_date LOOP
        -- Skip weekends (Saturday = 6, Sunday = 0)
        IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN
            -- Skip holidays
            IF NOT public.is_attendance_holiday(current_date) THEN
                working_days := working_days + 1;
            END IF;
        END IF;
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN working_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Add comments for documentation
COMMENT ON TABLE public.attendance_periods IS 'Defines different periods for attendance marking (morning, afternoon, full day)';
COMMENT ON TABLE public.daily_attendance IS 'Daily attendance records for each class division';
COMMENT ON TABLE public.student_attendance_records IS 'Individual student attendance records for each day';
COMMENT ON TABLE public.attendance_holidays IS 'Holidays that affect attendance calculations';

COMMENT ON FUNCTION public.get_student_attendance_summary IS 'Returns attendance summary for a student in a given date range';
COMMENT ON FUNCTION public.is_attendance_holiday IS 'Checks if a given date is marked as an attendance holiday';
COMMENT ON FUNCTION public.get_working_days IS 'Calculates working days between two dates excluding weekends and holidays';
