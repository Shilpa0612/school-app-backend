-- SAFE Test User Cleanup Script
-- This ONLY deletes test users, NOT real parents/teachers
-- 
-- Identifies test users by:
-- 1. Full name = "Test Teacher" or "Test Parent"
-- 2. Email contains "test.com" or "@test"
-- 3. Created recently (today)

-- STEP 1: First, PREVIEW what will be deleted (SAFETY CHECK)
SELECT 
    id,
    phone_number,
    full_name,
    email,
    role,
    created_at
FROM users 
WHERE 
    -- Only users with "Test" in full_name AND test email
    (full_name ILIKE '%Test Teacher%' OR full_name ILIKE '%Test Parent%')
    AND (email ILIKE '%test.com%' OR email ILIKE '%@test%' OR email IS NULL)
    AND created_at >= CURRENT_DATE  -- Only today's test users
ORDER BY created_at DESC;

-- STEP 2: If the preview looks correct, uncomment and run this:

/*
-- Delete ONLY test users (safe deletion)
DELETE FROM users 
WHERE 
    id IN (
        SELECT id
        FROM users 
        WHERE 
            (full_name ILIKE '%Test Teacher%' OR full_name ILIKE '%Test Parent%')
            AND (email ILIKE '%test.com%' OR email ILIKE '%@test%' OR email IS NULL)
            AND created_at >= CURRENT_DATE
    );
*/

-- STEP 3: Verify deletion
SELECT COUNT(*) as deleted_count
FROM users 
WHERE 
    (full_name ILIKE '%Test Teacher%' OR full_name ILIKE '%Test Parent%')
    AND (email ILIKE '%test.com%' OR email ILIKE '%@test%')
    AND created_at >= CURRENT_DATE;

-- Should return 0 after deletion

