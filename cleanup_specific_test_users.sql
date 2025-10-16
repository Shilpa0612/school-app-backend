-- Cleanup SPECIFIC Test Users by ID
-- This is the SAFEST method - delete by exact ID
--
-- Replace the IDs below with the ones from your test run

-- STEP 1: PREVIEW - Check which users will be deleted
SELECT 
    id,
    phone_number,
    full_name,
    email,
    role,
    created_at
FROM users 
WHERE id IN (
    -- Replace these with actual test user IDs from your test run
    'a5686567-e0df-463d-92ca-aeffffe2fa0d',  -- Test Teacher (8888888888)
    '970aba6a-e972-47ec-8fab-592520983107',  -- Test Parent (7777777777)
    '3a76f089-b1c1-433e-820b-69b587170d50',  -- Test Teacher (8888620657)
    'ebe2699a-071a-4a56-8dd0-3a45c59da2ae'   -- Test Parent (7777620657)
);

-- STEP 2: If the preview is correct, uncomment and run:

/*
DELETE FROM users 
WHERE id IN (
    'a5686567-e0df-463d-92ca-aeffffe2fa0d',
    '970aba6a-e972-47ec-8fab-592520983107',
    '3a76f089-b1c1-433e-820b-69b587170d50',
    'ebe2699a-071a-4a56-8dd0-3a45c59da2ae'
);
*/

-- STEP 3: Verify
SELECT 'Deleted successfully' as status;

