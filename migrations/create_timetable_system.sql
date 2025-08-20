-- Create Timetable System
-- This migration creates the necessary tables for managing class timetables

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Periods table - defines the time periods in a school day
CREATE TABLE IF NOT EXISTS public.periods (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL, -- e.g., "Period 1", "Lunch Break", "Assembly"
    start_time time NOT NULL,
    end_time time NOT NULL,
    period_type text NOT NULL DEFAULT 'academic' CHECK (period_type IN ('academic', 'break', 'lunch', 'assembly', 'other')),
    is_active boolean NOT NULL DEFAULT true,
    sequence_number integer NOT NULL, -- for ordering periods
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Ensure no overlapping periods
    CONSTRAINT no_overlapping_periods CHECK (start_time < end_time)
);

-- 2) Time slots table - defines when periods occur on different days
CREATE TABLE IF NOT EXISTS public.time_slots (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday, etc.
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Ensure unique period-day combinations
    UNIQUE(period_id, day_of_week)
);

-- 3) Timetable entries - the actual class schedule
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_division_id uuid NOT NULL REFERENCES public.class_divisions(id) ON DELETE CASCADE,
    academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 6), -- Monday to Saturday
    subject text, -- Subject being taught (can be null for breaks, assembly, etc.)
    teacher_id uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Teacher for this period
    notes text, -- Additional notes
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Ensure no conflicts: one subject per class per period per day
    UNIQUE(class_division_id, period_id, day_of_week, is_active) WHERE is_active = true,
    -- Ensure no teacher conflicts: one teacher per period per day (optional constraint)
    UNIQUE(teacher_id, period_id, day_of_week, is_active) WHERE is_active = true AND teacher_id IS NOT NULL
);

-- 4) Timetable templates - for creating standard timetables
CREATE TABLE IF NOT EXISTS public.timetable_templates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL, -- e.g., "Standard Primary", "Secondary Schedule"
    description text,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE CASCADE,
    class_level_id uuid REFERENCES public.class_levels(id) ON DELETE CASCADE,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5) Template entries - predefined timetable entries for templates
CREATE TABLE IF NOT EXISTS public.template_entries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id uuid NOT NULL REFERENCES public.timetable_templates(id) ON DELETE CASCADE,
    period_id uuid NOT NULL REFERENCES public.periods(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 6), -- Monday to Saturday
    subject text,
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Ensure unique template-period-day combinations
    UNIQUE(template_id, period_id, day_of_week)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_periods_active ON public.periods(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_periods_sequence ON public.periods(sequence_number);
CREATE INDEX IF NOT EXISTS idx_time_slots_period ON public.time_slots(period_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_day ON public.time_slots(day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_class ON public.timetable_entries(class_division_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_period ON public.timetable_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_day ON public.timetable_entries(day_of_week);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_teacher ON public.timetable_entries(teacher_id);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_active ON public.timetable_entries(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_template_entries_template ON public.template_entries(template_id);
CREATE INDEX IF NOT EXISTS idx_timetable_templates_active ON public.timetable_templates(is_active) WHERE is_active = true;

-- Trigger to maintain updated_at on periods
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_periods_updated_at ON public.periods;
CREATE TRIGGER trg_periods_updated_at
BEFORE UPDATE ON public.periods
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_timetable_entries_updated_at ON public.timetable_entries;
CREATE TRIGGER trg_timetable_entries_updated_at
BEFORE UPDATE ON public.timetable_entries
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_timetable_templates_updated_at ON public.timetable_templates;
CREATE TRIGGER trg_timetable_templates_updated_at
BEFORE UPDATE ON public.timetable_templates
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Insert default periods (can be customized later)
INSERT INTO public.periods (name, start_time, end_time, period_type, sequence_number) VALUES
('Assembly', '08:00:00', '08:15:00', 'assembly', 1),
('Period 1', '08:15:00', '09:00:00', 'academic', 2),
('Period 2', '09:00:00', '09:45:00', 'academic', 3),
('Break', '09:45:00', '10:00:00', 'break', 4),
('Period 3', '10:00:00', '10:45:00', 'academic', 5),
('Period 4', '10:45:00', '11:30:00', 'academic', 6),
('Lunch Break', '11:30:00', '12:15:00', 'lunch', 7),
('Period 5', '12:15:00', '13:00:00', 'academic', 8),
('Period 6', '13:00:00', '13:45:00', 'academic', 9),
('Period 7', '13:45:00', '14:30:00', 'academic', 10),
('Period 8', '14:30:00', '15:15:00', 'academic', 11)
ON CONFLICT DO NOTHING;

-- Insert time slots for weekdays (Monday to Saturday)
INSERT INTO public.time_slots (period_id, day_of_week)
SELECT p.id, d.day
FROM public.periods p
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6)) AS d(day) -- Monday to Saturday
WHERE p.is_active = true
ON CONFLICT DO NOTHING;
