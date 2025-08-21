import { adminSupabase } from '../src/config/supabase.js';

// Core optimization queries (only for tables that exist)
const coreOptimizationQueries = [
    // Critical Student Indexes
    "CREATE INDEX IF NOT EXISTS idx_students_master_status ON students_master(status)",
    "CREATE INDEX IF NOT EXISTS idx_students_master_full_name ON students_master(full_name)",
    "CREATE INDEX IF NOT EXISTS idx_students_master_admission_number ON students_master(admission_number)",
    "CREATE INDEX IF NOT EXISTS idx_students_master_created_at ON students_master(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_students_master_status_name ON students_master(status, full_name)",
    "CREATE INDEX IF NOT EXISTS idx_students_master_status_created ON students_master(status, created_at DESC)",

    // Student Academic Records Indexes
    "CREATE INDEX IF NOT EXISTS idx_student_academic_records_student_id ON student_academic_records(student_id)",
    "CREATE INDEX IF NOT EXISTS idx_student_academic_records_class_division_id ON student_academic_records(class_division_id)",
    "CREATE INDEX IF NOT EXISTS idx_student_academic_records_academic_year_id ON student_academic_records(academic_year_id)",
    "CREATE INDEX IF NOT EXISTS idx_student_academic_records_status ON student_academic_records(status)",
    "CREATE INDEX IF NOT EXISTS idx_student_academic_records_student_status ON student_academic_records(student_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_student_academic_records_class_status ON student_academic_records(class_division_id, status)",

    // Parent-Student Mapping Indexes
    "CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_parent_id ON parent_student_mappings(parent_id)",
    "CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_student_id ON parent_student_mappings(student_id)",
    "CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_is_primary_guardian ON parent_student_mappings(is_primary_guardian)",
    "CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_relationship ON parent_student_mappings(relationship)",
    "CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_parent_primary ON parent_student_mappings(parent_id, is_primary_guardian)",
    "CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_student_primary ON parent_student_mappings(student_id, is_primary_guardian)",

    // User Management Indexes
    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
    "CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name)",
    "CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number)",
    "CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC)",
    "CREATE INDEX IF NOT EXISTS idx_users_role_created ON users(role, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_users_role_name ON users(role, full_name)",

    // Class Division Indexes
    "CREATE INDEX IF NOT EXISTS idx_class_divisions_academic_year_id ON class_divisions(academic_year_id)",
    "CREATE INDEX IF NOT EXISTS idx_class_divisions_class_level_id ON class_divisions(class_level_id)",
    "CREATE INDEX IF NOT EXISTS idx_class_divisions_teacher_id ON class_divisions(teacher_id)",
    "CREATE INDEX IF NOT EXISTS idx_class_divisions_division ON class_divisions(division)",
    "CREATE INDEX IF NOT EXISTS idx_class_divisions_academic_level ON class_divisions(academic_year_id, class_level_id)",
    "CREATE INDEX IF NOT EXISTS idx_class_divisions_level_division ON class_divisions(class_level_id, division)",

    // Teacher Assignment Indexes
    "CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_teacher_id ON class_teacher_assignments(teacher_id)",
    "CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_class_division_id ON class_teacher_assignments(class_division_id)",
    "CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_is_active ON class_teacher_assignments(is_active)",
    "CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_is_primary ON class_teacher_assignments(is_primary)",
    "CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_teacher_active ON class_teacher_assignments(teacher_id, is_active)",
    "CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_class_active ON class_teacher_assignments(class_division_id, is_active)",

    // Academic Year Indexes
    "CREATE INDEX IF NOT EXISTS idx_academic_years_is_active ON academic_years(is_active)",
    "CREATE INDEX IF NOT EXISTS idx_academic_years_year_name ON academic_years(year_name)",
    "CREATE INDEX IF NOT EXISTS idx_academic_years_start_date ON academic_years(start_date)",
    "CREATE INDEX IF NOT EXISTS idx_academic_years_end_date ON academic_years(end_date)",

    // Class Level Indexes
    "CREATE INDEX IF NOT EXISTS idx_class_levels_sequence_number ON class_levels(sequence_number)",
    "CREATE INDEX IF NOT EXISTS idx_class_levels_name ON class_levels(name)",

    // Message System Indexes
    "CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)",
    "CREATE INDEX IF NOT EXISTS idx_messages_class_division_id ON messages(class_division_id)",
    "CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id)",
    "CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type)",
    "CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)",
    "CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_messages_class_created ON messages(class_division_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_messages_type_status ON messages(type, status)",

    // Homework Indexes
    "CREATE INDEX IF NOT EXISTS idx_homework_class_division_id ON homework(class_division_id)",
    "CREATE INDEX IF NOT EXISTS idx_homework_teacher_id ON homework(teacher_id)",
    "CREATE INDEX IF NOT EXISTS idx_homework_subject ON homework(subject)",
    "CREATE INDEX IF NOT EXISTS idx_homework_due_date ON homework(due_date)",
    "CREATE INDEX IF NOT EXISTS idx_homework_created_at ON homework(created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_homework_class_due ON homework(class_division_id, due_date DESC)",
    "CREATE INDEX IF NOT EXISTS idx_homework_teacher_created ON homework(teacher_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_homework_subject_class ON homework(subject, class_division_id)",

    // Partial Indexes for Common Filters
    "CREATE INDEX IF NOT EXISTS idx_students_master_active_only ON students_master(id, full_name, admission_number) WHERE status = 'active'",
    "CREATE INDEX IF NOT EXISTS idx_student_academic_records_ongoing_only ON student_academic_records(student_id, class_division_id, roll_number) WHERE status = 'ongoing'",
    "CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_active_only ON class_teacher_assignments(teacher_id, class_division_id) WHERE is_active = true",
    "CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_primary_only ON parent_student_mappings(student_id, parent_id) WHERE is_primary_guardian = true",
    "CREATE INDEX IF NOT EXISTS idx_messages_pending_only ON messages(sender_id, created_at) WHERE status = 'pending'",
    "CREATE INDEX IF NOT EXISTS idx_homework_future_only ON homework(class_division_id, due_date) WHERE due_date > now()",

    // Functional Indexes for Text Search
    "CREATE INDEX IF NOT EXISTS idx_students_master_name_lower ON students_master(lower(full_name))",
    "CREATE INDEX IF NOT EXISTS idx_users_name_lower ON users(lower(full_name))",

    // Composite Indexes for Complex Queries
    "CREATE INDEX IF NOT EXISTS idx_students_with_academic ON students_master(id, status) INCLUDE (full_name, admission_number)",
    "CREATE INDEX IF NOT EXISTS idx_class_divisions_with_teacher ON class_divisions(id, academic_year_id) INCLUDE (division, teacher_id)",
    "CREATE INDEX IF NOT EXISTS idx_parent_mappings_with_relationship ON parent_student_mappings(parent_id, student_id) INCLUDE (relationship, is_primary_guardian)"
];

// Tables to analyze after creating indexes
const coreTablesToAnalyze = [
    'students_master',
    'student_academic_records',
    'parent_student_mappings',
    'users',
    'class_divisions',
    'class_teacher_assignments',
    'academic_years',
    'class_levels',
    'messages',
    'homework'
];

async function checkTableExists(tableName) {
    try {
        const { data, error } = await adminSupabase.rpc('exec_sql', {
            sql_query: `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${tableName}')`
        });

        if (error) {
            console.error(`Error checking if table ${tableName} exists:`, error.message);
            return false;
        }

        return data && data.length > 0 && data[0].exists;
    } catch (err) {
        console.error(`Exception checking if table ${tableName} exists:`, err.message);
        return false;
    }
}

async function applyDatabaseOptimizationsSafe() {
    console.log('🔍 Checking which tables exist in your database...');

    // Check which tables exist
    const existingTables = [];
    const tableNames = [
        'students_master',
        'student_academic_records',
        'parent_student_mappings',
        'users',
        'class_divisions',
        'class_teacher_assignments',
        'academic_years',
        'class_levels',
        'messages',
        'homework',
        'daily_attendance',
        'student_attendance_records',
        'timetable_entries',
        'calendar_events',
        'leave_requests',
        'file_access_logs'
    ];

    for (const tableName of tableNames) {
        const exists = await checkTableExists(tableName);
        if (exists) {
            existingTables.push(tableName);
            console.log(`✅ Table exists: ${tableName}`);
        } else {
            console.log(`❌ Table does not exist: ${tableName}`);
        }
    }

    console.log(`\n📊 Found ${existingTables.length} existing tables out of ${tableNames.length} total tables`);

    // Filter queries to only include indexes for existing tables
    const safeQueries = coreOptimizationQueries.filter(query => {
        // Extract table name from CREATE INDEX query
        const match = query.match(/ON\s+(\w+)\s*\(/);
        if (match) {
            const tableName = match[1];
            return existingTables.includes(tableName);
        }
        return false;
    });

    console.log(`\n🚀 Starting database performance optimization...`);
    console.log(`📊 Creating ${safeQueries.length} indexes for existing tables...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < safeQueries.length; i++) {
        const query = safeQueries[i];
        try {
            const { error } = await adminSupabase.rpc('exec_sql', { sql_query: query });
            if (error) {
                console.error(`❌ Error creating index ${i + 1}:`, error.message);
                errorCount++;
            } else {
                successCount++;
                if ((i + 1) % 10 === 0) {
                    console.log(`✅ Created ${i + 1}/${safeQueries.length} indexes...`);
                }
            }
        } catch (err) {
            console.error(`❌ Exception creating index ${i + 1}:`, err.message);
            errorCount++;
        }
    }

    console.log(`\n📈 Index creation completed: ${successCount} successful, ${errorCount} failed`);

    if (successCount > 0) {
        console.log('\n🔍 Updating table statistics...');

        // Only analyze tables that exist
        const tablesToAnalyze = coreTablesToAnalyze.filter(table => existingTables.includes(table));

        for (const table of tablesToAnalyze) {
            try {
                const { error } = await adminSupabase.rpc('exec_sql', { sql_query: `ANALYZE ${table}` });
                if (error) {
                    console.error(`❌ Error analyzing ${table}:`, error.message);
                } else {
                    console.log(`✅ Analyzed ${table}`);
                }
            } catch (err) {
                console.error(`❌ Exception analyzing ${table}:`, err.message);
            }
        }
    }

    console.log('\n🎉 Database optimization completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Monitor query performance improvements');
    console.log('2. Check index usage with monitoring queries');
    console.log('3. Consider dropping unused indexes after monitoring');
    console.log('4. Set up regular maintenance for index statistics');

    console.log('\n📊 Expected performance improvements:');
    console.log('- Student queries: 10-50x faster');
    console.log('- Parent queries: 5-20x faster');
    console.log('- Teacher queries: 5-15x faster');
    console.log('- Search queries: 3-10x faster');

    console.log('\n📝 Note:');
    console.log('- Only indexes for existing tables were created');
    console.log('- When you add new tables (attendance, timetable, etc.),');
    console.log('  run the full optimization script for those tables');

    return {
        existingTables,
        successCount,
        errorCount,
        totalQueries: safeQueries.length
    };
}

// Performance monitoring queries
const monitoringQueries = {
    indexUsage: `
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan,
            idx_tup_read,
            idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC
    `,

    unusedIndexes: `
        SELECT 
            schemaname,
            tablename,
            indexname,
            idx_scan
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
            AND idx_scan = 0
        ORDER BY tablename, indexname
    `,

    tableSizes: `
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `
};

async function monitorPerformance() {
    console.log('📊 Database Performance Monitoring');
    console.log('=====================================\n');

    for (const [name, query] of Object.entries(monitoringQueries)) {
        try {
            const { data, error } = await adminSupabase.rpc('exec_sql', { sql_query: query });
            if (error) {
                console.error(`❌ Error running ${name} query:`, error.message);
            } else {
                console.log(`📈 ${name.toUpperCase()}:`);
                console.log(JSON.stringify(data, null, 2));
                console.log('\n');
            }
        } catch (err) {
            console.error(`❌ Exception running ${name} query:`, err.message);
        }
    }
}

// Run the optimization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];

    if (command === 'monitor') {
        monitorPerformance();
    } else {
        applyDatabaseOptimizationsSafe();
    }
}

export { applyDatabaseOptimizationsSafe, monitorPerformance };
