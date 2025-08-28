-- Migration: Consolidate class division columns
-- Date: 2025-08-28
-- Description: Consolidates class_division_id and class_division_ids into a single column

-- First, create a backup of existing data
CREATE TABLE IF NOT EXISTS calendar_events_backup AS 
SELECT * FROM calendar_events;

-- Add new consolidated column
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS class_divisions JSONB DEFAULT '[]'::jsonb;

-- Migrate existing data to the new column
UPDATE public.calendar_events 
SET class_divisions = CASE 
    -- Single class events: convert class_division_id to array
    WHEN class_division_id IS NOT NULL THEN jsonb_build_array(class_division_id)
    -- Multi-class events: parse class_division_ids string to JSONB
    WHEN class_division_ids IS NOT NULL AND class_division_ids != '[]' THEN class_division_ids::jsonb
    -- School-wide events: empty array
    ELSE '[]'::jsonb
END;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_class_divisions 
ON public.calendar_events USING GIN (class_divisions);

-- Add comment for documentation
COMMENT ON COLUMN public.calendar_events.class_divisions IS 'Array of class division IDs. Single class events have one ID, multi-class events have multiple IDs, school-wide events have empty array';

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Consolidated class division columns in calendar_events table';
END $$;
