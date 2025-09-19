-- Clear Chat Data Script
-- This script removes all chat messages, threads, and participants
-- Run these queries in the exact order shown to avoid foreign key constraint errors

-- 1. First, delete all chat message attachments (if they exist)
DELETE FROM chat_message_attachments;

-- 2. Delete all chat messages
DELETE FROM chat_messages;

-- 3. Delete all chat participants
DELETE FROM chat_participants;

-- 4. Finally, delete all chat threads
DELETE FROM chat_threads;

-- Optional: Reset sequences if you want to start IDs from 1 again
-- (Only run these if you want to reset auto-increment counters)

-- Reset chat_threads sequence (if using auto-increment)
-- ALTER SEQUENCE chat_threads_id_seq RESTART WITH 1;

-- Reset chat_messages sequence (if using auto-increment)  
-- ALTER SEQUENCE chat_messages_id_seq RESTART WITH 1;

-- Reset chat_participants sequence (if using auto-increment)
-- ALTER SEQUENCE chat_participants_id_seq RESTART WITH 1;

-- Reset chat_message_attachments sequence (if using auto-increment)
-- ALTER SEQUENCE chat_message_attachments_id_seq RESTART WITH 1;

-- Verification queries (run these after clearing to confirm)
-- SELECT COUNT(*) as remaining_threads FROM chat_threads;
-- SELECT COUNT(*) as remaining_participants FROM chat_participants;
-- SELECT COUNT(*) as remaining_messages FROM chat_messages;
-- SELECT COUNT(*) as remaining_attachments FROM chat_message_attachments;

-- Expected results after clearing:
-- remaining_threads: 0
-- remaining_participants: 0  
-- remaining_messages: 0
-- remaining_attachments: 0
