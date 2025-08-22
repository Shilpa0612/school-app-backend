-- Migration: Add blood_group field to students_master table
-- Date: 2024-03-19
-- Description: Adds blood_group field to students_master table

-- Add blood_group column with valid blood type check
ALTER TABLE public.students_master 
ADD COLUMN IF NOT EXISTS blood_group text CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));

-- Add comment for documentation
COMMENT ON COLUMN public.students_master.blood_group IS 'Student blood group (A+, A-, B+, B-, AB+, AB-, O+, O-)';

-- Create index on blood_group for filtering
CREATE INDEX IF NOT EXISTS idx_students_master_blood_group 
ON public.students_master(blood_group)
WHERE blood_group IS NOT NULL;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added blood_group field to students_master table';
END $$;
