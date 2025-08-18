-- Manual Migration Steps for Teacher-Class Many-to-Many Relationship
-- Run these SQL commands one by one in your Supabase SQL editor

-- Step 1: Create the junction table
CREATE TABLE IF NOT EXISTS public.class_teacher_assignments (
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
    
    -- Prevent duplicate assignments
    unique(class_division_id, teacher_id, assignment_type)
);

-- Step 2: Create partial unique constraint for primary teachers (separate from table creation)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_primary_teacher_per_class 
ON public.class_teacher_assignments(class_division_id) 
WHERE is_primary = true AND is_active = true;

-- Step 3: Create other indexes for better performance
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_class_id ON public.class_teacher_assignments(class_division_id);
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_teacher_id ON public.class_teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_active ON public.class_teacher_assignments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_primary ON public.class_teacher_assignments(class_division_id, is_primary) WHERE is_primary = true;

-- Step 4: Migrate existing teacher assignments
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
    true as is_primary,
    created_at as assigned_date,
    true as is_active
FROM public.class_divisions 
WHERE teacher_id IS NOT NULL
ON CONFLICT (class_division_id, teacher_id, assignment_type) DO NOTHING;

-- Step 5: Add migration tracking column
ALTER TABLE public.class_divisions ADD COLUMN IF NOT EXISTS migrated_to_junction boolean default false;

-- Step 6: Mark migrated records
UPDATE public.class_divisions 
SET migrated_to_junction = true 
WHERE teacher_id IS NOT NULL;

-- Step 7: Enable RLS on the new table
ALTER TABLE public.class_teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view class teacher assignments" ON public.class_teacher_assignments;
DROP POLICY IF EXISTS "Admin and principal can create teacher assignments" ON public.class_teacher_assignments;
DROP POLICY IF EXISTS "Admin and principal can update teacher assignments" ON public.class_teacher_assignments;
DROP POLICY IF EXISTS "Admin and principal can delete teacher assignments" ON public.class_teacher_assignments;

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

CREATE POLICY "Admin and principal can create teacher assignments" ON public.class_teacher_assignments FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'principal')
    )
);

CREATE POLICY "Admin and principal can update teacher assignments" ON public.class_teacher_assignments FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'principal')
    )
);

CREATE POLICY "Admin and principal can delete teacher assignments" ON public.class_teacher_assignments FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'principal')
    )
);

-- Step 9: Verification queries
-- Check how many records were migrated
SELECT 
    'Migration Summary' as description,
    (SELECT COUNT(*) FROM public.class_divisions WHERE teacher_id IS NOT NULL) as original_assignments,
    (SELECT COUNT(*) FROM public.class_teacher_assignments WHERE is_active = true) as migrated_assignments;

-- View sample migrated data
SELECT 
    cta.id,
    cd.division,
    cl.name as class_level,
    u.full_name as teacher_name,
    cta.assignment_type,
    cta.is_primary
FROM public.class_teacher_assignments cta
JOIN public.class_divisions cd ON cta.class_division_id = cd.id
JOIN public.class_levels cl ON cd.class_level_id = cl.id
JOIN public.users u ON cta.teacher_id = u.id
WHERE cta.is_active = true
ORDER BY cl.sequence_number, cd.division
LIMIT 10;

-- Check for any classes without primary teachers
SELECT 
    cd.id,
    cd.division,
    cl.name as class_level,
    COUNT(cta.id) as total_teachers,
    COUNT(CASE WHEN cta.is_primary THEN 1 END) as primary_teachers
FROM public.class_divisions cd
JOIN public.class_levels cl ON cd.class_level_id = cl.id
LEFT JOIN public.class_teacher_assignments cta ON cd.id = cta.class_division_id AND cta.is_active = true
GROUP BY cd.id, cd.division, cl.name, cl.sequence_number
ORDER BY cl.sequence_number, cd.division;
