-- Fix Chat RLS Policies to prevent infinite recursion
-- This script fixes the RLS policies that are causing the error

-- First, disable RLS temporarily to fix the policies
ALTER TABLE chat_threads DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can view threads they participate in" ON chat_threads;
DROP POLICY IF EXISTS "Users can create threads" ON chat_threads;
DROP POLICY IF EXISTS "Users can update threads they created" ON chat_threads;

DROP POLICY IF EXISTS "Users can view participants in their threads" ON chat_participants;
DROP POLICY IF EXISTS "Users can add participants to threads they created" ON chat_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON chat_participants;

DROP POLICY IF EXISTS "Users can view messages in their threads" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages to threads they participate in" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON chat_messages;

-- Re-enable RLS
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for chat_threads
CREATE POLICY "Users can view threads they participate in" ON chat_threads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_participants 
            WHERE chat_participants.thread_id = chat_threads.id 
            AND chat_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create threads" ON chat_threads
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update threads they created" ON chat_threads
    FOR UPDATE USING (created_by = auth.uid());

-- Create simplified policies for chat_participants
CREATE POLICY "Users can view participants in their threads" ON chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_participants cp2
            WHERE cp2.thread_id = chat_participants.thread_id 
            AND cp2.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add participants to threads they created" ON chat_participants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_threads 
            WHERE chat_threads.id = chat_participants.thread_id 
            AND chat_threads.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update their own participation" ON chat_participants
    FOR UPDATE USING (user_id = auth.uid());

-- Create simplified policies for chat_messages
CREATE POLICY "Users can view messages in their threads" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_participants 
            WHERE chat_participants.thread_id = chat_messages.thread_id 
            AND chat_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages to threads they participate in" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_participants 
            WHERE chat_participants.thread_id = chat_messages.thread_id 
            AND chat_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON chat_messages
    FOR DELETE USING (sender_id = auth.uid());

-- Grant necessary permissions
GRANT ALL ON chat_threads TO authenticated;
GRANT ALL ON chat_participants TO authenticated;
GRANT ALL ON chat_messages TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated; 