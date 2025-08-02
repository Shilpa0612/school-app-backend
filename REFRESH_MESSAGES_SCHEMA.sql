-- Refresh Messages Table Schema
-- This file ensures the messages table has all required columns

-- First, let's check if the approved_by column exists
DO $$
BEGIN
    -- Check if approved_by column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'approved_by'
        AND table_schema = 'public'
    ) THEN
        -- Add the approved_by column if it doesn't exist
        ALTER TABLE public.messages 
        ADD COLUMN approved_by uuid REFERENCES public.users(id) ON DELETE RESTRICT;
        
        RAISE NOTICE 'Added approved_by column to messages table';
    ELSE
        RAISE NOTICE 'approved_by column already exists in messages table';
    END IF;
END $$;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema'; 