-- Simple fix for calendar_events table
-- Add only the most likely missing columns

-- Add class_division_id (most likely missing)
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS class_division_id uuid REFERENCES public.class_divisions(id) ON DELETE CASCADE;

-- Add is_single_day (most likely missing)
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS is_single_day boolean DEFAULT true;

-- Add start_time (most likely missing)
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS start_time time;

-- Add end_time (most likely missing)
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS end_time time;

-- Add event_category (most likely missing)
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS event_category text DEFAULT 'general' CHECK (event_category IN ('general', 'academic', 'sports', 'cultural', 'holiday', 'exam', 'meeting', 'other'));

-- Add timezone (most likely missing)
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Asia/Kolkata';

-- Add basic indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_class ON public.calendar_events(class_division_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON public.calendar_events(event_category); 