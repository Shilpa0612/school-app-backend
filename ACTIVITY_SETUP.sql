-- Activity Planning Database Setup
-- This file contains the database schema for the activity planning system

-- Create activities table
CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    activity_date DATE NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('field_trip', 'sports', 'cultural', 'academic', 'other')),
    class_division_id UUID REFERENCES public.class_divisions(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    dress_code TEXT,
    venue TEXT,
    start_time TIME,
    end_time TIME,
    max_participants INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity items table (checklist for activities)
CREATE TABLE public.activity_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    item_type TEXT NOT NULL CHECK (item_type IN ('material', 'document', 'clothing', 'food', 'other')),
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity participants table
CREATE TABLE public.activity_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students_master(id) ON DELETE CASCADE,
    parent_consent BOOLEAN DEFAULT false,
    consent_given_at TIMESTAMP WITH TIME ZONE,
    consent_given_by UUID REFERENCES public.users(id),
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'attended', 'absent')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(activity_id, student_id)
);

-- Create activity reminders table
CREATE TABLE public.activity_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('night_before', 'morning_of', 'custom')),
    reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
    message TEXT NOT NULL,
    sent_to TEXT NOT NULL CHECK (sent_to IN ('parents', 'students', 'both')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_activities_teacher_id ON public.activities(teacher_id);
CREATE INDEX idx_activities_activity_date ON public.activities(activity_date);
CREATE INDEX idx_activities_status ON public.activities(status);
CREATE INDEX idx_activities_class_division_id ON public.activities(class_division_id);
CREATE INDEX idx_activity_items_activity_id ON public.activity_items(activity_id);
CREATE INDEX idx_activity_participants_activity_id ON public.activity_participants(activity_id);
CREATE INDEX idx_activity_participants_student_id ON public.activity_participants(student_id);
CREATE INDEX idx_activity_reminders_activity_id ON public.activity_reminders(activity_id);
CREATE INDEX idx_activity_reminders_reminder_time ON public.activity_reminders(reminder_time);

-- Enable Row Level Security (RLS)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activities table
CREATE POLICY "Teachers can view their own activities" ON public.activities
    FOR SELECT USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can view activities for their classes" ON public.activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.teacher_class_assignments tca
            JOIN public.class_divisions cd ON cd.academic_year_id = (
                SELECT id FROM public.academic_years WHERE year_name = tca.academic_year
            ) AND cd.class_level_id = (
                SELECT id FROM public.class_levels WHERE name = tca.class_level
            ) AND cd.division = tca.division
            WHERE tca.teacher_id = auth.uid()
            AND cd.id = activities.class_division_id
        )
    );

CREATE POLICY "Parents can view activities for their children's classes" ON public.activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.parent_student_mappings psm
            JOIN public.student_academic_records sar ON sar.student_id = psm.student_id
            WHERE psm.parent_id = auth.uid()
            AND sar.class_division_id = activities.class_division_id
        )
    );

CREATE POLICY "Teachers can create activities" ON public.activities
    FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update their own activities" ON public.activities
    FOR UPDATE USING (auth.uid() = teacher_id);

-- RLS Policies for activity_items table
CREATE POLICY "Users can view items for activities they can access" ON public.activity_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.activities 
            WHERE activities.id = activity_items.activity_id
            AND (
                activities.teacher_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.teacher_class_assignments tca
                    JOIN public.class_divisions cd ON cd.academic_year_id = (
                        SELECT id FROM public.academic_years WHERE year_name = tca.academic_year
                    ) AND cd.class_level_id = (
                        SELECT id FROM public.class_levels WHERE name = tca.class_level
                    ) AND cd.division = tca.division
                    WHERE tca.teacher_id = auth.uid()
                    AND cd.id = activities.class_division_id
                ) OR
                EXISTS (
                    SELECT 1 FROM public.parent_student_mappings psm
                    JOIN public.student_academic_records sar ON sar.student_id = psm.student_id
                    WHERE psm.parent_id = auth.uid()
                    AND sar.class_division_id = activities.class_division_id
                )
            )
        )
    );

CREATE POLICY "Teachers can manage items for their activities" ON public.activity_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.activities 
            WHERE activities.id = activity_items.activity_id
            AND activities.teacher_id = auth.uid()
        )
    );

-- RLS Policies for activity_participants table
CREATE POLICY "Users can view participants for activities they can access" ON public.activity_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.activities 
            WHERE activities.id = activity_participants.activity_id
            AND (
                activities.teacher_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.teacher_class_assignments tca
                    JOIN public.class_divisions cd ON cd.academic_year_id = (
                        SELECT id FROM public.academic_years WHERE year_name = tca.academic_year
                    ) AND cd.class_level_id = (
                        SELECT id FROM public.class_levels WHERE name = tca.class_level
                    ) AND cd.division = tca.division
                    WHERE tca.teacher_id = auth.uid()
                    AND cd.id = activities.class_division_id
                ) OR
                EXISTS (
                    SELECT 1 FROM public.parent_student_mappings psm
                    JOIN public.student_academic_records sar ON sar.student_id = psm.student_id
                    WHERE psm.parent_id = auth.uid()
                    AND sar.class_division_id = activities.class_division_id
                )
            )
        )
    );

CREATE POLICY "Teachers can manage participants for their activities" ON public.activity_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.activities 
            WHERE activities.id = activity_participants.activity_id
            AND activities.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Parents can update consent for their children" ON public.activity_participants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.parent_student_mappings 
            WHERE parent_student_mappings.parent_id = auth.uid()
            AND parent_student_mappings.student_id = activity_participants.student_id
        )
    );

-- RLS Policies for activity_reminders table
CREATE POLICY "Teachers can manage reminders for their activities" ON public.activity_reminders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.activities 
            WHERE activities.id = activity_reminders.activity_id
            AND activities.teacher_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_activity_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_activities_updated_at 
    BEFORE UPDATE ON public.activities 
    FOR EACH ROW EXECUTE FUNCTION update_activity_updated_at_column();

CREATE TRIGGER update_activity_participants_updated_at 
    BEFORE UPDATE ON public.activity_participants 
    FOR EACH ROW EXECUTE FUNCTION update_activity_updated_at_column(); 