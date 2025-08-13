-- Fix users table by adding missing columns
-- Run this in your Supabase SQL Editor

-- Add missing columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'english';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Add constraints if they don't exist
DO $$
BEGIN
    -- Add role constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('admin', 'principal', 'teacher', 'parent'));
    END IF;
    
    -- Add preferred_language constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_preferred_language_check'
    ) THEN
        ALTER TABLE public.users ADD CONSTRAINT users_preferred_language_check 
        CHECK (preferred_language IN ('english', 'hindi', 'marathi'));
    END IF;
END $$;

-- Update existing users to have default role if null
UPDATE public.users SET role = 'parent' WHERE role IS NULL;

-- Make role NOT NULL after setting defaults
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN full_name SET NOT NULL;

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;
