-- ============================================================================
-- CHECK EXISTING TABLES IN YOUR DATABASE
-- ============================================================================
-- Run this script first to see which tables actually exist in your database
-- ============================================================================

-- Check which tables exist in the public schema
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- ALTERNATIVE: Check if specific tables exist
-- ============================================================================

-- Check for core tables
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END AS users_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students_master' AND table_schema = 'public') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END AS students_master_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'class_divisions' AND table_schema = 'public') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END AS class_divisions_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'school_details' AND table_schema = 'public') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END AS school_details_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'academic_years' AND table_schema = 'public') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END AS academic_years_table,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'class_levels' AND table_schema = 'public') 
        THEN 'EXISTS' 
        ELSE 'NOT EXISTS' 
    END AS class_levels_table;

-- ============================================================================
-- CHECK FOR ALTERNATIVE TABLE NAMES
-- ============================================================================

-- Look for tables that might have similar names
SELECT 
    table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
AND (
    table_name LIKE '%school%' OR
    table_name LIKE '%academic%' OR
    table_name LIKE '%class%' OR
    table_name LIKE '%student%' OR
    table_name LIKE '%user%' OR
    table_name LIKE '%message%' OR
    table_name LIKE '%homework%' OR
    table_name LIKE '%attendance%' OR
    table_name LIKE '%announcement%' OR
    table_name LIKE '%alert%'
)
ORDER BY table_name;
