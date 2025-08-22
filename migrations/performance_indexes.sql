-- Performance Optimization Indexes
-- Run this migration to improve query performance
-- This file contains only indexes for tables and columns that definitely exist

-- ============================================================================
-- CORE TABLES (Definitely exist based on schema)
-- ============================================================================

-- Parent-student mappings (heavily used in children endpoint)
CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_parent_id 
ON parent_student_mappings(parent_id);

CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_student_id 
ON parent_student_mappings(student_id);

-- Composite index for parent-student mappings
CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_parent_student 
ON parent_student_mappings(parent_id, student_id);

-- Student academic records (for current class lookup)
CREATE INDEX IF NOT EXISTS idx_student_academic_records_student_status 
ON student_academic_records(student_id, status);

CREATE INDEX IF NOT EXISTS idx_student_academic_records_class_division 
ON student_academic_records(class_division_id, status);

-- Composite index for academic records
CREATE INDEX IF NOT EXISTS idx_student_academic_records_student_class_status 
ON student_academic_records(student_id, class_division_id, status);

-- Class divisions (for teacher lookup)
CREATE INDEX IF NOT EXISTS idx_class_divisions_teacher_id 
ON class_divisions(teacher_id);

CREATE INDEX IF NOT EXISTS idx_class_divisions_academic_year 
ON class_divisions(academic_year_id);

-- Users (for login and profile)
CREATE INDEX IF NOT EXISTS idx_users_phone_number 
ON users(phone_number);

CREATE INDEX IF NOT EXISTS idx_users_role 
ON users(role);

CREATE INDEX IF NOT EXISTS idx_users_role_phone 
ON users(role, phone_number);

-- Messages (for filtering)
CREATE INDEX IF NOT EXISTS idx_messages_sender 
ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_status 
ON messages(status);

CREATE INDEX IF NOT EXISTS idx_messages_class_division 
ON messages(class_division_id);

-- Homework (for filtering)
CREATE INDEX IF NOT EXISTS idx_homework_class_division 
ON homework(class_division_id);

CREATE INDEX IF NOT EXISTS idx_homework_teacher 
ON homework(teacher_id);

CREATE INDEX IF NOT EXISTS idx_homework_due_date 
ON homework(due_date);

-- ============================================================================
-- CONDITIONAL TABLES (Check if these exist before running)
-- ============================================================================

-- Staff table (for teacher staff info) - Check if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff') THEN
        CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
        CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
    END IF;
END $$;

-- Teacher assignments table (uses class_level, division instead of class_division_id) - Check if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_class_assignments') THEN
        CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_teacher_year 
        ON teacher_class_assignments(teacher_id, academic_year);
        
        CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_class_level_division 
        ON teacher_class_assignments(class_level, division);
        
        CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_teacher_class 
        ON teacher_class_assignments(teacher_id, class_level, division, academic_year);
    END IF;
END $$;

-- Calendar events table - Check if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calendar_events') THEN
        CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by 
        ON calendar_events(created_by);
        
        CREATE INDEX IF NOT EXISTS idx_calendar_events_class_division 
        ON calendar_events(class_division_id);
        
        CREATE INDEX IF NOT EXISTS idx_calendar_events_date_type 
        ON calendar_events(event_date, event_type);
    END IF;
END $$;

-- Classwork table - Check if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'classwork') THEN
        CREATE INDEX IF NOT EXISTS idx_classwork_class_division 
        ON classwork(class_division_id);
        
        CREATE INDEX IF NOT EXISTS idx_classwork_teacher 
        ON classwork(teacher_id);
        
        CREATE INDEX IF NOT EXISTS idx_classwork_date 
        ON classwork(date);
    END IF;
END $$;

-- Attendance tables - Check if exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_daily') THEN
        CREATE INDEX IF NOT EXISTS idx_attendance_daily_class_date 
        ON attendance_daily(class_division_id, attendance_date);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_student_records') THEN
        CREATE INDEX IF NOT EXISTS idx_attendance_student_records_student_date 
        ON attendance_student_records(student_id, daily_attendance_id);
    END IF;
END $$;

-- Chat tables - Check if exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
        CREATE INDEX IF NOT EXISTS idx_chat_messages_thread 
        ON chat_messages(thread_id);
        
        CREATE INDEX IF NOT EXISTS idx_chat_messages_sender 
        ON chat_messages(sender_id);
        
        CREATE INDEX IF NOT EXISTS idx_chat_messages_created 
        ON chat_messages(created_at);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_threads') THEN
        CREATE INDEX IF NOT EXISTS idx_chat_threads_created 
        ON chat_threads(created_at);
    END IF;
END $$;

-- ============================================================================
-- COMMENTS AND NOTES
-- ============================================================================

-- These indexes will significantly improve query performance for:
-- 1. Login process (users table) ✅
-- 2. Children endpoint (parent_student_mappings + related tables) ✅
-- 3. Teacher assignments (teacher_class_assignments) - Conditional
-- 4. Calendar events filtering - Conditional
-- 5. Messages filtering ✅
-- 6. Homework filtering ✅
-- 7. Classwork filtering - Conditional
-- 8. Attendance queries - Conditional
-- 9. Chat system queries - Conditional

-- ============================================================================
-- SAFETY FEATURES
-- ============================================================================

-- All indexes use IF NOT EXISTS to prevent errors
-- Conditional tables are checked before creating indexes
-- Core tables are guaranteed to exist based on schema

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

-- 1. Run this migration in your development environment first
-- 2. Monitor the creation process for any errors
-- 3. Indexes will take some time to create on large tables
-- 4. Ensure sufficient disk space is available
-- 5. Test performance improvements after index creation

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If you get errors about missing tables:
-- 1. Check which tables exist: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- 2. Comment out the conditional sections for non-existent tables
-- 3. Run the migration again

-- If you get errors about missing columns:
-- 1. Check table structure: \d table_name
-- 2. Verify column names match exactly
-- 3. Update the migration file accordingly
