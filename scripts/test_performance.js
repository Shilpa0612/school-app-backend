import { adminSupabase } from '../src/config/supabase.js';

// Performance test queries
const performanceTests = [
    {
        name: 'Student List Query',
        query: `
            SELECT id, full_name, admission_number, status 
            FROM students_master 
            WHERE status = 'active' 
            ORDER BY full_name 
            LIMIT 20
        `
    },
    {
        name: 'Parent-Child Relationships',
        query: `
            SELECT 
                p.id as parent_id,
                p.full_name as parent_name,
                s.id as student_id,
                s.full_name as student_name,
                psm.relationship
            FROM users p
            JOIN parent_student_mappings psm ON p.id = psm.parent_id
            JOIN students_master s ON psm.student_id = s.id
            WHERE p.role = 'parent'
            LIMIT 20
        `
    },
    {
        name: 'Teacher Class Students',
        query: `
            SELECT 
                s.id,
                s.full_name,
                s.admission_number,
                sar.roll_number,
                cd.division
            FROM students_master s
            JOIN student_academic_records sar ON s.id = sar.student_id
            JOIN class_divisions cd ON sar.class_division_id = cd.id
            WHERE sar.status = 'ongoing'
            ORDER BY cd.division, sar.roll_number
            LIMIT 20
        `
    },
    {
        name: 'Student Search',
        query: `
            SELECT id, full_name, admission_number
            FROM students_master
            WHERE full_name ILIKE '%john%' OR admission_number ILIKE '%john%'
            LIMIT 10
        `
    },
    {
        name: 'Academic Records with Class Info',
        query: `
            SELECT 
                s.full_name,
                sar.roll_number,
                cd.division,
                cl.name as class_level,
                ay.year_name
            FROM student_academic_records sar
            JOIN students_master s ON sar.student_id = s.id
            JOIN class_divisions cd ON sar.class_division_id = cd.id
            JOIN class_levels cl ON cd.class_level_id = cl.id
            JOIN academic_years ay ON cd.academic_year_id = ay.id
            WHERE sar.status = 'ongoing'
            LIMIT 20
        `
    }
];

async function testQueryPerformance(query, name) {
    const startTime = Date.now();

    try {
        const { data, error } = await adminSupabase.rpc('exec_sql', { sql_query: query });
        const endTime = Date.now();
        const duration = endTime - startTime;

        if (error) {
            return {
                name,
                success: false,
                duration: duration,
                error: error.message,
                resultCount: 0
            };
        }

        return {
            name,
            success: true,
            duration: duration,
            resultCount: data?.length || 0,
            error: null
        };
    } catch (err) {
        const endTime = Date.now();
        return {
            name,
            success: false,
            duration: endTime - startTime,
            error: err.message,
            resultCount: 0
        };
    }
}

async function runPerformanceTests() {
    console.log('🚀 Starting Database Performance Tests');
    console.log('=====================================\n');

    const results = [];
    let totalDuration = 0;
    let successCount = 0;

    for (const test of performanceTests) {
        console.log(`Testing: ${test.name}...`);
        const result = await testQueryPerformance(test.query, test.name);
        results.push(result);

        if (result.success) {
            successCount++;
            totalDuration += result.duration;
            console.log(`✅ ${result.name}: ${result.duration}ms (${result.resultCount} results)`);
        } else {
            console.log(`❌ ${result.name}: ${result.duration}ms - ${result.error}`);
        }
    }

    console.log('\n📊 Performance Test Summary');
    console.log('==========================');
    console.log(`Total tests: ${performanceTests.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${performanceTests.length - successCount}`);
    console.log(`Total duration: ${totalDuration}ms`);
    console.log(`Average duration: ${successCount > 0 ? Math.round(totalDuration / successCount) : 0}ms`);

    console.log('\n📈 Detailed Results:');
    console.log('===================');

    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        const duration = result.duration;
        const count = result.resultCount;
        const error = result.error ? ` - ${result.error}` : '';

        console.log(`${status} ${result.name}: ${duration}ms${result.success ? ` (${count} results)` : ''}${error}`);
    });

    // Performance recommendations
    console.log('\n💡 Performance Recommendations:');
    console.log('==============================');

    const slowQueries = results.filter(r => r.success && r.duration > 1000);
    if (slowQueries.length > 0) {
        console.log('⚠️  Slow queries detected (>1 second):');
        slowQueries.forEach(q => {
            console.log(`   - ${q.name}: ${q.duration}ms`);
        });
        console.log('\n🔧 Recommended actions:');
        console.log('   1. Run database optimization script');
        console.log('   2. Check for missing indexes');
        console.log('   3. Review query patterns');
    } else {
        console.log('✅ All queries are performing well (<1 second)');
    }

    const avgDuration = successCount > 0 ? totalDuration / successCount : 0;
    if (avgDuration > 500) {
        console.log('\n📈 Consider running optimization for better performance');
    } else if (avgDuration > 200) {
        console.log('\n📈 Performance is acceptable but could be improved');
    } else {
        console.log('\n🎉 Excellent performance!');
    }

    return results;
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runPerformanceTests().catch(console.error);
}

export { runPerformanceTests };

