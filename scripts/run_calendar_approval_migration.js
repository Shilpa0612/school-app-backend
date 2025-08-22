import { adminSupabase } from '../src/config/supabase.js';
import fs from 'fs';
import path from 'path';

async function runCalendarApprovalMigration() {
    try {
        console.log('Starting calendar approval migration...');
        
        // Read the migration file
        const migrationPath = path.join(process.cwd(), 'migrations', 'add_approval_to_calendar_events.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Migration SQL loaded successfully');
        
        // Execute the migration
        const { error } = await adminSupabase.rpc('exec_sql', {
            sql: migrationSQL
        });
        
        if (error) {
            console.error('Migration failed:', error);
            throw error;
        }
        
        console.log('✅ Calendar approval migration completed successfully!');
        console.log('New fields added:');
        console.log('- status (pending, approved, rejected)');
        console.log('- approved_by (user who approved/rejected)');
        console.log('- approved_at (timestamp)');
        console.log('- rejection_reason (reason for rejection)');
        
        // Verify the migration by checking if the columns exist
        const { data: columns, error: checkError } = await adminSupabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'calendar_events')
            .in('column_name', ['status', 'approved_by', 'approved_at', 'rejection_reason']);
        
        if (checkError) {
            console.error('Error verifying migration:', checkError);
        } else {
            console.log('✅ Migration verification successful!');
            console.log('Found columns:', columns.map(c => c.column_name));
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
runCalendarApprovalMigration();
