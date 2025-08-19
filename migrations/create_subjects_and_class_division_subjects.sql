-- Create subjects master table and class_division_subjects junction table

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Subjects master
CREATE TABLE IF NOT EXISTS public.subjects (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    code text UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2) Class-division to subject assignments
CREATE TABLE IF NOT EXISTS public.class_division_subjects (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_division_id uuid NOT NULL REFERENCES public.class_divisions(id) ON DELETE CASCADE,
    subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
    is_active boolean NOT NULL DEFAULT true,
    assigned_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Prevent duplicate active mappings
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_class_division_subject
ON public.class_division_subjects(class_division_id, subject_id)
WHERE is_active = true;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_cds_class ON public.class_division_subjects(class_division_id);
CREATE INDEX IF NOT EXISTS idx_cds_subject ON public.class_division_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_subjects_active ON public.subjects(is_active);

-- Trigger to maintain updated_at on subjects
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subjects_updated_at ON public.subjects;
CREATE TRIGGER trg_subjects_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();


