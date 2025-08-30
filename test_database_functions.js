const { createClient } = require('@supabase/supabase-js');

// You'll need to add your Supabase credentials here
const supabaseUrl = process.env.SUPABASE_URL || 'your_supabase_url';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_service_role_key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabaseFunctions() {
    console.log('🔍 Testing database functions directly...\n');

    try {
        // Test 1: Check if the function exists
        console.log('1. Checking if get_optimized_calendar_events function exists...');
        const { data: functions, error: funcError } = await supabase
            .from('information_schema.routines')
            .select('routine_name, routine_type')
            .eq('routine_name', 'get_optimized_calendar_events');

        if (funcError) {
            console.log('   ❌ Error checking functions:', funcError);
        } else {
            console.log('   ✅ Functions found:', functions);
        }

        // Test 2: Check if the view exists
        console.log('\n2. Checking if optimized_calendar_events view exists...');
        const { data: views, error: viewError } = await supabase
            .from('information_schema.views')
            .select('table_name')
            .eq('table_name', 'optimized_calendar_events');

        if (viewError) {
            console.log('   ❌ Error checking views:', viewError);
        } else {
            console.log('   ✅ Views found:', views);
        }

        // Test 3: Try to call the function directly
        console.log('\n3. Testing function call directly...');
        try {
            const result = await supabase.rpc('get_optimized_calendar_events', {
                p_start_date: null,
                p_end_date: null,
                p_event_type: null,
                p_event_category: null,
                p_status: null,
                p_class_division_id: null,
                p_user_role: 'teacher',
                p_user_id: 'af68c9d4-7825-476f-9f3d-7863339442dd'
            });

            if (result.error) {
                console.log('   ❌ Function call failed:', result.error);
            } else {
                console.log('   ✅ Function call successful');
                console.log('   📊 Data returned:', result.data?.length || 0, 'records');
            }
        } catch (rpcError) {
            console.log('   ❌ RPC call failed:', rpcError.message);
        }

        // Test 4: Check the view data directly
        console.log('\n4. Testing view data directly...');
        try {
            const { data: viewData, error: viewDataError } = await supabase
                .from('optimized_calendar_events')
                .select('*')
                .limit(5);

            if (viewDataError) {
                console.log('   ❌ View query failed:', viewDataError);
            } else {
                console.log('   ✅ View query successful');
                console.log('   📊 View data:', viewData?.length || 0, 'records');
            }
        } catch (viewQueryError) {
            console.log('   ❌ View query error:', viewQueryError.message);
        }

        // Test 5: Check regular calendar_events table
        console.log('\n5. Testing regular calendar_events table...');
        try {
            const { data: regularData, error: regularError } = await supabase
                .from('calendar_events')
                .select('*')
                .limit(5);

            if (regularError) {
                console.log('   ❌ Regular table query failed:', regularError);
            } else {
                console.log('   ✅ Regular table query successful');
                console.log('   📊 Regular table data:', regularData?.length || 0, 'records');
            }
        } catch (regularQueryError) {
            console.log('   ❌ Regular table query error:', regularQueryError.message);
        }

    } catch (error) {
        console.error('❌ Overall error:', error.message);
    }

    console.log('\n🎯 Database function tests completed!');
}

// Check if credentials are provided
if (supabaseUrl === 'your_supabase_url' || supabaseKey === 'your_service_role_key') {
    console.log('❌ Please set your Supabase credentials:');
    console.log('   SUPABASE_URL=your_url');
    console.log('   SUPABASE_SERVICE_ROLE_KEY=your_key');
    console.log('\nOr modify this file with your credentials.');
} else {
    testDatabaseFunctions().catch(console.error);
}
