-- Essential performance indexes for login optimization
-- Run these indexes to fix the slow login issue

-- ============================================================================
-- CORE PERFORMANCE INDEXES (Safe to run)
-- ============================================================================

-- Parent-student mappings (most important for login performance)
CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_parent_id 
ON parent_student_mappings(parent_id);

CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_student_id 
ON parent_student_mappings(student_id);

-- Student academic records (for children endpoint)
CREATE INDEX IF NOT EXISTS idx_student_academic_records_student_status 
ON student_academic_records(student_id, status);

CREATE INDEX IF NOT EXISTS idx_student_academic_records_class_division 
ON student_academic_records(class_division_id, status);

-- Users table (for login)
CREATE INDEX IF NOT EXISTS idx_users_phone_number 
ON users(phone_number);

CREATE INDEX IF NOT EXISTS idx_users_role 
ON users(role);

-- Class divisions (for teacher lookup)
CREATE INDEX IF NOT EXISTS idx_class_divisions_teacher_id 
ON class_divisions(teacher_id);

-- Teacher assignments table (CORRECTED COLUMNS)
CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_teacher_year 
ON teacher_class_assignments(teacher_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_class_level_division 
ON teacher_class_assignments(class_level, division);

-- Messages (for filtering)
CREATE INDEX IF NOT EXISTS idx_messages_sender 
ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_messages_status 
ON messages(status);

-- Homework (for filtering)
CREATE INDEX IF NOT EXISTS idx_homework_class_division 
ON homework(class_division_id);

CREATE INDEX IF NOT EXISTS idx_homework_teacher 
ON homework(teacher_id);

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

-- These indexes should significantly improve:
-- 1. Login performance (users table)
-- 2. Children endpoint (parent_student_mappings + student_academic_records)  
-- 3. Teacher assignments (teacher_class_assignments with correct columns)
-- 4. General API performance

SELECT 'Essential performance indexes created successfully!' as status;
