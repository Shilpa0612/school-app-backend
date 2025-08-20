import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ==================== PERIODS MANAGEMENT ====================

// Create period
router.post('/periods',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('name').isString().trim().notEmpty().withMessage('Period name is required'),
        body('start_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('Start time must be in HH:MM:SS format'),
        body('end_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('End time must be in HH:MM:SS format'),
        body('period_type').optional().isIn(['academic', 'break', 'lunch', 'assembly', 'other']).withMessage('Invalid period type'),
        body('sequence_number').isInt({ min: 1 }).withMessage('Sequence number must be a positive integer')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, start_time, end_time, period_type = 'academic', sequence_number } = req.body;

            // Check for time conflicts
            const { data: conflictingPeriods, error: conflictError } = await adminSupabase
                .from('periods')
                .select('id, name, start_time, end_time')
                .eq('is_active', true)
                .or(`start_time.lt.${end_time},end_time.gt.${start_time}`);

            if (conflictError) {
                logger.error('Error checking period conflicts:', conflictError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to check period conflicts'
                });
            }

            if (conflictingPeriods && conflictingPeriods.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Period time conflicts with existing periods',
                    conflicts: conflictingPeriods
                });
            }

            const { data, error } = await adminSupabase
                .from('periods')
                .insert([{
                    name,
                    start_time,
                    end_time,
                    period_type,
                    sequence_number
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { period: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get all periods
router.get('/periods',
    authenticate,
    async (req, res, next) => {
        try {
            const { include_inactive = 'false' } = req.query;

            let query = adminSupabase
                .from('periods')
                .select('*')
                .order('sequence_number');

            if (include_inactive !== 'true') {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;

            if (error) throw error;

            res.json({
                status: 'success',
                data: { periods: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update period
router.put('/periods/:id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('name').optional().isString().trim().notEmpty().withMessage('Period name cannot be empty'),
        body('start_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('Start time must be in HH:MM:SS format'),
        body('end_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('End time must be in HH:MM:SS format'),
        body('period_type').optional().isIn(['academic', 'break', 'lunch', 'assembly', 'other']).withMessage('Invalid period type'),
        body('sequence_number').optional().isInt({ min: 1 }).withMessage('Sequence number must be a positive integer'),
        body('is_active').optional().isBoolean().withMessage('is_active must be boolean')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const updates = req.body;

            // If updating times, check for conflicts
            if (updates.start_time || updates.end_time) {
                const { data: currentPeriod } = await adminSupabase
                    .from('periods')
                    .select('start_time, end_time')
                    .eq('id', id)
                    .single();

                const startTime = updates.start_time || currentPeriod?.start_time;
                const endTime = updates.end_time || currentPeriod?.end_time;

                const { data: conflictingPeriods, error: conflictError } = await adminSupabase
                    .from('periods')
                    .select('id, name, start_time, end_time')
                    .eq('is_active', true)
                    .neq('id', id)
                    .or(`start_time.lt.${endTime},end_time.gt.${startTime}`);

                if (conflictError) {
                    logger.error('Error checking period conflicts:', conflictError);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Failed to check period conflicts'
                    });
                }

                if (conflictingPeriods && conflictingPeriods.length > 0) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Period time conflicts with existing periods',
                        conflicts: conflictingPeriods
                    });
                }
            }

            const { data, error } = await adminSupabase
                .from('periods')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { period: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete period (soft delete)
router.delete('/periods/:id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Check if period is used in any timetables
            const { data: usedInTimetables, error: checkError } = await adminSupabase
                .from('timetable_entries')
                .select('id')
                .eq('period_id', id)
                .eq('is_active', true)
                .limit(1);

            if (checkError) {
                logger.error('Error checking period usage:', checkError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to check period usage'
                });
            }

            if (usedInTimetables && usedInTimetables.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot delete period that is used in timetables'
                });
            }

            const { error } = await adminSupabase
                .from('periods')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;

            res.json({
                status: 'success',
                message: 'Period deactivated successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== TIMETABLE MANAGEMENT ====================

// Create timetable entry
router.post('/entries',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('class_division_id').isUUID().withMessage('Valid class division ID is required'),
        body('academic_year_id').isUUID().withMessage('Valid academic year ID is required'),
        body('period_id').isUUID().withMessage('Valid period ID is required'),
        body('day_of_week').isInt({ min: 1, max: 6 }).withMessage('Day of week must be 1-6 (1=Monday, 2=Tuesday, etc., 6=Saturday)'),
        body('subject').optional().isString().trim().withMessage('Subject must be a string'),
        body('teacher_id').optional().isUUID().withMessage('Valid teacher ID if provided'),
        body('notes').optional().isString().trim().withMessage('Notes must be a string')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                class_division_id,
                academic_year_id,
                period_id,
                day_of_week,
                subject,
                teacher_id,
                notes
            } = req.body;

            // Verify class division exists
            const { data: classDivision, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('id')
                .eq('id', class_division_id)
                .single();

            if (classError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Verify period exists
            const { data: period, error: periodError } = await adminSupabase
                .from('periods')
                .select('id, period_type')
                .eq('id', period_id)
                .eq('is_active', true)
                .single();

            if (periodError || !period) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Period not found or inactive'
                });
            }

            // Verify teacher exists if provided
            if (teacher_id) {
                const { data: teacher, error: teacherError } = await adminSupabase
                    .from('users')
                    .select('id, role')
                    .eq('id', teacher_id)
                    .eq('role', 'teacher')
                    .single();

                if (teacherError || !teacher) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Teacher not found or invalid role'
                    });
                }
            }

            // Check for conflicts
            const { data: existingEntry, error: conflictError } = await adminSupabase
                .from('timetable_entries')
                .select('id, subject, teacher_id')
                .eq('class_division_id', class_division_id)
                .eq('academic_year_id', academic_year_id)
                .eq('period_id', period_id)
                .eq('day_of_week', day_of_week)
                .eq('is_active', true)
                .single();

            if (conflictError && conflictError.code !== 'PGRST116') {
                logger.error('Error checking timetable conflicts:', conflictError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to check timetable conflicts'
                });
            }

            if (existingEntry) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Timetable entry already exists for this class, period, and day',
                    existing_entry: existingEntry
                });
            }

            // Check teacher conflicts if teacher is assigned
            if (teacher_id) {
                const { data: teacherConflict, error: teacherConflictError } = await adminSupabase
                    .from('timetable_entries')
                    .select('id, class_division_id, subject')
                    .eq('teacher_id', teacher_id)
                    .eq('academic_year_id', academic_year_id)
                    .eq('period_id', period_id)
                    .eq('day_of_week', day_of_week)
                    .eq('is_active', true)
                    .single();

                if (teacherConflictError && teacherConflictError.code !== 'PGRST116') {
                    logger.error('Error checking teacher conflicts:', teacherConflictError);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Failed to check teacher conflicts'
                    });
                }

                if (teacherConflict) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Teacher is already assigned to another class during this period',
                        teacher_conflict: teacherConflict
                    });
                }
            }

            const { data, error } = await adminSupabase
                .from('timetable_entries')
                .insert([{
                    class_division_id,
                    academic_year_id,
                    period_id,
                    day_of_week,
                    subject,
                    teacher_id,
                    notes,
                    created_by: req.user.id
                }])
                .select(`
                    *,
                    period:period_id (
                        id,
                        name,
                        start_time,
                        end_time,
                        period_type
                    ),
                    teacher:teacher_id (
                        id,
                        full_name
                    ),
                    class_division:class_division_id (
                        id,
                        division,
                        class_level:class_level_id (
                            name
                        )
                    )
                `)
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { timetable_entry: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get timetable for a class
router.get('/class/:class_division_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const { day_of_week } = req.query;

            // Verify class division exists
            const { data: classDivision, error: classError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    class_level:class_level_id (
                        name
                    ),
                    academic_year:academic_year_id (
                        year_name
                    )
                `)
                .eq('id', class_division_id)
                .single();

            if (classError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Check access permissions
            if (req.user.role === 'teacher') {
                const { data: assignment, error: assignmentError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id')
                    .eq('class_division_id', class_division_id)
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true)
                    .single();

                if (assignmentError || !assignment) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only view timetables for your assigned classes'
                    });
                }
            } else if (req.user.role === 'parent') {
                // Parents can view timetables for their children's classes
                const { data: childClasses, error: childError } = await adminSupabase
                    .from('student_academic_records')
                    .select('class_division_id')
                    .eq('student_id', req.user.id) // Assuming parent can access their children's data
                    .eq('status', 'ongoing');

                if (childError) {
                    logger.error('Error checking parent access:', childError);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Failed to verify access permissions'
                    });
                }

                const hasAccess = childClasses?.some(record => record.class_division_id === class_division_id);
                if (!hasAccess) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only view timetables for your children\'s classes'
                    });
                }
            }

            // Build query
            let query = adminSupabase
                .from('timetable_entries')
                .select(`
                    *,
                    period:period_id (
                        id,
                        name,
                        start_time,
                        end_time,
                        period_type,
                        sequence_number
                    ),
                    teacher:teacher_id (
                        id,
                        full_name
                    )
                `)
                .eq('class_division_id', class_division_id)
                .eq('is_active', true)
                .order('period(sequence_number)');

            if (day_of_week !== undefined) {
                query = query.eq('day_of_week', parseInt(day_of_week));
            }

            const { data: entries, error } = await query;

            if (error) throw error;

            // Group by day of week (Monday to Saturday)
            const timetableByDay = {};
            const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            for (let day = 1; day <= 6; day++) {
                timetableByDay[day] = {
                    day_name: dayNames[day],
                    day_number: day,
                    entries: []
                };
            }

            entries.forEach(entry => {
                if (timetableByDay[entry.day_of_week]) {
                    timetableByDay[entry.day_of_week].entries.push(entry);
                }
            });

            // Sort entries by period sequence within each day
            Object.values(timetableByDay).forEach(day => {
                day.entries.sort((a, b) => a.period.sequence_number - b.period.sequence_number);
            });

            res.json({
                status: 'success',
                data: {
                    class_division: classDivision,
                    timetable: timetableByDay,
                    total_entries: entries.length
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get teacher's timetable
router.get('/teacher/:teacher_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { teacher_id } = req.params;
            const { day_of_week } = req.query;

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

            // Check access permissions
            if (req.user.role === 'teacher' && req.user.id !== teacher_id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view your own timetable'
                });
            }

            // Build query
            let query = adminSupabase
                .from('timetable_entries')
                .select(`
                    *,
                    period:period_id (
                        id,
                        name,
                        start_time,
                        end_time,
                        period_type,
                        sequence_number
                    ),
                    class_division:class_division_id (
                        id,
                        division,
                        class_level:class_level_id (
                            name
                        ),
                        academic_year:academic_year_id (
                            year_name
                        )
                    )
                `)
                .eq('teacher_id', teacher_id)
                .eq('is_active', true)
                .order('period(sequence_number)');

            if (day_of_week !== undefined) {
                query = query.eq('day_of_week', parseInt(day_of_week));
            }

            const { data: entries, error } = await query;

            if (error) throw error;

            // Group by day of week (Monday to Saturday)
            const timetableByDay = {};
            const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            for (let day = 1; day <= 6; day++) {
                timetableByDay[day] = {
                    day_name: dayNames[day],
                    day_number: day,
                    entries: []
                };
            }

            entries.forEach(entry => {
                if (timetableByDay[entry.day_of_week]) {
                    timetableByDay[entry.day_of_week].entries.push(entry);
                }
            });

            // Sort entries by period sequence within each day
            Object.values(timetableByDay).forEach(day => {
                day.entries.sort((a, b) => a.period.sequence_number - b.period.sequence_number);
            });

            res.json({
                status: 'success',
                data: {
                    teacher: {
                        id: teacher.id,
                        full_name: teacher.full_name
                    },
                    timetable: timetableByDay,
                    total_entries: entries.length
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update timetable entry
router.put('/entries/:id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('subject').optional().isString().trim().withMessage('Subject must be a string'),
        body('teacher_id').optional().isUUID().withMessage('Valid teacher ID if provided'),
        body('notes').optional().isString().trim().withMessage('Notes must be a string')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const updates = req.body;

            // Verify entry exists
            const { data: existingEntry, error: fetchError } = await adminSupabase
                .from('timetable_entries')
                .select('*')
                .eq('id', id)
                .eq('is_active', true)
                .single();

            if (fetchError || !existingEntry) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Timetable entry not found'
                });
            }

            // Verify teacher exists if updating
            if (updates.teacher_id) {
                const { data: teacher, error: teacherError } = await adminSupabase
                    .from('users')
                    .select('id, role')
                    .eq('id', updates.teacher_id)
                    .eq('role', 'teacher')
                    .single();

                if (teacherError || !teacher) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Teacher not found or invalid role'
                    });
                }

                // Check teacher conflicts
                const { data: teacherConflict, error: teacherConflictError } = await adminSupabase
                    .from('timetable_entries')
                    .select('id, class_division_id, subject')
                    .eq('teacher_id', updates.teacher_id)
                    .eq('period_id', existingEntry.period_id)
                    .eq('day_of_week', existingEntry.day_of_week)
                    .eq('is_active', true)
                    .neq('id', id)
                    .single();

                if (teacherConflictError && teacherConflictError.code !== 'PGRST116') {
                    logger.error('Error checking teacher conflicts:', teacherConflictError);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Failed to check teacher conflicts'
                    });
                }

                if (teacherConflict) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Teacher is already assigned to another class during this period',
                        teacher_conflict: teacherConflict
                    });
                }
            }

            const { data, error } = await adminSupabase
                .from('timetable_entries')
                .update(updates)
                .eq('id', id)
                .select(`
                    *,
                    period:period_id (
                        id,
                        name,
                        start_time,
                        end_time,
                        period_type
                    ),
                    teacher:teacher_id (
                        id,
                        full_name
                    ),
                    class_division:class_division_id (
                        id,
                        division,
                        class_level:class_level_id (
                            name
                        )
                    )
                `)
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { timetable_entry: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete timetable entry (soft delete)
router.delete('/entries/:id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            const { error } = await adminSupabase
                .from('timetable_entries')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;

            res.json({
                status: 'success',
                message: 'Timetable entry deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// ==================== TEMPLATE MANAGEMENT ====================

// Create timetable template
router.post('/templates',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('name').isString().trim().notEmpty().withMessage('Template name is required'),
        body('description').optional().isString().trim().withMessage('Description must be a string'),
        body('academic_year_id').optional().isUUID().withMessage('Valid academic year ID if provided'),
        body('class_level_id').optional().isUUID().withMessage('Valid class level ID if provided')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { name, description, academic_year_id, class_level_id } = req.body;

            const { data, error } = await adminSupabase
                .from('timetable_templates')
                .insert([{
                    name,
                    description,
                    academic_year_id,
                    class_level_id,
                    created_by: req.user.id
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { template: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get all templates
router.get('/templates',
    authenticate,
    async (req, res, next) => {
        try {
            const { include_inactive = 'false' } = req.query;

            let query = adminSupabase
                .from('timetable_templates')
                .select(`
                    *,
                    academic_year:academic_year_id (
                        year_name
                    ),
                    class_level:class_level_id (
                        name
                    ),
                    creator:created_by (
                        full_name
                    )
                `)
                .order('created_at', { ascending: false });

            if (include_inactive !== 'true') {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query;

            if (error) throw error;

            res.json({
                status: 'success',
                data: { templates: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Apply template to class
router.post('/templates/:template_id/apply/:class_division_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { template_id, class_division_id } = req.params;

            // Verify template exists
            const { data: template, error: templateError } = await adminSupabase
                .from('timetable_templates')
                .select('*')
                .eq('id', template_id)
                .eq('is_active', true)
                .single();

            if (templateError || !template) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Template not found'
                });
            }

            // Verify class division exists
            const { data: classDivision, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('id')
                .eq('id', class_division_id)
                .single();

            if (classError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Get template entries
            const { data: templateEntries, error: entriesError } = await adminSupabase
                .from('template_entries')
                .select('*')
                .eq('template_id', template_id)
                .eq('is_active', true);

            if (entriesError) throw entriesError;

            if (!templateEntries || templateEntries.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Template has no entries'
                });
            }

            // Clear existing timetable entries for this class
            const { error: clearError } = await adminSupabase
                .from('timetable_entries')
                .update({ is_active: false })
                .eq('class_division_id', class_division_id);

            if (clearError) throw clearError;

            // Create new timetable entries from template
            const timetableEntries = templateEntries.map(entry => ({
                class_division_id,
                academic_year_id: classDivision.academic_year_id,
                period_id: entry.period_id,
                day_of_week: entry.day_of_week,
                subject: entry.subject,
                notes: entry.notes,
                created_by: req.user.id
            }));

            const { data: newEntries, error: createError } = await adminSupabase
                .from('timetable_entries')
                .insert(timetableEntries)
                .select(`
                    *,
                    period:period_id (
                        name,
                        start_time,
                        end_time
                    )
                `);

            if (createError) throw createError;

            res.status(201).json({
                status: 'success',
                data: {
                    template: template,
                    applied_entries: newEntries,
                    total_entries: newEntries.length
                },
                message: `Template applied successfully. ${newEntries.length} entries created.`
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
