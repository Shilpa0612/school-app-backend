-- Migration: Create Classwork and Homework Tables
-- Date: 2024-01-15
-- Description: Creates tables for classwork and homework management

-- 1. Create classwork table
CREATE TABLE IF NOT EXISTS public.classwork (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_division_id uuid NOT NULL REFERENCES public.class_divisions(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    subject text NOT NULL,
    summary text NOT NULL,
    topics_covered text[] DEFAULT '{}',
    date date NOT NULL DEFAULT CURRENT_DATE,
    is_shared_with_parents boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create homework table
CREATE TABLE IF NOT EXISTS public.homework (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_division_id uuid NOT NULL REFERENCES public.class_divisions(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    subject text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    due_date timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create classwork_attachments table
CREATE TABLE IF NOT EXISTS public.classwork_attachments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    classwork_id uuid NOT NULL REFERENCES public.classwork(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create homework_files table
CREATE TABLE IF NOT EXISTS public.homework_files (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    homework_id uuid NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classwork_class_division ON public.classwork(class_division_id);
CREATE INDEX IF NOT EXISTS idx_classwork_teacher ON public.classwork(teacher_id);
CREATE INDEX IF NOT EXISTS idx_classwork_date ON public.classwork(date);
CREATE INDEX IF NOT EXISTS idx_classwork_subject ON public.classwork(subject);

CREATE INDEX IF NOT EXISTS idx_homework_class_division ON public.homework(class_division_id);
CREATE INDEX IF NOT EXISTS idx_homework_teacher ON public.homework(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_due_date ON public.homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_subject ON public.homework(subject);

CREATE INDEX IF NOT EXISTS idx_classwork_attachments_classwork ON public.classwork_attachments(classwork_id);
CREATE INDEX IF NOT EXISTS idx_homework_files_homework ON public.homework_files(homework_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.classwork ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classwork_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_files ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for classwork
CREATE POLICY "Teachers can view their own classwork" ON public.classwork
    FOR SELECT USING (
        teacher_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can create classwork for their assigned classes" ON public.classwork
    FOR INSERT WITH CHECK (
        teacher_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.class_divisions cd
            WHERE cd.id = class_division_id
            AND cd.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update their own classwork" ON public.classwork
    FOR UPDATE USING (
        teacher_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can delete their own classwork" ON public.classwork
    FOR DELETE USING (
        teacher_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- 8. Create RLS policies for homework
CREATE POLICY "Teachers can view their own homework" ON public.homework
    FOR SELECT USING (
        teacher_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can create homework for their assigned classes" ON public.homework
    FOR INSERT WITH CHECK (
        teacher_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.class_divisions cd
            WHERE cd.id = class_division_id
            AND cd.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Teachers can update their own homework" ON public.homework
    FOR UPDATE USING (
        teacher_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can delete their own homework" ON public.homework
    FOR DELETE USING (
        teacher_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- 9. Create RLS policies for attachments
CREATE POLICY "Teachers can manage their classwork attachments" ON public.classwork_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.classwork c
            WHERE c.id = classwork_id
            AND c.teacher_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Teachers can manage their homework files" ON public.homework_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.homework h
            WHERE h.id = homework_id
            AND h.teacher_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- 10. Create function to get classwork with details
CREATE OR REPLACE FUNCTION public.get_classwork_with_details(p_classwork_id uuid)
RETURNS TABLE (
    id uuid,
    class_division_id uuid,
    teacher_id uuid,
    subject text,
    summary text,
    topics_covered text[],
    date date,
    is_shared_with_parents boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    teacher_name text,
    class_division text,
    class_level text,
    attachments json
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.class_division_id,
        c.teacher_id,
        c.subject,
        c.summary,
        c.topics_covered,
        c.date,
        c.is_shared_with_parents,
        c.created_at,
        c.updated_at,
        u.full_name as teacher_name,
        cd.division as class_division,
        cl.name as class_level,
        COALESCE(
            json_agg(
                json_build_object(
                    'id', ca.id,
                    'file_name', ca.file_name,
                    'file_type', ca.file_type,
                    'storage_path', ca.storage_path
                )
            ) FILTER (WHERE ca.id IS NOT NULL),
            '[]'::json
        ) as attachments
    FROM public.classwork c
    LEFT JOIN public.users u ON c.teacher_id = u.id
    LEFT JOIN public.class_divisions cd ON c.class_division_id = cd.id
    LEFT JOIN public.class_levels cl ON cd.class_level_id = cl.id
    LEFT JOIN public.classwork_attachments ca ON c.id = ca.classwork_id
    WHERE c.id = p_classwork_id
    GROUP BY c.id, u.full_name, cd.division, cl.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Add comments for documentation
COMMENT ON TABLE public.classwork IS 'Daily classwork records for each class division';
COMMENT ON TABLE public.homework IS 'Homework assignments for students';
COMMENT ON TABLE public.classwork_attachments IS 'File attachments for classwork';
COMMENT ON TABLE public.homework_files IS 'File attachments for homework';

COMMENT ON FUNCTION public.get_classwork_with_details IS 'Returns classwork with teacher, class, and attachment details';
