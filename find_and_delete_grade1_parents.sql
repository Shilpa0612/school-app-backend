-- SQL script to find and delete Grade 1 parents created without initial_password

-- Step 1: Find parents created without initial_password (likely from your bulk call)
-- These will have phone numbers from your Grade 1 parent list
SELECT 
    u.id,
    u.full_name,
    u.phone_number,
    u.is_registered,
    u.initial_password,
    u.created_at,
    COUNT(psm.id) as linked_students_count
FROM users u
LEFT JOIN parent_student_mappings psm ON u.id = psm.parent_id
WHERE u.role = 'parent' 
AND u.phone_number IN (
    '9404002011',  -- Roshan Eknath Parmeshwar
    '8208551468',  -- Raushan Umesh Prasad Singh
    '8459514318',  -- Kishor Bhanudas Tirukhe
    '9588605473',  -- Shaikh Musa
    '9420818888',  -- Prashant Madhavrao Pawar
    '8770048722',  -- Vipin kumar mishra
    '8149260449',  -- Pratik Prabhakar Pise
    '7350969503',  -- Manoj Gopikishan Agrawal
    '7218594090',  -- Shru Khan
    '8087478036',  -- Amit
    '9158190100',  -- Raghunath kautikrao Sahane
    '9970045740',  -- Sachin Babanrao Shinde
    '9890109143',  -- Baliram Babanrao Choudhari
    '9028008020',  -- Punit Nirmal Jogad
    '8484003111',  -- Dnyaneshwar Patilba Bhusare
    '9158759550',  -- Chetan Bharat Rathod
    '8830069989',  -- Anit Rai
    '9922436652',  -- Kakasaheb ramro Jamkar
    '9226288465',  -- Ashok Chandrakant Gavali
    '8208123943'   -- Mahavir Ramjivan Gaud
)
GROUP BY u.id, u.full_name, u.phone_number, u.is_registered, u.initial_password, u.created_at
ORDER BY u.created_at DESC;

-- Step 2: Delete parent-student mappings for these parents
-- (Run this only after confirming the above query shows the right parents)
/*
DELETE FROM parent_student_mappings 
WHERE parent_id IN (
    SELECT u.id 
    FROM users u 
    WHERE u.role = 'parent' 
    AND u.phone_number IN (
        '9404002011', '8208551468', '8459514318', '9588605473', '9420818888',
        '8770048722', '8149260449', '7350969503', '7218594090', '8087478036',
        '9158190100', '9970045740', '9890109143', '9028008020', '8484003111',
        '9158759550', '8830069989', '9922436652', '9226288465', '8208123943'
    )
);
*/

-- Step 3: Delete the parent users
-- (Run this only after Step 2)
/*
DELETE FROM users 
WHERE role = 'parent' 
AND phone_number IN (
    '9404002011', '8208551468', '8459514318', '9588605473', '9420818888',
    '8770048722', '8149260449', '7350969503', '7218594090', '8087478036',
    '9158190100', '9970045740', '9890109143', '9028008020', '8484003111',
    '9158759550', '8830069989', '9922436652', '9226288465', '8208123943'
);
*/

-- Step 4: Verify cleanup
-- (Run this to confirm all parents are deleted)
/*
SELECT COUNT(*) as remaining_parents
FROM users 
WHERE role = 'parent' 
AND phone_number IN (
    '9404002011', '8208551468', '8459514318', '9588605473', '9420818888',
    '8770048722', '8149260449', '7350969503', '7218594090', '8087478036',
    '9158190100', '9970045740', '9890109143', '9028008020', '8484003111',
    '9158759550', '8830069989', '9922436652', '9226288465', '8208123943'
);
*/
