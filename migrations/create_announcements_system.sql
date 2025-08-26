-- Announcements System Schema
-- This migration creates the announcements system with approval workflow

-- ============================================================================
-- ANNOUNCEMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    announcement_type TEXT NOT NULL CHECK (announcement_type IN ('circular', 'general', 'urgent', 'academic', 'administrative')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Creator and approval info
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Target audience
    target_roles TEXT[] DEFAULT '{}', -- ['teacher', 'parent', 'student', 'admin']
    target_classes TEXT[] DEFAULT '{}', -- Class division IDs
    target_departments TEXT[] DEFAULT '{}', -- Department IDs
    
    -- Scheduling
    publish_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    is_published BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- ANNOUNCEMENT ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.announcement_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    mime_type TEXT,
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================================================
-- ANNOUNCEMENT VIEWS TABLE (for tracking who viewed what)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.announcement_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure unique views per user per announcement
    UNIQUE(announcement_id, user_id)
);

-- ============================================================================
-- ANNOUNCEMENT RECIPIENTS TABLE (for tracking delivery)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.announcement_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'read')),
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure unique recipient per announcement per user
    UNIQUE(announcement_id, user_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Announcements table indexes
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON public.announcements(announcement_type);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON public.announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_announcements_approved_by ON public.announcements(approved_by);
CREATE INDEX IF NOT EXISTS idx_announcements_publish_at ON public.announcements(publish_at);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON public.announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_is_published ON public.announcements(is_published);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON public.announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_announcements_status_type ON public.announcements(status, announcement_type);
CREATE INDEX IF NOT EXISTS idx_announcements_status_published ON public.announcements(status, is_published);
CREATE INDEX IF NOT EXISTS idx_announcements_type_published ON public.announcements(announcement_type, is_published);

-- Attachments table indexes
CREATE INDEX IF NOT EXISTS idx_announcement_attachments_announcement_id ON public.announcement_attachments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_attachments_uploaded_by ON public.announcement_attachments(uploaded_by);

-- Views table indexes
CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement_id ON public.announcement_views(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id ON public.announcement_views(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_viewed_at ON public.announcement_views(viewed_at);

-- Recipients table indexes
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_announcement_id ON public.announcement_recipients(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_user_id ON public.announcement_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_recipients_status ON public.announcement_recipients(delivery_status);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Function to auto-approve announcements from principal/admin
CREATE OR REPLACE FUNCTION auto_approve_announcements()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if creator is principal or admin
    IF EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = NEW.created_by 
        AND role IN ('principal', 'admin')
    ) THEN
        NEW.status = 'approved';
        NEW.approved_by = NEW.created_by;
        NEW.approved_at = now();
        NEW.is_published = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-approve announcements from principal/admin
CREATE TRIGGER trigger_auto_approve_announcements
    BEFORE INSERT ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION auto_approve_announcements();

-- Function to create recipients when announcement is approved
CREATE OR REPLACE FUNCTION create_announcement_recipients()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create recipients when status changes to approved
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        -- Insert recipients based on target roles
        INSERT INTO public.announcement_recipients (announcement_id, user_id, delivery_status)
        SELECT 
            NEW.id,
            u.id,
            'pending'
        FROM public.users u
        WHERE u.is_registered = true
        AND (
            -- If no specific roles targeted, include all users
            array_length(NEW.target_roles, 1) IS NULL
            OR u.role = ANY(NEW.target_roles)
        )
        ON CONFLICT (announcement_id, user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create recipients when announcement is approved
CREATE TRIGGER trigger_create_announcement_recipients
    AFTER UPDATE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION create_announcement_recipients();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_recipients ENABLE ROW LEVEL SECURITY;

-- Announcements policies
CREATE POLICY "Users can view published announcements" ON public.announcements
    FOR SELECT USING (
        is_published = true 
        AND status = 'approved'
        AND (expires_at IS NULL OR expires_at > now())
    );

CREATE POLICY "Users can view their own announcements" ON public.announcements
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Principals and admins can view all announcements" ON public.announcements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('principal', 'admin')
        )
    );

CREATE POLICY "Users can create announcements" ON public.announcements
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own draft announcements" ON public.announcements
    FOR UPDATE USING (
        created_by = auth.uid() 
        AND status = 'draft'
    );

CREATE POLICY "Principals and admins can update any announcement" ON public.announcements
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('principal', 'admin')
        )
    );

CREATE POLICY "Users can delete their own draft announcements" ON public.announcements
    FOR DELETE USING (
        created_by = auth.uid() 
        AND status = 'draft'
    );

CREATE POLICY "Principals and admins can delete any announcement" ON public.announcements
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('principal', 'admin')
        )
    );

-- Attachments policies
CREATE POLICY "Users can view attachments of published announcements" ON public.announcement_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.announcements 
            WHERE id = announcement_id 
            AND is_published = true 
            AND status = 'approved'
        )
    );

CREATE POLICY "Users can view attachments of their own announcements" ON public.announcement_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.announcements 
            WHERE id = announcement_id 
            AND created_by = auth.uid()
        )
    );

CREATE POLICY "Principals and admins can view all attachments" ON public.announcement_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('principal', 'admin')
        )
    );

CREATE POLICY "Users can upload attachments to their announcements" ON public.announcement_attachments
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.announcements 
            WHERE id = announcement_id 
            AND created_by = auth.uid()
        )
    );

-- Views policies
CREATE POLICY "Users can view their own announcement views" ON public.announcement_views
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own announcement views" ON public.announcement_views
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Recipients policies
CREATE POLICY "Users can view their own announcement recipients" ON public.announcement_recipients
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Principals and admins can view all recipients" ON public.announcement_recipients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('principal', 'admin')
        )
    );

CREATE POLICY "System can create recipients" ON public.announcement_recipients
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own recipient status" ON public.announcement_recipients
    FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.announcements IS 'School announcements with approval workflow';
COMMENT ON COLUMN public.announcements.announcement_type IS 'Type of announcement: circular, general, urgent, academic, administrative';
COMMENT ON COLUMN public.announcements.status IS 'Status: draft, pending, approved, rejected';
COMMENT ON COLUMN public.announcements.priority IS 'Priority level: low, normal, high, urgent';
COMMENT ON COLUMN public.announcements.target_roles IS 'Array of target roles: teacher, parent, student, admin';
COMMENT ON COLUMN public.announcements.target_classes IS 'Array of target class division IDs';
COMMENT ON COLUMN public.announcements.is_published IS 'Whether the announcement is publicly visible';
COMMENT ON COLUMN public.announcements.is_featured IS 'Whether the announcement is featured/pinned';

COMMENT ON TABLE public.announcement_attachments IS 'File attachments for announcements';
COMMENT ON TABLE public.announcement_views IS 'Track who viewed which announcements';
COMMENT ON TABLE public.announcement_recipients IS 'Track announcement delivery and read status';

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Insert sample announcement types for reference
-- (These are just examples, actual data will be inserted through the API)

-- Sample circular announcement
-- INSERT INTO public.announcements (
--     title, content, announcement_type, status, created_by, target_roles
-- ) VALUES (
--     'School Holiday Notice',
--     'School will be closed on Monday for Republic Day celebration.',
--     'circular',
--     'approved',
--     (SELECT id FROM public.users WHERE role = 'principal' LIMIT 1),
--     ARRAY['teacher', 'parent', 'student']
-- );

-- Sample general announcement
-- INSERT INTO public.announcements (
--     title, content, announcement_type, status, created_by, target_roles
-- ) VALUES (
--     'Annual Sports Day',
--     'Annual sports day will be held on 15th December. All students are invited to participate.',
--     'general',
--     'approved',
--     (SELECT id FROM public.users WHERE role = 'principal' LIMIT 1),
--     ARRAY['teacher', 'parent', 'student']
-- );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Announcements system schema created successfully!';
    RAISE NOTICE 'Tables created: announcements, announcement_attachments, announcement_views, announcement_recipients';
    RAISE NOTICE 'Indexes created for optimal performance';
    RAISE NOTICE 'RLS policies configured for security';
    RAISE NOTICE 'Triggers set up for auto-approval and recipient creation';
END $$;
