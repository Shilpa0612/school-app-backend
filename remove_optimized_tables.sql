-- ============================================================================
-- REMOVE OPTIMIZED TABLES, VIEWS, AND FUNCTIONS
-- ============================================================================
-- This script will clean up all the duplicate optimized tables and views
-- that were created earlier to save storage space and costs.

-- ============================================================================
-- 1. DROP OPTIMIZED VIEWS
-- ============================================================================

-- Drop optimized calendar events view
DROP VIEW IF EXISTS optimized_calendar_events;

-- Drop optimized daily attendance view
DROP VIEW IF EXISTS optimized_daily_attendance;

-- Drop optimized student attendance view
DROP VIEW IF EXISTS optimized_student_attendance;

-- Drop optimized teacher assignments view
DROP VIEW IF EXISTS optimized_teacher_assignments;

-- Drop optimized class divisions view
DROP VIEW IF EXISTS optimized_class_divisions;

-- Drop optimized homework view
DROP VIEW IF EXISTS optimized_homework;

-- ============================================================================
-- 2. DROP MATERIALIZED VIEWS
-- ============================================================================

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS mv_daily_attendance_summary;

-- ============================================================================
-- 3. DROP OPTIMIZED FUNCTIONS
-- ============================================================================

-- Drop optimized functions
DROP FUNCTION IF EXISTS get_optimized_calendar_events(
    DATE, DATE, TEXT, TEXT, TEXT, UUID, TEXT, UUID
);

DROP FUNCTION IF EXISTS get_optimized_attendance_summary(
    UUID, DATE, DATE, UUID
);

DROP FUNCTION IF EXISTS get_optimized_student_attendance_summary(
    UUID, DATE, DATE, UUID
);

DROP FUNCTION IF EXISTS get_optimized_teacher_summary(
    UUID, DATE, DATE
);

DROP FUNCTION IF EXISTS get_optimized_homework(
    UUID, TEXT, UUID, DATE, DATE
);

DROP FUNCTION IF EXISTS get_query_performance_stats();

DROP FUNCTION IF EXISTS refresh_materialized_views();

-- Drop function with CASCADE to handle trigger dependencies
DROP FUNCTION IF EXISTS trigger_refresh_materialized_views() CASCADE;

-- ============================================================================
-- 4. DROP TRIGGERS (Already dropped by CASCADE above)
-- ============================================================================

-- Triggers are automatically dropped by the CASCADE above
-- DROP TRIGGER IF EXISTS trigger_refresh_after_attendance_change ON daily_attendance;
-- DROP TRIGGER IF EXISTS trigger_refresh_after_student_attendance_change ON student_attendance_records;

-- ============================================================================
-- 5. DROP INDEXES (Optional - keep if you want performance)
-- ============================================================================

-- Uncomment the lines below if you want to remove ALL indexes too
-- (This will make queries slower but save more space)

-- Calendar events indexes
-- DROP INDEX IF EXISTS idx_calendar_events_date;
-- DROP INDEX IF EXISTS idx_calendar_events_status;
-- DROP INDEX IF EXISTS idx_calendar_events_type;
-- DROP INDEX IF EXISTS idx_calendar_events_category;
-- DROP INDEX IF EXISTS idx_calendar_events_created_by;
-- DROP INDEX IF EXISTS idx_calendar_events_class_division;
-- DROP INDEX IF EXISTS idx_calendar_events_class_divisions_gin;

-- Attendance indexes
-- DROP INDEX IF EXISTS idx_daily_attendance_date;
-- DROP INDEX IF EXISTS idx_daily_attendance_class;
-- DROP INDEX IF EXISTS idx_daily_attendance_academic_year;
-- DROP INDEX IF EXISTS idx_student_attendance_student;
-- DROP INDEX IF EXISTS idx_student_attendance_daily;
-- DROP INDEX IF EXISTS idx_student_attendance_status;

-- Teacher assignments indexes
-- DROP INDEX IF EXISTS idx_class_teacher_assignments_teacher;
-- DROP INDEX IF EXISTS idx_class_teacher_assignments_class;

-- Class divisions indexes
-- DROP INDEX IF EXISTS idx_class_divisions_academic_year;
-- DROP INDEX IF EXISTS idx_class_divisions_level;

-- Homework indexes
-- DROP INDEX IF EXISTS idx_homework_class;
-- DROP INDEX IF EXISTS idx_homework_due_date;
-- DROP INDEX IF EXISTS idx_homework_teacher;

-- ============================================================================
-- 6. VERIFY CLEANUP
-- ============================================================================

-- Check what optimized objects remain (should be empty)
SELECT 'Views' as object_type, table_name as object_name
FROM information_schema.views 
WHERE table_name LIKE 'optimized_%'
UNION ALL
SELECT 'Functions' as object_type, routine_name as object_name
FROM information_schema.routines 
WHERE routine_name LIKE 'get_optimized_%'
UNION ALL
SELECT 'Materialized Views' as object_type, matviewname as object_name
FROM pg_matviews 
WHERE matviewname LIKE 'mv_%';

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🧹 Cleanup completed successfully!';
    RAISE NOTICE '🗑️  Removed optimized views and functions';
    RAISE NOTICE '🗑️  Removed materialized views';
    RAISE NOTICE '🗑️  Removed triggers';
    RAISE NOTICE '💾 Storage space saved!';
    RAISE NOTICE '📊 Database is now cleaner and more cost-effective';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Recommendation: Keep the indexes for performance';
    RAISE NOTICE '   (They use minimal space but provide big performance gains)';
END $$;
