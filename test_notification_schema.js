#!/usr/bin/env node

/**
 * Test Notification Schema Setup
 * This script tests if the notification schema can be created successfully
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 Testing Parent Notifications Schema...\n');

async function testSchemaCreation() {
    try {
        // Read the simple schema file
        const schemaSQL = fs.readFileSync('parent_notifications_simple.sql', 'utf8');

        console.log('1. Creating parent_notifications table...');

        // Execute the schema creation
        const { data, error } = await supabase.rpc('exec_sql', { sql: schemaSQL });

        if (error) {
            console.log('❌ Error creating schema:', error.message);
            return false;
        }

        console.log('✅ Parent notifications table created successfully');

        // Test if table exists
        console.log('\n2. Verifying table exists...');
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'parent_notifications');

        if (tableError) {
            console.log('❌ Error checking table:', tableError.message);
            return false;
        }

        if (tables && tables.length > 0) {
            console.log('✅ parent_notifications table exists');
        } else {
            console.log('❌ parent_notifications table not found');
            return false;
        }

        // Test inserting sample data
        console.log('\n3. Testing sample data insertion...');
        const { data: insertData, error: insertError } = await supabase
            .from('parent_notifications')
            .insert({
                parent_id: '00000000-0000-0000-0000-000000000000', // Fake UUID
                student_id: '00000000-0000-0000-0000-000000000000', // Fake UUID
                type: 'system',
                title: 'Test Notification',
                message: 'This is a test notification',
                priority: 'normal',
                data: { test: true }
            });

        if (insertError) {
            console.log('❌ Error inserting test data:', insertError.message);
            return false;
        }

        console.log('✅ Sample data inserted successfully');

        // Test querying the data
        console.log('\n4. Testing data retrieval...');
        const { data: queryData, error: queryError } = await supabase
            .from('parent_notifications')
            .select('*')
            .limit(1);

        if (queryError) {
            console.log('❌ Error querying data:', queryError.message);
            return false;
        }

        console.log('✅ Data retrieval successful');
        console.log('📊 Sample record:', queryData[0]);

        // Clean up test data
        console.log('\n5. Cleaning up test data...');
        const { error: deleteError } = await supabase
            .from('parent_notifications')
            .delete()
            .eq('title', 'Test Notification');

        if (deleteError) {
            console.log('❌ Error cleaning up:', deleteError.message);
            return false;
        }

        console.log('✅ Test data cleaned up successfully');

        return true;

    } catch (error) {
        console.log('❌ Unexpected error:', error.message);
        return false;
    }
}

async function main() {
    const success = await testSchemaCreation();

    if (success) {
        console.log('\n🎉 Parent Notifications Schema Test PASSED!');
        console.log('\n📋 Next Steps:');
        console.log('1. Start your server: npm start');
        console.log('2. Test notification endpoints');
        console.log('3. Test with real mobile devices');
    } else {
        console.log('\n❌ Parent Notifications Schema Test FAILED!');
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check your database connection');
        console.log('2. Verify table dependencies exist');
        console.log('3. Check Supabase permissions');
    }
}

main().catch(console.error);
