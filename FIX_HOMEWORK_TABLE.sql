-- Fix homework table structure
-- Add missing columns to match the schema

-- Add class_division_id column
ALTER TABLE public.homework 
ADD COLUMN class_division_id uuid REFERENCES public.class_divisions(id) ON DELETE RESTRICT NOT NULL;

-- Add teacher_id column  
ALTER TABLE public.homework 
ADD COLUMN teacher_id uuid REFERENCES public.users(id) ON DELETE RESTRICT NOT NULL;

-- Add subject column
ALTER TABLE public.homework 
ADD COLUMN subject text NOT NULL;

-- Add title column
ALTER TABLE public.homework 
ADD COLUMN title text NOT NULL;

-- Add description column
ALTER TABLE public.homework 
ADD COLUMN description text NOT NULL;

-- Create indexes for better performance
CREATE INDEX idx_homework_class_division ON public.homework(class_division_id);
CREATE INDEX idx_homework_teacher ON public.homework(teacher_id);
CREATE INDEX idx_homework_subject ON public.homework(subject);
CREATE INDEX idx_homework_due_date ON public.homework(due_date);

-- Enable RLS if not already enabled
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Teachers can view their own homework"
ON public.homework FOR SELECT
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can create homework for their classes"
ON public.homework FOR INSERT
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own homework"
ON public.homework FOR UPDATE
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own homework"
ON public.homework FOR DELETE
USING (teacher_id = auth.uid());

-- Admin and principal can view all homework
CREATE POLICY "Admin and principal can view all homework"
ON public.homework FOR SELECT
USING (auth.role() IN ('admin', 'principal'));

-- Parents can view homework for their children's classes
CREATE POLICY "Parents can view homework for their children's classes"
ON public.homework FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM parent_student_mappings psm
        JOIN student_academic_records sar ON psm.student_id = sar.student_id
        WHERE psm.parent_id = auth.uid() 
        AND sar.class_division_id = homework.class_division_id
    )
); 