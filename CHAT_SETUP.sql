-- Chat System Database Setup
-- This file contains the database schema for the chat system

-- Create chat threads table
CREATE TABLE public.chat_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_type TEXT NOT NULL CHECK (thread_type IN ('direct', 'group')),
    title TEXT, -- For group chats
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat participants table
CREATE TABLE public.chat_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_read_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(thread_id, user_id)
);

-- Create chat messages table
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'deleted')),
    moderated BOOLEAN DEFAULT false,
    moderated_by UUID REFERENCES public.users(id),
    moderated_at TIMESTAMP WITH TIME ZONE,
    moderation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat message attachments table
CREATE TABLE public.chat_message_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_chat_threads_created_by ON public.chat_threads(created_by);
CREATE INDEX idx_chat_threads_status ON public.chat_threads(status);
CREATE INDEX idx_chat_participants_thread_id ON public.chat_participants(thread_id);
CREATE INDEX idx_chat_participants_user_id ON public.chat_participants(user_id);
CREATE INDEX idx_chat_messages_thread_id ON public.chat_messages(thread_id);
CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_chat_message_attachments_message_id ON public.chat_message_attachments(message_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_threads table
CREATE POLICY "Users can view threads they participate in" ON public.chat_threads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants 
            WHERE chat_participants.thread_id = chat_threads.id 
            AND chat_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create threads" ON public.chat_threads
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Thread admins can update threads" ON public.chat_threads
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants 
            WHERE chat_participants.thread_id = chat_threads.id 
            AND chat_participants.user_id = auth.uid()
            AND chat_participants.role = 'admin'
        )
    );

-- RLS Policies for chat_participants table
CREATE POLICY "Users can view participants in their threads" ON public.chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants cp2
            WHERE cp2.thread_id = chat_participants.thread_id 
            AND cp2.user_id = auth.uid()
        )
    );

CREATE POLICY "Thread admins can manage participants" ON public.chat_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants cp2
            WHERE cp2.thread_id = chat_participants.thread_id 
            AND cp2.user_id = auth.uid()
            AND cp2.role = 'admin'
        )
    );

-- RLS Policies for chat_messages table
CREATE POLICY "Users can view messages in their threads" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants 
            WHERE chat_participants.thread_id = chat_messages.thread_id 
            AND chat_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages to their threads" ON public.chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.chat_participants 
            WHERE chat_participants.thread_id = chat_messages.thread_id 
            AND chat_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages" ON public.chat_messages
    FOR UPDATE USING (auth.uid() = sender_id);

-- RLS Policies for chat_message_attachments table
CREATE POLICY "Users can view attachments in their threads" ON public.chat_message_attachments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_messages cm
            JOIN public.chat_participants cp ON cp.thread_id = cm.thread_id
            WHERE cm.id = chat_message_attachments.message_id 
            AND cp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create attachments for their messages" ON public.chat_message_attachments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_messages 
            WHERE chat_messages.id = chat_message_attachments.message_id 
            AND chat_messages.sender_id = auth.uid()
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chat_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_chat_threads_updated_at 
    BEFORE UPDATE ON public.chat_threads 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON public.chat_messages 
    FOR EACH ROW EXECUTE FUNCTION update_chat_updated_at_column(); 