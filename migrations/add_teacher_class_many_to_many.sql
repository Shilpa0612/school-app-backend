-- Migration: Add Many-to-Many Relationship Between Teachers and Classes
-- This migration creates a junction table for teacher-class assignments
-- and migrates existing data from the simple foreign key approach

-- Step 1: Create the junction table for teacher-class assignments
CREATE TABLE public.class_teacher_assignments (
    id uuid primary key default uuid_generate_v4(),
    class_division_id uuid references public.class_divisions(id) on delete cascade not null,
    teacher_id uuid references public.users(id) on delete restrict not null,
    assignment_type text default 'class_teacher' check (assignment_type in ('class_teacher', 'subject_teacher', 'assistant_teacher', 'substitute_teacher')),
    is_primary boolean default false,
    assigned_date timestamp with time zone default timezone('utc'::text, now()) not null,
    assigned_by uuid references public.users(id) on delete restrict,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Ensure one primary teacher per class
    unique(class_division_id, is_primary) where (is_primary = true),
    -- Prevent duplicate assignments
    unique(class_division_id, teacher_id, assignment_type)
);

-- Step 2: Create indexes for better performance
CREATE INDEX idx_class_teacher_assignments_class_id ON public.class_teacher_assignments(class_division_id);
CREATE INDEX idx_class_teacher_assignments_teacher_id ON public.class_teacher_assignments(teacher_id);
CREATE INDEX idx_class_teacher_assignments_active ON public.class_teacher_assignments(is_active) WHERE is_active = true;
CREATE INDEX idx_class_teacher_assignments_primary ON public.class_teacher_assignments(class_division_id, is_primary) WHERE is_primary = true;

-- Step 3: Migrate existing teacher assignments from class_divisions table
INSERT INTO public.class_teacher_assignments (
    class_division_id,
    teacher_id,
    assignment_type,
    is_primary,
    assigned_date,
    is_active
)
SELECT 
    id as class_division_id,
    teacher_id,
    'class_teacher' as assignment_type,
    true as is_primary,  -- Existing teachers become primary teachers
    created_at as assigned_date,
    true as is_active
FROM public.class_divisions 
WHERE teacher_id IS NOT NULL;

-- Step 4: Add a new column to track migration status (optional, for safety)
ALTER TABLE public.class_divisions ADD COLUMN migrated_to_junction boolean default false;

-- Step 5: Mark migrated records
UPDATE public.class_divisions 
SET migrated_to_junction = true 
WHERE teacher_id IS NOT NULL;

-- Step 6: Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_class_teacher_assignment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 7: Create trigger for updated_at
CREATE TRIGGER class_teacher_assignments_updated_at_trigger
    BEFORE UPDATE ON public.class_teacher_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_class_teacher_assignment_updated_at();

-- Step 8: Enable RLS on the new table
ALTER TABLE public.class_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies
-- Policy for viewing assignments
CREATE POLICY "Users can view class teacher assignments" ON public.class_teacher_assignments FOR SELECT USING (
    -- Admin and principal can see all
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'principal')
    )
    OR
    -- Teachers can see their own assignments
    (teacher_id = auth.uid())
    OR
    -- Parents can see assignments for their children's classes
    EXISTS (
        SELECT 1 FROM public.parent_student_mappings psm
        JOIN public.student_academic_records sar ON psm.student_id = sar.student_id
        WHERE psm.parent_id = auth.uid() 
        AND sar.class_division_id = class_teacher_assignments.class_division_id
        AND sar.status = 'ongoing'
    )
);

-- Policy for creating assignments (admin/principal only)
CREATE POLICY "Admin and principal can create teacher assignments" ON public.class_teacher_assignments FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'principal')
    )
);

-- Policy for updating assignments (admin/principal only)
CREATE POLICY "Admin and principal can update teacher assignments" ON public.class_teacher_assignments FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'principal')
    )
);

-- Policy for deleting assignments (admin/principal only)
CREATE POLICY "Admin and principal can delete teacher assignments" ON public.class_teacher_assignments FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'principal')
    )
);

-- Step 10: Create helper functions

-- Function to get all teachers for a class
CREATE OR REPLACE FUNCTION get_class_teachers(p_class_division_id uuid)
RETURNS TABLE (
    assignment_id uuid,
    teacher_id uuid,
    teacher_name text,
    assignment_type text,
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

-- Function to get all classes for a teacher
CREATE OR REPLACE FUNCTION get_teacher_classes(p_teacher_id uuid)
RETURNS TABLE (
    assignment_id uuid,
    class_division_id uuid,
    class_name text,
    division text,
    assignment_type text,
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

-- Function to assign teacher to class with validation
CREATE OR REPLACE FUNCTION assign_teacher_to_class(
    p_class_division_id uuid,
    p_teacher_id uuid,
    p_assignment_type text DEFAULT 'class_teacher',
    p_is_primary boolean DEFAULT false,
    p_assigned_by uuid DEFAULT null
)
RETURNS uuid AS $$
DECLARE
    assignment_id uuid;
    existing_primary_count integer;
BEGIN
    -- Validate teacher exists and has teacher role
    IF NOT EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = p_teacher_id AND role = 'teacher'
    ) THEN
        RAISE EXCEPTION 'Teacher not found or invalid role';
    END IF;
    
    -- Validate class division exists
    IF NOT EXISTS (
        SELECT 1 FROM public.class_divisions 
        WHERE id = p_class_division_id
    ) THEN
        RAISE EXCEPTION 'Class division not found';
    END IF;
    
    -- If assigning as primary, check if primary already exists
    IF p_is_primary THEN
        SELECT COUNT(*) INTO existing_primary_count
        FROM public.class_teacher_assignments
        WHERE class_division_id = p_class_division_id 
        AND is_primary = true 
        AND is_active = true;
        
        IF existing_primary_count > 0 THEN
            RAISE EXCEPTION 'Class already has a primary teacher';
        END IF;
    END IF;
    
    -- Check if assignment already exists
    IF EXISTS (
        SELECT 1 FROM public.class_teacher_assignments
        WHERE class_division_id = p_class_division_id 
        AND teacher_id = p_teacher_id 
        AND assignment_type = p_assignment_type
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Teacher already assigned to this class with the same assignment type';
    END IF;
    
    -- Create the assignment
    INSERT INTO public.class_teacher_assignments (
        class_division_id,
        teacher_id,
        assignment_type,
        is_primary,
        assigned_by,
        is_active
    ) VALUES (
        p_class_division_id,
        p_teacher_id,
        p_assignment_type,
        p_is_primary,
        COALESCE(p_assigned_by, auth.uid()),
        true
    ) RETURNING id INTO assignment_id;
    
    RETURN assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE public.class_teacher_assignments IS 'Junction table for many-to-many relationship between teachers and classes';
COMMENT ON COLUMN public.class_teacher_assignments.assignment_type IS 'Type of teaching assignment: class_teacher, subject_teacher, assistant_teacher, substitute_teacher';
COMMENT ON COLUMN public.class_teacher_assignments.is_primary IS 'Indicates if this is the primary/main teacher for the class';
COMMENT ON FUNCTION get_class_teachers(uuid) IS 'Returns all active teachers assigned to a specific class';
COMMENT ON FUNCTION get_teacher_classes(uuid) IS 'Returns all active classes assigned to a specific teacher';
COMMENT ON FUNCTION assign_teacher_to_class(uuid, uuid, text, boolean, uuid) IS 'Safely assigns a teacher to a class with validation';
