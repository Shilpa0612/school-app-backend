-- Feedback System Database Setup
-- This file contains the database schema for the feedback system

-- Create feedback categories table
CREATE TABLE public.feedback_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback submissions table
CREATE TABLE public.feedback_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES public.feedback_categories(id) ON DELETE SET NULL,
    submitter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('suggestion', 'complaint', 'appreciation', 'question')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'in_progress', 'resolved', 'closed')),
    is_anonymous BOOLEAN DEFAULT false,
    contact_preference TEXT CHECK (contact_preference IN ('email', 'phone', 'in_app', 'none')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback responses table
CREATE TABLE public.feedback_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES public.feedback_submissions(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false, -- Internal notes vs public response
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback attachments table
CREATE TABLE public.feedback_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES public.feedback_submissions(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback status history table
CREATE TABLE public.feedback_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID NOT NULL REFERENCES public.feedback_submissions(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_feedback_submissions_submitter_id ON public.feedback_submissions(submitter_id);
CREATE INDEX idx_feedback_submissions_status ON public.feedback_submissions(status);
CREATE INDEX idx_feedback_submissions_priority ON public.feedback_submissions(priority);
CREATE INDEX idx_feedback_submissions_category_id ON public.feedback_submissions(category_id);
CREATE INDEX idx_feedback_submissions_created_at ON public.feedback_submissions(created_at);
CREATE INDEX idx_feedback_responses_feedback_id ON public.feedback_responses(feedback_id);
CREATE INDEX idx_feedback_responses_responder_id ON public.feedback_responses(responder_id);
CREATE INDEX idx_feedback_attachments_feedback_id ON public.feedback_attachments(feedback_id);
CREATE INDEX idx_feedback_status_history_feedback_id ON public.feedback_status_history(feedback_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.feedback_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feedback_categories table
CREATE POLICY "Anyone can view active categories" ON public.feedback_categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins and principals can manage categories" ON public.feedback_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- RLS Policies for feedback_submissions table
CREATE POLICY "Users can view their own submissions" ON public.feedback_submissions
    FOR SELECT USING (auth.uid() = submitter_id);

CREATE POLICY "Admins and principals can view all submissions" ON public.feedback_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Users can create submissions" ON public.feedback_submissions
    FOR INSERT WITH CHECK (auth.uid() = submitter_id);

CREATE POLICY "Admins and principals can update submissions" ON public.feedback_submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- RLS Policies for feedback_responses table
CREATE POLICY "Users can view responses to their submissions" ON public.feedback_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.feedback_submissions 
            WHERE feedback_submissions.id = feedback_responses.feedback_id
            AND feedback_submissions.submitter_id = auth.uid()
        )
    );

CREATE POLICY "Admins and principals can view all responses" ON public.feedback_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Admins and principals can create responses" ON public.feedback_responses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- RLS Policies for feedback_attachments table
CREATE POLICY "Users can view attachments for their submissions" ON public.feedback_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.feedback_submissions 
            WHERE feedback_submissions.id = feedback_attachments.feedback_id
            AND feedback_submissions.submitter_id = auth.uid()
        )
    );

CREATE POLICY "Admins and principals can view all attachments" ON public.feedback_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Users can create attachments for their submissions" ON public.feedback_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.feedback_submissions 
            WHERE feedback_submissions.id = feedback_attachments.feedback_id
            AND feedback_submissions.submitter_id = auth.uid()
        )
    );

-- RLS Policies for feedback_status_history table
CREATE POLICY "Users can view history for their submissions" ON public.feedback_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.feedback_submissions 
            WHERE feedback_submissions.id = feedback_status_history.feedback_id
            AND feedback_submissions.submitter_id = auth.uid()
        )
    );

CREATE POLICY "Admins and principals can view all history" ON public.feedback_status_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "System can create status history" ON public.feedback_status_history
    FOR INSERT WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_feedback_submissions_updated_at 
    BEFORE UPDATE ON public.feedback_submissions 
    FOR EACH ROW EXECUTE FUNCTION update_feedback_updated_at_column();

-- Insert default feedback categories
INSERT INTO public.feedback_categories (name, description) VALUES
('General', 'General feedback and suggestions'),
('Academic', 'Academic-related feedback'),
('Infrastructure', 'School infrastructure and facilities'),
('Communication', 'Communication and messaging system'),
('Activities', 'School activities and events'),
('Technology', 'Technology and app-related feedback'),
('Safety', 'Safety and security concerns'),
('Other', 'Other categories'); 