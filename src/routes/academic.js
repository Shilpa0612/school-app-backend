import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Debug: Resolve teacher identifier (users.id, staff.id, or staff.user_id) without mutating data
router.get('/debug/resolve-teacher/:id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const inputId = req.params.id;
            const result = {
                input_id: inputId,
                user_by_id: null,
                staff_by_id: null,
                user_by_phone: null,
                staff_by_user_id: null,
                resolved_user_id: null,
                resolution_path: []
            };

            // Try direct users.id (role teacher)
            const { data: userById, error: userByIdError } = await adminSupabase
                .from('users')
                .select('id, full_name, phone_number, role')
                .eq('id', inputId)
                .eq('role', 'teacher')
                .single();
            if (userById && !userByIdError) {
                result.user_by_id = userById;
                result.resolved_user_id = userById.id;
                result.resolution_path.push('users.id');
            }

            // Try staff by id if not resolved
            if (!result.resolved_user_id) {
                const { data: staffById } = await adminSupabase
                    .from('staff')
                    .select('id, user_id, phone_number, role, full_name')
                    .eq('id', inputId)
                    .eq('role', 'teacher')
                    .single();
                if (staffById) {
                    result.staff_by_id = staffById;
                    if (staffById.user_id) {
                        result.resolved_user_id = staffById.user_id;
                        result.resolution_path.push('staff.id -> staff.user_id');
                    } else if (staffById.phone_number) {
                        // Fallback: user by phone
                        const { data: userByPhone } = await adminSupabase
                            .from('users')
                            .select('id, full_name, phone_number, role')
                            .eq('phone_number', staffById.phone_number)
                            .eq('role', 'teacher')
                            .single();
                        if (userByPhone) {
                            result.user_by_phone = userByPhone;
                            result.resolved_user_id = userByPhone.id;
                            result.resolution_path.push('staff.id -> phone_number -> users');
                        }
                    }
                }
            }

            // Try staff by user_id if still not resolved (i.e., input is actually a users.id)
            if (!result.resolved_user_id) {
                const { data: staffByUserId } = await adminSupabase
                    .from('staff')
                    .select('id, user_id, phone_number, role, full_name')
                    .eq('user_id', inputId)
                    .single();
                if (staffByUserId) {
                    result.staff_by_user_id = staffByUserId;
                    result.resolved_user_id = staffByUserId.user_id;
                    result.resolution_path.push('staff.user_id');
                }
            }

            return res.json({ status: 'success', data: result });
        } catch (error) {
            logger.error('Error resolving teacher identifier:', error);
            return res.status(500).json({ status: 'error', message: 'Failed to resolve teacher identifier' });
        }
    }
);

// Debug: Check database structure and tables
router.get('/debug/database-structure',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const result = {
                tables_exist: {},
                table_columns: {},
                sample_data: {}
            };

            // Check if tables exist
            const tables = ['users', 'staff', 'class_divisions'];

            for (const table of tables) {
                try {
                    const { data, error } = await adminSupabase
                        .from(table)
                        .select('*')
                        .limit(1);

                    result.tables_exist[table] = !error;

                    if (!error) {
                        // Get column info
                        const { data: columns, error: colError } = await adminSupabase.rpc('get_table_columns', { table_name: table });
                        if (!colError) {
                            result.table_columns[table] = columns;
                        }

                        // Get sample data count
                        const { count, error: countError } = await adminSupabase
                            .from(table)
                            .select('*', { count: 'exact', head: true });

                        if (!countError) {
                            result.sample_data[table] = { count };
                        }
                    }
                } catch (e) {
                    result.tables_exist[table] = false;
                    result.sample_data[table] = { error: e.message };
                }
            }

            return res.json({
                status: 'success',
                data: result
            });
        } catch (error) {
            logger.error('Error checking database structure:', error);
            return res.status(500).json({ status: 'error', message: 'Failed to check database structure' });
        }
    }
);

// Get current user's teacher ID for self-assignment (teachers only)
router.get('/my-teacher-id',
    authenticate,
    async (req, res, next) => {
        try {
            // Check if user is a teacher
            if (req.user.role !== 'teacher') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only teachers can access this endpoint'
                });
            }

            // Get staff record for this teacher
            const { data: staffRecord } = await adminSupabase
                .from('staff')
                .select('id, user_id, full_name, department, designation')
                .eq('user_id', req.user.id)
                .single();

            res.json({
                status: 'success',
                data: {
                    user_id: req.user.id,
                    staff_id: staffRecord?.id || null,
                    full_name: req.user.full_name,
                    staff_info: staffRecord ? {
                        id: staffRecord.id,
                        department: staffRecord.department,
                        designation: staffRecord.designation
                    } : null,
                    assignment_ids: {
                        // Use this user_id for class division assignment
                        teacher_id: req.user.id,
                        // Alternative: use staff_id (will be resolved by backend)
                        staff_id: staffRecord?.id || null
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting teacher ID:', error);
            next(error);
        }
    }
);

// Create academic year
router.post('/years',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('year_name').matches(/^\d{4}-\d{4}$/).withMessage('Year name must be in format YYYY-YYYY'),
        body('start_date').isISO8601().toDate(),
        body('end_date').isISO8601().toDate(),
        body('is_active').isBoolean()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { year_name, start_date, end_date, is_active } = req.body;

            // If setting as active, deactivate other years first
            if (is_active) {
                await adminSupabase
                    .from('academic_years')
                    .update({ is_active: false })
                    .eq('is_active', true);
            }

            const { data, error } = await adminSupabase
                .from('academic_years')
                .insert([{
                    year_name,
                    start_date,
                    end_date,
                    is_active
                }])
                .select()
                .single();

            if (error) {
                logger.error('Error creating academic year:', error);
                throw error;
            }

            res.status(201).json({
                status: 'success',
                data: { academic_year: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get all academic years
router.get('/years',
    authenticate,
    async (req, res, next) => {
        try {
            const { data, error } = await adminSupabase
                .from('academic_years')
                .select('*')
                .order('year_name', { ascending: false });

            if (error) {
                logger.error('Error fetching academic years:', error);
                throw error;
            }

            res.json({
                status: 'success',
                data: { academic_years: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get active academic year
router.get('/years/active',
    authenticate,
    async (req, res, next) => {
        try {
            const { data, error } = await adminSupabase
                .from('academic_years')
                .select('*')
                .eq('is_active', true)
                .single();

            if (error) {
                logger.error('Error fetching active academic year:', error);
                throw error;
            }

            res.json({
                status: 'success',
                data: { academic_year: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update academic year
router.put('/years/:id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('year_name').optional().matches(/^\d{4}-\d{4}$/).withMessage('Year name must be in format YYYY-YYYY'),
        body('start_date').optional().isISO8601().toDate(),
        body('end_date').optional().isISO8601().toDate(),
        body('is_active').optional().isBoolean()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const { year_name, start_date, end_date, is_active } = req.body;

            // If setting as active, deactivate other years first
            if (is_active) {
                await adminSupabase
                    .from('academic_years')
                    .update({ is_active: false })
                    .eq('is_active', true);
            }

            const updateData = {};
            if (year_name) updateData.year_name = year_name;
            if (start_date) updateData.start_date = start_date;
            if (end_date) updateData.end_date = end_date;
            if (typeof is_active !== 'undefined') updateData.is_active = is_active;

            const { data, error } = await adminSupabase
                .from('academic_years')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                logger.error('Error updating academic year:', error);
                throw error;
            }

            res.json({
                status: 'success',
                data: { academic_year: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete academic year (only if no students are enrolled)
router.delete('/years/:id',
    authenticate,
    authorize(['admin']),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Check if any students are enrolled in this academic year
            const { data: enrolledStudents, error: checkError } = await adminSupabase
                .from('student_academic_records')
                .select('id')
                .eq('academic_year_id', id)
                .limit(1);

            if (checkError) {
                logger.error('Error checking enrolled students:', checkError);
                throw checkError;
            }

            if (enrolledStudents && enrolledStudents.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot delete academic year with enrolled students'
                });
            }

            const { error } = await adminSupabase
                .from('academic_years')
                .delete()
                .eq('id', id);

            if (error) {
                logger.error('Error deleting academic year:', error);
                throw error;
            }

            res.json({
                status: 'success',
                message: 'Academic year deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Create class level
router.post('/class-levels',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('name').notEmpty().withMessage('Class level name is required'),
        body('sequence_number').isInt({ min: 1 }).withMessage('Valid sequence number is required')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, sequence_number } = req.body;

            // Use adminSupabase for admin operations
            const { data, error } = await adminSupabase
                .from('class_levels')
                .insert([{ name, sequence_number }])
                .select()
                .single();

            if (error) {
                logger.error('Error creating class level:', error);
                throw error;
            }

            res.status(201).json({
                status: 'success',
                data: { class_level: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get all class levels
router.get('/class-levels',
    authenticate,
    async (req, res, next) => {
        try {
            // Use adminSupabase instead of regular supabase client
            const { data, error } = await adminSupabase
                .from('class_levels')
                .select('*')
                .order('sequence_number');

            if (error) {
                logger.error('Error fetching class levels:', error);
                throw error;
            }

            res.json({
                status: 'success',
                data: { class_levels: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Create class division
router.post('/class-divisions',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('academic_year_id').isUUID().withMessage('Valid academic year ID is required'),
        body('class_level_id').isUUID().withMessage('Valid class level ID is required'),
        body('division').notEmpty().withMessage('Division name is required'),
        body('teacher_id').optional().isUUID().withMessage('Valid teacher ID if provided')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { academic_year_id, class_level_id, division, teacher_id } = req.body;

            // Verify academic year exists and is active
            const { data: academicYear, error: yearError } = await adminSupabase
                .from('academic_years')
                .select('is_active')
                .eq('id', academic_year_id)
                .single();

            if (yearError || !academicYear) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Academic year not found'
                });
            }

            // Verify class level exists
            const { data: classLevel, error: levelError } = await adminSupabase
                .from('class_levels')
                .select('id')
                .eq('id', class_level_id)
                .single();

            if (levelError || !classLevel) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class level not found'
                });
            }

            // If teacher_id provided, verify/resolve teacher exists (accept users.id or staff.id)
            if (teacher_id) {
                let resolvedTeacherId = null;

                // Try direct users.id
                const { data: userById } = await adminSupabase
                    .from('users')
                    .select('id')
                    .eq('id', teacher_id)
                    .eq('role', 'teacher')
                    .single();
                if (userById) {
                    resolvedTeacherId = userById.id;
                }

                if (!resolvedTeacherId) {
                    // Try staff by id
                    const { data: staffById } = await adminSupabase
                        .from('staff')
                        .select('id, user_id, phone_number, role')
                        .eq('id', teacher_id)
                        .eq('role', 'teacher')
                        .single();

                    if (staffById) {
                        if (staffById.user_id) {
                            resolvedTeacherId = staffById.user_id;
                        } else {
                            // Fallback: find user by phone_number
                            const { data: userByPhone } = await adminSupabase
                                .from('users')
                                .select('id')
                                .eq('phone_number', staffById.phone_number)
                                .eq('role', 'teacher')
                                .single();
                            if (userByPhone) {
                                resolvedTeacherId = userByPhone.id;
                                // Backfill staff.user_id for future consistency
                                await adminSupabase
                                    .from('staff')
                                    .update({ user_id: userByPhone.id })
                                    .eq('id', staffById.id);
                            }
                        }
                    }
                }

                if (!resolvedTeacherId) {
                    // Also allow passing staff.user_id directly as teacher_id
                    const { data: staffByUserId } = await adminSupabase
                        .from('staff')
                        .select('user_id')
                        .eq('user_id', teacher_id)
                        .single();
                    if (staffByUserId && staffByUserId.user_id) {
                        resolvedTeacherId = staffByUserId.user_id;
                    }
                }

                if (!resolvedTeacherId) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Teacher not found in users or staff'
                    });
                }

                // Overwrite teacher_id with resolved users.id
                req.body.teacher_id = resolvedTeacherId;
            }

            const { data, error } = await adminSupabase
                .from('class_divisions')
                .insert([{
                    academic_year_id,
                    class_level_id,
                    division,
                    teacher_id
                }])
                .select()
                .single();

            if (error) {
                logger.error('Error creating class division:', error);
                throw error;
            }

            res.status(201).json({
                status: 'success',
                data: { class_division: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get class divisions
router.get('/class-divisions',
    authenticate,
    async (req, res, next) => {
        try {
            const { academic_year_id } = req.query;

            let query = adminSupabase
                .from('class_divisions')
                .select(`
                    *,
                    academic_year:academic_year_id(year_name),
                    class_level:class_level_id(name, sequence_number),
                    teacher:teacher_id(id, full_name)
                `);

            if (academic_year_id) {
                query = query.eq('academic_year_id', academic_year_id);
            }

            const { data, error } = await query.order('class_level(sequence_number)');

            if (error) throw error;

            res.json({
                status: 'success',
                data: { class_divisions: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update class division
router.put('/class-divisions/:id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('teacher_id').optional().isUUID().withMessage('Valid teacher ID if provided'),
        body('division').optional().notEmpty().withMessage('Division name cannot be empty')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const { teacher_id, division } = req.body;

            // Initialize updateData
            const updateData = {};
            if (division) updateData.division = division;

            // If teacher_id provided, verify teacher exists
            if (teacher_id) {
                const { data: teacher, error: teacherError } = await adminSupabase
                    .from('users')
                    .select('id')
                    .eq('id', teacher_id)
                    .eq('role', 'teacher')
                    .single();

                if (teacherError || !teacher) {
                    // Try to find teacher in staff table and sync
                    const { data: staffMember, error: staffError } = await adminSupabase
                        .from('staff')
                        .select('*')
                        .eq('id', teacher_id)
                        .eq('role', 'teacher')
                        .single();

                    if (staffMember && !staffError) {
                        // Find corresponding user by phone number
                        const { data: user, error: userError } = await adminSupabase
                            .from('users')
                            .select('id, role')
                            .eq('phone_number', staffMember.phone_number)
                            .eq('role', 'teacher')
                            .single();

                        if (user && !userError) {
                            // Update staff record to use user ID
                            const { error: updateStaffError } = await adminSupabase
                                .from('staff')
                                .update({ id: user.id })
                                .eq('id', teacher_id);

                            if (updateStaffError) {
                                logger.error('Error updating staff ID:', updateStaffError);
                                return res.status(500).json({
                                    status: 'error',
                                    message: 'Failed to sync staff ID'
                                });
                            }

                            // Update teacher_id to use the user ID
                            updateData.teacher_id = user.id;

                            // Log the auto-sync
                            logger.info(`Auto-synced staff ID ${teacher_id} to user ID ${user.id} for ${staffMember.full_name}`);
                        } else {
                            return res.status(404).json({
                                status: 'error',
                                message: 'Teacher found in staff but no corresponding user account exists'
                            });
                        }
                    } else {
                        return res.status(404).json({
                            status: 'error',
                            message: 'Teacher not found in staff or users table'
                        });
                    }
                } else {
                    // Teacher found in users table, use the original teacher_id
                    updateData.teacher_id = teacher_id;
                }
            }

            const { data, error } = await adminSupabase
                .from('class_divisions')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                logger.error('Error updating class division:', error);
                throw error;
            }

            res.json({
                status: 'success',
                data: { class_division: data }
            });
        } catch (error) {
            logger.error('Error in class division update:', error);
            next(error);
        }
    }
);

// Register new student
router.post('/students',
    authenticate,
    authorize('admin'),
    [
        body('admission_number').notEmpty(),
        body('full_name').notEmpty(),
        body('date_of_birth').isISO8601().toDate(),
        body('admission_date').isISO8601().toDate(),
        body('class_division_id').isUUID(),
        body('roll_number').notEmpty()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                admission_number,
                full_name,
                date_of_birth,
                admission_date,
                class_division_id,
                roll_number
            } = req.body;

            // Start a Supabase transaction
            const { data: student, error: studentError } = await supabase
                .from('students_master')
                .insert([{
                    admission_number,
                    full_name,
                    date_of_birth,
                    admission_date
                }])
                .select()
                .single();

            if (studentError) throw studentError;

            // Assign to class
            const { data: record, error: recordError } = await supabase
                .rpc('assign_student_to_class', {
                    p_student_id: student.id,
                    p_class_division_id: class_division_id,
                    p_roll_number: roll_number
                });

            if (recordError) throw recordError;

            res.status(201).json({
                status: 'success',
                data: {
                    student,
                    academic_record: record
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Promote students
router.post('/promote',
    authenticate,
    authorize('admin', 'principal'),
    [
        body('from_academic_year_id').isUUID(),
        body('to_academic_year_id').isUUID()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { from_academic_year_id, to_academic_year_id } = req.body;

            const { data, error } = await supabase
                .rpc('promote_students', {
                    p_from_academic_year_id: from_academic_year_id,
                    p_to_academic_year_id: to_academic_year_id
                });

            if (error) throw error;

            res.json({
                status: 'success',
                data: { promotions: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get student details with current class
router.get('/students/:id',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Get student master record
            const { data: student, error: studentError } = await supabase
                .from('students_master')
                .select(`
                    *,
                    student_academic_records(
                        *,
                        class:class_division_id(
                            *,
                            level:class_level_id(*),
                            teacher:teacher_id(id, full_name)
                        )
                    )
                `)
                .eq('id', id)
                .single();

            if (studentError) throw studentError;

            // Get parent mappings
            const { data: parents, error: parentsError } = await supabase
                .from('parent_student_mappings')
                .select(`
                    *,
                    parent:parent_id(
                        id,
                        full_name,
                        phone_number,
                        email
                    )
                `)
                .eq('student_id', id);

            if (parentsError) throw parentsError;

            res.json({
                status: 'success',
                data: {
                    student,
                    parents
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get students eligible for promotion
router.get('/promotion-eligible/:academic_year_id',
    authenticate,
    authorize('admin', 'principal'),
    async (req, res, next) => {
        try {
            const { academic_year_id } = req.params;

            const { data, error } = await supabase
                .from('student_academic_records')
                .select(`
                    id,
                    roll_number,
                    status,
                    student:student_id (
                        id,
                        admission_number,
                        full_name,
                        status
                    ),
                    class:class_division_id (
                        id,
                        division,
                        level:class_level_id (
                            id,
                            name,
                            sequence_number
                        )
                    )
                `)
                .eq('academic_year_id', academic_year_id)
                .eq('status', 'ongoing');

            if (error) throw error;

            res.json({
                status: 'success',
                data: { eligible_students: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Promote specific students
router.post('/promote-selected',
    authenticate,
    authorize('admin', 'principal'),
    [
        body('promotions').isArray(),
        body('promotions.*.student_id').isUUID(),
        body('promotions.*.new_class_division_id').isUUID(),
        body('promotions.*.new_roll_number').optional().isString(),
        body('to_academic_year_id').isUUID()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { promotions, to_academic_year_id } = req.body;

            // Insert new academic records for each student
            const { data, error } = await supabase
                .from('student_academic_records')
                .insert(
                    promotions.map(p => ({
                        student_id: p.student_id,
                        academic_year_id: to_academic_year_id,
                        class_division_id: p.new_class_division_id,
                        roll_number: p.new_roll_number,
                        status: 'ongoing'
                    }))
                )
                .select();

            if (error) throw error;

            // Update previous year records status
            const { error: updateError } = await supabase
                .from('student_academic_records')
                .update({ status: 'promoted' })
                .in('student_id', promotions.map(p => p.student_id));

            if (updateError) throw updateError;

            res.json({
                status: 'success',
                data: { promoted_records: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get student's academic history
router.get('/student-history/:student_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { student_id } = req.params;

            const { data: history, error: historyError } = await adminSupabase
                .from('student_academic_records')
                .select(`
                    *,
                    academic_year:academic_year_id (
                        year_name,
                        start_date,
                        end_date
                    ),
                    class:class_division_id (
                        division,
                        level:class_level_id (
                            name,
                            sequence_number
                        ),
                        teacher:teacher_id (
                            full_name
                        )
                    )
                `)
                .eq('student_id', student_id)
                .order('created_at', { ascending: false });

            if (historyError) throw historyError;

            // Get parent information
            const { data: parents, error: parentsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    relationship,
                    is_primary_guardian,
                    access_level,
                    parent:parent_id (
                        id,
                        full_name,
                        phone_number,
                        email
                    )
                `)
                .eq('student_id', student_id);

            if (parentsError) throw parentsError;

            res.json({
                status: 'success',
                data: {
                    academic_history: history,
                    parents: parents
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Link multiple students to parent
router.post('/link-students',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('parent_id').isUUID(),
        body('students').isArray(),
        body('students.*.student_id').isUUID(),
        body('students.*.relationship').isIn(['father', 'mother', 'guardian']),
        body('students.*.is_primary_guardian').isBoolean(),
        body('students.*.access_level').isIn(['full', 'restricted', 'readonly'])
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { parent_id, students } = req.body;

            // Check if any student already has a primary guardian
            for (const student of students) {
                if (student.is_primary_guardian) {
                    const { data: existingPrimary } = await adminSupabase
                        .from('parent_student_mappings')
                        .select('id')
                        .eq('student_id', student.student_id)
                        .eq('is_primary_guardian', true)
                        .single();

                    if (existingPrimary) {
                        return res.status(400).json({
                            status: 'error',
                            message: `Student ${student.student_id} already has a primary guardian`
                        });
                    }
                }
            }

            // Create mappings
            const { data, error } = await adminSupabase
                .from('parent_student_mappings')
                .insert(
                    students.map(s => ({
                        parent_id,
                        student_id: s.student_id,
                        relationship: s.relationship,
                        is_primary_guardian: s.is_primary_guardian,
                        access_level: s.access_level
                    }))
                )
                .select();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { mappings: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update parent-student relationship
router.put('/update-parent-access/:mapping_id',
    authenticate,
    authorize('admin'),
    [
        body('is_primary_guardian').optional().isBoolean(),
        body('access_level').optional().isIn(['full', 'restricted', 'readonly']),
        body('relationship').optional().isIn(['father', 'mother', 'guardian'])
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { mapping_id } = req.params;
            const updates = req.body;

            // If updating to primary guardian, check if one already exists
            if (updates.is_primary_guardian) {
                const { data: mapping } = await supabase
                    .from('parent_student_mappings')
                    .select('student_id')
                    .eq('id', mapping_id)
                    .single();

                if (mapping) {
                    const { data: existingPrimary } = await supabase
                        .from('parent_student_mappings')
                        .select('id')
                        .eq('student_id', mapping.student_id)
                        .eq('is_primary_guardian', true)
                        .neq('id', mapping_id)
                        .single();

                    if (existingPrimary) {
                        return res.status(400).json({
                            status: 'error',
                            message: 'Student already has a primary guardian'
                        });
                    }
                }
            }

            const { data, error } = await supabase
                .from('parent_student_mappings')
                .update(updates)
                .eq('id', mapping_id)
                .select();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { mapping: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;