-- Add is_registered column to users table
-- This column tracks whether a parent has completed their registration with password

ALTER TABLE public.users 
ADD COLUMN is_registered BOOLEAN DEFAULT true;

-- Update existing users to be marked as registered
UPDATE public.users 
SET is_registered = true 
WHERE is_registered IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE public.users 
ALTER COLUMN is_registered SET NOT NULL;

-- Add index for better query performance
CREATE INDEX idx_users_is_registered ON public.users(is_registered);

-- Add comment for documentation
COMMENT ON COLUMN public.users.is_registered IS 'Indicates whether a parent has completed their registration with password. Defaults to true for existing users.'; 