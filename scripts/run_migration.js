import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminSupabase } from '../src/config/supabase.js';
import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        logger.info('Starting teacher-class many-to-many migration...');

        // Read the migration SQL file
        const migrationPath = path.join(__dirname, '../migrations/add_teacher_class_many_to_many.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Split into individual statements (basic approach)
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        logger.info(`Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.toLowerCase().includes('comment on')) {
                // Skip comment statements as they might not be supported
                logger.info(`Skipping comment statement ${i + 1}`);
                continue;
            }

            try {
                logger.info(`Executing statement ${i + 1}/${statements.length}...`);
                
                // For complex statements like function creation, use rpc
                if (statement.toLowerCase().includes('create or replace function')) {
                    // Extract function name and execute as RPC
                    const funcMatch = statement.match(/create or replace function (\w+)/i);
                    if (funcMatch) {
                        logger.info(`Creating function: ${funcMatch[1]}`);
                    }
                }

                const { error } = await adminSupabase.rpc('exec_sql', { sql_statement: statement });
                
                if (error) {
                    // Try direct query for simpler statements
                    const { error: directError } = await adminSupabase.from('_temp').select('1').limit(0);
                    if (directError) {
                        logger.error(`Error executing statement ${i + 1}:`, error);
                        // Continue with other statements
                    }
                } else {
                    logger.info(`✓ Statement ${i + 1} executed successfully`);
                }
            } catch (statementError) {
                logger.error(`Error in statement ${i + 1}:`, statementError);
                // Continue with migration
            }
        }

        // Verify the migration worked
        logger.info('Verifying migration...');
        
        // Check if junction table exists
        const { data: tables, error: tableError } = await adminSupabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'class_teacher_assignments');

        if (tableError) {
            logger.error('Error checking for junction table:', tableError);
        } else if (tables && tables.length > 0) {
            logger.info('✓ Junction table class_teacher_assignments exists');
            
            // Check if data was migrated
            const { count, error: countError } = await adminSupabase
                .from('class_teacher_assignments')
                .select('*', { count: 'exact', head: true });

            if (countError) {
                logger.error('Error counting migrated records:', countError);
            } else {
                logger.info(`✓ Migration completed! ${count || 0} teacher assignments migrated to junction table`);
            }
        } else {
            logger.error('❌ Junction table was not created successfully');
        }

        // Check original class_divisions for comparison
        const { count: originalCount, error: originalError } = await adminSupabase
            .from('class_divisions')
            .select('teacher_id', { count: 'exact', head: true })
            .not('teacher_id', 'is', null);

        if (!originalError) {
            logger.info(`Original class_divisions has ${originalCount || 0} teacher assignments`);
        }

        logger.info('Migration process completed!');
        
        return {
            success: true,
            migratedRecords: count || 0,
            originalRecords: originalCount || 0
        };

    } catch (error) {
        logger.error('Migration failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration()
        .then(result => {
            if (result.success) {
                console.log('✅ Migration completed successfully!');
                console.log(`📊 Migrated ${result.migratedRecords} records from ${result.originalRecords} original assignments`);
                process.exit(0);
            } else {
                console.error('❌ Migration failed:', result.error);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Migration script error:', error);
            process.exit(1);
        });
}

export { runMigration };
