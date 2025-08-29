import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

// Import getActiveAcademicYear function from attendance routes
async function getActiveAcademicYear() {
    try {
        const { data: academicYear, error } = await adminSupabase
            .from('academic_years')
            .select('*')
            .eq('is_active', true)
            .single();

        if (error) throw error;
        return academicYear;
    } catch (error) {
        console.error('Error getting active academic year:', error);
        throw error;
    }
}

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
        body('class_division_ids').optional().isArray(),
        body('is_multi_class').optional().isBoolean(),
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
                class_division_ids = [],
                is_multi_class = false,
                is_single_day = true,
                start_time,
                end_time,
                event_category = 'general',
                timezone = 'Asia/Kolkata'
            } = req.body;

            // Determine event type and class assignments
            let finalEventType = event_type;
            let finalClassDivisionId = null;
            let finalClassDivisionIds = [];
            let finalIsMultiClass = false;

            if (class_division_ids && class_division_ids.length > 0) {
                // Multi-class event - but use class_specific type as per requirement
                finalEventType = 'class_specific';
                finalClassDivisionIds = class_division_ids;
                finalClassDivisionId = null;
                finalIsMultiClass = true;
            } else if (class_division_id) {
                // Single class event
                finalEventType = 'class_specific';
                finalClassDivisionId = class_division_id;
                finalClassDivisionIds = [];
                finalIsMultiClass = false;
            } else if (event_type === 'school_wide') {
                // School-wide event
                finalEventType = 'school_wide';
                finalClassDivisionId = null;
                finalClassDivisionIds = [];
                finalIsMultiClass = false;
            }

            // Validate class divisions exist
            if (finalClassDivisionIds.length > 0) {
                const { data: validClasses, error: classError } = await adminSupabase
                    .from('class_divisions')
                    .select('id, division, academic_year:academic_year_id (year_name), class_level:class_level_id (name)')
                    .in('id', finalClassDivisionIds);

                if (classError || validClasses.length !== finalClassDivisionIds.length) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'One or more class divisions not found'
                    });
                }

                console.log(`✅ Validated ${validClasses.length} classes:`,
                    validClasses.map(c => `${c.class_level.name} ${c.division}`));
            } else if (finalClassDivisionId) {
                // Validate single class division exists
                const { data: classDivision, error: classDivisionError } = await adminSupabase
                    .from('class_divisions')
                    .select('id, division, academic_year:academic_year_id (year_name), class_level:class_level_id (name)')
                    .eq('id', finalClassDivisionId)
                    .single();

                if (classDivisionError || !classDivision) {
                    console.log(`❌ Class division validation failed:`, {
                        class_division_id: finalClassDivisionId,
                        error: classDivisionError,
                        data: classDivision
                    });
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid class_division_id provided'
                    });
                }

                console.log(`✅ Class division validated: ${classDivision.class_level.name} ${classDivision.division}`);
            }

            // Convert IST time to UTC for storage
            let utcEventDate = new Date(event_date);
            if (timezone === 'Asia/Kolkata') {
                // If the input is in IST, convert to UTC
                const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
                utcEventDate = new Date(utcEventDate.getTime() - istOffset);
            }

            // Determine event status based on user role and event type
            let eventStatus = 'approved'; // Default status

            // Approval logic based on user role
            if (req.user.role === 'teacher') {
                // Teacher events need principal approval
                eventStatus = 'pending';
            } else if (req.user.role === 'principal') {
                // Principal events are auto-approved
                eventStatus = 'approved';
            } else if (req.user.role === 'admin') {
                // Admin events are auto-approved
                eventStatus = 'approved';
            }
            // All other roles (parents, etc.) - events are auto-approved

            const { data, error } = await adminSupabase
                .from('calendar_events')
                .insert([{
                    title,
                    description,
                    event_date: utcEventDate.toISOString(),
                    event_type: finalEventType,
                    class_division_id: finalClassDivisionId,
                    class_division_ids: finalClassDivisionIds,
                    class_divisions: finalClassDivisionIds.length > 0 ? finalClassDivisionIds : (finalClassDivisionId ? [finalClassDivisionId] : []),
                    is_multi_class: finalIsMultiClass,
                    is_single_day,
                    start_time,
                    end_time,
                    event_category,
                    timezone,
                    status: eventStatus,
                    created_by: req.user.id
                }])
                .select(`
                    *,
                    creator:created_by (id, full_name, role),
                    approver:approved_by (id, full_name, role),
                    class:class_division_id (
                        id,
                        division,
                        academic_year:academic_year_id (year_name),
                        class_level:class_level_id (name)
                    )
                `)
                .single();

            if (error) throw error;

            // Add status message based on the event status
            let statusMessage = 'Event created successfully';
            if (data.status === 'pending') {
                statusMessage = 'Event created successfully and is pending approval';
            } else if (data.status === 'approved') {
                statusMessage = 'Event created and approved successfully';
            }

            // Add multi-class information to message
            const eventClassDivisions = data.class_divisions || [];
            if (eventClassDivisions.length > 1) {
                const classCount = eventClassDivisions.length;
                statusMessage += ` for ${classCount} class${classCount > 1 ? 'es' : ''}`;
            }

            // If this is a multi-class event, fetch the class details
            let eventWithClasses = { ...data };
            if (eventClassDivisions.length > 1) {
                try {
                    const { data: classDetails, error: classError } = await adminSupabase
                        .from('class_divisions')
                        .select('id, division, academic_year:academic_year_id (year_name), class_level:class_level_id (name)')
                        .in('id', eventClassDivisions);

                    if (!classError && classDetails) {
                        eventWithClasses.classes = classDetails;
                    }
                } catch (err) {
                    console.log('Could not fetch class details for multi-class event:', err.message);
                }
            }

            // Auto-sync to attendance holidays if this is a holiday/exam event (optimized inline sync)
            if (['holiday', 'exam'].includes(event_category)) {
                try {
                    const eventDate = data.event_date.split('T')[0];

                    // Check if holiday already exists
                    const { data: existingHoliday, error: checkError } = await adminSupabase
                        .from('attendance_holidays')
                        .select('id')
                        .eq('holiday_date', eventDate)
                        .eq('academic_year_id', (await getActiveAcademicYear()).id)
                        .single();

                    if (existingHoliday) {
                        // Update existing holiday
                        await adminSupabase
                            .from('attendance_holidays')
                            .update({
                                holiday_name: data.title,
                                holiday_type: event_category === 'exam' ? 'exam' :
                                    (data.event_type === 'school_wide' ? 'school' : 'class_specific'),
                                description: data.description,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingHoliday.id);
                    } else {
                        // Create new holiday
                        await adminSupabase
                            .from('attendance_holidays')
                            .insert([{
                                holiday_date: eventDate,
                                holiday_name: data.title,
                                holiday_type: event_category === 'exam' ? 'exam' :
                                    (data.event_type === 'school_wide' ? 'school' : 'class_specific'),
                                description: data.description,
                                academic_year_id: (await getActiveAcademicYear()).id
                            }]);
                    }

                    console.log('Auto-synced calendar event to holiday:', data.title);
                } catch (syncError) {
                    console.error('Error auto-syncing calendar event to holiday:', syncError);
                    // Don't fail the main request if sync fails
                }
            }

            res.status(201).json({
                status: 'success',
                message: statusMessage,
                data: {
                    event: eventWithClasses,
                    approval_status: data.status,
                    requires_approval: data.status === 'pending',
                    class_count: eventClassDivisions.length || 1
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get events (ULTRA-OPTIMIZED VERSION)
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
                status,
                use_ist = 'true'
            } = req.query;

            // Try to use the optimized database function first
            let events = [];
            let error = null;

            try {
                const result = await adminSupabase.rpc('get_optimized_calendar_events', {
                    p_start_date: start_date || null,
                    p_end_date: end_date || null,
                    p_event_type: event_type || null,
                    p_event_category: event_category || null,
                    p_status: status || null,
                    p_class_division_id: class_division_id || null,
                    p_user_role: req.user.role,
                    p_user_id: req.user.id
                });
                events = result.data || [];
                error = result.error;
            } catch (rpcError) {
                // Fallback to optimized direct query if function doesn't exist
                console.log('Using fallback optimized query...');

                // Determine status filter based on user role
                let statusFilter = 'approved';
                if (status) {
                    if (['admin', 'principal'].includes(req.user.role)) {
                        statusFilter = status;
                    } else if (req.user.role === 'teacher' && ['approved', 'pending', 'rejected'].includes(status)) {
                        statusFilter = status;
                    } else if (status !== 'approved') {
                        return res.status(400).json({
                            status: 'error',
                            message: 'You can only view approved events'
                        });
                    }
                } else if (['admin', 'principal'].includes(req.user.role)) {
                    statusFilter = null; // Show all events
                }

                // Build optimized query with joins
                let query = adminSupabase
                    .from('calendar_events')
                    .select(`
                        *,
                        creator:created_by(id, full_name, role),
                        approver:approved_by(id, full_name, role),
                        class_division:class_division_id(
                            id,
                            division,
                            class_level:class_levels(name, sequence_number)
                        )
                    `);

                // Apply filters
                if (statusFilter) {
                    query = query.eq('status', statusFilter);
                }
                if (start_date) {
                    query = query.gte('event_date', start_date);
                }
                if (end_date) {
                    query = query.lte('event_date', end_date);
                }
                if (class_division_id) {
                    query = query.or(`class_division_id.eq.${class_division_id},class_divisions.cs.{${class_division_id}}`);
                }
                if (event_type) {
                    query = query.eq('event_type', event_type);
                }
                if (event_category) {
                    query = query.eq('event_category', event_category);
                }

                query = query.order('event_date', { ascending: true }).limit(1000);

                const result = await query;
                events = result.data || [];
                error = result.error;

                // Apply teacher filtering if needed
                if (req.user.role === 'teacher' && !status && !error) {
                    const { data: assignments } = await adminSupabase
                        .from('class_teacher_assignments')
                        .select('class_division_id')
                        .eq('teacher_id', req.user.id)
                        .eq('is_active', true);

                    const teacherClassIds = assignments?.map(a => a.class_division_id) || [];

                    events = events.filter(event => {
                        // Show approved events
                        if (event.status === 'approved') return true;

                        // Show teacher's own pending events
                        if (event.status === 'pending' && event.created_by === req.user.id) return true;

                        // Show school-wide events
                        if (event.event_type === 'school_wide') return true;

                        // Show events for teacher's assigned classes
                        if (event.class_division_id && teacherClassIds.includes(event.class_division_id)) return true;

                        // Show multi-class events for teacher's classes
                        if (event.class_divisions) {
                            let classDivisions = [];
                            if (typeof event.class_divisions === 'string') {
                                try {
                                    classDivisions = JSON.parse(event.class_divisions);
                                } catch (e) {
                                    classDivisions = [];
                                }
                            } else if (Array.isArray(event.class_divisions)) {
                                classDivisions = event.class_divisions;
                            }
                            return classDivisions.some(classId => teacherClassIds.includes(classId));
                        }

                        return false;
                    });
                }
            }

            if (error) throw error;

            // Minimal post-processing for class info
            const processedEvents = events.map(event => {
                let classDivisions = [];
                if (event.class_divisions) {
                    if (typeof event.class_divisions === 'string') {
                        try {
                            classDivisions = JSON.parse(event.class_divisions);
                        } catch (e) {
                            classDivisions = [];
                        }
                    } else if (Array.isArray(event.class_divisions)) {
                        classDivisions = event.class_divisions;
                    }
                }

                // Set class info based on type
                let classInfo;
                if (classDivisions.length > 1) {
                    classInfo = {
                        type: 'multi_class',
                        class_count: classDivisions.length,
                        class_ids: classDivisions,
                        message: `Applies to ${classDivisions.length} classes`
                    };
                } else if (classDivisions.length === 1) {
                    classInfo = {
                        type: 'single_class',
                        class_count: 1,
                        message: 'Class-specific event'
                    };
                } else if (event.event_type === 'school_wide') {
                    classInfo = {
                        type: 'school_wide',
                        class_count: 0,
                        message: 'Applies to all classes'
                    };
                } else if (event.class_division) {
                    classInfo = event.class_division;
                } else {
                    classInfo = {
                        type: 'unknown',
                        class_count: 0,
                        message: 'Class information not available'
                    };
                }

                return {
                    ...event,
                    class_info: classInfo,
                    status: event.status || 'approved',
                    approved_by: event.approved_by || null,
                    approved_at: event.approved_at || null,
                    rejection_reason: event.rejection_reason || null
                };
            });

            res.json({
                status: 'success',
                data: { events: processedEvents }
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
                        approver:approved_by (id, full_name, role),
                        class:class_division_id (
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        )
                    `)
                    .eq('status', 'approved'); // Parents only see approved events

                // Build the OR condition based on whether parent has children
                if (classDivisionIds.length > 0) {
                    // Include school-wide events, single class events, and multi-class events
                    const conditions = ['event_type.eq.school_wide'];

                    // Single class events
                    conditions.push(`class_division_id.in.(${classDivisionIds.join(',')})`);

                    // Multi-class events - check if any of the classes match parent's children
                    conditions.push(`class_division_ids.cs.{${classDivisionIds.join(',')}}`);

                    query = query.or(conditions.join(','));
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

            // Post-process to filter by status if using IST functions
            let filteredEvents = data || [];
            if (use_ist === 'true') {
                filteredEvents = filteredEvents.filter(event => event.status === 'approved');
            }

            res.json({
                status: 'success',
                data: {
                    events: filteredEvents,
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

                // Post-process to filter by status if using IST functions
                let filteredEvents = data || [];
                if (use_ist === 'true') {
                    filteredEvents = filteredEvents.filter(event => event.status === 'approved');
                }

                return res.json({
                    status: 'success',
                    data: {
                        events: filteredEvents,
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
                    // Single class events
                    conditions.push(`class_division_id.in.(${classDivisionIds.join(',')})`);
                    // Multi-class events - check if any of the classes match teacher's assignments
                    conditions.push(`class_division_ids.cs.{${classDivisionIds.join(',')}}`);
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

            // Post-process to filter by status if using IST functions
            let filteredEvents = data || [];
            if (use_ist === 'true') {
                filteredEvents = filteredEvents.filter(event => event.status === 'approved');
            }

            res.json({
                status: 'success',
                data: {
                    events: filteredEvents,
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

            // Use adminSupabase to bypass RLS policies
            const query = adminSupabase
                .from('calendar_events')
                .select(`
                        *,
                        creator:created_by (id, full_name, role),
                    approver:approved_by (id, full_name, role)
                `)
                .eq('id', id);

            const { data, error } = await query;

            if (error) throw error;

            if (!data || data.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Event not found'
                });
            }

            // If multiple records found, take the first one (should not happen with proper UUID)
            const eventData = data.length > 1 ? data[0] : data[0];

            // Process the event to handle multi-class events
            let processedEvent = { ...eventData };

            // Use the new consolidated class_divisions column
            let classDivisions = [];
            if (eventData.class_divisions) {
                // Handle both JSONB arrays and JSON strings
                if (typeof eventData.class_divisions === 'string') {
                    try {
                        classDivisions = JSON.parse(eventData.class_divisions);
                    } catch (e) {
                        console.log('Error parsing class_divisions:', eventData.class_divisions);
                        classDivisions = [];
                    }
                } else if (Array.isArray(eventData.class_divisions)) {
                    classDivisions = eventData.class_divisions;
                }
            }
            const isMultiClass = classDivisions.length > 1;
            const isSingleClass = classDivisions.length === 1;
            const isSchoolWide = classDivisions.length === 0 && eventData.event_type === 'school_wide';

            if (isMultiClass) {
                // Multi-class event
                processedEvent.class_info = {
                    type: 'multi_class',
                    class_count: classDivisions.length,
                    class_ids: classDivisions,
                    message: `Applies to ${classDivisions.length} classes`
                };
            } else if (isSingleClass) {
                // Single class event - fetch class info separately
                if (classDivisions[0]) {
                    const { data: classData } = await supabase
                        .from('class_divisions')
                        .select(`
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        `)
                        .eq('id', classDivisions[0])
                        .single();

                    processedEvent.class_info = classData || {
                        type: 'single_class',
                        class_count: 1,
                        message: 'Class information not available'
                    };
                } else {
                    processedEvent.class_info = {
                        type: 'single_class',
                        class_count: 1,
                        message: 'Class information not available'
                    };
                }
            } else if (isSchoolWide) {
                // School-wide event
                processedEvent.class_info = {
                    type: 'school_wide',
                    class_count: 0,
                    message: 'Applies to all classes'
                };
            } else {
                // Handle events with no class information or empty class_divisions
                if (eventData.event_type === 'school_wide') {
                    processedEvent.class_info = {
                        type: 'school_wide',
                        class_count: 0,
                        message: 'Applies to all classes'
                    };
                } else if (eventData.class_division_id) {
                    // Single class event with class_division_id but no class_divisions
                    const { data: classData } = await adminSupabase
                        .from('class_divisions')
                        .select(`
                                id,
                                division,
                                academic_year:academic_year_id (year_name),
                                class_level:class_level_id (name)
                            `)
                        .eq('id', eventData.class_division_id)
                        .single();

                    processedEvent.class_info = classData || {
                        type: 'single_class',
                        class_count: 1,
                        message: 'Class information not available'
                    };
                } else {
                    // Fallback for other cases
                    processedEvent.class_info = {
                        type: 'unknown',
                        class_count: 0,
                        message: 'Class information not available'
                    };
                }
            }

            res.json({
                status: 'success',
                data: { event: processedEvent }
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
        body('class_division_ids').optional().isArray(),
        body('is_multi_class').optional().isBoolean(),
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

            // Handle multi-class event type changes
            if (updateData.class_division_ids && updateData.class_division_ids.length > 0) {
                // Converting to multi-class event - but use class_specific type as per requirement
                updateData.event_type = 'class_specific';
                updateData.class_division_id = null;
                updateData.is_multi_class = true;
            } else if (updateData.class_division_id) {
                // Converting to single class event
                updateData.event_type = 'class_specific';
                updateData.class_division_ids = [];
                updateData.is_multi_class = false;
            }

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
                .select(`
                    *,
                    creator:created_by (id, full_name, role),
                    approver:approved_by (id, full_name, role),
                    class:class_division_id (
                        id,
                        division,
                        academic_year:academic_year_id (year_name),
                        class_level:class_level_id (name)
                    )
                `)
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Event not found'
                });
            }

            // Auto-sync to attendance holidays if this is a holiday/exam event (optimized inline sync)
            if (['holiday', 'exam'].includes(data.event_category)) {
                try {
                    const eventDate = data.event_date.split('T')[0];

                    // Check if holiday already exists
                    const { data: existingHoliday, error: checkError } = await adminSupabase
                        .from('attendance_holidays')
                        .select('id')
                        .eq('holiday_date', eventDate)
                        .eq('academic_year_id', (await getActiveAcademicYear()).id)
                        .single();

                    if (existingHoliday) {
                        // Update existing holiday
                        await adminSupabase
                            .from('attendance_holidays')
                            .update({
                                holiday_name: data.title,
                                holiday_type: data.event_category === 'exam' ? 'exam' :
                                    (data.event_type === 'school_wide' ? 'school' : 'class_specific'),
                                description: data.description,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingHoliday.id);
                    } else {
                        // Create new holiday
                        await adminSupabase
                            .from('attendance_holidays')
                            .insert([{
                                holiday_date: eventDate,
                                holiday_name: data.title,
                                holiday_type: data.event_category === 'exam' ? 'exam' :
                                    (data.event_type === 'school_wide' ? 'school' : 'class_specific'),
                                description: data.description,
                                academic_year_id: (await getActiveAcademicYear()).id
                            }]);
                    }

                    console.log('Auto-synced updated calendar event to holiday:', data.title);
                } catch (syncError) {
                    console.error('Error auto-syncing updated calendar event to holiday:', syncError);
                    // Don't fail the main request if sync fails
                }
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
                .select('event_type, class_division_id, created_by, event_category')
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

            // Auto-sync to attendance holidays if this was a holiday/exam event (optimized inline sync)
            if (['holiday', 'exam'].includes(event.event_category)) {
                try {
                    const eventDate = new Date(event.event_date).toISOString().split('T')[0];

                    // Check if there are other holiday/exam events for this date
                    const { data: otherEvents, error: otherError } = await adminSupabase
                        .from('calendar_events')
                        .select('id')
                        .eq('event_date::date', eventDate)
                        .in('event_category', ['holiday', 'exam'])
                        .eq('status', 'approved')
                        .neq('id', id);

                    // If no other events, delete the holiday
                    if (!otherEvents || otherEvents.length === 0) {
                        await adminSupabase
                            .from('attendance_holidays')
                            .delete()
                            .eq('holiday_date', eventDate)
                            .eq('academic_year_id', (await getActiveAcademicYear()).id);

                        console.log('Auto-synced deleted calendar event to holiday:', event.title);
                    } else {
                        console.log('Event deleted but other holiday events exist for this date');
                    }
                } catch (syncError) {
                    console.error('Error auto-syncing deleted calendar event to holiday:', syncError);
                    // Don't fail the main request if sync fails
                }
            }

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
                    .from('class_teacher_assignments')
                    .select('*')
                    .eq('teacher_id', req.user.id)
                    .eq('class_division_id', class_division_id)
                    .eq('is_active', true)
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
                    creator:created_by (id, full_name, role),
                    class:class_division_id (
                        id,
                        division,
                        academic_year:academic_year_id (year_name),
                        class_level:class_level_id (name)
                    )
                `)
                .or(`class_division_id.eq.${class_division_id},class_divisions.cs.{${class_division_id}}`)
                .or(`event_type.eq.class_specific`);

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

// Approve event (Admin/Principal only)
router.post('/events/:id/approve',
    authenticate,
    async (req, res, next) => {
        try {
            // Check if user is admin or principal
            if (!['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only admin and principal can approve events'
                });
            }

            const { id } = req.params;

            // Get the event
            const { data: event, error: fetchError } = await adminSupabase
                .from('calendar_events')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !event) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Event not found'
                });
            }

            // Check if event is pending approval
            if (event.status !== 'pending') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Event is not pending approval'
                });
            }

            // Approve the event
            const { data: updatedEvent, error: updateError } = await adminSupabase
                .from('calendar_events')
                .update({
                    status: 'approved',
                    approved_by: req.user.id,
                    approved_at: new Date().toISOString()
                })
                .eq('id', id)
                .select(`
                    *,
                    creator:created_by (id, full_name, role),
                    approver:approved_by (id, full_name, role),
                    class:class_division_id (
                        id,
                        division,
                        academic_year:academic_year_id (year_name),
                        class_level:class_level_id (name)
                    )
                `)
                .single();

            if (updateError) throw updateError;

            res.json({
                status: 'success',
                message: 'Event approved successfully',
                data: { event: updatedEvent }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Reject event (Principal only)
router.post('/events/:id/reject',
    authenticate,
    [
        body('rejection_reason').notEmpty().trim().withMessage('Rejection reason is required')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            // Check if user is admin or principal
            if (!['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only admin and principal can reject events'
                });
            }

            const { id } = req.params;
            const { rejection_reason } = req.body;

            // Get the event
            const { data: event, error: fetchError } = await adminSupabase
                .from('calendar_events')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !event) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Event not found'
                });
            }

            // Check if event is pending approval
            if (event.status !== 'pending') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Event is not pending approval'
                });
            }

            // Reject the event
            const { data: updatedEvent, error: updateError } = await adminSupabase
                .from('calendar_events')
                .update({
                    status: 'rejected',
                    approved_by: req.user.id,
                    approved_at: new Date().toISOString(),
                    rejection_reason: rejection_reason
                })
                .eq('id', id)
                .select(`
                    *,
                    creator:created_by (id, full_name, role),
                    approver:approved_by (id, full_name, role),
                    class:class_division_id (
                        id,
                        division,
                        academic_year:academic_year_id (year_name),
                        class_level:class_level_id (name)
                    )
                `)
                .single();

            if (updateError) throw updateError;

            res.json({
                status: 'success',
                message: 'Event rejected successfully',
                data: { event: updatedEvent }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get pending events for approval (Principal only)
router.get('/events/pending',
    authenticate,
    async (req, res, next) => {
        try {
            // Check if user is principal
            if (req.user.role !== 'principal') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only principals can view pending events'
                });
            }

            const { data: pendingEvents, error } = await adminSupabase
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
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;

            res.json({
                status: 'success',
                data: { events: pendingEvents || [] }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router; 