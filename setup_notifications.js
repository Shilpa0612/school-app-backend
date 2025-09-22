#!/usr/bin/env node

/**
 * Setup script for Parent Notifications System
 * This script helps set up the database schema and test the notification system
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { adminSupabase } from './src/config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Setting up Parent Notifications System...\n');

async function setupDatabase() {
    console.log('1. Setting up database schema...');

    try {
        // Read the SQL schema file
        const schemaPath = join(__dirname, 'parent_notifications_schema.sql');
        const schema = readFileSync(schemaPath, 'utf8');

        // Execute the schema
        const { error } = await adminSupabase.rpc('exec_sql', { sql: schema });

        if (error) {
            console.error('❌ Database setup failed:', error.message);
            return false;
        }

        console.log('✅ Database schema created successfully');
        return true;

    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        return false;
    }
}

async function verifySetup() {
    console.log('\n2. Verifying setup...');

    try {
        // Check if parent_notifications table exists
        const { data: tables, error } = await adminSupabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'parent_notifications');

        if (error) {
            console.error('❌ Error checking tables:', error.message);
            return false;
        }

        if (tables.length === 0) {
            console.error('❌ parent_notifications table not found');
            return false;
        }

        console.log('✅ parent_notifications table exists');

        // Check if notification service can be imported
        try {
            const { default: notificationService } = await import('./src/services/notificationService.js');
            console.log('✅ Notification service imported successfully');
        } catch (error) {
            console.error('❌ Error importing notification service:', error.message);
            return false;
        }

        // Check if WebSocket service can be imported
        try {
            const { default: websocketService } = await import('./src/services/websocketService.js');
            console.log('✅ WebSocket service imported successfully');
        } catch (error) {
            console.error('❌ Error importing WebSocket service:', error.message);
            return false;
        }

        return true;

    } catch (error) {
        console.error('❌ Error verifying setup:', error.message);
        return false;
    }
}

async function createSampleData() {
    console.log('\n3. Creating sample data...');

    try {
        // Check if we have any parents and students
        const { data: parents, error: parentError } = await adminSupabase
            .from('users')
            .select('id')
            .eq('role', 'parent')
            .limit(1);

        if (parentError || !parents.length) {
            console.log('⚠️  No parents found. Please create parent accounts first.');
            return false;
        }

        const { data: students, error: studentError } = await adminSupabase
            .from('students')
            .select('id')
            .limit(1);

        if (studentError || !students.length) {
            console.log('⚠️  No students found. Please create student accounts first.');
            return false;
        }

        // Check if we have parent-student mappings
        const { data: mappings, error: mappingError } = await adminSupabase
            .from('parent_student_mappings')
            .select('parent_id, student_id')
            .limit(1);

        if (mappingError || !mappings.length) {
            console.log('⚠️  No parent-student mappings found. Please create mappings first.');
            return false;
        }

        console.log('✅ Sample data verification passed');
        return true;

    } catch (error) {
        console.error('❌ Error checking sample data:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('\n4. Running notification system tests...');

    try {
        const { runTests } = await import('./test_notifications.js');
        await runTests();
        return true;
    } catch (error) {
        console.error('❌ Error running tests:', error.message);
        return false;
    }
}

async function main() {
    console.log('Parent Notifications System Setup');
    console.log('==================================\n');

    const steps = [
        { name: 'Database Setup', fn: setupDatabase },
        { name: 'Setup Verification', fn: verifySetup },
        { name: 'Sample Data Check', fn: createSampleData },
        { name: 'System Tests', fn: runTests }
    ];

    let allPassed = true;

    for (const step of steps) {
        const success = await step.fn();
        if (!success) {
            allPassed = false;
            break;
        }
    }

    console.log('\n' + '='.repeat(50));

    if (allPassed) {
        console.log('🎉 Setup completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Start your server: npm start');
        console.log('2. Connect parent clients to WebSocket');
        console.log('3. Create content to trigger notifications');
        console.log('4. Monitor notification delivery');
    } else {
        console.log('❌ Setup failed. Please check the errors above.');
        console.log('\nTroubleshooting:');
        console.log('1. Ensure your database is running');
        console.log('2. Check your Supabase configuration');
        console.log('3. Verify you have parent and student data');
        console.log('4. Check the logs for specific error messages');
    }

    console.log('\nFor more information, see PARENT_NOTIFICATIONS_SYSTEM.md');
}

// Run the setup
main().catch(console.error);
