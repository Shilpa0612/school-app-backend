import { adminSupabase } from '../src/config/supabase.js';
import { logger } from '../src/utils/logger.js';

/**
 * Run migration to add missing fields to students_master table
 */
async function runMigration() {
    try {
        logger.info('Starting migration: Add missing fields to students_master table');

        // Add gender column
        const { error: genderError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.students_master 
                ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female', 'other'));
            `
        });

        if (genderError) {
            logger.error('Error adding gender column:', genderError);
        } else {
            logger.info('✅ Gender column added successfully');
        }

        // Add address column
        const { error: addressError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.students_master 
                ADD COLUMN IF NOT EXISTS address text;
            `
        });

        if (addressError) {
            logger.error('Error adding address column:', addressError);
        } else {
            logger.info('✅ Address column added successfully');
        }

        // Add emergency_contact column
        const { error: contactError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.students_master 
                ADD COLUMN IF NOT EXISTS emergency_contact text CHECK (emergency_contact ~ '^[0-9]{10}$' OR emergency_contact IS NULL);
            `
        });

        if (contactError) {
            logger.error('Error adding emergency_contact column:', contactError);
        } else {
            logger.info('✅ Emergency contact column added successfully');
        }

        // Update existing records to have default gender
        const { error: updateError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                UPDATE public.students_master 
                SET gender = 'other' 
                WHERE gender IS NULL;
            `
        });

        if (updateError) {
            logger.error('Error updating existing records:', updateError);
        } else {
            logger.info('✅ Existing records updated with default gender');
        }

        logger.info('🎉 Migration completed successfully!');

    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
runMigration();
