-- Fix staff table to add user_id column for linking to users
-- Run this in your Supabase SQL editor if the backfill endpoint fails

-- Add user_id column to staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

-- Update existing staff records to link with users by phone number
UPDATE public.staff 
SET user_id = u.id
FROM public.users u
WHERE staff.user_id IS NULL 
  AND staff.phone_number = u.phone_number 
  AND staff.role = u.role;

-- Create missing user accounts for staff without matching users
-- (This will create user accounts with default password 'Staff@123')
INSERT INTO public.users (full_name, phone_number, role, password_hash)
SELECT 
    s.full_name,
    s.phone_number,
    s.role,
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' -- bcrypt hash of 'Staff@123'
FROM public.staff s
WHERE s.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.phone_number = s.phone_number AND u.role = s.role
  );

-- Link the newly created users back to staff
UPDATE public.staff 
SET user_id = u.id
FROM public.users u
WHERE staff.user_id IS NULL 
  AND staff.phone_number = u.phone_number 
  AND staff.role = u.role;

-- Verify the fix
SELECT 
    s.id as staff_id,
    s.full_name as staff_name,
    s.phone_number,
    s.user_id,
    u.id as user_id_verified,
    u.full_name as user_name,
    u.role
FROM public.staff s
LEFT JOIN public.users u ON s.user_id = u.id
ORDER BY s.full_name;
