-- Migration: Recreate Attendance System Without Periods
-- Date: 2025-08-28
-- Description: Drop and recreate attendance tables without period complexity

-- 1. Create backup of existing data (optional)
CREATE TABLE IF NOT EXISTS daily_attendance_backup AS 
SELECT * FROM daily_attendance;

CREATE TABLE IF NOT EXISTS student_attendance_records_backup AS 
SELECT * FROM student_attendance_records;

CREATE TABLE IF NOT EXISTS attendance_holidays_backup AS 
SELECT * FROM attendance_holidays;

-- 2. Drop existing attendance tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS student_attendance_records CASCADE;
DROP TABLE IF EXISTS daily_attendance CASCADE;
DROP TABLE IF EXISTS attendance_periods CASCADE;
DROP TABLE IF EXISTS attendance_holidays CASCADE;

-- 3. Recreate attendance_holidays table (keep this - useful!)
CREATE TABLE attendance_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(255) NOT NULL,
    holiday_reason TEXT,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(holiday_date, academic_year_id)
);

-- 4. Recreate daily_attendance table (simplified - no period_id)
CREATE TABLE daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_division_id UUID NOT NULL REFERENCES class_divisions(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_holiday BOOLEAN DEFAULT false,
    holiday_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(class_division_id, academic_year_id, attendance_date)
);

-- 5. Recreate student_attendance_records table (simplified statuses)
CREATE TABLE student_attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_attendance_id UUID NOT NULL REFERENCES daily_attendance(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students_master(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('full_day', 'half_day', 'absent')),
    remarks TEXT,
    marked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(daily_attendance_id, student_id)
);

-- 6. Create indexes for better performance
CREATE INDEX idx_daily_attendance_class_date ON daily_attendance(class_division_id, attendance_date);
CREATE INDEX idx_daily_attendance_academic_year ON daily_attendance(academic_year_id);
CREATE INDEX idx_student_attendance_daily_id ON student_attendance_records(daily_attendance_id);
CREATE INDEX idx_student_attendance_student_id ON student_attendance_records(student_id);
CREATE INDEX idx_attendance_holidays_date ON attendance_holidays(holiday_date);
CREATE INDEX idx_attendance_holidays_academic_year ON attendance_holidays(academic_year_id);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_holidays ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for daily_attendance
CREATE POLICY "Teachers can view attendance for their assigned classes" ON daily_attendance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM class_teacher_assignments cta
            WHERE cta.class_division_id = daily_attendance.class_division_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM class_divisions cd
            WHERE cd.id = daily_attendance.class_division_id
            AND cd.teacher_id = auth.uid()
        )
        OR
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can insert attendance for their assigned classes" ON daily_attendance
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM class_teacher_assignments cta
            WHERE cta.class_division_id = daily_attendance.class_division_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM class_divisions cd
            WHERE cd.id = daily_attendance.class_division_id
            AND cd.teacher_id = auth.uid()
        )
        OR
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can update attendance for their assigned classes" ON daily_attendance
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM class_teacher_assignments cta
            WHERE cta.class_division_id = daily_attendance.class_division_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM class_divisions cd
            WHERE cd.id = daily_attendance.class_division_id
            AND cd.teacher_id = auth.uid()
        )
        OR
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin', 'principal')
        )
    );

-- 9. Create RLS policies for student_attendance_records
CREATE POLICY "Teachers can view student attendance for their assigned classes" ON student_attendance_records
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM daily_attendance da
            JOIN class_teacher_assignments cta ON da.class_division_id = cta.class_division_id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM daily_attendance da
            JOIN class_divisions cd ON da.class_division_id = cd.id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cd.teacher_id = auth.uid()
        )
        OR
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can insert student attendance for their assigned classes" ON student_attendance_records
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM daily_attendance da
            JOIN class_teacher_assignments cta ON da.class_division_id = cta.class_division_id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM daily_attendance da
            JOIN class_divisions cd ON da.class_division_id = cd.id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cd.teacher_id = auth.uid()
        )
        OR
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can update student attendance for their assigned classes" ON student_attendance_records
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM daily_attendance da
            JOIN class_teacher_assignments cta ON da.class_division_id = cta.class_division_id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cta.teacher_id = auth.uid()
            AND cta.is_active = true
        )
        OR
        EXISTS (
            SELECT 1 FROM daily_attendance da
            JOIN class_divisions cd ON da.class_division_id = cd.id
            WHERE da.id = student_attendance_records.daily_attendance_id
            AND cd.teacher_id = auth.uid()
        )
        OR
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin', 'principal')
        )
    );

-- 10. Create RLS policies for attendance_holidays
CREATE POLICY "Everyone can view holidays" ON attendance_holidays
    FOR SELECT USING (true);

CREATE POLICY "Admin and principal can manage holidays" ON attendance_holidays
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM users WHERE role IN ('admin', 'principal')
        )
    );

-- 11. Add comments
COMMENT ON TABLE daily_attendance IS 'Simplified daily attendance records - no periods, just daily attendance';
COMMENT ON COLUMN daily_attendance.attendance_date IS 'Date of attendance (no period complexity)';
COMMENT ON TABLE student_attendance_records IS 'Student attendance records with simplified status: full_day, half_day, absent';
COMMENT ON TABLE attendance_holidays IS 'Holiday records for automatic holiday detection';

-- 12. Create function to get simplified attendance summary
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
        FROM daily_attendance da
        JOIN student_attendance_records sar ON da.id = sar.daily_attendance_id
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

-- 13. Grant permissions
GRANT EXECUTE ON FUNCTION get_simplified_attendance_summary TO authenticated;

-- 14. Add comments to the function
COMMENT ON FUNCTION get_simplified_attendance_summary IS 'Get attendance summary for simplified system (full_day, half_day, absent)';

-- Migration completed successfully!
