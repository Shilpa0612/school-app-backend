import { adminSupabase } from '../src/config/supabase.js';

async function runChatMigration() {
    try {
        console.log('Starting chat migration...');

        // Add thread_id column to messages table
        console.log('Adding thread_id column...');
        const { error: threadIdError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.messages 
                ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE;
            `
        });

        if (threadIdError) {
            console.error('Error adding thread_id column:', threadIdError);
            return;
        }

        // Add message_type column to messages table
        console.log('Adding message_type column...');
        const { error: messageTypeError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.messages 
                ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system'));
            `
        });

        if (messageTypeError) {
            console.error('Error adding message_type column:', messageTypeError);
            return;
        }

        // Create indexes
        console.log('Creating indexes...');
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(thread_id);',
            'CREATE INDEX IF NOT EXISTS idx_messages_type ON public.messages(type);',
            'CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages(status);',
            'CREATE INDEX IF NOT EXISTS idx_messages_thread_status ON public.messages(thread_id, status);'
        ];

        for (const indexSql of indexes) {
            const { error: indexError } = await adminSupabase.rpc('exec_sql', { sql: indexSql });
            if (indexError) {
                console.error('Error creating index:', indexError);
                return;
            }
        }

        // Update existing messages to have default message_type
        console.log('Updating existing messages...');
        const { error: updateError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                UPDATE public.messages 
                SET message_type = 'text' 
                WHERE message_type IS NULL;
            `
        });

        if (updateError) {
            console.error('Error updating existing messages:', updateError);
            return;
        }

        // Add message_id column to chat_messages table for reference
        console.log('Adding message_id column to chat_messages...');
        const { error: messageIdError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.chat_messages 
                ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE;
            `
        });

        if (messageIdError) {
            console.error('Error adding message_id column to chat_messages:', messageIdError);
            return;
        }

        console.log('Chat migration completed successfully!');
        console.log('New columns added:');
        console.log('- messages.thread_id: Reference to chat threads');
        console.log('- messages.message_type: Type of message (text, image, file, system)');
        console.log('- chat_messages.message_id: Reference to main message in messages table');

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

// Run the migration
runChatMigration();
