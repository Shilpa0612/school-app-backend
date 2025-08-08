-- Identify all existing get_events_with_ist functions
-- Run this first to see what functions exist

SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type,
    p.oid as function_oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'get_events_with_ist'
AND n.nspname = 'public'
ORDER BY p.oid;

-- This will show you all the function signatures that exist
-- You can then manually drop each one using their OID or signature 