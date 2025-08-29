// Performance test for calendar events endpoint
const fetch = require('node-fetch');

async function testCalendarPerformance() {
    const url = 'https://ajws-school-ba8ae5e3f955.herokuapp.com/api/calendar/events?use_ist=true';

    console.log('🚀 Testing Calendar Events Endpoint Performance...\n');

    // Test multiple times to get average
    const testCount = 5;
    const times = [];

    for (let i = 1; i <= testCount; i++) {
        console.log(`Test ${i}/${testCount}...`);

        const startTime = Date.now();

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer mock-token'
                }
            });

            const endTime = Date.now();
            const duration = endTime - startTime;
            times.push(duration);

            if (response.ok) {
                const data = await response.json();
                const eventCount = data.data?.events?.length || 0;
                console.log(`✅ Success: ${duration}ms (${eventCount} events)`);
            } else {
                console.log(`❌ Error: ${response.status} - ${duration}ms`);
            }

        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            times.push(duration);
            console.log(`❌ Network Error: ${duration}ms - ${error.message}`);
        }

        // Wait 1 second between tests
        if (i < testCount) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Calculate statistics
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log('\n📊 Performance Results:');
    console.log(`Average Time: ${avgTime.toFixed(0)}ms`);
    console.log(`Fastest Time: ${minTime}ms`);
    console.log(`Slowest Time: ${maxTime}ms`);

    // Performance assessment
    if (avgTime < 500) {
        console.log('🎉 EXCELLENT Performance! (< 500ms)');
    } else if (avgTime < 1000) {
        console.log('✅ GOOD Performance! (< 1s)');
    } else if (avgTime < 3000) {
        console.log('⚠️  SLOW Performance! (< 3s)');
    } else {
        console.log('❌ VERY SLOW Performance! (> 3s)');
    }

    console.log('\n💡 Recommendations:');
    if (avgTime > 1000) {
        console.log('1. Run the database optimizations SQL script');
        console.log('2. Check if database indexes are created');
        console.log('3. Monitor database query performance');
        console.log('4. Consider caching frequently accessed data');
    } else {
        console.log('1. Performance is good!');
        console.log('2. Consider applying database optimizations for even better performance');
    }
}

// Run the test
testCalendarPerformance().catch(console.error);
