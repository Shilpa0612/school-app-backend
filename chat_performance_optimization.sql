-- Chat Performance Optimization Indexes
-- Run these indexes to dramatically improve chat thread performance

-- 1. Critical indexes for chat_participants table
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_thread_id ON chat_participants(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_thread ON chat_participants(user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_thread_user ON chat_participants(thread_id, user_id);

-- 2. Critical indexes for chat_messages table
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);

-- 3. Critical indexes for chat_threads table
CREATE INDEX IF NOT EXISTS idx_chat_threads_updated_at ON chat_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status);
CREATE INDEX IF NOT EXISTS idx_chat_threads_created_at ON chat_threads(created_at);

-- 4. Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_role ON chat_participants(user_id, role);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_sender ON chat_messages(thread_id, sender_id);

-- 5. Index for unread message counting (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created_unread 
ON chat_messages(thread_id, created_at);

-- 6. Partial indexes for active threads only
CREATE INDEX IF NOT EXISTS idx_chat_threads_active_updated 
ON chat_threads(updated_at DESC) 
WHERE status = 'active';

-- 7. Index for user lookups in participants
CREATE INDEX IF NOT EXISTS idx_users_id_role ON users(id, role);

-- Performance analysis queries (run these to check current performance)
-- These are for monitoring, not for production

-- Check index usage
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE relname IN ('chat_participants', 'chat_messages', 'chat_threads', 'users')
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename IN ('chat_participants', 'chat_messages', 'chat_threads', 'users')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
