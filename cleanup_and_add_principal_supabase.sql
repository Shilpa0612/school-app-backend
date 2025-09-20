-- ============================================================================
-- DATABASE CLEANUP AND NEW PRINCIPAL ADDITION SCRIPT (SUPABASE VERSION)
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

-- ============================================================================
-- STEP 1: CHECK CURRENT USERS (Run this first to see what you have)
-- ============================================================================

-- First, let's see what users exist
SELECT 
    id,
    role,
    full_name,
    phone_number,
    created_at
FROM users 
WHERE role IN ('admin', 'principal')
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

-- Additional referencing tables (must be deleted before class_divisions)
DELETE FROM alert_recipients;
DELETE FROM alert_delivery_logs;
DELETE FROM alerts;
DELETE FROM class_division_subjects;
DELETE FROM subjects;
DELETE FROM class_teacher_assignments;

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

-- Delete users that are not admin or principal
-- IMPORTANT: This will delete ALL users except admin and principal roles
DELETE FROM users 
WHERE role NOT IN ('admin', 'principal');

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
-- STEP 5: VERIFICATION - Check what remains
-- ============================================================================

-- Check remaining users
SELECT 
    'REMAINING USERS' AS status,
    COUNT(*) AS total_users
FROM users;

-- List all remaining users
SELECT 
    role,
    full_name,
    phone_number,
    email,
    created_at
FROM users 
ORDER BY role, full_name;

-- Check if tables are empty
SELECT 
    'VERIFICATION SUMMARY' AS status,
    (SELECT COUNT(*) FROM users) AS users_remaining,
    (SELECT COUNT(*) FROM students_master) AS students_remaining,
    (SELECT COUNT(*) FROM messages) AS messages_remaining,
    (SELECT COUNT(*) FROM announcements) AS announcements_remaining,
    (SELECT COUNT(*) FROM school_details) AS school_remaining,
    (SELECT COUNT(*) FROM academic_years) AS academic_years_remaining,
    (SELECT COUNT(*) FROM class_levels) AS class_levels_remaining;

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
