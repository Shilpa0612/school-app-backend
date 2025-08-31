-- Migration: Add target_subjects field to announcements table
-- Date: 2024-01-15
-- Description: Add target_subjects array field for subject-specific announcement targeting

-- Add target_subjects field to announcements table
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_subjects TEXT[] DEFAULT '{}';

-- Create index for performance on target_subjects array
CREATE INDEX IF NOT EXISTS idx_announcements_target_subjects ON announcements USING GIN(target_subjects);

-- Add comment to document the new field
COMMENT ON COLUMN announcements.target_subjects IS 'Array of subject names for targeting announcements to specific subjects';

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'announcements' 
AND column_name = 'target_subjects';

-- Show the updated table structure
