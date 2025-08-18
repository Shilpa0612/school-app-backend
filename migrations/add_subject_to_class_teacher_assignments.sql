-- Migration: Add subject to class_teacher_assignments and enforce rules

-- 1) Add subject column
ALTER TABLE public.class_teacher_assignments
ADD COLUMN IF NOT EXISTS subject text;

-- 2) Enforce that subject is required when assignment_type is subject_teacher
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'class_teacher_assignments_subject_required_for_subject_teacher'
    ) THEN
        ALTER TABLE public.class_teacher_assignments
        ADD CONSTRAINT class_teacher_assignments_subject_required_for_subject_teacher
        CHECK (
            assignment_type <> 'subject_teacher' OR subject IS NOT NULL
        );
    END IF;
END$$;

-- 3) Index on subject rows for faster lookups (only subject_teacher rows)
CREATE INDEX IF NOT EXISTS idx_cta_subject_subject_teacher
ON public.class_teacher_assignments(subject)
WHERE assignment_type = 'subject_teacher';

-- 4) Prevent duplicate subject assignments per teacher in a class (active only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cta_unique_subject_per_teacher
ON public.class_teacher_assignments(class_division_id, teacher_id, subject)
WHERE assignment_type = 'subject_teacher' AND is_active = true;

-- 5) Refresh helper functions to include subject in returns
CREATE OR REPLACE FUNCTION get_class_teachers(p_class_division_id uuid)
RETURNS TABLE (
    assignment_id uuid,
    teacher_id uuid,
    teacher_name text,
    assignment_type text,
    subject text,
    is_primary boolean,
    assigned_date timestamp with time zone,
    phone_number text,
    email text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cta.id as assignment_id,
        cta.teacher_id,
        u.full_name as teacher_name,
        cta.assignment_type,
        cta.subject,
        cta.is_primary,
        cta.assigned_date,
        u.phone_number,
        u.email
    FROM public.class_teacher_assignments cta
    JOIN public.users u ON cta.teacher_id = u.id
    WHERE cta.class_division_id = p_class_division_id
    AND cta.is_active = true
    ORDER BY cta.is_primary DESC, cta.assigned_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_teacher_classes(p_teacher_id uuid)
RETURNS TABLE (
    assignment_id uuid,
    class_division_id uuid,
    class_name text,
    division text,
    assignment_type text,
    subject text,
    is_primary boolean,
    assigned_date timestamp with time zone,
    academic_year text,
    class_level text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cta.id as assignment_id,
        cta.class_division_id,
        CONCAT(cl.name, ' ', cd.division) as class_name,
        cd.division,
        cta.assignment_type,
        cta.subject,
        cta.is_primary,
        cta.assigned_date,
        ay.year_name as academic_year,
        cl.name as class_level
    FROM public.class_teacher_assignments cta
    JOIN public.class_divisions cd ON cta.class_division_id = cd.id
    JOIN public.class_levels cl ON cd.class_level_id = cl.id
    JOIN public.academic_years ay ON cd.academic_year_id = ay.id
    WHERE cta.teacher_id = p_teacher_id
    AND cta.is_active = true
    ORDER BY cta.is_primary DESC, cl.sequence_number ASC, cd.division ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


