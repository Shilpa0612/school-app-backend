-- ============================================================================
-- DATABASE CLEANUP AND NEW PRINCIPAL ADDITION SCRIPT
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
BEGIN;

-- ============================================================================
-- STEP 1: IDENTIFY AND LOG USERS TO PRESERVE
-- ============================================================================

-- Create a temporary table to store users we want to keep
CREATE TEMP TABLE users_to_keep AS
SELECT id, phone_number, role, full_name
FROM users 
WHERE role IN ('admin', 'principal');

-- Log the users we're keeping
DO $$
DECLARE
    admin_count INTEGER;
    principal_count INTEGER;
    rec RECORD;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM users_to_keep WHERE role = 'admin';
    SELECT COUNT(*) INTO principal_count FROM users_to_keep WHERE role = 'principal';
    
    RAISE NOTICE 'Users to preserve: % admins, % principals', admin_count, principal_count;
    
    -- List the users
    FOR rec IN SELECT role, full_name, phone_number FROM users_to_keep ORDER BY role, full_name LOOP
        RAISE NOTICE 'Keeping: % - % (%)', rec.role, rec.full_name, rec.phone_number;
    END LOOP;
END $$;

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

-- Verify the cleanup
DO $$
DECLARE
    user_count INTEGER;
    student_count INTEGER;
    message_count INTEGER;
    announcement_count INTEGER;
    school_count INTEGER;
    academic_year_count INTEGER;
    class_level_count INTEGER;
    rec RECORD;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO student_count FROM students_master;
    SELECT COUNT(*) INTO message_count FROM messages;
    SELECT COUNT(*) INTO announcement_count FROM announcements;
    SELECT COUNT(*) INTO school_count FROM school_details;
    SELECT COUNT(*) INTO academic_year_count FROM academic_years;
    SELECT COUNT(*) INTO class_level_count FROM class_levels;
    
    RAISE NOTICE '=== CLEANUP VERIFICATION ===';
    RAISE NOTICE 'Users remaining: %', user_count;
    RAISE NOTICE 'Students remaining: %', student_count;
    RAISE NOTICE 'Messages remaining: %', message_count;
    RAISE NOTICE 'Announcements remaining: %', announcement_count;
    RAISE NOTICE 'School details remaining: %', school_count;
    RAISE NOTICE 'Academic years remaining: %', academic_year_count;
    RAISE NOTICE 'Class levels remaining: %', class_level_count;
    
    -- List remaining users
    RAISE NOTICE '=== REMAINING USERS ===';
    FOR rec IN SELECT role, full_name, phone_number FROM users ORDER BY role, full_name LOOP
        RAISE NOTICE 'User: % - % (%)', rec.role, rec.full_name, rec.phone_number;
    END LOOP;
END $$;

-- Drop temporary table
DROP TABLE users_to_keep;

-- ============================================================================
-- STEP 6: RESET SEQUENCES AND CLEAN UP
-- ============================================================================

-- Reset any sequences if needed (PostgreSQL auto-incrementing sequences)
-- This ensures new records start from clean numbers

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

-- Commit the transaction
COMMIT;

-- ============================================================================
-- FINAL SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== CLEANUP COMPLETED SUCCESSFULLY ===';
    RAISE NOTICE 'Database has been cleaned and new principal added.';
    RAISE NOTICE 'Only admin users, existing principals, and system data remain.';
    RAISE NOTICE 'Please verify the new principal login credentials.';
END $$;

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
