import { adminSupabase } from '../src/config/supabase.js';

const migrationSQL = `
-- Migration: Add date_of_birth column to staff table
-- Date: 2025-08-25
-- Description: Adds date_of_birth column to store staff birthdays

-- Add date_of_birth column to staff table
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS date_of_birth date;

-- Add comment to document the column
COMMENT ON COLUMN public.staff.date_of_birth IS 'Date of birth for staff members (teachers, principals, admins). Optional field.';

-- Create index for birthday queries (useful for birthday-related features)
CREATE INDEX IF NOT EXISTS idx_staff_date_of_birth ON public.staff (date_of_birth) WHERE date_of_birth IS NOT NULL;

-- Create index for month/day birthday queries (for birthday notifications)
CREATE INDEX IF NOT EXISTS idx_staff_birthday_month_day ON public.staff (
    EXTRACT(MONTH FROM date_of_birth),
    EXTRACT(DAY FROM date_of_birth)
) WHERE date_of_birth IS NOT NULL;

-- Create composite indexes for optimized birthday queries
CREATE INDEX IF NOT EXISTS idx_staff_user_id_date_of_birth ON public.staff (user_id, date_of_birth) WHERE date_of_birth IS NOT NULL;

-- Create indexes for students_master birthday queries
CREATE INDEX IF NOT EXISTS idx_students_master_date_of_birth ON public.students_master (date_of_birth) WHERE date_of_birth IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_master_birthday_month_day ON public.students_master (
    EXTRACT(MONTH FROM date_of_birth),
    EXTRACT(DAY FROM date_of_birth)
) WHERE date_of_birth IS NOT NULL;

-- Create composite indexes for parent-student birthday queries
CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_parent_id ON public.parent_student_mappings (parent_id);

CREATE INDEX IF NOT EXISTS idx_student_academic_records_class_division_status ON public.student_academic_records (class_division_id, status);

COMMENT ON INDEX public.idx_staff_date_of_birth IS 'Index for efficient birthday queries on staff table';
COMMENT ON INDEX public.idx_staff_birthday_month_day IS 'Index for efficient month/day birthday queries (useful for birthday notifications)';
COMMENT ON INDEX public.idx_staff_user_id_date_of_birth IS 'Composite index for staff birthday queries by user_id';
COMMENT ON INDEX public.idx_students_master_date_of_birth IS 'Index for efficient student birthday queries';
COMMENT ON INDEX public.idx_students_master_birthday_month_day IS 'Index for efficient student month/day birthday queries';
COMMENT ON INDEX public.idx_parent_student_mappings_parent_id IS 'Index for parent-student mapping queries';
COMMENT ON INDEX public.idx_student_academic_records_class_division_status IS 'Index for class division academic records queries';
`;

async function addDateOfBirthToStaff() {
    try {
        console.log('🔄 Starting migration: Add date_of_birth to staff table...');

        // Execute the migration SQL
        const { data, error } = await adminSupabase.rpc('exec_sql', {
            sql_query: migrationSQL
        });

        if (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }

        console.log('✅ Migration completed successfully!');
        console.log('📋 Changes made:');
        console.log('   - Added date_of_birth column to staff table');
        console.log('   - Added indexes for efficient birthday queries');
        console.log('   - Added documentation comments');

        // Verify the column was added
        console.log('\n🔍 Verifying column addition...');
        const { data: verifyData, error: verifyError } = await adminSupabase
            .from('staff')
            .select('id, full_name, date_of_birth')
            .limit(1);

        if (verifyError) {
            console.error('❌ Verification failed:', verifyError);
        } else {
            console.log('✅ Column verification successful!');
            console.log('📊 Sample data structure:', verifyData[0]);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
addDateOfBirthToStaff();
