-- Migration: Add multi-class support to calendar_events table
-- Date: 2025-01-XX
-- Description: Adds support for events with multiple class divisions

-- Add multi-class support fields
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS class_division_ids JSONB DEFAULT '[]';

ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS is_multi_class BOOLEAN DEFAULT false;

-- Create index for efficient multi-class queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_class_ids 
ON public.calendar_events USING GIN (class_division_ids);

-- Update existing events to ensure they meet the constraint before adding it
-- Handle both single class and school-wide events
UPDATE public.calendar_events 
SET 
    class_division_ids = '[]'::jsonb,  -- Cast to JSONB type
    is_multi_class = false
WHERE class_division_ids IS NULL;

-- Add constraint to ensure either single class or multiple classes (but not both)
-- First drop the constraint if it exists to avoid errors
ALTER TABLE public.calendar_events 
DROP CONSTRAINT IF EXISTS check_class_division_logic;

ALTER TABLE public.calendar_events 
ADD CONSTRAINT check_class_division_logic 
CHECK (
    (class_division_id IS NOT NULL AND (class_division_ids = '[]' OR class_division_ids IS NULL)) OR
    (class_division_id IS NULL AND (class_division_ids = '[]' OR class_division_ids IS NULL))
);

-- Add comments for documentation
COMMENT ON COLUMN public.calendar_events.class_division_ids IS 'Array of class division IDs for multi-class events';
COMMENT ON COLUMN public.calendar_events.is_multi_class IS 'Flag indicating if this is a multi-class event';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added multi-class support to calendar_events table';
END $$;
