-- Students Performance Optimization
-- Add indexes to improve query performance for large datasets (1k-10k students)

-- Index for students_master table
CREATE INDEX IF NOT EXISTS idx_students_master_status_created 
ON students_master(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_students_master_full_name 
ON students_master USING gin(to_tsvector('english', full_name));

CREATE INDEX IF NOT EXISTS idx_students_master_admission_number 
ON students_master(admission_number);

-- Index for student_academic_records table
CREATE INDEX IF NOT EXISTS idx_student_academic_records_student_status 
ON student_academic_records(student_id, status);

CREATE INDEX IF NOT EXISTS idx_student_academic_records_class_division_status 
ON student_academic_records(class_division_id, status);

CREATE INDEX IF NOT EXISTS idx_student_academic_records_roll_number 
ON student_academic_records(class_division_id, roll_number);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_student_academic_records_composite 
ON student_academic_records(student_id, class_division_id, status);

-- Index for parent_student_mappings table
CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_student_id 
ON parent_student_mappings(student_id);

CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_parent_id 
ON parent_student_mappings(parent_id);

-- Index for class_divisions table
CREATE INDEX IF NOT EXISTS idx_class_divisions_academic_year 
ON class_divisions(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_class_divisions_class_level 
ON class_divisions(class_level_id);

-- Index for class_levels table
CREATE INDEX IF NOT EXISTS idx_class_levels_sequence 
ON class_levels(sequence_number);

-- Index for academic_years table
CREATE INDEX IF NOT EXISTS idx_academic_years_active 
ON academic_years(is_active);

-- Monitoring queries to check index usage
-- Run these after creating indexes to monitor performance

-- Check index usage statistics
SELECT 
    schemaname,
    relname as tablename,
    indexrelname as indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE relname IN ('students_master', 'student_academic_records', 'parent_student_mappings', 'class_divisions', 'class_levels', 'academic_years')
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename IN ('students_master', 'student_academic_records', 'parent_student_mappings', 'class_divisions', 'class_levels', 'academic_years')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Performance test query (similar to the API endpoint)
EXPLAIN ANALYZE
SELECT s.id, s.full_name, s.admission_number, s.date_of_birth, s.admission_date, s.status, s.created_at
FROM students_master s
INNER JOIN student_academic_records sar ON s.id = sar.student_id
INNER JOIN class_divisions cd ON sar.class_division_id = cd.id
WHERE s.status = 'active'
  AND sar.status = 'ongoing'
  AND cd.id = 'cdbd7c50-ac8a-44b5-ade7-91579464ff02'
ORDER BY s.created_at DESC
LIMIT 20;
