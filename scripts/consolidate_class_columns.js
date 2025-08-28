import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { adminSupabase } from '../src/config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function consolidateClassColumns() {
    try {
        console.log('🔄 Consolidating class division columns...');

        // Read the migration SQL file
        const migrationPath = join(__dirname, '..', 'migrations', 'consolidate_class_division_columns.sql');
        const migrationSQL = readFileSync(migrationPath, 'utf8');

        // Execute the migration
        const { error } = await adminSupabase.rpc('exec_sql', {
            sql: migrationSQL
        });

        if (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }

        console.log('✅ Class columns consolidation completed successfully!');
        console.log('📝 Added class_divisions column and migrated existing data');

    } catch (error) {
        console.error('❌ Error running migration:', error);
        process.exit(1);
    }
}

consolidateClassColumns();
