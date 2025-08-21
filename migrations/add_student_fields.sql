-- Migration: Add missing fields to students_master table
-- Date: 2024-01-15
-- Description: Adds gender, address, and emergency_contact fields to students_master table

-- Add gender column
ALTER TABLE public.students_master 
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other'));

-- Add address column
ALTER TABLE public.students_master 
ADD COLUMN IF NOT EXISTS address text;

-- Add emergency_contact column
ALTER TABLE public.students_master 
ADD COLUMN IF NOT EXISTS emergency_contact text CHECK (emergency_contact ~ '^[0-9]{10}$' OR emergency_contact IS NULL);

-- Add comments for documentation
COMMENT ON COLUMN public.students_master.gender IS 'Student gender: male, female, or other';
COMMENT ON COLUMN public.students_master.address IS 'Student residential address';
COMMENT ON COLUMN public.students_master.emergency_contact IS 'Emergency contact phone number (10 digits)';

-- Create index on emergency_contact for faster lookups
CREATE INDEX IF NOT EXISTS idx_students_master_emergency_contact 
ON public.students_master(emergency_contact) 
WHERE emergency_contact IS NOT NULL;

-- Create index on gender for filtering
CREATE INDEX IF NOT EXISTS idx_students_master_gender 
ON public.students_master(gender);

-- Update existing records to have default values if needed
UPDATE public.students_master 
SET gender = 'other' 
WHERE gender IS NULL;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added gender, address, and emergency_contact fields to students_master table';
END $$;
