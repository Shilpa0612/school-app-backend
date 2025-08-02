-- Analytics and Reports Database Setup
-- This file contains the database schema for the analytics and reports system

-- Create user activity logs table
CREATE TABLE public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    activity_details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily statistics table
CREATE TABLE public.daily_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    new_registrations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_homework INTEGER DEFAULT 0,
    total_classwork INTEGER DEFAULT 0,
    total_alerts INTEGER DEFAULT 0,
    total_leave_requests INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create report templates table
CREATE TABLE public.report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL CHECK (template_type IN ('daily', 'weekly', 'monthly', 'custom')),
    parameters JSONB,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated reports table
CREATE TABLE public.generated_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES public.report_templates(id) ON DELETE SET NULL,
    report_name TEXT NOT NULL,
    report_type TEXT NOT NULL,
    parameters JSONB,
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    generated_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_activity_type ON public.user_activity_logs(activity_type);
CREATE INDEX idx_user_activity_logs_created_at ON public.user_activity_logs(created_at);
CREATE INDEX idx_daily_statistics_date ON public.daily_statistics(date);
CREATE INDEX idx_report_templates_template_type ON public.report_templates(template_type);
CREATE INDEX idx_generated_reports_status ON public.generated_reports(status);
CREATE INDEX idx_generated_reports_generated_at ON public.generated_reports(generated_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_activity_logs table
CREATE POLICY "Users can view their own activity logs" ON public.user_activity_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins and principals can view all activity logs" ON public.user_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "System can create activity logs" ON public.user_activity_logs
    FOR INSERT WITH CHECK (true);

-- RLS Policies for daily_statistics table
CREATE POLICY "Admins and principals can view daily statistics" ON public.daily_statistics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "System can manage daily statistics" ON public.daily_statistics
    FOR ALL USING (true);

-- RLS Policies for report_templates table
CREATE POLICY "Admins and principals can manage report templates" ON public.report_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

-- RLS Policies for generated_reports table
CREATE POLICY "Users can view their own generated reports" ON public.generated_reports
    FOR SELECT USING (auth.uid() = generated_by);

CREATE POLICY "Admins and principals can view all generated reports" ON public.generated_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'principal')
        )
    );

CREATE POLICY "Users can create reports" ON public.generated_reports
    FOR INSERT WITH CHECK (auth.uid() = generated_by);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_analytics_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_daily_statistics_updated_at 
    BEFORE UPDATE ON public.daily_statistics 
    FOR EACH ROW EXECUTE FUNCTION update_analytics_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at 
    BEFORE UPDATE ON public.report_templates 
    FOR EACH ROW EXECUTE FUNCTION update_analytics_updated_at_column(); 