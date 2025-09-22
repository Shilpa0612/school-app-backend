-- Simple Parent Notifications Database Schema
-- This creates just the essential table without complex views

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

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON parent_notifications TO authenticated;

COMMENT ON TABLE parent_notifications IS 'Stores real-time notifications for parents about their children';
COMMENT ON COLUMN parent_notifications.type IS 'Type of notification: announcement, event, homework, classwork, message, attendance, birthday, system';
COMMENT ON COLUMN parent_notifications.priority IS 'Priority level: low, normal, high, urgent';
COMMENT ON COLUMN parent_notifications.data IS 'Additional data related to the notification in JSON format';
COMMENT ON COLUMN parent_notifications.related_id IS 'ID of the related record (announcement, event, homework, etc.)';
COMMENT ON COLUMN parent_notifications.is_read IS 'Whether the parent has read this notification';
COMMENT ON COLUMN parent_notifications.read_at IS 'Timestamp when the notification was marked as read';
