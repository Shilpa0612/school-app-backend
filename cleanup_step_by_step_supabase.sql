-- ============================================================================
-- STEP-BY-STEP CLEANUP SCRIPT FOR SUPABASE
-- ============================================================================
-- Run each section separately to avoid query limits
-- ============================================================================

-- ============================================================================
-- STEP 1: CHECK CURRENT STATE (Run this first)
-- ============================================================================

-- Check current users
SELECT 
    role,
    full_name,
    phone_number,
    email,
    created_at
FROM users 
ORDER BY role, full_name;

-- Check current data counts
SELECT 
    'CURRENT STATE' AS status,
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM students_master) AS total_students,
    (SELECT COUNT(*) FROM messages) AS total_messages,
    (SELECT COUNT(*) FROM announcements) AS total_announcements,
    (SELECT COUNT(*) FROM school_details) AS total_school_details,
    (SELECT COUNT(*) FROM academic_years) AS total_academic_years,
    (SELECT COUNT(*) FROM class_levels) AS total_class_levels;

-- ============================================================================
-- STEP 2: DELETE CHAT DATA (Run this section)
-- ============================================================================

DELETE FROM chat_message_attachments;
DELETE FROM chat_messages;
DELETE FROM chat_participants;
DELETE FROM chat_threads;

SELECT 'Chat data deleted' AS status;

-- ============================================================================
-- STEP 3: DELETE ANNOUNCEMENT DATA (Run this section)
-- ============================================================================

DELETE FROM announcement_recipients;
DELETE FROM announcement_views;
DELETE FROM announcement_attachments;
DELETE FROM announcements;

SELECT 'Announcement data deleted' AS status;

-- ============================================================================
-- STEP 4: DELETE TIMETABLE DATA (Run this section)
-- ============================================================================

DELETE FROM class_timetable;
DELETE FROM timetable_config;

SELECT 'Timetable data deleted' AS status;

-- ============================================================================
-- STEP 5: DELETE ATTENDANCE DATA (Run this section)
-- ============================================================================

DELETE FROM student_attendance_records;
DELETE FROM daily_attendance;
DELETE FROM attendance_holidays;

SELECT 'Attendance data deleted (periods preserved)' AS status;

-- ============================================================================
-- STEP 6: DELETE ACADEMIC ACTIVITIES (Run this section)
-- ============================================================================

DELETE FROM classwork_attachments;
DELETE FROM classwork;
DELETE FROM homework_files;
DELETE FROM homework;

SELECT 'Academic activities deleted' AS status;

-- ============================================================================
-- STEP 7: DELETE ADMINISTRATIVE DATA (Run this section)
-- ============================================================================

DELETE FROM file_access_logs;
DELETE FROM leave_requests;
DELETE FROM calendar_events;

SELECT 'Administrative data deleted' AS status;

-- ============================================================================
-- STEP 8: DELETE COMMUNICATION DATA (Run this section)
-- ============================================================================

DELETE FROM messages;

SELECT 'Communication data deleted' AS status;

-- ============================================================================
-- STEP 9: DELETE ADDITIONAL REFERENCING TABLES (Run this section)
-- ============================================================================

-- Delete tables that reference class_divisions first
DELETE FROM alert_recipients;
DELETE FROM alert_delivery_logs;
DELETE FROM alerts;
DELETE FROM class_division_subjects;
DELETE FROM subjects;
DELETE FROM class_teacher_assignments;

SELECT 'Additional referencing tables deleted' AS status;

-- ============================================================================
-- STEP 10: DELETE ACADEMIC MANAGEMENT DATA (Run this section)
-- ============================================================================

DELETE FROM teacher_class_assignments;
DELETE FROM parent_student_mappings;
DELETE FROM student_academic_records;
DELETE FROM class_divisions;
DELETE FROM students_master;

SELECT 'Academic management data deleted' AS status;

-- ============================================================================
-- STEP 11: DELETE SYSTEM CONFIGURATION (Run this section)
-- ============================================================================

DELETE FROM school_details;
DELETE FROM academic_years;
DELETE FROM class_levels;

SELECT 'System configuration deleted' AS status;

-- ============================================================================
-- STEP 12: DELETE NON-ADMIN/NON-PRINCIPAL USERS (Run this section)
-- ============================================================================

-- CAREFUL: This deletes all users except admin and principal
DELETE FROM users 
WHERE role NOT IN ('admin', 'principal');

SELECT 'Non-admin/non-principal users deleted' AS status;

-- ============================================================================
-- STEP 13: ADD NEW PRINCIPAL (Run this section)
-- ============================================================================

-- Update these values with your actual data
INSERT INTO users (
    phone_number,
    password_hash,
    role,
    full_name,
    email,
    preferred_language,
    created_at
) VALUES (
    '+1234567890',                    -- Update with actual phone number
    '$2a$10$example.hash.here',       -- Update with actual password hash
    'principal',
    'New Principal Name',              -- Update with actual name
    'new.principal@school.com',        -- Update with actual email
    'english',                         -- Update if needed
    NOW()
);

SELECT 'New principal added' AS status;

-- ============================================================================
-- STEP 14: FINAL VERIFICATION (Run this section)
-- ============================================================================

-- Check final state
SELECT 
    'FINAL STATE' AS status,
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM students_master) AS total_students,
    (SELECT COUNT(*) FROM messages) AS total_messages,
    (SELECT COUNT(*) FROM announcements) AS total_announcements,
    (SELECT COUNT(*) FROM school_details) AS total_school_details,
    (SELECT COUNT(*) FROM academic_years) AS total_academic_years,
    (SELECT COUNT(*) FROM class_levels) AS total_class_levels;

-- List remaining users
SELECT 
    'REMAINING USERS' AS status,
    role,
    full_name,
    phone_number,
    email
FROM users 
ORDER BY role, full_name;
