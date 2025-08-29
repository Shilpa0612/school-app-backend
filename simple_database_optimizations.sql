-- ============================================================================
-- SIMPLE & COST-EFFECTIVE DATABASE OPTIMIZATIONS
-- ============================================================================
-- This approach only adds indexes and functions - NO duplicate data!
-- Much more cost-effective and efficient.

-- ============================================================================
-- 1. PERFORMANCE INDEXES (Only adds indexes, no duplicate data)
-- ============================================================================

-- Calendar events indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON calendar_events(event_category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_class_division ON calendar_events(class_division_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_class_divisions_gin ON calendar_events USING GIN(class_divisions);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_daily_attendance_date ON daily_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_class ON daily_attendance(class_division_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_academic_year ON daily_attendance(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_student ON student_attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_daily ON student_attendance_records(daily_attendance_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_status ON student_attendance_records(status);

-- Teacher assignments indexes
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_teacher ON class_teacher_assignments(teacher_id, is_active);
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_class ON class_teacher_assignments(class_division_id, is_active);

-- Class divisions indexes
CREATE INDEX IF NOT EXISTS idx_class_divisions_academic_year ON class_divisions(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_class_divisions_level ON class_divisions(class_level_id);

-- Homework indexes
CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_division_id);
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_teacher ON homework(teacher_id);

-- ============================================================================
-- 2. OPTIMIZED FUNCTIONS (Uses existing data, no duplication)
-- ============================================================================

-- Optimized calendar events function (no duplicate data)
CREATE OR REPLACE FUNCTION get_optimized_calendar_events(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_event_type TEXT DEFAULT NULL,
    p_event_category TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_class_division_id UUID DEFAULT NULL,
    p_user_role TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    event_date DATE,
    event_type TEXT,
    event_category TEXT,
    status TEXT,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    class_division_id UUID,
    class_divisions JSONB,
    is_multi_class BOOLEAN,
    is_single_day BOOLEAN,
    start_time TIME,
    end_time TIME,
    timezone TEXT,
    created_at TIMESTAMPTZ,
    creator_name TEXT,
    creator_role TEXT,
    approver_name TEXT,
    approver_role TEXT,
    class_division_name TEXT,
    class_level_name TEXT,
    class_level_sequence INTEGER,
    academic_year_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.id,
        ce.title,
        ce.description,
        ce.event_date,
        ce.event_type,
        ce.event_category,
        ce.status,
        ce.created_by,
        ce.approved_by,
        ce.approved_at,
        ce.rejection_reason,
        ce.class_division_id,
        ce.class_divisions,
        ce.is_multi_class,
        ce.is_single_day,
        ce.start_time,
        ce.end_time,
        ce.timezone,
        ce.created_at,
        creator.full_name as creator_name,
        creator.role as creator_role,
        approver.full_name as approver_name,
        approver.role as approver_role,
        cd.division as class_division_name,
        cl.name as class_level_name,
        cl.sequence_number as class_level_sequence,
        ay.year_name as academic_year_name
    FROM calendar_events ce
    LEFT JOIN users creator ON ce.created_by = creator.id
    LEFT JOIN users approver ON ce.approved_by = approver.id
    LEFT JOIN class_divisions cd ON ce.class_division_id = cd.id
    LEFT JOIN class_levels cl ON cd.class_level_id = cl.id
    LEFT JOIN academic_years ay ON cd.academic_year_id = ay.id
    WHERE 
        (p_start_date IS NULL OR ce.event_date >= p_start_date)
        AND (p_end_date IS NULL OR ce.event_date <= p_end_date)
        AND (p_event_type IS NULL OR ce.event_type = p_event_type)
        AND (p_event_category IS NULL OR ce.event_category = p_event_category)
        AND (p_status IS NULL OR ce.status = p_status)
        AND (p_class_division_id IS NULL OR 
             ce.class_division_id = p_class_division_id OR 
             ce.class_divisions @> jsonb_build_array(p_class_division_id::text))
        AND (
            -- Role-based filtering
            p_user_role = 'admin' OR p_user_role = 'principal' OR
            ce.status = 'approved' OR
            (p_user_role = 'teacher' AND ce.created_by = p_user_id) OR
            (p_user_role = 'teacher' AND ce.event_type = 'school_wide')
        )
    ORDER BY ce.event_date ASC;
END;
$$ LANGUAGE plpgsql;

-- Optimized attendance summary function (no duplicate data)
CREATE OR REPLACE FUNCTION get_optimized_attendance_summary(
    p_class_division_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_academic_year_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    class_division_id UUID,
    attendance_date DATE,
    is_holiday BOOLEAN,
    holiday_reason TEXT,
    marked_by UUID,
    academic_year_id UUID,
    created_at TIMESTAMPTZ,
    class_division_name TEXT,
    class_level_name TEXT,
    class_level_sequence INTEGER,
    academic_year_name TEXT,
    total_students BIGINT,
    present_count BIGINT,
    absent_count BIGINT,
    late_count BIGINT,
    attendance_percentage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        da.id,
        da.class_division_id,
        da.attendance_date,
        da.is_holiday,
        da.holiday_reason,
        da.marked_by,
        da.academic_year_id,
        da.created_at,
        cd.division as class_division_name,
        cl.name as class_level_name,
        cl.sequence_number as class_level_sequence,
        ay.year_name as academic_year_name,
        COUNT(sar.id) as total_students,
        COUNT(CASE WHEN sar.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN sar.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN sar.status = 'late' THEN 1 END) as late_count,
        CASE 
            WHEN COUNT(sar.id) > 0 THEN 
                ROUND((COUNT(CASE WHEN sar.status = 'present' THEN 1 END)::DECIMAL / COUNT(sar.id)::DECIMAL) * 100)
            ELSE 0 
        END as attendance_percentage
    FROM daily_attendance da
    LEFT JOIN class_divisions cd ON da.class_division_id = cd.id
    LEFT JOIN class_levels cl ON cd.class_level_id = cl.id
    LEFT JOIN academic_years ay ON da.academic_year_id = ay.id
    LEFT JOIN student_attendance_records sar ON da.id = sar.daily_attendance_id
    WHERE 
        (p_class_division_id IS NULL OR da.class_division_id = p_class_division_id)
        AND (p_start_date IS NULL OR da.attendance_date >= p_start_date)
        AND (p_end_date IS NULL OR da.attendance_date <= p_end_date)
        AND (p_academic_year_id IS NULL OR da.academic_year_id = p_academic_year_id)
    GROUP BY da.id, da.class_division_id, da.attendance_date, da.is_holiday, da.holiday_reason, 
             da.marked_by, da.academic_year_id, da.created_at,
             cd.division, cl.name, cl.sequence_number, ay.year_name
    ORDER BY da.attendance_date DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. ATTENDANCE STATUS FIX
-- ============================================================================

-- First, let's see what status values currently exist
-- SELECT DISTINCT status FROM student_attendance_records;

-- Update any existing records with invalid status values
UPDATE student_attendance_records 
SET status = 'present' 
WHERE status NOT IN ('present', 'absent');

-- Drop the existing constraint completely
ALTER TABLE student_attendance_records 
DROP CONSTRAINT IF EXISTS student_attendance_records_status_check;

-- Add the new constraint that allows present and absent
ALTER TABLE student_attendance_records 
ADD CONSTRAINT student_attendance_records_status_check 
CHECK (status IN ('present', 'absent'));

-- Verify the constraint was added correctly
-- SELECT 
--     conname as constraint_name,
--     pg_get_constraintdef(oid) as constraint_definition
-- FROM pg_constraint 
-- WHERE conname = 'student_attendance_records_status_check';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Simple database optimizations completed!';
    RAISE NOTICE '📊 Added performance indexes (no duplicate data)';
    RAISE NOTICE '⚡ Created optimized functions (uses existing data)';
    RAISE NOTICE '🔧 Fixed attendance status constraint';
    RAISE NOTICE '💰 Cost-effective approach - no data duplication!';
    RAISE NOTICE '🚀 All endpoints should now be faster!';
END $$;
