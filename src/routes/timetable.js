import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ==================== TIMETABLE CONFIGURATION ====================

// Debug endpoint to check teacher assignments
router.get('/debug/teacher-assignments/:teacher_id',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const { teacher_id } = req.params;

            logger.info('Debug: Checking teacher assignments for:', teacher_id);

            // Check class_teacher_assignments table
            const { data: ctaData, error: ctaError } = await adminSupabase
                .from('class_teacher_assignments')
                .select('*')
                .eq('teacher_id', teacher_id);

            logger.info('CTA table data:', { ctaData, ctaError });

            // Check class_divisions table
            const { data: cdData, error: cdError } = await adminSupabase
                .from('class_divisions')
                .select('*')
                .eq('teacher_id', teacher_id);

            logger.info('Class divisions table data:', { cdData, cdError });

            // Check if tables exist
            const { data: tables, error: tablesError } = await adminSupabase
                .from('information_schema.tables')
                .select('table_name')
                .eq('table_schema', 'public')
                .in('table_name', ['class_teacher_assignments', 'class_divisions']);

            logger.info('Available tables:', { tables, tablesError });

            res.json({
                status: 'success',
                data: {
                    teacher_id,
                    class_teacher_assignments: { data: ctaData, error: ctaError },
                    class_divisions: { data: cdData, error: cdError },
                    available_tables: { data: tables, error: tablesError }
                }
            });
        } catch (error) {
            logger.error('Debug error:', error);
            next(error);
        }
    }
);

// Create timetable configuration
router.post('/config',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    [
        body('name').isString().trim().notEmpty().withMessage('Configuration name is required'),
        body('description').optional().isString().trim(),
        body('academic_year_id').isUUID().withMessage('Valid academic year ID is required'),
        body('total_periods').isInt({ min: 1, max: 10 }).withMessage('Total periods must be between 1 and 10'),
        body('days_per_week').isInt({ min: 5, max: 7 }).withMessage('Days per week must be between 5 and 7')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, description, academic_year_id, total_periods, days_per_week } = req.body;

            // Check if config already exists for this academic year
            const { data: existingConfig, error: checkError } = await adminSupabase
                .from('timetable_config')
                .select('id, name')
                .eq('academic_year_id', academic_year_id)
                .eq('is_active', true)
                .single();

            if (existingConfig) {
                return res.status(400).json({
                    status: 'error',
                    message: `Timetable configuration already exists for this academic year: ${existingConfig.name}`
                });
            }

            // Create new configuration
            const { data, error } = await adminSupabase
                .from('timetable_config')
                .insert([{
                    name,
                    description,
                    academic_year_id,
                    total_periods,
                    days_per_week,
                    created_by: req.user.id
                }])
                .select()
                .single();

            if (error) throw error;

            logger.info('Timetable configuration created:', {
                config_id: data.id,
                name: data.name,
                academic_year_id: data.academic_year_id,
                created_by: req.user.id
            });

            res.status(201).json({
                status: 'success',
                message: 'Timetable configuration created successfully',
                data: { config: data }
            });
        } catch (error) {
            logger.error('Error creating timetable configuration:', error);
            next(error);
        }
    }
);

// Get timetable configuration
router.get('/config',
    authenticate,
    async (req, res, next) => {
        try {
            const { academic_year_id, include_inactive = 'false' } = req.query;

            let query = adminSupabase
                .from('timetable_config')
                .select(`
                    *,
                    academic_year:academic_years(year_name)
                `)
                .order('created_at', { ascending: false });

            if (academic_year_id) {
                query = query.eq('academic_year_id', academic_year_id);
            }

            if (include_inactive !== 'true') {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;

            if (error) throw error;

            res.json({
                status: 'success',
                data: { configs: data }
            });
        } catch (error) {
            logger.error('Error fetching timetable configuration:', error);
            next(error);
        }
    }
);

// Update timetable configuration
router.put('/config/:id',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    [
        body('name').optional().isString().trim().notEmpty().withMessage('Configuration name cannot be empty'),
        body('description').optional().isString().trim(),
        body('total_periods').optional().isInt({ min: 1, max: 10 }).withMessage('Total periods must be between 1 and 10'),
        body('days_per_week').optional().isInt({ min: 5, max: 7 }).withMessage('Days per week must be between 5 and 7')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const updateData = {};

            // Build update data
            ['name', 'description', 'total_periods', 'days_per_week'].forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            // Check if config exists
            const { data: existingConfig, error: checkError } = await adminSupabase
                .from('timetable_config')
                .select('*')
                .eq('id', id)
                .single();

            // For teachers, validate they can only update configs they created
            if (req.user.role === 'teacher' && existingConfig.created_by !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only update timetable configurations you created'
                });
            }

            if (checkError || !existingConfig) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Timetable configuration not found'
                });
            }

            // Update configuration
            const { data, error } = await adminSupabase
                .from('timetable_config')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            logger.info('Timetable configuration updated:', {
                config_id: id,
                updated_by: req.user.id,
                changes: updateData
            });

            res.json({
                status: 'success',
                message: 'Timetable configuration updated successfully',
                data: { config: data }
            });
        } catch (error) {
            logger.error('Error updating timetable configuration:', error);
            next(error);
        }
    }
);

// ==================== CLASS TIMETABLE ENTRIES ====================

// Create class timetable entry
router.post('/entries',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    [
        body('config_id').isUUID().withMessage('Valid config ID is required'),
        body('class_division_id').isUUID().withMessage('Valid class division ID is required'),
        body('period_number').isInt({ min: 1, max: 10 }).withMessage('Period number must be between 1 and 10'),
        body('day_of_week').isInt({ min: 1, max: 7 }).withMessage('Day of week must be between 1 and 7'),
        body('subject').optional().isString().trim(),
        body('teacher_id').optional().isUUID().withMessage('Valid teacher ID is required if provided'),
        // body('room_number').optional().isString().trim(),
        body('notes').optional().isString().trim()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Validation failed',
                    details: 'Some fields failed validation',
                    errors: errors.array(),
                    error_code: 'VALIDATION_ERROR',
                    suggestion: 'Please correct the validation errors and try again'
                });
            }

            const {
                config_id,
                class_division_id,
                period_number,
                day_of_week,
                subject,
                teacher_id,
                notes
            } = req.body;

            // For teachers, validate they can only manage timetables for their assigned classes
            if (req.user.role === 'teacher') {
                // Check multiple possible table structures for teacher assignments
                let teacherAssignment = null;

                logger.info('Teacher validation - checking assignments for:', {
                    teacher_id: req.user.id,
                    class_division_id: class_division_id
                });

                // Try multiple possible table structures
                const possibleTables = [
                    'class_teacher_assignments',
                    'teacher_assignments',
                    'staff_assignments',
                    'class_assignments'
                ];

                for (const tableName of possibleTables) {
                    try {
                        const { data: assignments, error } = await adminSupabase
                            .from(tableName)
                            .select('id')
                            .eq('teacher_id', req.user.id)
                            .eq('class_division_id', class_division_id)
                            .eq('is_active', true);

                        logger.info(`Table ${tableName} check result:`, { assignments, error });

                        if (assignments && assignments.length > 0) {
                            teacherAssignment = assignments[0]; // Take first assignment
                            logger.info(`Found assignment in ${tableName} table`);
                            break;
                        }
                    } catch (err) {
                        logger.info(`Table ${tableName} not accessible or doesn't exist:`, err.message);
                    }
                }

                // If still not found, try the legacy class_divisions table
                if (!teacherAssignment) {
                    try {
                        const { data: legacyAssignment, error: legacyError } = await adminSupabase
                            .from('class_divisions')
                            .select('id')
                            .eq('id', class_division_id)
                            .eq('teacher_id', req.user.id)
                            .single();

                        logger.info('Legacy table check result:', { legacyAssignment, legacyError });

                        if (legacyAssignment) {
                            teacherAssignment = legacyAssignment;
                            logger.info('Found assignment in legacy table');
                        }
                    } catch (err) {
                        logger.info('Legacy table check failed:', err.message);
                    }
                }

                // If still not found, try a broader search in any table that might have teacher assignments
                if (!teacherAssignment) {
                    try {
                        // Try to find any table that might contain teacher assignments
                        const { data: anyAssignment, error: anyError } = await adminSupabase
                            .from('class_divisions')
                            .select('id, teacher_id, class_teacher_id, primary_teacher_id')
                            .eq('id', class_division_id)
                            .or(`teacher_id.eq.${req.user.id},class_teacher_id.eq.${req.user.id},primary_teacher_id.eq.${req.user.id}`)
                            .single();

                        logger.info('Broader search result:', { anyAssignment, anyError });

                        if (anyAssignment) {
                            teacherAssignment = anyAssignment;
                            logger.info('Found assignment in broader search');
                        }
                    } catch (err) {
                        logger.info('Broader search failed:', err.message);
                    }
                }

                logger.info('Final teacher assignment result:', { teacherAssignment });

                if (!teacherAssignment) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only manage timetables for your assigned classes'
                    });
                }
            }

            // Validate config exists
            const { data: config, error: configError } = await adminSupabase
                .from('timetable_config')
                .select('total_periods, days_per_week')
                .eq('id', config_id)
                .eq('is_active', true)
                .single();

            if (configError || !config) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid timetable configuration'
                });
            }

            // Validate period number and day
            if (period_number > config.total_periods) {
                return res.status(500).json({
                    status: 'error',
                    message: `Period number cannot exceed total periods (${config.total_periods})`,
                    details: `The requested period ${period_number} exceeds the maximum ${config.total_periods} periods configured for this timetable`,
                    error_code: 'PERIOD_EXCEEDS_LIMIT',
                    suggestion: `Please choose a period number between 1 and ${config.total_periods}`,
                    requested_period: period_number,
                    max_periods: config.total_periods
                });
            }

            if (day_of_week > config.days_per_week) {
                return res.status(500).json({
                    status: 'error',
                    message: `Day of week cannot exceed configured days (${config.days_per_week})`,
                    details: `The requested day ${day_of_week} exceeds the maximum ${config.days_per_week} days configured for this timetable`,
                    error_code: 'DAY_EXCEEDS_LIMIT',
                    suggestion: `Please choose a day between 1 and ${config.days_per_week}`,
                    requested_day: day_of_week,
                    max_days: config.days_per_week
                });
            }

            // Check for class conflicts (same class, period, day)
            const { data: classConflicts, error: classConflictError } = await adminSupabase
                .from('class_timetable')
                .select('id, subject')
                .eq('class_division_id', class_division_id)
                .eq('period_number', period_number)
                .eq('day_of_week', day_of_week)
                .eq('is_active', true);

            if (classConflicts && classConflicts.length > 0) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Class schedule conflict',
                    details: `${classConflicts[0].subject || 'A period'} is already assigned for this class, period, and day`,
                    error_code: 'CLASS_CONFLICT',
                    suggestion: 'Please choose a different period or day, or update the existing entry',
                    conflict_data: {
                        existing_subject: classConflicts[0].subject,
                        class_division_id,
                        period_number,
                        day_of_week
                    }
                });
            }

            // Check for teacher conflicts (same teacher, period, day) - only if teacher_id is provided
            if (teacher_id) {
                const { data: teacherConflicts, error: teacherConflictError } = await adminSupabase
                    .from('class_timetable')
                    .select(`
                        id, 
                        subject, 
                        class_division_id,
                        class_divisions(class_name, division)
                    `)
                    .eq('teacher_id', teacher_id)
                    .eq('period_number', period_number)
                    .eq('day_of_week', day_of_week)
                    .eq('is_active', true);

                if (teacherConflicts && teacherConflicts.length > 0) {
                    const conflict = teacherConflicts[0];
                    const conflictClass = conflict.class_divisions
                        ? `${conflict.class_divisions.class_name}-${conflict.class_divisions.division}`
                        : 'Unknown Class';

                    return res.status(500).json({
                        status: 'error',
                        message: 'Teacher schedule conflict',
                        details: `This teacher is already assigned to teach ${conflict.subject || 'a period'} for ${conflictClass} at the same time`,
                        error_code: 'TEACHER_CONFLICT',
                        suggestion: 'Please choose a different teacher, period, or day for this assignment',
                        conflict_data: {
                            existing_subject: conflict.subject,
                            existing_class: conflictClass,
                            teacher_id,
                            period_number,
                            day_of_week,
                            day_name: ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][day_of_week]
                        }
                    });
                }
            }

            // Create timetable entry
            const { data, error } = await adminSupabase
                .from('class_timetable')
                .insert([{
                    config_id,
                    class_division_id,
                    period_number,
                    day_of_week,
                    subject,
                    teacher_id,
                    notes,
                    created_by: req.user.id
                }])
                .select()
                .single();

            if (error) throw error;

            logger.info('Class timetable entry created:', {
                entry_id: data.id,
                class_division_id: data.class_division_id,
                period_number: data.period_number,
                day_of_week: data.day_of_week,
                subject: data.subject,
                created_by: req.user.id
            });

            res.status(201).json({
                status: 'success',
                message: 'Timetable entry created successfully',
                data: { entry: data }
            });
        } catch (error) {
            logger.error('Error creating timetable entry:', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                details: error.details,
                hint: error.hint,
                body: req.body,
                user: req.user?.id
            });

            // Enhanced error handling for specific cases
            if (error.code) {
                switch (error.code) {
                    case '23505': // Unique constraint violation
                        // Check if it's a teacher conflict or class conflict
                        const errorDetail = error.detail || error.message || '';
                        if (errorDetail.includes('unique_teacher_period_day')) {
                            return res.status(500).json({
                                status: 'error',
                                message: 'Teacher schedule conflict',
                                details: 'This teacher is already assigned to another class during the same period and day',
                                error_code: 'TEACHER_CONFLICT_DB',
                                suggestion: 'Please choose a different teacher, period, or day for this assignment',
                                constraint_violated: 'unique_teacher_period_day'
                            });
                        } else if (errorDetail.includes('unique_class_period_day')) {
                            return res.status(500).json({
                                status: 'error',
                                message: 'Class schedule conflict',
                                details: 'A timetable entry already exists for this class, period, and day combination',
                                error_code: 'CLASS_CONFLICT_DB',
                                suggestion: 'Please check existing timetable entries or modify the period/day selection',
                                constraint_violated: 'unique_class_period_day'
                            });
                        } else {
                            return res.status(500).json({
                                status: 'error',
                                message: 'Duplicate entry conflict',
                                details: 'A duplicate entry was detected in the timetable',
                                error_code: error.code,
                                suggestion: 'Please check existing timetable entries or modify your selection'
                            });
                        }
                        break;
                    case '23503': // Foreign key constraint violation
                        return res.status(500).json({
                            status: 'error',
                            message: 'Invalid reference data',
                            details: 'One or more referenced IDs (config_id, class_division_id, teacher_id) are invalid or do not exist',
                            error_code: error.code,
                            suggestion: 'Please verify that all IDs exist and are valid'
                        });
                    case '23514': // Check constraint violation
                        return res.status(500).json({
                            status: 'error',
                            message: 'Data validation constraint failed',
                            details: error.message,
                            error_code: error.code,
                            suggestion: 'Please check the data values meet the required constraints'
                        });
                    case '22P02': // Invalid UUID format
                        return res.status(500).json({
                            status: 'error',
                            message: 'Invalid ID format',
                            details: 'One or more IDs are not in valid UUID format',
                            error_code: error.code,
                            suggestion: 'Please ensure all IDs are valid UUIDs'
                        });
                    case 'PGRST116': // Supabase: No rows returned
                        return res.status(500).json({
                            status: 'error',
                            message: 'Resource not found',
                            details: 'The specified timetable configuration or class division was not found',
                            error_code: error.code,
                            suggestion: 'Please verify the config_id and class_division_id exist and are active'
                        });
                }
            }

            // Handle authentication/authorization errors
            if (error.message && error.message.includes('auth')) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Authentication error',
                    details: error.message,
                    error_code: 'AUTH_ERROR',
                    suggestion: 'Please check your authentication credentials'
                });
            }

            // Handle validation errors
            if (error.name === 'ValidationError') {
                return res.status(500).json({
                    status: 'error',
                    message: 'Validation failed',
                    details: error.message,
                    errors: error.errors || [],
                    error_code: 'VALIDATION_ERROR',
                    suggestion: 'Please correct the validation errors and try again'
                });
            }

            // Generic server error with detailed information for debugging
            return res.status(500).json({
                status: 'error',
                message: 'Internal server error while creating timetable entry',
                details: process.env.NODE_ENV === 'production'
                    ? 'An unexpected error occurred. Please contact support if this persists.'
                    : error.message,
                error_code: error.code || 'UNKNOWN_ERROR',
                error_type: error.name || 'UnknownError',
                suggestion: 'Please try again. If the error persists, contact technical support with the error details.',
                timestamp: new Date().toISOString(),
                // Include stack trace only in development
                ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
            });
        }
    }
);

// Get class timetable
router.get('/class/:class_division_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const { config_id, academic_year_id } = req.query;

            // Build query
            let query = adminSupabase
                .from('class_timetable')
                .select(`
                    *,
                    config:timetable_config(
                        id,
                        name,
                        total_periods,
                        days_per_week
                    ),
                    teacher:users!class_timetable_teacher_id_fkey(
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('class_division_id', class_division_id)
                .eq('is_active', true)
                .order('day_of_week', { ascending: true })
                .order('period_number', { ascending: true });

            if (config_id) {
                query = query.eq('config_id', config_id);
            }

            if (academic_year_id) {
                query = query.eq('config.academic_year_id', academic_year_id);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Fetch all subjects to create a lookup map (including inactive ones for debugging)
            const { data: subjects, error: subjectsError } = await adminSupabase
                .from('subjects')
                .select('id, name, code, is_active');

            if (subjectsError) {
                logger.warn('Error fetching subjects:', subjectsError);
            }

            // Create subject lookup map
            const subjectMap = {};
            if (subjects) {
                subjects.forEach(subject => {
                    subjectMap[subject.id] = subject;
                });
            }

            // Debug: Log subject lookup info
            const debugInfo = {
                total_subjects: subjects?.length || 0,
                subject_ids_in_timetable: [...new Set(data.map(entry => entry.subject))],
                subject_map_keys: Object.keys(subjectMap),
                sample_subject: subjects?.[0]
            };
            logger.info('Subject lookup debug:', debugInfo);
            console.log('🔍 TIMETABLE DEBUG:', debugInfo);

            // Organize by day
            const timetableByDay = {};
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            data.forEach(entry => {
                const dayName = days[entry.day_of_week - 1];
                if (!timetableByDay[dayName]) {
                    timetableByDay[dayName] = [];
                }
                // Enhance entry with subject information
                const subjectInfo = subjectMap[entry.subject];

                // Debug: Log the lookup for this specific entry
                const entryDebugInfo = {
                    entry_subject_id: entry.subject,
                    subject_found: !!subjectInfo,
                    subject_info: subjectInfo,
                    available_subject_ids: Object.keys(subjectMap)
                };
                logger.info('Subject lookup for entry:', entryDebugInfo);
                console.log('🔍 ENTRY DEBUG:', entryDebugInfo);

                const enhancedEntry = {
                    ...entry,
                    subject_info: subjectInfo ? {
                        id: subjectInfo.id,
                        name: subjectInfo.name,
                        code: subjectInfo.code,
                        display_name: subjectInfo.name
                    } : {
                        id: 'free_period',
                        name: 'Free Period',
                        code: null,
                        display_name: 'Free Period'
                    }
                };

                timetableByDay[dayName].push(enhancedEntry);
            });

            // Sort periods within each day
            Object.keys(timetableByDay).forEach(day => {
                timetableByDay[day].sort((a, b) => a.period_number - b.period_number);
            });

            // Enhance response with subject information summary
            const subjectSummary = {};
            data.forEach(entry => {
                const subjectInfo = subjectMap[entry.subject];
                if (subjectInfo) {
                    const subjectKey = subjectInfo.id;
                    if (!subjectSummary[subjectKey]) {
                        subjectSummary[subjectKey] = {
                            id: subjectInfo.id,
                            name: subjectInfo.name,
                            code: subjectInfo.code,
                            display_name: subjectInfo.name,
                            periods_per_week: 0
                        };
                    }
                    subjectSummary[subjectKey].periods_per_week++;
                }
            });

            res.json({
                status: 'success',
                data: {
                    class_division_id,
                    timetable: timetableByDay,
                    total_entries: data.length,
                    subject_summary: Object.values(subjectSummary)
                }
            });
        } catch (error) {
            logger.error('Error fetching class timetable:', error);
            next(error);
        }
    }
);

// Get all children's timetables for a parent
router.get('/parent/children',
    authenticate,
    authorize(['parent']),
    async (req, res, next) => {
        try {
            const { config_id, academic_year_id } = req.query;

            // Get all children for the parent using the same table structure as /api/users/children
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    relationship,
                    is_primary_guardian
                `)
                .eq('parent_id', req.user.id);

            if (mappingsError) throw mappingsError;

            if (!mappings || mappings.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        children: [],
                        message: 'No children found'
                    }
                });
            }

            // Get student details with academic records
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    admission_number,
                    student_academic_records (
                        id,
                        roll_number,
                        status,
                        class_division:class_division_id (
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        )
                    )
                `)
                .in('id', mappings.map(m => m.student_id));

            if (studentsError) throw studentsError;



            // Get timetables for each child
            const childrenWithTimetables = await Promise.all(
                students.map(async (student) => {
                    // Find the mapping for this student to get relationship info
                    const mapping = mappings.find(m => m.student_id === student.id);

                    // Find current academic record
                    const currentAcademicRecord = student.student_academic_records?.find(r => r.status === 'ongoing');
                    const class_division_id = currentAcademicRecord?.class_division?.id;

                    if (!class_division_id) {
                        return {
                            id: student.id,
                            name: student.full_name,
                            admission_number: student.admission_number,
                            relationship: mapping?.relationship,
                            is_primary_guardian: mapping?.is_primary_guardian,
                            timetable: null,
                            message: 'Student not assigned to any class'
                        };
                    }

                    // Get timetable for this child's class
                    let query = adminSupabase
                        .from('class_timetable')
                        .select(`
                            *,
                            config:timetable_config(
                                id,
                                name,
                                total_periods,
                                days_per_week
                            ),
                            teacher:users!class_timetable_teacher_id_fkey(
                                id,
                                full_name,
                                role
                            )
                        `)
                        .eq('class_division_id', class_division_id)
                        .eq('is_active', true)
                        .order('day_of_week', { ascending: true })
                        .order('period_number', { ascending: true });

                    if (config_id) {
                        query = query.eq('config_id', config_id);
                    }

                    if (academic_year_id) {
                        query = query.eq('config.academic_year_id', academic_year_id);
                    }

                    const { data: timetableData, error: timetableError } = await query;

                    if (timetableError) {
                        return {
                            ...child,
                            timetable: null,
                            error: 'Failed to fetch timetable'
                        };
                    }

                    // Organize by day
                    const timetableByDay = {};
                    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

                    timetableData.forEach(entry => {
                        const dayName = days[entry.day_of_week - 1];
                        if (!timetableByDay[dayName]) {
                            timetableByDay[dayName] = [];
                        }
                        // Enhance entry with subject information
                        const enhancedEntry = {
                            ...entry,
                            subject_info: {
                                name: entry.subject || 'Free Period',
                                id: entry.subject ? entry.subject.toLowerCase().replace(/\s+/g, '_') : 'free_period',
                                display_name: entry.subject || 'Free Period'
                            }
                        };

                        timetableByDay[dayName].push(enhancedEntry);
                    });

                    // Sort periods within each day
                    Object.keys(timetableByDay).forEach(day => {
                        timetableByDay[day].sort((a, b) => a.period_number - b.period_number);
                    });

                    return {
                        id: student.id,
                        name: student.full_name,
                        admission_number: student.admission_number,
                        relationship: mapping?.relationship,
                        is_primary_guardian: mapping?.is_primary_guardian,
                        class_info: {
                            class_division_id: class_division_id,
                            class_name: `${currentAcademicRecord?.class_division?.level?.name || 'Unknown'} ${currentAcademicRecord?.class_division?.division || ''}`,
                            division: currentAcademicRecord?.class_division?.division,
                            academic_year: null, // Not available in current structure
                            roll_number: currentAcademicRecord?.roll_number
                        },
                        timetable: timetableByDay,
                        total_entries: timetableData.length
                    };
                })
            );

            res.json({
                status: 'success',
                data: {
                    parent_id: req.user.id,
                    children: childrenWithTimetables
                }
            });
        } catch (error) {
            logger.error('Error fetching parent children timetables:', error);
            next(error);
        }
    }
);

// Get student timetable (for parents)
router.get('/student/:student_id',
    authenticate,
    authorize(['admin', 'principal', 'teacher', 'parent']),
    async (req, res, next) => {
        try {
            const { student_id } = req.params;
            const { config_id, academic_year_id } = req.query;

            logger.info('=== STUDENT TIMETABLE ENDPOINT START ===');
            logger.info('Request details:', {
                student_id,
                config_id,
                academic_year_id,
                user_id: req.user.id,
                user_role: req.user.role
            });

            // For parents, verify they can only access their own children's timetables
            if (req.user.role === 'parent') {
                logger.info('=== PARENT VALIDATION START ===');
                logger.info('Checking parent-child relationship for:', {
                    parent_id: req.user.id,
                    student_id: student_id
                });

                // Check parent-child relationship using the same table structure as /api/users/children
                const { data: mapping, error: mappingError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('id')
                    .eq('parent_id', req.user.id)
                    .eq('student_id', student_id)
                    .single();

                logger.info('Parent-child mapping result:', { mapping, mappingError });

                if (mappingError || !mapping) {
                    logger.error('Parent validation failed:', { mappingError, mapping });
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only access timetables for your own children'
                    });
                }

                logger.info('✅ Parent validation successful');
            }

            // Get student's class division using the same table structure as /api/users/children
            logger.info('=== STUDENT LOOKUP START ===');
            logger.info('Fetching student from students_master table:', { student_id });

            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .select(`
                    student_academic_records (
                        id,
                        status,
                        class_division_id
                    )
                `)
                .eq('id', student_id)
                .single();

            logger.info('Student lookup result:', { student, studentError });

            if (studentError || !student) {
                logger.error('Student lookup failed:', { studentError, student });
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found'
                });
            }

            logger.info('✅ Student found successfully');
            logger.info('Student data structure:', JSON.stringify(student, null, 2));
            logger.info('Student academic records (detailed):', {
                count: student.student_academic_records?.length || 0,
                records: student.student_academic_records?.map(r => ({
                    id: r.id,
                    status: r.status,
                    class_division_id: r.class_division_id
                }))
            });

            // Extract class_division_id from the nested academic records structure
            logger.info('=== CLASS DIVISION EXTRACTION START ===');
            logger.info('Student academic records:', student.student_academic_records);

            logger.info('Looking for academic record with status === "ongoing"');
            logger.info('Looking for academic record with status === "ongoing"');
            let currentAcademicRecord = student.student_academic_records?.find(r => r.status === 'ongoing');

            // Fallback: if no "ongoing" status found, take the first record
            if (!currentAcademicRecord && student.student_academic_records?.length > 0) {
                currentAcademicRecord = student.student_academic_records[0];
                logger.info('No "ongoing" status found, using first academic record as fallback');
            }

            logger.info('Current academic record:', currentAcademicRecord);
            logger.info('All academic records with their statuses:',
                student.student_academic_records?.map(r => ({ id: r.id, status: r.status, class_division_id: r.class_division_id }))
            );

            const class_division_id = currentAcademicRecord?.class_division_id;
            logger.info('Extracted class_division_id:', class_division_id);

            if (!class_division_id) {
                logger.error('No class division found:', {
                    hasAcademicRecords: !!student.student_academic_records,
                    academicRecordsLength: student.student_academic_records?.length,
                    currentAcademicRecord,
                    extractedClassDivisionId: class_division_id
                });
                return res.status(400).json({
                    status: 'error',
                    message: 'Student is not assigned to any class or no ongoing academic record found'
                });
            }

            logger.info('✅ Class division ID extracted successfully:', class_division_id);

            // Build query for class timetable
            logger.info('=== TIMETABLE QUERY START ===');
            logger.info('Building timetable query for class_division_id:', class_division_id);

            let query = adminSupabase
                .from('class_timetable')
                .select(`
                    *,
                    config:timetable_config(
                        id,
                        name,
                        total_periods,
                        days_per_week
                    ),
                    teacher:users!class_timetable_teacher_id_fkey(
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('class_division_id', class_division_id)
                .eq('is_active', true)
                .order('day_of_week', { ascending: true })
                .order('period_number', { ascending: true });

            logger.info('Query built successfully');

            if (config_id) {
                query = query.eq('config_id', config_id);
            }

            if (academic_year_id) {
                query = query.eq('config.academic_year_id', academic_year_id);
            }

            logger.info('Executing timetable query...');
            const { data, error } = await query;

            logger.info('Timetable query result:', {
                dataCount: data?.length || 0,
                error: error?.message || null
            });

            if (error) {
                logger.error('Timetable query failed:', error);
                throw error;
            }

            logger.info('=== RESPONSE PREPARATION ===');
            logger.info('Organizing timetable data by day...');

            // Organize by day
            const timetableByDay = {};
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            data.forEach(entry => {
                const dayName = days[entry.day_of_week - 1];
                if (!timetableByDay[dayName]) {
                    timetableByDay[dayName] = [];
                }
                // Enhance entry with subject information
                const subjectInfo = subjectMap[entry.subject];

                // Debug: Log the lookup for this specific entry
                const entryDebugInfo = {
                    entry_subject_id: entry.subject,
                    subject_found: !!subjectInfo,
                    subject_info: subjectInfo,
                    available_subject_ids: Object.keys(subjectMap)
                };
                logger.info('Subject lookup for entry:', entryDebugInfo);
                console.log('🔍 ENTRY DEBUG:', entryDebugInfo);

                const enhancedEntry = {
                    ...entry,
                    subject_info: subjectInfo ? {
                        id: subjectInfo.id,
                        name: subjectInfo.name,
                        code: subjectInfo.code,
                        display_name: subjectInfo.name
                    } : {
                        id: 'free_period',
                        name: 'Free Period',
                        code: null,
                        display_name: 'Free Period'
                    }
                };

                timetableByDay[dayName].push(enhancedEntry);
            });

            // Sort periods within each day
            Object.keys(timetableByDay).forEach(day => {
                timetableByDay[day].sort((a, b) => a.period_number - b.period_number);
            });

            logger.info('✅ Timetable organized successfully');
            logger.info('Final response data:', {
                student_id,
                class_division_id,
                total_entries: data.length,
                days_with_entries: Object.keys(timetableByDay)
            });

            logger.info('=== STUDENT TIMETABLE ENDPOINT SUCCESS ===');
            logger.info('Sending successful response to client');

            res.json({
                status: 'success',
                data: {
                    student_id,
                    class_division_id: class_division_id,
                    timetable: timetableByDay,
                    total_entries: data.length
                }
            });
        } catch (error) {
            logger.error('=== STUDENT TIMETABLE ENDPOINT ERROR ===');
            logger.error('Error details:', {
                message: error.message,
                stack: error.stack,
                student_id,
                user_id: req.user.id
            });
            next(error);
        }
    }
);

// Get teacher timetable
router.get('/teacher/:teacher_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { teacher_id } = req.params;
            const { config_id, academic_year_id } = req.query;

            // Verify teacher exists
            const { data: teacher, error: teacherError } = await adminSupabase
                .from('users')
                .select('id, full_name, role')
                .eq('id', teacher_id)
                .eq('role', 'teacher')
                .single();

            if (teacherError || !teacher) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Teacher not found'
                });
            }

            // Check permissions
            if (req.user.role === 'teacher' && req.user.id !== teacher_id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view your own timetable'
                });
            }

            // Build query
            let query = adminSupabase
                .from('class_timetable')
                .select(`
                    *,
                    config:timetable_config(
                        id,
                        name,
                        total_periods,
                        days_per_week
                    ),
                    class_division:class_divisions(
                        id,
                        division,
                        class_level:class_levels(name)
                    )
                `)
                .eq('teacher_id', teacher_id)
                .eq('is_active', true)
                .order('day_of_week', { ascending: true })
                .order('period_number', { ascending: true });

            if (config_id) {
                query = query.eq('config_id', config_id);
            }

            if (academic_year_id) {
                query = query.eq('config.academic_year_id', academic_year_id);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Fetch all subjects to create a lookup map (including inactive ones for debugging)
            const { data: subjects, error: subjectsError } = await adminSupabase
                .from('subjects')
                .select('id, name, code, is_active');

            if (subjectsError) {
                logger.warn('Error fetching subjects:', subjectsError);
            }

            // Create subject lookup map
            const subjectMap = {};
            if (subjects) {
                subjects.forEach(subject => {
                    subjectMap[subject.id] = subject;
                });
            }

            // Debug: Log subject lookup info
            const debugInfo = {
                total_subjects: subjects?.length || 0,
                subject_ids_in_timetable: [...new Set(data.map(entry => entry.subject))],
                subject_map_keys: Object.keys(subjectMap),
                sample_subject: subjects?.[0]
            };
            logger.info('Subject lookup debug:', debugInfo);
            console.log('🔍 TIMETABLE DEBUG:', debugInfo);

            // Organize by day
            const timetableByDay = {};
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

            data.forEach(entry => {
                const dayName = days[entry.day_of_week - 1];
                if (!timetableByDay[dayName]) {
                    timetableByDay[dayName] = [];
                }
                // Enhance entry with subject information
                const subjectInfo = subjectMap[entry.subject];

                // Debug: Log the lookup for this specific entry
                const entryDebugInfo = {
                    entry_subject_id: entry.subject,
                    subject_found: !!subjectInfo,
                    subject_info: subjectInfo,
                    available_subject_ids: Object.keys(subjectMap)
                };
                logger.info('Subject lookup for entry:', entryDebugInfo);
                console.log('🔍 ENTRY DEBUG:', entryDebugInfo);

                const enhancedEntry = {
                    ...entry,
                    subject_info: subjectInfo ? {
                        id: subjectInfo.id,
                        name: subjectInfo.name,
                        code: subjectInfo.code,
                        display_name: subjectInfo.name
                    } : {
                        id: 'free_period',
                        name: 'Free Period',
                        code: null,
                        display_name: 'Free Period'
                    }
                };

                timetableByDay[dayName].push(enhancedEntry);
            });

            // Sort periods within each day
            Object.keys(timetableByDay).forEach(day => {
                timetableByDay[day].sort((a, b) => a.period_number - b.period_number);
            });

            res.json({
                status: 'success',
                data: {
                    teacher: {
                        id: teacher.id,
                        full_name: teacher.full_name,
                        role: teacher.role
                    },
                    timetable: timetableByDay,
                    total_entries: data.length
                }
            });
        } catch (error) {
            logger.error('Error fetching teacher timetable:', error);
            next(error);
        }
    }
);

// Update timetable entry
router.put('/entries/:id',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    [
        body('subject').optional().isString().trim(),
        body('teacher_id').optional().isUUID().withMessage('Valid teacher ID is required if provided'),
        body('notes').optional().isString().trim()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const updateData = {};

            // Build update data
            ['subject', 'teacher_id', 'notes'].forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            // For teachers, validate they can only update timetables for their assigned classes
            if (req.user.role === 'teacher') {
                const { data: existingEntry, error: entryError } = await adminSupabase
                    .from('class_timetable')
                    .select('class_division_id')
                    .eq('id', id)
                    .single();

                if (entryError || !existingEntry) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Timetable entry not found'
                    });
                }

                // Check multiple possible table structures for teacher assignments
                let teacherAssignment = null;

                logger.info('Teacher validation - checking assignments for:', {
                    teacher_id: req.user.id,
                    class_division_id: existingEntry.class_division_id
                });

                // Try multiple possible table structures
                const possibleTables = [
                    'class_teacher_assignments',
                    'teacher_assignments',
                    'staff_assignments',
                    'class_assignments'
                ];

                for (const tableName of possibleTables) {
                    try {
                        const { data: assignment, error } = await adminSupabase
                            .from(tableName)
                            .select('id')
                            .eq('teacher_id', req.user.id)
                            .eq('class_division_id', existingEntry.class_division_id)
                            .eq('is_active', true)
                            .single();

                        logger.info(`Table ${tableName} check result:`, { assignment, error });

                        if (assignment) {
                            teacherAssignment = assignment;
                            logger.info(`Found assignment in ${tableName} table`);
                            break;
                        }
                    } catch (err) {
                        logger.info(`Table ${tableName} not accessible or doesn't exist:`, err.message);
                    }
                }

                // If still not found, try the legacy class_divisions table
                if (!teacherAssignment) {
                    try {
                        const { data: legacyAssignment, error: legacyError } = await adminSupabase
                            .from('class_divisions')
                            .select('id')
                            .eq('id', existingEntry.class_division_id)
                            .eq('teacher_id', req.user.id)
                            .single();

                        logger.info('Legacy table check result:', { legacyAssignment, legacyError });

                        if (legacyAssignment) {
                            teacherAssignment = legacyAssignment;
                            logger.info('Found assignment in legacy table');
                        }
                    } catch (err) {
                        logger.info('Legacy table check failed:', err.message);
                    }
                }

                // If still not found, try a broader search in any table that might have teacher assignments
                if (!teacherAssignment) {
                    try {
                        // Try to find any table that might contain teacher assignments
                        const { data: anyAssignment, error: anyError } = await adminSupabase
                            .from('class_divisions')
                            .select('id, teacher_id, class_teacher_id, primary_teacher_id')
                            .eq('id', existingEntry.class_division_id)
                            .or(`teacher_id.eq.${req.user.id},class_teacher_id.eq.${req.user.id},primary_teacher_id.eq.${req.user.id}`)
                            .single();

                        logger.info('Broader search result:', { anyAssignment, anyError });

                        if (anyAssignment) {
                            teacherAssignment = anyAssignment;
                            logger.info('Found assignment in broader search');
                        }
                    } catch (err) {
                        logger.info('Broader search failed:', err.message);
                    }
                }

                logger.info('Final teacher assignment result:', { teacherAssignment });

                if (!teacherAssignment) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only update timetables for your assigned classes'
                    });
                }
            }

            // Check if entry exists
            const { data: existingEntry, error: checkError } = await adminSupabase
                .from('class_timetable')
                .select('*')
                .eq('id', id)
                .single();

            if (checkError || !existingEntry) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Timetable entry not found'
                });
            }

            // Update entry
            const { data, error } = await adminSupabase
                .from('class_timetable')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            logger.info('Timetable entry updated:', {
                entry_id: id,
                updated_by: req.user.id,
                changes: updateData
            });

            res.json({
                status: 'success',
                message: 'Timetable entry updated successfully',
                data: { entry: data }
            });
        } catch (error) {
            logger.error('Error updating timetable entry:', error);
            next(error);
        }
    }
);

// Delete timetable entry
router.delete('/entries/:id',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Check if entry exists
            const { data: existingEntry, error: checkError } = await adminSupabase
                .from('class_timetable')
                .select('id, subject, class_division_id')
                .eq('id', id)
                .single();

            // For teachers, validate they can only delete timetables for their assigned classes
            if (req.user.role === 'teacher') {
                // Check multiple possible table structures for teacher assignments
                let teacherAssignment = null;

                logger.info('Teacher validation - checking assignments for:', {
                    teacher_id: req.user.id,
                    class_division_id: existingEntry.class_division_id
                });

                // Try multiple possible table structures
                const possibleTables = [
                    'class_teacher_assignments',
                    'teacher_assignments',
                    'staff_assignments',
                    'class_assignments'
                ];

                for (const tableName of possibleTables) {
                    try {
                        const { data: assignment, error } = await adminSupabase
                            .from(tableName)
                            .select('id')
                            .eq('teacher_id', req.user.id)
                            .eq('class_division_id', existingEntry.class_division_id)
                            .eq('is_active', true)
                            .single();

                        logger.info(`Table ${tableName} check result:`, { assignment, error });

                        if (assignment) {
                            teacherAssignment = assignment;
                            logger.info(`Found assignment in ${tableName} table`);
                            break;
                        }
                    } catch (err) {
                        logger.info(`Table ${tableName} not accessible or doesn't exist:`, err.message);
                    }
                }

                // If still not found, try the legacy class_divisions table
                if (!teacherAssignment) {
                    try {
                        const { data: legacyAssignment, error: legacyError } = await adminSupabase
                            .from('class_divisions')
                            .select('id')
                            .eq('id', existingEntry.class_division_id)
                            .eq('teacher_id', req.user.id)
                            .single();

                        logger.info('Legacy table check result:', { legacyAssignment, legacyError });

                        if (legacyAssignment) {
                            teacherAssignment = legacyAssignment;
                            logger.info('Found assignment in legacy table');
                        }
                    } catch (err) {
                        logger.info('Legacy table check failed:', err.message);
                    }
                }

                // If still not found, try a broader search in any table that might have teacher assignments
                if (!teacherAssignment) {
                    try {
                        // Try to find any table that might contain teacher assignments
                        const { data: anyAssignment, error: anyError } = await adminSupabase
                            .from('class_divisions')
                            .select('id, teacher_id, class_teacher_id, primary_teacher_id')
                            .eq('id', existingEntry.class_division_id)
                            .or(`teacher_id.eq.${req.user.id},class_teacher_id.eq.${req.user.id},primary_teacher_id.eq.${req.user.id}`)
                            .single();

                        logger.info('Broader search result:', { anyAssignment, anyError });

                        if (anyAssignment) {
                            teacherAssignment = anyAssignment;
                            logger.info('Found assignment in broader search');
                        }
                    } catch (err) {
                        logger.info('Broader search failed:', err.message);
                    }
                }

                logger.info('Final teacher assignment result:', { teacherAssignment });

                if (!teacherAssignment) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only delete timetables for your assigned classes'
                    });
                }
            }

            if (checkError || !existingEntry) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Timetable entry not found'
                });
            }

            // Soft delete
            const { error } = await adminSupabase
                .from('class_timetable')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;

            logger.info('Timetable entry deleted:', {
                entry_id: id,
                deleted_by: req.user.id,
                subject: existingEntry.subject,
                class_division_id: existingEntry.class_division_id
            });

            res.json({
                status: 'success',
                message: 'Timetable entry deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting timetable entry:', error);
            next(error);
        }
    }
);

// Bulk create timetable entries
router.post('/bulk-entries',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    [
        body('config_id').isUUID().withMessage('Valid config ID is required'),
        body('class_division_id').isUUID().withMessage('Valid class division ID is required'),
        body('entries').isArray({ min: 1 }).withMessage('At least one entry is required'),
        body('entries.*.period_number').isInt({ min: 1, max: 10 }).withMessage('Period number must be between 1 and 10'),
        body('entries.*.day_of_week').isInt({ min: 1, max: 7 }).withMessage('Day of week must be between 1 and 7'),
        body('entries.*.subject').optional().isString().trim(),
        body('entries.*.teacher_id').optional().isUUID().withMessage('Valid teacher ID is required if provided'),
        body('entries.*.notes').optional().isString().trim()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { config_id, class_division_id, entries } = req.body;

            // For teachers, validate they can only manage timetables for their assigned classes
            if (req.user.role === 'teacher') {
                // Check multiple possible table structures for teacher assignments
                let teacherAssignment = null;

                logger.info('Teacher validation - checking assignments for:', {
                    teacher_id: req.user.id,
                    class_division_id: class_division_id
                });

                // Try multiple possible table structures
                const possibleTables = [
                    'class_teacher_assignments',
                    'teacher_assignments',
                    'staff_assignments',
                    'class_assignments'
                ];

                for (const tableName of possibleTables) {
                    try {
                        const { data: assignments, error } = await adminSupabase
                            .from(tableName)
                            .select('id')
                            .eq('teacher_id', req.user.id)
                            .eq('class_division_id', class_division_id)
                            .eq('is_active', true);

                        logger.info(`Table ${tableName} check result:`, { assignments, error });

                        if (assignments && assignments.length > 0) {
                            teacherAssignment = assignments[0]; // Take first assignment
                            logger.info(`Found assignment in ${tableName} table`);
                            break;
                        }
                    } catch (err) {
                        logger.info(`Table ${tableName} not accessible or doesn't exist:`, err.message);
                    }
                }

                // If still not found, try the legacy class_divisions table
                if (!teacherAssignment) {
                    try {
                        const { data: legacyAssignment, error: legacyError } = await adminSupabase
                            .from('class_divisions')
                            .select('id')
                            .eq('id', class_division_id)
                            .eq('teacher_id', req.user.id)
                            .single();

                        logger.info('Legacy table check result:', { legacyAssignment, legacyError });

                        if (legacyAssignment) {
                            teacherAssignment = legacyAssignment;
                            logger.info('Found assignment in legacy table');
                        }
                    } catch (err) {
                        logger.info('Legacy table check failed:', err.message);
                    }
                }

                // If still not found, try a broader search in any table that might have teacher assignments
                if (!teacherAssignment) {
                    try {
                        // Try to find any table that might contain teacher assignments
                        const { data: anyAssignment, error: anyError } = await adminSupabase
                            .from('class_divisions')
                            .select('id, teacher_id, class_teacher_id, primary_teacher_id')
                            .eq('id', class_division_id)
                            .or(`teacher_id.eq.${req.user.id},class_teacher_id.eq.${req.user.id},primary_teacher_id.eq.${req.user.id}`)
                            .single();

                        logger.info('Broader search result:', { anyAssignment, anyError });

                        if (anyAssignment) {
                            teacherAssignment = anyAssignment;
                            logger.info('Found assignment in broader search');
                        }
                    } catch (err) {
                        logger.info('Broader search failed:', err.message);
                    }
                }

                logger.info('Final teacher assignment result:', { teacherAssignment });

                if (!teacherAssignment) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only manage timetables for your assigned classes'
                    });
                }
            }

            // Validate config exists
            const { data: config, error: configError } = await adminSupabase
                .from('timetable_config')
                .select('total_periods, days_per_week')
                .eq('id', config_id)
                .eq('is_active', true)
                .single();

            if (configError || !config) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid timetable configuration'
                });
            }

            // Prepare entries for insertion
            const entriesToInsert = entries.map(entry => ({
                config_id,
                class_division_id,
                period_number: entry.period_number,
                day_of_week: entry.day_of_week,
                subject: entry.subject || null,
                teacher_id: entry.teacher_id || null,
                notes: entry.notes || null,
                created_by: req.user.id
            }));

            // Insert all entries
            const { data, error } = await adminSupabase
                .from('class_timetable')
                .insert(entriesToInsert)
                .select();

            if (error) throw error;

            logger.info('Bulk timetable entries created:', {
                config_id,
                class_division_id,
                total_entries: data.length,
                created_by: req.user.id
            });

            res.status(201).json({
                status: 'success',
                message: `${data.length} timetable entries created successfully`,
                data: { entries: data }
            });
        } catch (error) {
            logger.error('Error creating bulk timetable entries:', error);
            next(error);
        }
    }
);

// Debug endpoint to check subjects
router.get('/debug/subjects',
    authenticate,
    async (req, res, next) => {
        try {
            // Get all subjects (both active and inactive)
            const { data: allSubjects, error: allError } = await adminSupabase
                .from('subjects')
                .select('id, name, code, is_active')
                .order('name');

            if (allError) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch subjects',
                    error: allError
                });
            }

            // Get only active subjects
            const activeSubjects = allSubjects?.filter(s => s.is_active) || [];
            const inactiveSubjects = allSubjects?.filter(s => !s.is_active) || [];

            // Test the specific subject ID from the timetable
            const testSubjectId = "e1e3b4d8-9ac2-4e57-b829-3f66869816c7";
            const testSubject = allSubjects?.find(s => s.id === testSubjectId);

            res.json({
                status: 'success',
                data: {
                    total_subjects: allSubjects?.length || 0,
                    active_subjects: activeSubjects.length,
                    inactive_subjects: inactiveSubjects.length,
                    all_subjects: allSubjects,
                    active_subjects_only: activeSubjects,
                    inactive_subjects_only: inactiveSubjects,
                    test_subject_lookup: {
                        subject_id: testSubjectId,
                        found: !!testSubject,
                        subject_data: testSubject
                    }
                }
            });

        } catch (error) {
            logger.error('Error in debug subjects:', error);
            next(error);
        }
    }
);

export default router;
