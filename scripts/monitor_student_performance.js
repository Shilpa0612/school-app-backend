import { adminSupabase } from '../src/config/supabase.js';

// Performance monitoring script for student APIs
async function monitorStudentPerformance() {
    console.log('🔍 Student API Performance Monitor');
    console.log('=====================================\n');

    try {
        // 1. Check index usage
        console.log('📊 Index Usage Statistics:');
        const { data: indexStats, error: indexError } = await adminSupabase
            .rpc('get_index_usage_stats');

        if (indexError) {
            console.log('❌ Could not fetch index stats:', indexError.message);
        } else {
            console.table(indexStats);
        }

        // 2. Test student list query performance
        console.log('\n⚡ Testing Student List Query Performance:');
        const startTime = Date.now();

        const { data: students, error: studentsError } = await adminSupabase
            .from('students_master')
            .select(`
                id,
                full_name,
                admission_number,
                status,
                student_academic_records(
                    class_division:class_division_id(
                        division,
                        level:class_level_id(name)
                    )
                ),
                parent_student_mappings(
                    parent:parent_id(full_name)
                )
            `)
            .eq('status', 'active')
            .limit(20);

        const endTime = Date.now();
        const queryTime = endTime - startTime;

        if (studentsError) {
            console.log('❌ Student query failed:', studentsError.message);
        } else {
            console.log(`✅ Student list query: ${queryTime}ms (${students.length} students)`);
            console.log(`📈 Performance: ${queryTime < 100 ? 'Excellent' : queryTime < 500 ? 'Good' : 'Needs improvement'}`);
        }

        // 3. Test parent dashboard query performance
        console.log('\n👨‍👩‍👧‍👦 Testing Parent Dashboard Query Performance:');
        const parentStartTime = Date.now();

        const { data: parentMappings, error: parentError } = await adminSupabase
            .from('parent_student_mappings')
            .select(`
                student:student_id(
                    id,
                    full_name,
                    admission_number,
                    student_academic_records!inner(
                        class_division:class_division_id(
                            division,
                            level:class_level_id(name)
                        )
                    )
                )
            `)
            .limit(10);

        const parentEndTime = Date.now();
        const parentQueryTime = parentEndTime - parentStartTime;

        if (parentError) {
            console.log('❌ Parent query failed:', parentError.message);
        } else {
            console.log(`✅ Parent dashboard query: ${parentQueryTime}ms (${parentMappings.length} mappings)`);
            console.log(`📈 Performance: ${parentQueryTime < 100 ? 'Excellent' : parentQueryTime < 500 ? 'Good' : 'Needs improvement'}`);
        }

        // 4. Test search performance
        console.log('\n🔍 Testing Search Performance:');
        const searchStartTime = Date.now();

        const { data: searchResults, error: searchError } = await adminSupabase
            .from('students_master')
            .select('id, full_name, admission_number')
            .or('full_name.ilike.%john%,admission_number.ilike.%ADM%')
            .eq('status', 'active')
            .limit(10);

        const searchEndTime = Date.now();
        const searchQueryTime = searchEndTime - searchStartTime;

        if (searchError) {
            console.log('❌ Search query failed:', searchError.message);
        } else {
            console.log(`✅ Search query: ${searchQueryTime}ms (${searchResults.length} results)`);
            console.log(`📈 Performance: ${searchQueryTime < 100 ? 'Excellent' : searchQueryTime < 500 ? 'Good' : 'Needs improvement'}`);
        }

        // 5. Check table statistics
        console.log('\n📋 Table Statistics:');
        const { data: tableStats, error: tableError } = await adminSupabase
            .rpc('get_table_stats', { table_names: ['students_master', 'parent_student_mappings', 'student_academic_records'] });

        if (tableError) {
            console.log('❌ Could not fetch table stats:', tableError.message);
        } else {
            console.table(tableStats);
        }

        // 6. Performance recommendations
        console.log('\n💡 Performance Recommendations:');

        if (queryTime > 500) {
            console.log('⚠️  Student list query is slow. Consider:');
            console.log('   - Adding covering indexes');
            console.log('   - Implementing database-level pagination');
            console.log('   - Reducing nested queries');
        }

        if (parentQueryTime > 500) {
            console.log('⚠️  Parent dashboard query is slow. Consider:');
            console.log('   - Adding composite indexes on parent_student_mappings');
            console.log('   - Using batch queries for related data');
            console.log('   - Implementing caching for frequently accessed data');
        }

        if (searchQueryTime > 300) {
            console.log('⚠️  Search query is slow. Consider:');
            console.log('   - Adding full-text search indexes');
            console.log('   - Using case-insensitive indexes');
            console.log('   - Implementing search optimization');
        }

        // 7. Overall performance score
        const avgQueryTime = (queryTime + parentQueryTime + searchQueryTime) / 3;
        let performanceScore = 'A';
        if (avgQueryTime > 1000) performanceScore = 'D';
        else if (avgQueryTime > 500) performanceScore = 'C';
        else if (avgQueryTime > 200) performanceScore = 'B';

        console.log(`\n🎯 Overall Performance Score: ${performanceScore}`);
        console.log(`📊 Average Query Time: ${avgQueryTime.toFixed(2)}ms`);

        if (performanceScore === 'A') {
            console.log('🎉 Excellent performance! Your optimizations are working well.');
        } else if (performanceScore === 'B') {
            console.log('👍 Good performance. Consider minor optimizations for better results.');
        } else {
            console.log('🚨 Performance needs improvement. Run the optimization scripts.');
        }

    } catch (error) {
        console.error('❌ Performance monitoring failed:', error);
    }
}

// Run the monitoring
if (import.meta.url === `file://${process.argv[1]}`) {
    monitorStudentPerformance()
        .then(() => {
            console.log('\n✅ Performance monitoring completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Monitoring failed:', error);
            process.exit(1);
        });
}

export { monitorStudentPerformance };
