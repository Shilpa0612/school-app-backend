-- Check which test user is still in the database

SELECT 
    id,
    phone_number,
    full_name,
    email,
    role,
    created_at
FROM users 
WHERE full_name IN ('Test Teacher', 'Test Parent')
  AND created_at >= '2025-10-15'
ORDER BY created_at DESC;

-- This will show you which test user wasn't deleted
-- Check the ID and delete it manually

