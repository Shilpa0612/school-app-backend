# Database Performance Optimization Guide

## Overview

This guide provides comprehensive strategies for optimizing database performance in the School App Backend, especially as data grows from hundreds to thousands of records.

## Current Performance Issues

### Identified Problems

1. **Slow student queries** - Taking 2-5 seconds for basic operations
2. **Parent data loading delays** - 3-8 seconds for parent-child relationships
3. **Teacher dashboard slowness** - 5-10 seconds for class data
4. **Search functionality delays** - 3-7 seconds for name/admission number searches

### Root Causes

1. **Missing indexes** on frequently queried columns
2. **No composite indexes** for complex joins
3. **Inefficient query patterns** in some routes
4. **Lack of partial indexes** for filtered queries

## Optimization Strategy

### 1. Critical Indexes (Immediate Impact)

#### Student-Related Indexes

```sql
-- Basic student queries
CREATE INDEX idx_students_master_status ON students_master(status);
CREATE INDEX idx_students_master_full_name ON students_master(full_name);
CREATE INDEX idx_students_master_admission_number ON students_master(admission_number);

-- Composite indexes for common queries
CREATE INDEX idx_students_master_status_name ON students_master(status, full_name);
CREATE INDEX idx_students_master_status_created ON students_master(status, created_at DESC);

-- Partial index for active students (most common query)
CREATE INDEX idx_students_master_active_only ON students_master(id, full_name, admission_number)
WHERE status = 'active';
```

#### Academic Records Indexes

```sql
-- Academic record queries
CREATE INDEX idx_student_academic_records_student_id ON student_academic_records(student_id);
CREATE INDEX idx_student_academic_records_class_division_id ON student_academic_records(class_division_id);
CREATE INDEX idx_student_academic_records_status ON student_academic_records(status);

-- Composite indexes
CREATE INDEX idx_student_academic_records_student_status ON student_academic_records(student_id, status);
CREATE INDEX idx_student_academic_records_class_status ON student_academic_records(class_division_id, status);

-- Partial index for ongoing records
CREATE INDEX idx_student_academic_records_ongoing_only ON student_academic_records(student_id, class_division_id, roll_number)
WHERE status = 'ongoing';
```

#### Parent-Student Mapping Indexes

```sql
-- Parent mapping queries
CREATE INDEX idx_parent_student_mappings_parent_id ON parent_student_mappings(parent_id);
CREATE INDEX idx_parent_student_mappings_student_id ON parent_student_mappings(student_id);
CREATE INDEX idx_parent_student_mappings_is_primary_guardian ON parent_student_mappings(is_primary_guardian);

-- Composite indexes
CREATE INDEX idx_parent_student_mappings_parent_primary ON parent_student_mappings(parent_id, is_primary_guardian);
CREATE INDEX idx_parent_student_mappings_student_primary ON parent_student_mappings(student_id, is_primary_guardian);

-- Partial index for primary guardians
CREATE INDEX idx_parent_student_mappings_primary_only ON parent_student_mappings(student_id, parent_id)
WHERE is_primary_guardian = true;
```

### 2. User Management Indexes

```sql
-- User queries
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_full_name ON users(full_name);
CREATE INDEX idx_users_phone_number ON users(phone_number);

-- Role-based composite indexes
CREATE INDEX idx_users_role_created ON users(role, created_at DESC);
CREATE INDEX idx_users_role_name ON users(role, full_name);

-- Case-insensitive search
CREATE INDEX idx_users_name_lower ON users(lower(full_name));
```

### 3. Class and Teacher Indexes

```sql
-- Class division queries
CREATE INDEX idx_class_divisions_academic_year_id ON class_divisions(academic_year_id);
CREATE INDEX idx_class_divisions_teacher_id ON class_divisions(teacher_id);
CREATE INDEX idx_class_divisions_academic_level ON class_divisions(academic_year_id, class_level_id);

-- Teacher assignment queries
CREATE INDEX idx_class_teacher_assignments_teacher_id ON class_teacher_assignments(teacher_id);
CREATE INDEX idx_class_teacher_assignments_class_division_id ON class_teacher_assignments(class_division_id);
CREATE INDEX idx_class_teacher_assignments_teacher_active ON class_teacher_assignments(teacher_id, is_active);

-- Partial index for active assignments
CREATE INDEX idx_class_teacher_assignments_active_only ON class_teacher_assignments(teacher_id, class_division_id)
WHERE is_active = true;
```

## Implementation

### Quick Start

1. **Run the optimization script:**

   ```bash
   node scripts/apply_database_optimizations.js
   ```

2. **Or use the batch file (Windows):**

   ```bash
   scripts/optimize_database.bat
   ```

3. **Monitor performance:**
   ```bash
   node scripts/apply_database_optimizations.js monitor
   ```

### Manual Implementation

If you prefer to run indexes manually:

1. **Connect to your Supabase database**
2. **Run the SQL from `migrations/optimize_database_performance.sql`**
3. **Update table statistics:**
   ```sql
   ANALYZE students_master;
   ANALYZE student_academic_records;
   ANALYZE parent_student_mappings;
   ANALYZE users;
   ANALYZE class_divisions;
   ```

## Expected Performance Improvements

### Before Optimization

- Student list queries: 2-5 seconds
- Parent dashboard: 3-8 seconds
- Teacher class view: 5-10 seconds
- Search operations: 3-7 seconds

### After Optimization

- Student list queries: 0.1-0.5 seconds (10-50x faster)
- Parent dashboard: 0.2-1 second (5-20x faster)
- Teacher class view: 0.3-1.5 seconds (5-15x faster)
- Search operations: 0.1-0.8 seconds (3-10x faster)

## Monitoring and Maintenance

### Performance Monitoring Queries

#### Check Index Usage

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

#### Find Unused Indexes

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND idx_scan = 0
ORDER BY tablename, indexname;
```

#### Check Table Sizes

```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Regular Maintenance

#### Weekly Tasks

1. **Update statistics:**

   ```sql
   ANALYZE students_master;
   ANALYZE student_academic_records;
   ANALYZE parent_student_mappings;
   ANALYZE users;
   ```

2. **Monitor slow queries:**
   - Check application logs for queries taking > 1 second
   - Review index usage statistics
   - Identify unused indexes

#### Monthly Tasks

1. **Clean up unused indexes:**
   - Drop indexes with 0 scans for 30+ days
   - Review and optimize query patterns

2. **Performance review:**
   - Analyze query execution plans
   - Check for new optimization opportunities
   - Review table growth patterns

## Advanced Optimizations

### For 10,000+ Records

#### Partitioning Strategy

```sql
-- Partition students by academic year
CREATE TABLE students_master_2024 PARTITION OF students_master
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE students_master_2025 PARTITION OF students_master
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

#### Materialized Views

```sql
-- Cache frequently accessed data
CREATE MATERIALIZED VIEW mv_student_summary AS
SELECT
    s.id,
    s.full_name,
    s.admission_number,
    s.status,
    sar.class_division_id,
    cd.division,
    cl.name as class_level
FROM students_master s
JOIN student_academic_records sar ON s.id = sar.student_id
JOIN class_divisions cd ON sar.class_division_id = cd.id
JOIN class_levels cl ON cd.class_level_id = cl.id
WHERE sar.status = 'ongoing';

-- Refresh periodically
REFRESH MATERIALIZED VIEW mv_student_summary;
```

### For 100,000+ Records

#### Read Replicas

- Set up Supabase read replicas for heavy read operations
- Route analytics queries to replicas
- Keep write operations on primary database

#### Caching Strategy

```javascript
// Redis caching for frequently accessed data
const cacheKey = `student:${studentId}`;
const cachedData = await redis.get(cacheKey);
if (cachedData) {
  return JSON.parse(cachedData);
}

// Fetch from database and cache
const studentData = await fetchStudentFromDB(studentId);
await redis.setex(cacheKey, 3600, JSON.stringify(studentData)); // 1 hour TTL
```

## Troubleshooting

### Common Issues

#### Index Creation Fails

```bash
# Check if table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'students_master';

# Check existing indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'students_master';
```

#### Performance Not Improving

1. **Check if indexes are being used:**

   ```sql
   EXPLAIN ANALYZE SELECT * FROM students_master WHERE status = 'active';
   ```

2. **Verify statistics are up to date:**

   ```sql
   SELECT last_analyze FROM pg_stat_user_tables
   WHERE tablename = 'students_master';
   ```

3. **Check for query plan issues:**
   ```sql
   SET enable_seqscan = off;
   EXPLAIN ANALYZE your_query_here;
   ```

### Performance Monitoring Dashboard

Create a simple monitoring dashboard:

```javascript
// Performance monitoring endpoint
router.get(
  "/admin/performance",
  authenticate,
  authorize(["admin"]),
  async (req, res) => {
    const stats = await getDatabaseStats();
    res.json({
      status: "success",
      data: {
        table_sizes: stats.tableSizes,
        index_usage: stats.indexUsage,
        slow_queries: stats.slowQueries,
        recommendations: stats.recommendations,
      },
    });
  }
);
```

## Best Practices

### Query Optimization

1. **Use specific columns** instead of `SELECT *`
2. **Limit results** with `LIMIT` clause
3. **Use appropriate WHERE clauses** to leverage indexes
4. **Avoid subqueries** when possible, use JOINs instead

### Index Management

1. **Don't over-index** - too many indexes slow down writes
2. **Monitor index usage** regularly
3. **Drop unused indexes** to save space
4. **Use partial indexes** for filtered queries

### Application Level

1. **Implement pagination** for large result sets
2. **Use connection pooling** for database connections
3. **Cache frequently accessed data**
4. **Implement query timeouts** to prevent long-running queries

## Scaling Strategy

### Phase 1: Current (100-1,000 records)

- ✅ Basic indexes (implemented)
- ✅ Query optimization
- ✅ Monitoring setup

### Phase 2: Growth (1,000-10,000 records)

- 🔄 Partitioning strategy
- 🔄 Materialized views
- 🔄 Advanced caching

### Phase 3: Large Scale (10,000+ records)

- 🔄 Read replicas
- 🔄 Database sharding
- 🔄 Microservices architecture

## Conclusion

The database optimization strategy provides immediate performance improvements for current data volumes and a clear path for scaling as the application grows. Regular monitoring and maintenance ensure optimal performance over time.

### Key Takeaways

1. **Indexes are crucial** for query performance
2. **Monitor regularly** to identify bottlenecks
3. **Plan for growth** with scalable strategies
4. **Test thoroughly** before implementing changes

### Next Steps

1. Run the optimization script
2. Monitor performance improvements
3. Set up regular maintenance schedule
4. Plan for future scaling needs

---

_Last updated: [Current Date]_
_Version: 1.0_
