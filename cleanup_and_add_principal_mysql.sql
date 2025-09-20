-- ============================================================================
-- DATABASE CLEANUP AND NEW PRINCIPAL ADDITION SCRIPT (MySQL VERSION)
-- ============================================================================
-- 
-- WARNING: This script will DELETE ALL DATA except:
-- - Admin users (role = 'admin')
-- - Existing principal users (role = 'principal')
-- - System configuration data (attendance_periods only - these define attendance time periods)
-- 
-- BEFORE RUNNING:
-- 1. BACKUP YOUR DATABASE
-- 2. Verify the admin and existing principal user IDs
-- 3. Update the new principal details in the INSERT statement at the end
-- 
-- ============================================================================

-- Start transaction for safety
START TRANSACTION;

-- ============================================================================
-- STEP 1: IDENTIFY AND LOG USERS TO PRESERVE
-- ============================================================================

-- Create a temporary table to store users we want to keep
CREATE TEMPORARY TABLE users_to_keep AS
SELECT id, phone_number, role, full_name
FROM users 
WHERE role IN ('admin', 'principal');

-- Log the users we're keeping (MySQL version)
SELECT 
    CONCAT('Users to preserve: ', 
           (SELECT COUNT(*) FROM users_to_keep WHERE role = 'admin'), 
           ' admins, ', 
           (SELECT COUNT(*) FROM users_to_keep WHERE role = 'principal'), 
           ' principals') AS message;

-- List the users we're keeping
SELECT 
    CONCAT('Keeping: ', role, ' - ', full_name, ' (', phone_number, ')') AS keeping_users
FROM users_to_keep 
ORDER BY role, full_name;

-- ============================================================================
-- STEP 2: DELETE ALL DATA FROM RELATED TABLES
-- ============================================================================

-- Delete in order to respect foreign key constraints

-- Chat system tables (if they exist)
DELETE FROM chat_message_attachments;
DELETE FROM chat_messages;
DELETE FROM chat_participants;
DELETE FROM chat_threads;

-- Announcement system tables
DELETE FROM announcement_recipients;
DELETE FROM announcement_views;
DELETE FROM announcement_attachments;
DELETE FROM announcements;

-- Timetable system tables
DELETE FROM class_timetable;
DELETE FROM timetable_config;

-- Attendance system tables (keep attendance_periods as it's system data)
DELETE FROM student_attendance_records;
DELETE FROM daily_attendance;
DELETE FROM attendance_holidays;

-- Academic activities tables
DELETE FROM classwork_attachments;
DELETE FROM classwork;
DELETE FROM homework_files;
DELETE FROM homework;

-- Administrative tables
DELETE FROM file_access_logs;
DELETE FROM leave_requests;
DELETE FROM calendar_events;

-- Communication tables
DELETE FROM messages;

-- Academic management tables
DELETE FROM teacher_class_assignments;
DELETE FROM parent_student_mappings;
DELETE FROM student_academic_records;
DELETE FROM class_divisions;
DELETE FROM students_master;

-- System configuration tables (as requested)
DELETE FROM school_details;
DELETE FROM academic_years;
DELETE FROM class_levels;

-- ============================================================================
-- STEP 3: DELETE ALL NON-ADMIN/NON-PRINCIPAL USERS
-- ============================================================================

-- Delete users that are not in our keep list
DELETE FROM users 
WHERE id NOT IN (SELECT id FROM users_to_keep);

-- ============================================================================
-- STEP 4: ADD NEW PRINCIPAL
-- ============================================================================

-- Insert new principal user
-- IMPORTANT: Update these values according to your requirements
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

-- ============================================================================
-- STEP 5: VERIFICATION AND CLEANUP
-- ============================================================================

-- Verify the cleanup (MySQL version)
SELECT '=== CLEANUP VERIFICATION ===' AS status;

SELECT 
    CONCAT('Users remaining: ', (SELECT COUNT(*) FROM users)) AS users_remaining,
    CONCAT('Students remaining: ', (SELECT COUNT(*) FROM students_master)) AS students_remaining,
    CONCAT('Messages remaining: ', (SELECT COUNT(*) FROM messages)) AS messages_remaining,
    CONCAT('Announcements remaining: ', (SELECT COUNT(*) FROM announcements)) AS announcements_remaining,
    CONCAT('School details remaining: ', (SELECT COUNT(*) FROM school_details)) AS school_remaining,
    CONCAT('Academic years remaining: ', (SELECT COUNT(*) FROM academic_years)) AS academic_years_remaining,
    CONCAT('Class levels remaining: ', (SELECT COUNT(*) FROM class_levels)) AS class_levels_remaining;

-- List remaining users
SELECT '=== REMAINING USERS ===' AS status;

SELECT 
    CONCAT('User: ', role, ' - ', full_name, ' (', phone_number, ')') AS remaining_users
FROM users 
ORDER BY role, full_name;

-- ============================================================================
-- STEP 6: CLEAN UP TEMPORARY TABLE
-- ============================================================================

-- Drop temporary table
DROP TEMPORARY TABLE users_to_keep;

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

-- Commit the transaction
COMMIT;

-- ============================================================================
-- FINAL SUCCESS MESSAGE
-- ============================================================================

SELECT '=== CLEANUP COMPLETED SUCCESSFULLY ===' AS status;
SELECT 'Database has been cleaned and new principal added.' AS message;
SELECT 'Only admin users, existing principals, and system data remain.' AS note;
SELECT 'Please verify the new principal login credentials.' AS next_step;

-- ============================================================================
-- MANUAL STEPS REQUIRED AFTER RUNNING THIS SCRIPT:
-- ============================================================================
-- 
-- 1. Update the new principal's password hash with a proper bcrypt hash
-- 2. Set up the new principal's access permissions
-- 3. Create initial academic year and class levels if needed
-- 4. Test login with the new principal credentials
-- 5. Set up initial school configuration
-- 
-- ============================================================================
