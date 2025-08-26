const { adminSupabase } = require('./src/config/supabase.js');

// Performance monitoring utility
class PerformanceMonitor {
    constructor() {
        this.queries = [];
    }

    async monitorQuery(name, queryFn) {
        const startTime = Date.now();
        try {
            const result = await queryFn();
            const duration = Date.now() - startTime;

            this.queries.push({
                name,
                duration,
                success: true,
                timestamp: new Date().toISOString()
            });

            if (duration > 1000) {
                console.warn(`⚠️  Slow query detected: ${name} took ${duration}ms`);
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.queries.push({
                name,
                duration,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    getStats() {
        const successfulQueries = this.queries.filter(q => q.success);
        const failedQueries = this.queries.filter(q => !q.success);

        if (successfulQueries.length === 0) {
            return { message: 'No queries executed' };
        }

        const durations = successfulQueries.map(q => q.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);

        return {
            totalQueries: this.queries.length,
            successfulQueries: successfulQueries.length,
            failedQueries: failedQueries.length,
            averageDuration: Math.round(avgDuration),
            maxDuration,
            minDuration,
            slowQueries: successfulQueries.filter(q => q.duration > 1000).length
        };
    }

    printStats() {
        const stats = this.getStats();
        console.log('\n📊 Performance Statistics:');
        console.log('========================');
        console.log(`Total Queries: ${stats.totalQueries}`);
        console.log(`Successful: ${stats.successfulQueries}`);
        console.log(`Failed: ${stats.failedQueries}`);
        console.log(`Average Duration: ${stats.averageDuration}ms`);
        console.log(`Max Duration: ${stats.maxDuration}ms`);
        console.log(`Min Duration: ${stats.minDuration}ms`);
        console.log(`Slow Queries (>1s): ${stats.slowQueries}`);

        if (stats.slowQueries > 0) {
            console.log('\n🐌 Slow Queries:');
            this.queries
                .filter(q => q.success && q.duration > 1000)
                .forEach(q => {
                    console.log(`  - ${q.name}: ${q.duration}ms`);
                });
        }
    }
}

// Test login performance
async function testLoginPerformance() {
    const monitor = new PerformanceMonitor();

    console.log('🔍 Testing Login Performance...');

    try {
        // Test user lookup by phone number
        await monitor.monitorQuery('User Lookup by Phone', async () => {
            const { data, error } = await adminSupabase
                .from('users')
                .select('id, phone_number, password_hash, role, full_name, email, preferred_language')
                .eq('phone_number', '1234567890')
                .eq('is_registered', true)
                .single();

            if (error) throw error;
            return data;
        });

        // Test multiple user lookups
        for (let i = 0; i < 5; i++) {
            await monitor.monitorQuery(`User Lookup ${i + 1}`, async () => {
                const { data, error } = await adminSupabase
                    .from('users')
                    .select('id, phone_number, role, full_name')
                    .eq('phone_number', `123456789${i}`)
                    .single();

                if (error) throw error;
                return data;
            });
        }

        // Test children/teachers endpoint performance
        await monitor.monitorQuery('Children Teachers Query', async () => {
            const { data, error } = await adminSupabase
                .from('parent_student_mappings')
                .select('student_id')
                .eq('parent_id', 'test-parent-id');

            if (error) throw error;
            return data;
        });

        monitor.printStats();

    } catch (error) {
        console.error('❌ Performance test failed:', error.message);
        monitor.printStats();
    }
}

// Test database connection and basic queries
async function testDatabaseConnection() {
    console.log('🔌 Testing Database Connection...');

    try {
        const startTime = Date.now();
        const { data, error } = await adminSupabase
            .from('users')
            .select('count')
            .limit(1);

        const duration = Date.now() - startTime;

        if (error) {
            console.error('❌ Database connection failed:', error.message);
            return false;
        }

        console.log(`✅ Database connection successful (${duration}ms)`);
        return true;

    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        return false;
    }
}

// Main function
async function main() {
    console.log('🚀 Starting Performance Monitor...\n');

    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.log('❌ Cannot proceed without database connection');
        return;
    }

    await testLoginPerformance();
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { PerformanceMonitor, testLoginPerformance, testDatabaseConnection };
