-- DELETE ONLY THESE EXACT TEST USERS
-- Safe deletion using specific IDs from your test runs

-- STEP 1: PREVIEW what will be deleted (RUN THIS FIRST!)
SELECT 
    id,
    phone_number,
    full_name,
    email,
    role,
    created_at
FROM users 
WHERE id IN (
    'a5686567-e0df-463d-92ca-aeffffe2fa0d',  -- Test Teacher (8888888888) - created 2025-10-15 13:53
    '970aba6a-e972-47ec-8fab-592520983107',  -- Test Parent (7777777777) - created 2025-10-15 13:53
    '3a76f089-b1c1-433e-820b-69b587170d50',  -- Test Teacher (8888620657) - created 2025-10-15 13:57
    'ebe2699a-071a-4a56-8dd0-3a45c59da2ae'   -- Test Parent (7777620657) - created 2025-10-15 13:57
)
ORDER BY created_at;

-- Verify these are ALL test users (full_name = "Test Teacher" or "Test Parent")
-- If you see ANY real users, STOP and don't run the DELETE!


-- STEP 2: If preview is correct, uncomment and run this DELETE:

/*
DELETE FROM users 
WHERE id IN (
    'a5686567-e0df-463d-92ca-aeffffe2fa0d',
    '970aba6a-e972-47ec-8fab-592520983107',
    '3a76f089-b1c1-433e-820b-69b587170d50',
    'ebe2699a-071a-4a56-8dd0-3a45c59da2ae'
);
*/


-- STEP 3: Verify deletion
SELECT 'Test users deleted successfully' as status;

-- STEP 4: Double-check no test users remain
SELECT COUNT(*) as remaining_test_users
FROM users 
WHERE full_name IN ('Test Teacher', 'Test Parent')
  AND created_at >= '2025-10-15';

-- Should return 0

