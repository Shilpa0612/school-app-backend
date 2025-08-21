import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create event
router.post('/events',
    authenticate,
    [
        body('title').notEmpty().trim(),
        body('description').notEmpty().trim(),
        body('event_date').isISO8601().toDate(),
        body('event_type').optional().isIn(['school_wide', 'class_specific', 'teacher_specific']),
        body('class_division_id').optional().isUUID(),
        body('is_single_day').optional().isBoolean(),
        body('start_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
        body('end_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
        body('event_category').optional().isIn(['general', 'academic', 'sports', 'cultural', 'holiday', 'exam', 'meeting', 'other']),
        body('timezone').optional().isString()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                title,
                description,
                event_date,
                event_type = 'school_wide',
                class_division_id,
                is_single_day = true,
                start_time,
                end_time,
                event_category = 'general',
                timezone = 'Asia/Kolkata'
            } = req.body;

            // Access control
            if (event_type === 'school_wide' && !['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only admin and principal can create school-wide events'
                });
            }

            if (event_type === 'class_specific') {
                if (!class_division_id) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'class_division_id is required for class-specific events'
                    });
                }

                // Check if teacher is assigned to this class
                if (req.user.role === 'teacher') {
                    // Check both new teacher assignment system and legacy system
                    const { data: teacherAssignment, error: assignmentError } = await supabase
                        .from('teacher_class_assignments')
                        .select('*')
                        .eq('teacher_id', req.user.id)
                        .eq('class_division_id', class_division_id)
                        .eq('is_active', true)
                        .single();

                    // If not found in new system, check legacy system
                    if (assignmentError || !teacherAssignment) {
                        const { data: legacyAssignment, error: legacyError } = await supabase
                            .from('class_divisions')
                            .select('teacher_id')
                            .eq('id', class_division_id)
                            .eq('teacher_id', req.user.id)
                            .single();

                        if (legacyError || !legacyAssignment) {
                            return res.status(403).json({
                                status: 'error',
                                message: 'You can only create events for your assigned classes'
                            });
                        }
                    }
                } else if (!['admin', 'principal'].includes(req.user.role)) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Only admin, principal, and assigned teachers can create class-specific events'
                    });
                }
            }

            // Convert IST time to UTC for storage
            let utcEventDate = new Date(event_date);
            if (timezone === 'Asia/Kolkata') {
                // If the input is in IST, convert to UTC
                const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
                utcEventDate = new Date(utcEventDate.getTime() - istOffset);
            }

            const { data, error } = await adminSupabase
                .from('calendar_events')
                .insert([{
                    title,
                    description,
                    event_date: utcEventDate.toISOString(),
                    event_type,
                    class_division_id,
                    is_single_day,
                    start_time,
                    end_time,
                    event_category,
                    timezone,
                    created_by: req.user.id
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { event: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get events
router.get('/events',
    authenticate,
    async (req, res, next) => {
        try {
            const {
                start_date,
                end_date,
                class_division_id,
                event_type,
                event_category,
                use_ist = 'true'
            } = req.query;

            let query;

            if (use_ist === 'true') {
                // Use the custom function for IST timezone
                query = supabase.rpc('get_events_with_ist', {
                    p_start_date: start_date,
                    p_end_date: end_date,
                    p_class_division_id: class_division_id,
                    p_event_type: event_type,
                    p_event_category: event_category
                });
            } else {
                // Use regular query
                query = supabase
                    .from('calendar_events')
                    .select(`
                    *,
                        creator:created_by (id, full_name, role),
                        class:class_division_id (
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        )
                    `);

                // Apply filters
                if (start_date) {
                    query = query.gte('event_date', start_date);
                }
                if (end_date) {
                    query = query.lte('event_date', end_date);
                }
                if (class_division_id) {
                    query = query.eq('class_division_id', class_division_id);
                }
                if (event_type) {
                    query = query.eq('event_type', event_type);
                }
                if (event_category) {
                    query = query.eq('event_category', event_category);
                }

                query = query.order('event_date', { ascending: true });
            }

            const { data, error } = await query;

            if (error) throw error;

            res.json({
                status: 'success',
                data: { events: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get all relevant events for parents (school-wide + class-specific for their children)
router.get('/events/parent',
    authenticate,
    async (req, res, next) => {
        try {
            const {
                start_date,
                end_date,
                event_category,
                use_ist = 'true'
            } = req.query;

            // Verify user is a parent
            if (req.user.role !== 'parent') {
                return res.status(403).json({
                    status: 'error',
                    message: 'This endpoint is only for parents'
                });
            }

            // First, get all student IDs for this parent
            const { data: parentMappings, error: mappingsError } = await supabase
                .from('parent_student_mappings')
                .select('student_id')
                .eq('parent_id', req.user.id);

            if (mappingsError) throw mappingsError;

            const studentIds = parentMappings?.map(mapping => mapping.student_id) || [];

            // Get all class divisions where parent has children enrolled
            let childClasses = [];
            let classDivisionIds = [];

            if (studentIds.length > 0) {
                const { data: childClassesData, error: childClassesError } = await supabase
                    .from('student_academic_records')
                    .select(`
                        class_division_id,
                        class_divisions!inner (
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        )
                    `)
                    .in('student_id', studentIds)
                    .eq('status', 'ongoing');

                if (childClassesError) throw childClassesError;

                childClasses = childClassesData || [];
                classDivisionIds = childClasses?.map(record => record.class_division_id) || [];
            }

            let query;

            if (use_ist === 'true') {
                // Use the custom function for IST timezone with parent-specific filtering
                query = supabase.rpc('get_parent_events_with_ist', {
                    p_start_date: start_date,
                    p_end_date: end_date,
                    p_event_category: event_category,
                    p_class_division_ids: classDivisionIds
                });
            } else {
                // Use regular query with parent-specific filtering
                query = supabase
                    .from('calendar_events')
                    .select(`
                        *,
                        creator:created_by (id, full_name, role),
                        class:class_division_id (
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        )
                    `);

                // Build the OR condition based on whether parent has children
                if (classDivisionIds.length > 0) {
                    query = query.or(`event_type.eq.school_wide,class_division_id.in.(${classDivisionIds.join(',')})`);
                } else {
                    // If no children, only show school-wide events
                    query = query.eq('event_type', 'school_wide');
                }

                // Apply filters
                if (start_date) {
                    query = query.gte('event_date', start_date);
                }
                if (end_date) {
                    query = query.lte('event_date', end_date);
                }
                if (event_category) {
                    query = query.eq('event_category', event_category);
                }

                query = query.order('event_date', { ascending: true });
            }

            const { data, error } = await query;

            if (error) throw error;

            res.json({
                status: 'success',
                data: {
                    events: data,
                    child_classes: childClasses?.map(record => record.class_divisions) || []
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get all relevant events for teachers (school-wide + assigned classes)
router.get('/events/teacher',
    authenticate,
    async (req, res, next) => {
        try {
            const {
                start_date,
                end_date,
                event_category,
                event_type,
                class_division_id,
                use_ist = 'true'
            } = req.query;

            // Verify user is a teacher
            if (req.user.role !== 'teacher') {
                return res.status(403).json({
                    status: 'error',
                    message: 'This endpoint is only for teachers'
                });
            }

            // Get all class divisions where teacher is assigned
            const { data: teacherAssignments, error: assignmentsError } = await supabase
                .from('class_teacher_assignments')
                .select(`
                    class_division_id,
                    assignment_type,
                    subject,
                    is_primary,
                    class_divisions!inner (
                        id,
                        division,
                        academic_year:academic_year_id (year_name),
                        class_level:class_level_id (name)
                    )
                `)
                .eq('teacher_id', req.user.id)
                .eq('is_active', true);

            if (assignmentsError) throw assignmentsError;

            const assignedClasses = teacherAssignments || [];
            const classDivisionIds = assignedClasses?.map(assignment => assignment.class_division_id) || [];

            // If teacher has no assigned classes, only show school-wide events
            if (classDivisionIds.length === 0) {
                let query;

                if (use_ist === 'true') {
                    query = supabase.rpc('get_events_with_ist', {
                        p_start_date: start_date,
                        p_end_date: end_date,
                        p_event_type: 'school_wide',
                        p_event_category: event_category
                    });
                } else {
                    query = supabase
                        .from('calendar_events')
                        .select(`
                            *,
                            creator:created_by (id, full_name, role),
                            class:class_division_id (
                                id,
                                division,
                                academic_year:academic_year_id (year_name),
                                class_level:class_level_id (name)
                            )
                        `)
                        .eq('event_type', 'school_wide');

                    // Apply filters
                    if (start_date) {
                        query = query.gte('event_date', start_date);
                    }
                    if (end_date) {
                        query = query.lte('event_date', end_date);
                    }
                    if (event_category) {
                        query = query.eq('event_category', event_category);
                    }

                    query = query.order('event_date', { ascending: true });
                }

                const { data, error } = await query;
                if (error) throw error;

                return res.json({
                    status: 'success',
                    data: {
                        events: data || [],
                        assigned_classes: []
                    }
                });
            }

            let query;

            if (use_ist === 'true') {
                // Use the custom function for IST timezone with teacher-specific filtering
                query = supabase.rpc('get_teacher_events_with_ist', {
                    p_start_date: start_date,
                    p_end_date: end_date,
                    p_event_category: event_category,
                    p_event_type: event_type,
                    p_class_division_id: class_division_id,
                    p_class_division_ids: classDivisionIds
                });
            } else {
                // Use regular query with teacher-specific filtering
                query = supabase
                    .from('calendar_events')
                    .select(`
                        *,
                        creator:created_by (id, full_name, role),
                        class:class_division_id (
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        )
                    `);

                // Build the OR condition for teacher's assigned classes + school-wide events
                const conditions = ['event_type.eq.school_wide'];
                if (classDivisionIds.length > 0) {
                    conditions.push(`class_division_id.in.(${classDivisionIds.join(',')})`);
                }
                query = query.or(conditions.join(','));

                // Apply filters
                if (start_date) {
                    query = query.gte('event_date', start_date);
                }
                if (end_date) {
                    query = query.lte('event_date', end_date);
                }
                if (event_category) {
                    query = query.eq('event_category', event_category);
                }
                if (event_type) {
                    query = query.eq('event_type', event_type);
                }
                if (class_division_id) {
                    // Verify teacher is assigned to this specific class
                    if (!classDivisionIds.includes(class_division_id)) {
                        return res.status(403).json({
                            status: 'error',
                            message: 'You are not assigned to this class'
                        });
                    }
                    query = query.eq('class_division_id', class_division_id);
                }

                query = query.order('event_date', { ascending: true });
            }

            const { data, error } = await query;
            if (error) throw error;

            res.json({
                status: 'success',
                data: {
                    events: data || [],
                    assigned_classes: assignedClasses.map(assignment => ({
                        class_division_id: assignment.class_division_id,
                        assignment_type: assignment.assignment_type,
                        subject: assignment.subject,
                        is_primary: assignment.is_primary,
                        class_info: assignment.class_divisions
                    }))
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get event by ID
router.get('/events/:id',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { use_ist = 'true' } = req.query;

            let query;

            if (use_ist === 'true') {
                query = supabase.rpc('get_events_with_ist')
                    .eq('id', id)
                    .single();
            } else {
                query = supabase
                    .from('calendar_events')
                    .select(`
                        *,
                        creator:created_by (id, full_name, role),
                        class:class_division_id (
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        )
                    `)
                    .eq('id', id)
                    .single();
            }

            const { data, error } = await query;

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Event not found'
                });
            }

            res.json({
                status: 'success',
                data: { event: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update event
router.put('/events/:id',
    authenticate,
    [
        body('title').optional().notEmpty().trim(),
        body('description').optional().notEmpty().trim(),
        body('event_date').optional().isISO8601().toDate(),
        body('event_type').optional().isIn(['school_wide', 'class_specific', 'teacher_specific']),
        body('class_division_id').optional().isUUID(),
        body('is_single_day').optional().isBoolean(),
        body('start_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
        body('end_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
        body('event_category').optional().isIn(['general', 'academic', 'sports', 'cultural', 'holiday', 'exam', 'meeting', 'other']),
        body('timezone').optional().isString()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const updateData = { ...req.body };

            // Remove undefined values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) {
                    delete updateData[key];
                }
            });

            // Convert IST time to UTC if event_date is provided
            if (updateData.event_date && updateData.timezone === 'Asia/Kolkata') {
                const istOffset = 5.5 * 60 * 60 * 1000;
                const utcEventDate = new Date(updateData.event_date.getTime() - istOffset);
                updateData.event_date = utcEventDate.toISOString();
            }

            const { data, error } = await adminSupabase
                .from('calendar_events')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Event not found'
                });
            }

            res.json({
                status: 'success',
                data: { event: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete event
router.delete('/events/:id',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // First check if user has permission to delete this event
            const { data: event, error: fetchError } = await adminSupabase
                .from('calendar_events')
                .select('event_type, class_division_id, created_by')
                .eq('id', id)
                .single();

            if (fetchError || !event) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Event not found'
                });
            }

            // Check permissions
            if (event.created_by !== req.user.id && !['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only delete your own events'
                });
            }

            const { error } = await adminSupabase
                .from('calendar_events')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({
                status: 'success',
                message: 'Event deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get class-specific events for a teacher
router.get('/events/class/:class_division_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const { start_date, end_date, event_category } = req.query;

            // Verify teacher has access to this class
            if (req.user.role === 'teacher') {
                const { data: assignment, error: assignmentError } = await supabase
                    .from('teacher_class_assignments')
                    .select('*')
                    .eq('teacher_id', req.user.id)
                    .single();

                if (assignmentError || !assignment) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'You can only view events for your assigned classes'
                    });
                }
            } else if (!['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access denied'
                });
            }

            let query = supabase
                .from('calendar_events')
                .select(`
                    *,
                    creator:created_by (id, full_name, role)
                `)
                .eq('class_division_id', class_division_id)
                .eq('event_type', 'class_specific');

            if (start_date) {
                query = query.gte('event_date', start_date);
            }
            if (end_date) {
                query = query.lte('event_date', end_date);
            }
            if (event_category) {
                query = query.eq('event_category', event_category);
            }

            const { data, error } = await query
                .order('event_date', { ascending: true });

            if (error) throw error;

            res.json({
                status: 'success',
                data: { events: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router; 