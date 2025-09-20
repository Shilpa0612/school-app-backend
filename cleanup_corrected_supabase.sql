-- ============================================================================
-- CORRECTED CLEANUP SCRIPT FOR YOUR ACTUAL DATABASE
-- ============================================================================
-- This script only deletes tables that actually exist in your database
-- ============================================================================

-- ============================================================================
-- STEP 1: CHECK CURRENT STATE
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

-- Check current data counts for existing tables
SELECT 
    'CURRENT STATE' AS status,
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM students_master) AS total_students,
    (SELECT COUNT(*) FROM messages) AS total_messages,
    (SELECT COUNT(*) FROM announcements) AS total_announcements,
    (SELECT COUNT(*) FROM academic_years) AS total_academic_years,
    (SELECT COUNT(*) FROM class_levels) AS total_class_levels;

-- ============================================================================
-- STEP 2: DELETE CHAT DATA
-- ============================================================================

DELETE FROM chat_message_attachments;
DELETE FROM chat_messages;
SELECT 'Chat data deleted' AS status;

-- ============================================================================
-- STEP 3: DELETE ANNOUNCEMENT DATA
-- ============================================================================

DELETE FROM announcement_recipients;
DELETE FROM announcement_views;
DELETE FROM announcement_attachments;
DELETE FROM announcements;
SELECT 'Announcement data deleted' AS status;

-- ============================================================================
-- STEP 4: DELETE ALERT DATA
-- ============================================================================

DELETE FROM alert_delivery_logs;
DELETE FROM alert_recipients;
DELETE FROM alerts;
SELECT 'Alert data deleted' AS status;

-- ============================================================================
-- STEP 5: DELETE TIMETABLE DATA
-- ============================================================================

DELETE FROM class_timetable;
SELECT 'Timetable data deleted' AS status;

-- ============================================================================
-- STEP 6: DELETE ATTENDANCE DATA
-- ============================================================================

DELETE FROM student_attendance_records;
DELETE FROM daily_attendance_backup;
DELETE FROM daily_attendance;
DELETE FROM attendance_holidays;
SELECT 'Attendance data deleted' AS status;

-- ============================================================================
-- STEP 7: DELETE ACADEMIC ACTIVITIES
-- ============================================================================

DELETE FROM classwork_attachments;
DELETE FROM classwork_topics;
DELETE FROM classwork;
DELETE FROM homework_files;
DELETE FROM homework;
SELECT 'Academic activities deleted' AS status;

-- ============================================================================
-- STEP 8: DELETE USER ACTIVITY LOGS
-- ============================================================================

DELETE FROM user_activity_logs;
SELECT 'User activity logs deleted' AS status;

-- ============================================================================
-- STEP 9: DELETE COMMUNICATION DATA
-- ============================================================================

DELETE FROM messages;
SELECT 'Communication data deleted' AS status;

-- ============================================================================
-- STEP 10: DELETE ADDITIONAL REFERENCING TABLES
-- ============================================================================

DELETE FROM class_division_subjects;
DELETE FROM class_teacher_assignments;
SELECT 'Additional referencing tables deleted' AS status;

-- ============================================================================
-- STEP 11: DELETE ACADEMIC MANAGEMENT DATA
-- ============================================================================

DELETE FROM teacher_class_assignments;
DELETE FROM parent_student_mappings;
DELETE FROM student_academic_records;
DELETE FROM class_divisions;
DELETE FROM students_master;
SELECT 'Academic management data deleted' AS status;

-- ============================================================================
-- STEP 12: DELETE SYSTEM CONFIGURATION
-- ============================================================================

DELETE FROM academic_years;
DELETE FROM class_levels;
SELECT 'System configuration deleted' AS status;

-- ============================================================================
-- STEP 13: DELETE NON-ADMIN/NON-PRINCIPAL USERS
-- ============================================================================

-- CAREFUL: This deletes all users except admin and principal
DELETE FROM users 
WHERE role NOT IN ('admin', 'principal');
SELECT 'Non-admin/non-principal users deleted' AS status;

-- ============================================================================
-- STEP 14: ADD NEW PRINCIPAL
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
-- STEP 15: FINAL VERIFICATION
-- ============================================================================

-- Check final state
SELECT 
    'FINAL STATE' AS status,
    (SELECT COUNT(*) FROM users) AS total_users,
    (SELECT COUNT(*) FROM students_master) AS total_students,
    (SELECT COUNT(*) FROM messages) AS total_messages,
    (SELECT COUNT(*) FROM announcements) AS total_announcements,
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
