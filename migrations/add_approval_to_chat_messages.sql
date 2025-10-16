-- Migration: Add Approval System to Chat Messages
-- This adds approval workflow for teacher-to-parent messages
-- Parent-to-teacher messages do not require approval

-- Add approval-related columns to chat_messages table
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_approval_status ON public.chat_messages(approval_status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_approval_status_created ON public.chat_messages(approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_approval ON public.chat_messages(thread_id, approval_status);

-- Add comments to explain the new columns
COMMENT ON COLUMN public.chat_messages.approval_status IS 'Approval status: pending (teacher to parent), approved (default), rejected';
COMMENT ON COLUMN public.chat_messages.approved_by IS 'User ID of admin/principal who approved/rejected the message';
COMMENT ON COLUMN public.chat_messages.approved_at IS 'Timestamp when message was approved/rejected';
COMMENT ON COLUMN public.chat_messages.rejection_reason IS 'Reason for rejection (if rejected)';

-- Update existing messages to be approved by default
UPDATE public.chat_messages 
SET approval_status = 'approved' 
WHERE approval_status IS NULL;

