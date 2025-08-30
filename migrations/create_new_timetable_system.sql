-- Create New Simplified Timetable System
-- This migration creates a simpler timetable system with period configuration and class-specific subject assignments

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Timetable Configuration - defines the overall timetable structure
CREATE TABLE IF NOT EXISTS public.timetable_config (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL, -- e.g., "Primary School Schedule", "Secondary Schedule"
    description text,
    academic_year_id uuid NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    total_periods integer NOT NULL CHECK (total_periods > 0 AND total_periods <= 10), -- Maximum 10 periods per day
    days_per_week integer NOT NULL DEFAULT 6 CHECK (days_per_week >= 5 AND days_per_week <= 7), -- Monday to Saturday (or Sunday)
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Ensure unique configuration per academic year (only one active per academic year)
    CONSTRAINT unique_active_config_per_year UNIQUE(academic_year_id, is_active)
);



-- 2) Class Timetable - defines subjects for each class and period
CREATE TABLE IF NOT EXISTS public.class_timetable (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id uuid NOT NULL REFERENCES public.timetable_config(id) ON DELETE CASCADE,
    class_division_id uuid NOT NULL REFERENCES public.class_divisions(id) ON DELETE CASCADE,
    period_number integer NOT NULL CHECK (period_number > 0 AND period_number <= 10), -- Period 1, 2, 3, etc.
    day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1=Monday, 2=Tuesday, etc.
    subject text, -- Subject being taught (e.g., "English", "Kannada", "Mathematics")
    teacher_id uuid REFERENCES public.users(id) ON DELETE SET NULL, -- Teacher for this period
    notes text, -- Additional notes
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Ensure no conflicts: one subject per class per period per day
    CONSTRAINT unique_class_period_day UNIQUE(class_division_id, period_number, day_of_week, is_active),
    -- Ensure no teacher conflicts: one teacher per period per day (optional constraint)
    CONSTRAINT unique_teacher_period_day UNIQUE(teacher_id, period_number, day_of_week, is_active)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_timetable_config_academic_year ON public.timetable_config(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_timetable_config_active ON public.timetable_config(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_class_timetable_config ON public.class_timetable(config_id);
CREATE INDEX IF NOT EXISTS idx_class_timetable_class ON public.class_timetable(class_division_id);
CREATE INDEX IF NOT EXISTS idx_class_timetable_period ON public.class_timetable(period_number);
CREATE INDEX IF NOT EXISTS idx_class_timetable_day ON public.class_timetable(day_of_week);
CREATE INDEX IF NOT EXISTS idx_class_timetable_teacher ON public.class_timetable(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_timetable_active ON public.class_timetable(is_active) WHERE is_active = true;

-- Create partial unique indexes for active records only
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_config_per_year 
ON public.timetable_config(academic_year_id) WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_class_period_day_active 
ON public.class_timetable(class_division_id, period_number, day_of_week) WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_teacher_period_day_active 
ON public.class_timetable(teacher_id, period_number, day_of_week) WHERE is_active = true AND teacher_id IS NOT NULL;

-- Trigger to maintain updated_at on timetable_config
CREATE OR REPLACE FUNCTION public.set_timetable_config_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain updated_at on class_timetable
CREATE OR REPLACE FUNCTION public.set_class_timetable_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_timetable_config_updated_at ON public.timetable_config;
CREATE TRIGGER trg_timetable_config_updated_at
    BEFORE UPDATE ON public.timetable_config
    FOR EACH ROW EXECUTE FUNCTION public.set_timetable_config_updated_at();

DROP TRIGGER IF EXISTS trg_class_timetable_updated_at ON public.class_timetable;
CREATE TRIGGER trg_class_timetable_updated_at
    BEFORE UPDATE ON public.class_timetable
    FOR EACH ROW EXECUTE FUNCTION public.set_class_timetable_updated_at();



-- Insert sample data for testing
INSERT INTO public.timetable_config (
    name, 
    description, 
    academic_year_id, 
    total_periods, 
    days_per_week
) VALUES (
    'Standard Primary Schedule',
    'Standard timetable for primary school classes',
    (SELECT id FROM public.academic_years WHERE is_current = true LIMIT 1),
    8,
    6
) ON CONFLICT DO NOTHING;
