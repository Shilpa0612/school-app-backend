-- Migration: Add Chat Support to Messages Table
-- This migration adds thread_id and message_type columns to support real-time chat functionality

-- Add thread_id column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE;

-- Add message_type column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system'));

-- Add index for better performance on thread_id queries
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(thread_id);

-- Add index for message_type queries
CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(type);

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_messages_thread_status ON public.messages(thread_id, status);

-- Update existing messages to have default message_type
UPDATE public.messages 
SET message_type = 'text' 
WHERE message_type IS NULL;

-- Add comment to explain the new columns
COMMENT ON COLUMN public.messages.thread_id IS 'Reference to chat thread for real-time chat messages';
COMMENT ON COLUMN public.messages.message_type IS 'Type of message: text, image, file, or system';

-- Create a view to combine messages and chat_messages for backward compatibility
CREATE OR REPLACE VIEW public.unified_messages AS
SELECT 
    m.id,
    m.sender_id,
    m.content,
    m.type,
    m.status,
    m.thread_id,
    m.message_type,
    m.created_at,
    m.class_division_id,
    m.recipient_id,
    m.approved_by,
    'messages' as source_table
FROM public.messages m
WHERE m.thread_id IS NOT NULL

UNION ALL

SELECT 
    cm.id,
    cm.sender_id,
    cm.content,
    'individual' as type,
    'approved' as status,
    cm.thread_id,
    cm.message_type,
    cm.created_at,
    NULL as class_division_id,
    NULL as recipient_id,
    NULL as approved_by,
    'chat_messages' as source_table
FROM public.chat_messages cm
WHERE cm.message_id IS NULL; -- Only include chat_messages that don't have a reference to messages table

-- Grant permissions on the view
GRANT SELECT ON public.unified_messages TO authenticated;
GRANT SELECT ON public.unified_messages TO anon;
