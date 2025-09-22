-- Parent Notifications Database Schema
-- This schema supports real-time notifications for parents about their children

-- Create parent_notifications table
CREATE TABLE IF NOT EXISTS parent_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students_master(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('announcement', 'event', 'homework', 'classwork', 'message', 'attendance', 'birthday', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    related_id UUID, -- ID of the related record (announcement_id, event_id, etc.)
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent_id ON parent_notifications(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_student_id ON parent_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_type ON parent_notifications(type);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_is_read ON parent_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_created_at ON parent_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_priority ON parent_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent_student ON parent_notifications(parent_id, student_id);
CREATE INDEX IF NOT EXISTS idx_parent_notifications_unread ON parent_notifications(parent_id, is_read) WHERE is_read = FALSE;

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_parent_notifications_parent_unread_type ON parent_notifications(parent_id, is_read, type) WHERE is_read = FALSE;

-- Add RLS (Row Level Security) policies
ALTER TABLE parent_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Parents can only see their own notifications
CREATE POLICY "Parents can view their own notifications" ON parent_notifications
    FOR SELECT USING (parent_id = auth.uid());

-- Policy: Parents can update their own notifications (mark as read)
CREATE POLICY "Parents can update their own notifications" ON parent_notifications
    FOR UPDATE USING (parent_id = auth.uid());

-- Policy: System can insert notifications (for automated notifications)
CREATE POLICY "System can insert notifications" ON parent_notifications
    FOR INSERT WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_parent_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_parent_notifications_updated_at
    BEFORE UPDATE ON parent_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_notifications_updated_at();

-- Create function to clean up old notifications (optional)
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM parent_notifications 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for notification summary (useful for dashboards)
CREATE OR REPLACE VIEW parent_notification_summary AS
SELECT 
    pn.parent_id,
    pn.student_id,
    s.full_name as student_name,
    s.admission_number,
    cl.name as class_name,
    cd.division,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE pn.is_read = FALSE) as unread_count,
    COUNT(*) FILTER (WHERE pn.type = 'announcement') as announcement_count,
    COUNT(*) FILTER (WHERE pn.type = 'event') as event_count,
    COUNT(*) FILTER (WHERE pn.type = 'homework') as homework_count,
    COUNT(*) FILTER (WHERE pn.type = 'classwork') as classwork_count,
    COUNT(*) FILTER (WHERE pn.type = 'message') as message_count,
    COUNT(*) FILTER (WHERE pn.priority = 'urgent') as urgent_count,
    MAX(pn.created_at) as last_notification_at
FROM parent_notifications pn
JOIN students_master s ON pn.student_id = s.id
JOIN student_academic_records sar ON s.id = sar.student_id
JOIN class_divisions cd ON sar.class_division_id = cd.id
JOIN class_levels cl ON cd.class_level_id = cl.id
GROUP BY pn.parent_id, pn.student_id, s.full_name, s.admission_number, cl.name, cd.division;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON parent_notifications TO authenticated;
GRANT SELECT ON parent_notification_summary TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications TO authenticated;

-- Insert sample data for testing (optional - remove in production)
-- Only insert if there are actual parents and students in the system
DO $$
BEGIN
    -- Only insert sample data if we have both parents and students
    IF EXISTS (SELECT 1 FROM users WHERE role = 'parent' LIMIT 1) 
       AND EXISTS (SELECT 1 FROM students_master LIMIT 1) THEN
        
        INSERT INTO parent_notifications (parent_id, student_id, type, title, message, priority, data) VALUES
        (
            (SELECT id FROM users WHERE role = 'parent' LIMIT 1),
            (SELECT id FROM students_master LIMIT 1),
            'announcement',
            'New School Announcement',
            'There will be a parent-teacher meeting next week.',
            'normal',
            '{"announcement_id": "sample-announcement-id"}'
        ),
        (
            (SELECT id FROM users WHERE role = 'parent' LIMIT 1),
            (SELECT id FROM students_master LIMIT 1),
            'homework',
            'New Homework Assignment',
            'Math homework due tomorrow.',
            'high',
            '{"homework_id": "sample-homework-id", "subject": "Mathematics"}'
        ),
        (
            (SELECT id FROM users WHERE role = 'parent' LIMIT 1),
            (SELECT id FROM students_master LIMIT 1),
            'event',
            'School Event Reminder',
            'Annual day celebration is tomorrow.',
            'normal',
            '{"event_id": "sample-event-id", "event_date": "2024-01-15"}'
        );
        
        RAISE NOTICE 'Sample notification data inserted successfully';
    ELSE
        RAISE NOTICE 'No sample data inserted - no parents or students found in system';
    END IF;
END $$;

COMMENT ON TABLE parent_notifications IS 'Stores real-time notifications for parents about their children';
COMMENT ON COLUMN parent_notifications.type IS 'Type of notification: announcement, event, homework, classwork, message, attendance, birthday, system';
COMMENT ON COLUMN parent_notifications.priority IS 'Priority level: low, normal, high, urgent';
COMMENT ON COLUMN parent_notifications.data IS 'Additional data related to the notification in JSON format';
COMMENT ON COLUMN parent_notifications.related_id IS 'ID of the related record (announcement, event, homework, etc.)';
COMMENT ON COLUMN parent_notifications.is_read IS 'Whether the parent has read this notification';
COMMENT ON COLUMN parent_notifications.read_at IS 'Timestamp when the notification was marked as read';
