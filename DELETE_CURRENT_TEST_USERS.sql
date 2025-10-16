-- Safe Cleanup for Current Test Users
-- Created during chat system testing on 2025-10-15

-- STEP 1: PREVIEW - Verify these are test users
SELECT 
    id,
    phone_number,
    full_name,
    email,
    role,
    created_at
FROM users 
WHERE id IN (
    '8e941922-80ba-42d8-b297-972d571f8269',  -- Test Teacher (8888000001)
    '505b6185-da84-4f8e-93b8-3c241817eb9f'   -- Test Parent (7777000001)
)
ORDER BY created_at;

-- Expected result: 2 rows
-- Both should have full_name = "Test Teacher" or "Test Parent"
-- Both should have email ending in "test.com"


-- STEP 2: Preview what will be CASCADE deleted
SELECT 'Chat Threads' as table_name, COUNT(*) as count
FROM chat_threads 
WHERE created_by IN ('8e941922-80ba-42d8-b297-972d571f8269', '505b6185-da84-4f8e-93b8-3c241817eb9f')

UNION ALL

SELECT 'Chat Messages' as table_name, COUNT(*) as count
FROM chat_messages
WHERE sender_id IN ('8e941922-80ba-42d8-b297-972d571f8269', '505b6185-da84-4f8e-93b8-3c241817eb9f')

UNION ALL

SELECT 'Message Reads' as table_name, COUNT(*) as count
FROM message_reads
WHERE user_id IN ('8e941922-80ba-42d8-b297-972d571f8269', '505b6185-da84-4f8e-93b8-3c241817eb9f')

UNION ALL

SELECT 'Chat Participants' as table_name, COUNT(*) as count
FROM chat_participants
WHERE user_id IN ('8e941922-80ba-42d8-b297-972d571f8269', '505b6185-da84-4f8e-93b8-3c241817eb9f');

-- This shows how much test data will be deleted


-- STEP 3: If preview looks correct, DELETE (uncomment to run)

/*
DELETE FROM users 
WHERE id IN (
    '8e941922-80ba-42d8-b297-972d571f8269',  -- Test Teacher
    '505b6185-da84-4f8e-93b8-3c241817eb9f'   -- Test Parent
);
*/


-- STEP 4: Verify deletion
SELECT COUNT(*) as remaining_test_users
FROM users 
WHERE id IN (
    '8e941922-80ba-42d8-b297-972d571f8269',
    '505b6185-da84-4f8e-93b8-3c241817eb9f'
);
-- Should return 0 after deletion


-- STEP 5: Verify cascade deletion worked
SELECT 
    'Users' as table_name, 
    COUNT(*) as remaining_count
FROM users 
WHERE full_name IN ('Test Teacher', 'Test Parent')
  AND created_at >= '2025-10-15'

UNION ALL

SELECT 
    'Chat Threads' as table_name,
    COUNT(*) as remaining_count  
FROM chat_threads
WHERE id = '95b2a40a-7a9a-4417-82f6-012ab7d03c89'

UNION ALL

SELECT 
    'Chat Messages' as table_name,
    COUNT(*) as remaining_count
FROM chat_messages  
WHERE thread_id = '95b2a40a-7a9a-4417-82f6-012ab7d03c89';

-- All counts should be 0 after deletion

