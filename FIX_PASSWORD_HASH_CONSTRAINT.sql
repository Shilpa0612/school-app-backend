-- Fix password_hash constraint for parent registration workflow
-- This allows creating parent records without passwords initially

-- Make password_hash column nullable
ALTER TABLE public.users 
ALTER COLUMN password_hash DROP NOT NULL;

-- Add a check constraint to ensure password_hash is not null for non-parent users
ALTER TABLE public.users 
ADD CONSTRAINT check_password_hash 
CHECK (
    (role IN ('admin', 'principal', 'teacher') AND password_hash IS NOT NULL) OR
    (role = 'parent' AND (password_hash IS NOT NULL OR is_registered = false))
);

-- Add comment for documentation
COMMENT ON COLUMN public.users.password_hash IS 'Password hash. Can be null for unregistered parents.';
COMMENT ON CONSTRAINT check_password_hash ON public.users IS 'Ensures password_hash is not null for non-parent users and unregistered parents can have null password_hash.'; 