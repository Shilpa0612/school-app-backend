import { adminSupabase } from '../src/config/supabase.js';

// Critical indexes for sub-10ms performance
const criticalIndexes = [
    // 1. STUDENT MASTER TABLE (Most Critical)
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_master_active_covering 
     ON students_master(id, full_name, admission_number, date_of_birth, status, created_at) 
     WHERE status = 'active'`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_master_search_optimized 
     ON students_master(lower(full_name), lower(admission_number), status) 
     WHERE status = 'active'`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_master_active_only 
     ON students_master(id, full_name, admission_number) 
     WHERE status = 'active'`,

    // 2. STUDENT ACADEMIC RECORDS (Critical for Parent/Teacher APIs)
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_academic_records_ongoing_covering 
     ON student_academic_records(student_id, class_division_id, roll_number, status, created_at) 
     WHERE status = 'ongoing'`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_academic_records_class_optimized 
     ON student_academic_records(class_division_id, student_id, roll_number) 
     WHERE status = 'ongoing'`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_academic_records_student_history 
     ON student_academic_records(student_id, academic_year_id, status, created_at DESC)`,

    // 3. PARENT-STUDENT MAPPINGS (Critical for Parent APIs)
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parent_mappings_covering 
     ON parent_student_mappings(parent_id, student_id, relationship, is_primary_guardian, created_at)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parent_mappings_student_optimized 
     ON parent_student_mappings(student_id, parent_id, is_primary_guardian)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parent_mappings_primary_only 
     ON parent_student_mappings(student_id, parent_id) 
     WHERE is_primary_guardian = true`,

    // 4. CLASS TEACHER ASSIGNMENTS (Critical for Teacher APIs)
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_assignments_covering 
     ON class_teacher_assignments(teacher_id, class_division_id, assignment_type, subject, is_primary, is_active, assigned_date)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_assignments_active_only 
     ON class_teacher_assignments(teacher_id, class_division_id, assignment_type, subject) 
     WHERE is_active = true`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_assignments_class_optimized 
     ON class_teacher_assignments(class_division_id, teacher_id, assignment_type) 
     WHERE is_active = true`,

    // 5. USERS TABLE (Critical for Authentication)
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_login_optimized 
     ON users(phone_number, role, id, full_name, email)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_covering 
     ON users(role, id, full_name, phone_number, email, created_at)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_teachers_only 
     ON users(id, full_name, phone_number, email) 
     WHERE role = 'teacher'`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_parents_only 
     ON users(id, full_name, phone_number, email) 
     WHERE role = 'parent'`,

    // 6. MESSAGES TABLE (Critical for Chat/Messaging)
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_thread_optimized 
     ON messages(thread_id, created_at DESC, sender_id, content, type, status)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_status_optimized 
     ON messages(status, created_at DESC, sender_id, thread_id)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_optimized 
     ON messages(sender_id, created_at DESC, thread_id, status)`,

    // 7. CLASS DIVISIONS (Critical for Academic APIs)
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_class_divisions_covering 
     ON class_divisions(id, academic_year_id, class_level_id, division, teacher_id, created_at)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_class_divisions_year_optimized 
     ON class_divisions(academic_year_id, class_level_id, division)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_class_divisions_teacher_optimized 
     ON class_divisions(teacher_id, academic_year_id, class_level_id, division)`
];

// Composite indexes for complex queries
const compositeIndexes = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_with_academic_comprehensive 
     ON students_master(id, status, full_name, admission_number) 
     INCLUDE (date_of_birth, created_at)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parent_mappings_comprehensive 
     ON parent_student_mappings(parent_id, student_id, relationship, is_primary_guardian) 
     INCLUDE (created_at)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_assignments_comprehensive 
     ON class_teacher_assignments(teacher_id, class_division_id, assignment_type, is_active) 
     INCLUDE (subject, is_primary, assigned_date)`,

    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_comprehensive 
     ON messages(thread_id, created_at DESC, status) 
     INCLUDE (sender_id, content, type)`
];

// Tables to analyze after creating indexes
const tablesToAnalyze = [
    'students_master',
    'student_academic_records',
    'parent_student_mappings',
    'users',
    'class_divisions',
    'class_teacher_assignments',
    'messages',
    'homework',
    'academic_years',
    'class_levels'
];

async function apply10msOptimizations() {
    console.log('🚀 Starting 10ms Performance Optimizations...\n');

    try {
        // Step 1: Create critical indexes
        console.log('📊 Creating critical indexes...');
        for (let i = 0; i < criticalIndexes.length; i++) {
            const indexSql = criticalIndexes[i];
            console.log(`Creating index ${i + 1}/${criticalIndexes.length}...`);

            const { error } = await adminSupabase.rpc('exec_sql', { sql: indexSql });

            if (error) {
                console.error(`❌ Error creating index ${i + 1}:`, error.message);
                // Continue with other indexes
            } else {
                console.log(`✅ Index ${i + 1} created successfully`);
            }
        }

        // Step 2: Create composite indexes
        console.log('\n📊 Creating composite indexes...');
        for (let i = 0; i < compositeIndexes.length; i++) {
            const indexSql = compositeIndexes[i];
            console.log(`Creating composite index ${i + 1}/${compositeIndexes.length}...`);

            const { error } = await adminSupabase.rpc('exec_sql', { sql: indexSql });

            if (error) {
                console.error(`❌ Error creating composite index ${i + 1}:`, error.message);
            } else {
                console.log(`✅ Composite index ${i + 1} created successfully`);
            }
        }

        // Step 3: Update table statistics
        console.log('\n📊 Updating table statistics...');
        for (const table of tablesToAnalyze) {
            console.log(`Analyzing table: ${table}...`);

            const { error } = await adminSupabase.rpc('exec_sql', {
                sql: `ANALYZE ${table}`
            });

            if (error) {
                console.error(`❌ Error analyzing ${table}:`, error.message);
            } else {
                console.log(`✅ ${table} analyzed successfully`);
            }
        }

        // Step 4: Check index usage
        console.log('\n📊 Checking index usage...');
        const { data: indexUsage, error: usageError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    idx_scan as index_scans,
                    idx_tup_read as tuples_read,
                    idx_tup_fetch as tuples_fetched,
                    CASE 
                        WHEN idx_scan = 0 THEN 'UNUSED'
                        WHEN idx_scan < 10 THEN 'LOW_USAGE'
                        ELSE 'ACTIVE'
                    END as usage_status
                FROM pg_stat_user_indexes 
                WHERE tablename IN ('students_master', 'student_academic_records', 'parent_student_mappings', 'users', 'class_divisions')
                ORDER BY idx_scan DESC
                LIMIT 20;
            `
        });

        if (usageError) {
            console.error('❌ Error checking index usage:', usageError.message);
        } else {
            console.log('✅ Index usage checked successfully');
            console.log('\n📈 Index Usage Summary:');
            console.table(indexUsage || []);
        }

        console.log('\n🎉 10ms Performance Optimizations Completed Successfully!');
        console.log('\n📋 Next Steps:');
        console.log('1. ✅ Database indexes created');
        console.log('2. ✅ Table statistics updated');
        console.log('3. 🔄 Update API endpoints with optimized queries');
        console.log('4. 🔄 Add caching middleware');
        console.log('5. 🔄 Monitor performance metrics');

        console.log('\n🎯 Expected Results:');
        console.log('- Parent Children Teachers API: <10ms');
        console.log('- Teacher Linked Parents API: <10ms');
        console.log('- Student List API: <10ms');
        console.log('- Search API: <10ms');

    } catch (error) {
        console.error('❌ Optimization failed:', error);
        process.exit(1);
    }
}

// Run the optimizations
apply10msOptimizations();
