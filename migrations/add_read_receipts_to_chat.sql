-- Migration: Add Read Receipts to Chat System
-- This adds per-message read tracking without breaking existing functionality
-- Maintains backward compatibility with existing last_read_at in chat_participants

-- ============================================================================
-- MESSAGE READS TABLE (WhatsApp-style read receipts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure each user can only mark a message as read once
    UNIQUE(message_id, user_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for querying reads by message (to get read-by list)
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON public.message_reads(message_id);

-- Index for querying reads by user (to get what user has read)
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON public.message_reads(user_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_message_reads_message_user ON public.message_reads(message_id, user_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_message_reads_read_at ON public.message_reads(read_at DESC);

-- ============================================================================
-- UPDATE CHAT_MESSAGES STATUS FIELD
-- ============================================================================

-- Add delivered_at timestamp to track delivery
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;

-- Add index for status queries (if not already exists)
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON public.chat_messages(status);

-- Update existing messages to have delivered status if they're old enough
-- (Assume messages older than 1 minute are delivered)
UPDATE public.chat_messages 
SET status = 'delivered', 
    delivered_at = created_at 
WHERE status = 'sent' 
AND created_at < NOW() - INTERVAL '1 minute';

-- ============================================================================
-- HELPER FUNCTION: Get message read count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_message_read_count(p_message_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM message_reads
        WHERE message_id = p_message_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- HELPER FUNCTION: Check if message is read by user
-- ============================================================================

CREATE OR REPLACE FUNCTION is_message_read_by_user(p_message_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM message_reads
        WHERE message_id = p_message_id
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- HELPER FUNCTION: Get unread message count for thread
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unread_count_for_thread(p_thread_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM chat_messages cm
        WHERE cm.thread_id = p_thread_id
        AND cm.sender_id != p_user_id  -- Don't count own messages
        AND cm.approval_status = 'approved'  -- Only count approved messages
        AND NOT EXISTS (
            SELECT 1
            FROM message_reads mr
            WHERE mr.message_id = cm.id
            AND mr.user_id = p_user_id
        )
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- HELPER FUNCTION: Mark all messages in thread as read
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_thread_messages_as_read(p_thread_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    inserted_count INTEGER;
BEGIN
    -- Insert read receipts for all unread messages in the thread
    WITH unread_messages AS (
        SELECT cm.id
        FROM chat_messages cm
        WHERE cm.thread_id = p_thread_id
        AND cm.sender_id != p_user_id  -- Don't mark own messages
        AND cm.approval_status = 'approved'  -- Only mark approved messages
        AND NOT EXISTS (
            SELECT 1
            FROM message_reads mr
            WHERE mr.message_id = cm.id
            AND mr.user_id = p_user_id
        )
    ),
    inserted_reads AS (
        INSERT INTO message_reads (message_id, user_id, read_at)
        SELECT id, p_user_id, NOW()
        FROM unread_messages
        ON CONFLICT (message_id, user_id) DO NOTHING
        RETURNING id
    )
    SELECT COUNT(*) INTO inserted_count FROM inserted_reads;
    
    -- Also update last_read_at in chat_participants for backward compatibility
    UPDATE chat_participants
    SET last_read_at = NOW()
    WHERE thread_id = p_thread_id
    AND user_id = p_user_id;
    
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.message_reads IS 'Tracks which users have read which messages (per-message read receipts)';
COMMENT ON COLUMN public.message_reads.message_id IS 'Reference to the message that was read';
COMMENT ON COLUMN public.message_reads.user_id IS 'User who read the message';
COMMENT ON COLUMN public.message_reads.read_at IS 'Timestamp when the message was read';

COMMENT ON COLUMN public.chat_messages.delivered_at IS 'Timestamp when message was delivered to recipient(s)';

COMMENT ON FUNCTION get_message_read_count IS 'Returns the number of users who have read a specific message';
COMMENT ON FUNCTION is_message_read_by_user IS 'Checks if a specific user has read a specific message';
COMMENT ON FUNCTION get_unread_count_for_thread IS 'Returns the count of unread messages in a thread for a specific user';
COMMENT ON FUNCTION mark_thread_messages_as_read IS 'Marks all unread messages in a thread as read for a specific user';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Optional, based on your security requirements
-- ============================================================================

-- Enable RLS on message_reads table
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see read receipts for their own messages
CREATE POLICY "Users can view read receipts for their own messages" ON public.message_reads
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM chat_messages cm
        WHERE cm.id = message_reads.message_id
        AND cm.sender_id = auth.uid()
    )
);

-- Policy: Users can view their own read receipts
CREATE POLICY "Users can view their own read receipts" ON public.message_reads
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Users can insert read receipts for themselves
CREATE POLICY "Users can insert their own read receipts" ON public.message_reads
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy: Admins can see all read receipts
CREATE POLICY "Admins can view all read receipts" ON public.message_reads
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'principal')
    )
);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT ON public.message_reads TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_read_count TO authenticated;
GRANT EXECUTE ON FUNCTION is_message_read_by_user TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_count_for_thread TO authenticated;
GRANT EXECUTE ON FUNCTION mark_thread_messages_as_read TO authenticated;

