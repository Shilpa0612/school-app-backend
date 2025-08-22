-- Migration: Add approval status to calendar_events table
-- Date: 2025-08-22
-- Description: Adds approval workflow fields to calendar_events table

-- Add approval status column
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add approved_by column
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id);

-- Add approved_at column
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Add rejection_reason column
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add comments for documentation
COMMENT ON COLUMN public.calendar_events.status IS 'Event approval status: pending, approved, rejected';
COMMENT ON COLUMN public.calendar_events.approved_by IS 'User who approved/rejected the event';
COMMENT ON COLUMN public.calendar_events.approved_at IS 'Timestamp when event was approved/rejected';
COMMENT ON COLUMN public.calendar_events.rejection_reason IS 'Reason for rejection if event was rejected';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_status 
ON public.calendar_events(status);

CREATE INDEX IF NOT EXISTS idx_calendar_events_approved_by 
ON public.calendar_events(approved_by);

-- Update existing events to be pending (for proper approval workflow)
UPDATE public.calendar_events 
SET status = 'pending' 
WHERE status IS NULL;

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added approval workflow fields to calendar_events table';
END $$;
