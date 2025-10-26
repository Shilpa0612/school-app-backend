import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import notificationService from '../services/notificationService.js';

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

            // Handle event_date conversion properly
            let utcEventDate;
            if (typeof event_date === 'string' && event_date.endsWith('Z')) {
                // Date is already in UTC format, use as is
                utcEventDate = new Date(event_date);
            } else if (timezone === 'Asia/Kolkata') {
                // Convert IST time to UTC for storage
                const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
                utcEventDate = new Date(new Date(event_date).getTime() - istOffset);
            } else {
                // For other timezones, convert to Date object
                utcEventDate = new Date(event_date);
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

            // Send notifications for approved events (non-blocking)
            if (data.status === 'approved') {
                sendEventNotifications(data, eventClassDivisions);
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
                event_category,
                event_type,
                class_division_id,
                use_ist = 'true',
                debug = 'false',
                show_all = 'false',
                status
            } = req.query;

            console.log('Calendar events request:', {
                user_role: req.user.role,
                user_id: req.user.id,
                status,
                event_type,
                event_category,
                class_division_id
            });

            // Try to use the optimized database function first
            let events = [];
            let error = null;

            // Temporarily disable RPC call to test fallback
            const useRPC = false; // Set to true when function is working

            if (useRPC) {
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
                    console.log('RPC function failed, using fallback query...');
                    events = [];
                    error = null;
                }
            } else {
                console.log('RPC function disabled, using fallback query...');
                events = [];
                error = null;
            }

            // Determine status filter based on user role
            let statusFilter = 'approved';
            if (status) {
                if (['admin', 'principal'].includes(req.user.role)) {
                    statusFilter = status;
                } else if (req.user.role === 'teacher' && ['approved', 'pending', 'rejected'].includes(status)) {
                    // For teachers, don't apply status filter to DB query - let post-processing handle it
                    statusFilter = null;
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
            if (req.user.role === 'teacher' && !error) {
                const { data: assignments } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('class_division_id')
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true);

                const teacherClassIds = assignments?.map(a => a.class_division_id) || [];

                events = events.filter(event => {
                    // If status filter is applied, only show events matching that status
                    if (status && event.status !== status) return false;

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

            if (error && events.length === 0) {
                console.error('Calendar events query error:', error);
                throw error;
            }

            // Build lookup of class names for multi-class events
            let classIdToName = {};
            try {
                let allClassIds = new Set();
                for (const ev of events) {
                    if (ev && ev.class_divisions) {
                        let ids = [];
                        if (typeof ev.class_divisions === 'string') {
                            try { ids = JSON.parse(ev.class_divisions); } catch (_) { ids = []; }
                        } else if (Array.isArray(ev.class_divisions)) {
                            ids = ev.class_divisions;
                        }
                        ids.forEach(id => allClassIds.add(id));
                    }
                }
                const idList = Array.from(allClassIds);
                if (idList.length > 0) {
                    const { data: classesLookup } = await adminSupabase
                        .from('class_divisions')
                        .select('id, division, class_level:class_level_id (name)')
                        .in('id', idList);
                    if (Array.isArray(classesLookup)) {
                        classesLookup.forEach(cd => {
                            if (cd && cd.id && cd.class_level && cd.class_level.name && cd.division) {
                                classIdToName[cd.id] = `${cd.class_level.name} ${cd.division}`;
                            }
                        });
                    }
                }
            } catch (_) { }

            // Enhanced post-processing for class info with class division name
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

                // Compute a human-readable class division name
                let classDivisionName = null;
                let classDivisionNames = null;
                if (event.event_type === 'school_wide') {
                    classDivisionName = 'All Classes';
                    classDivisionNames = [];
                } else if (classDivisions.length > 1) {
                    const names = classDivisions.map(id => classIdToName[id]).filter(Boolean);
                    classDivisionNames = names;
                    classDivisionName = names.length ? names.join(', ') : `Multiple Classes (${classDivisions.length})`;
                } else if (event.class_division && event.class_division.class_level && event.class_division.division) {
                    classDivisionName = `${event.class_division.class_level.name} ${event.class_division.division}`;
                    classDivisionNames = [classDivisionName];
                }

                return {
                    ...event,
                    class_info: classInfo,
                    class_division_name: classDivisionName,
                    class_division_names: classDivisionNames,
                    status: event.status || 'approved',
                    approved_by: event.approved_by || null,
                    approved_at: event.approved_at || null,
                    rejection_reason: event.rejection_reason || null
                };
            });

            console.log(`Calendar events response: ${processedEvents.length} events found`);

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
                student_id, // New filter for specific student
                use_ist = 'true',
                debug = 'false',
                show_all = 'false'
            } = req.query;

            const debugInfo = debug === 'true' ? {
                parent_id: req.user.id,
                use_ist: use_ist === 'true',
                show_all: show_all === 'true',
                start_date: start_date || null,
                end_date: end_date || null,
                event_category: event_category || null,
                student_id: student_id || null
            } : null;

            // Verify user is a parent
            if (req.user.role !== 'parent') {
                return res.status(403).json({
                    status: 'error',
                    message: 'This endpoint is only for parents'
                });
            }

            // First, get all student IDs for this parent with student details
            const { data: parentMappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    students:students_master (
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .eq('parent_id', req.user.id);

            if (mappingsError) throw mappingsError;

            // Filter by specific student if provided
            let filteredMappings = parentMappings || [];
            if (student_id) {
                filteredMappings = filteredMappings.filter(mapping => mapping.student_id === student_id);
                if (filteredMappings.length === 0) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Student not found or you do not have access to this student'
                    });
                }
            }

            const studentIds = filteredMappings?.map(mapping => mapping.student_id) || [];

            // Get all class divisions where parent has children enrolled
            let childClasses = [];
            let classDivisionIds = [];

            if (studentIds.length > 0) {
                const { data: childClassesData, error: childClassesError } = await adminSupabase
                    .from('student_academic_records')
                    .select(`
                        student_id,
                        class_division_id,
                        roll_number,
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
                if (debugInfo) debugInfo.class_division_ids = classDivisionIds;
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
                    conditions.push(`class_division_ids.ov.{${classDivisionIds.join(',')}}`);

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

            let { data, error } = await query;

            if (debugInfo) debugInfo.rpc_or_query_count_initial = Array.isArray(data) ? data.length : (data ? 1 : 0);

            // Ensure relevant class-specific events are included for IST path by merging from standard query
            if (use_ist === 'true' && Array.isArray(classDivisionIds) && classDivisionIds.length > 0) {
                // Query single-class events by class_division_id
                let singleClassQuery = adminSupabase
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
                    .eq('event_type', 'class_specific')
                    .in('class_division_id', classDivisionIds);
                if (start_date) singleClassQuery = singleClassQuery.gte('event_date', start_date);
                if (end_date) singleClassQuery = singleClassQuery.lte('event_date', end_date);
                if (event_category) singleClassQuery = singleClassQuery.eq('event_category', event_category);
                singleClassQuery = singleClassQuery.order('event_date', { ascending: true });

                // Query multi-class events and filter client-side for overlap
                let multiClassQuery = adminSupabase
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
                    .eq('event_type', 'class_specific')
                    .eq('is_multi_class', true);
                if (start_date) multiClassQuery = multiClassQuery.gte('event_date', start_date);
                if (end_date) multiClassQuery = multiClassQuery.lte('event_date', end_date);
                if (event_category) multiClassQuery = multiClassQuery.eq('event_category', event_category);
                multiClassQuery = multiClassQuery.order('event_date', { ascending: true });

                const singleRes = await singleClassQuery;
                const multiRes = await multiClassQuery;

                const childIdSet = new Set(classDivisionIds);
                const multiFiltered = (multiRes.data || []).filter(ev => {
                    let ids = [];
                    if (Array.isArray(ev.class_division_ids)) {
                        ids = ev.class_division_ids;
                    } else if (ev.class_divisions) {
                        if (typeof ev.class_divisions === 'string') {
                            try { ids = JSON.parse(ev.class_divisions); } catch (_) { ids = []; }
                        } else if (Array.isArray(ev.class_divisions)) {
                            ids = ev.class_divisions;
                        }
                    }
                    return ids.some(id => childIdSet.has(id));
                });

                if (debugInfo) debugInfo.class_specific_single_class_count = Array.isArray(singleRes.data) ? singleRes.data.length : 0;
                if (debugInfo) debugInfo.class_specific_multi_candidates = Array.isArray(multiRes.data) ? multiRes.data.length : 0;
                if (debugInfo) debugInfo.class_specific_multi_filtered = multiFiltered.length;

                // Enrich/merge: prefer admin records for class-specific fields
                const byId = new Map();
                (data || []).forEach(ev => { if (ev && ev.id) byId.set(ev.id, ev); });
                const toMerge = [
                    ...((singleRes.data || [])),
                    ...multiFiltered
                ];
                let mergedNew = 0;
                for (const ev of toMerge) {
                    if (!ev || !ev.id) continue;
                    if (byId.has(ev.id)) {
                        const existing = byId.get(ev.id);
                        byId.set(ev.id, { ...existing, ...ev });
                    } else {
                        byId.set(ev.id, ev);
                        mergedNew++;
                    }
                }
                if (debugInfo) debugInfo.class_specific_merge_count = mergedNew;
                data = Array.from(byId.values());
                if (debugInfo) debugInfo.after_class_specific_merge_count = data.length;
                error = null;
            }

            if (error) throw error;

            // Post-process to filter by status if using IST functions
            let filteredEvents = data || [];
            if (use_ist === 'true' && show_all === 'true') {
                filteredEvents = data || [];
            } else if (use_ist === 'true') {
                // Parents only see approved (school-wide always passes)
                filteredEvents = filteredEvents.filter(event => {
                    if (!event) return false;
                    const typeNorm = (event.event_type || '').toString().trim().toLowerCase();
                    if (typeNorm === 'school_wide') return true;
                    const statusNorm = (event.status || '').toString().trim().toLowerCase();
                    const isApproved = statusNorm === 'approved' || !!event.approved_by || !!event.approved_at;
                    return isApproved;
                });
            }
            // Separate school-wide vs class-specific
            const schoolWideEvents = (filteredEvents || []).filter(event => {
                const typeNorm = (event?.event_type || '').toString().trim().toLowerCase();
                return typeNorm === 'school_wide';
            }).map(event => ({
                ...event,
                class_division_name: 'All Classes'
            }));
            const nonSchoolWideEvents = (filteredEvents || []).filter(event => {
                const typeNorm = (event?.event_type || '').toString().trim().toLowerCase();
                return typeNorm !== 'school_wide';
            });
            if (debugInfo) debugInfo.after_status_filter_count = filteredEvents.length;
            if (debugInfo) debugInfo.show_all = show_all === 'true';
            if (debugInfo) debugInfo.school_wide_count = schoolWideEvents.length;
            if (debugInfo) debugInfo.class_specific_count = nonSchoolWideEvents.length;

            // Group events by student and add student information
            const eventsByStudent = [];

            for (const mapping of filteredMappings) {
                const student = mapping.students;
                const studentRecord = childClasses.find(record => record.student_id === mapping.student_id);

                // Find events relevant to this student's class
                const studentEvents = nonSchoolWideEvents.filter(event => {
                    // only class-specific events relevant to this student's class
                    if (event.event_type === 'class_specific') {
                        if (event.class_division_id && studentRecord?.class_division_id === event.class_division_id) return true;
                        if (event.class_division_ids && event.class_division_ids.includes(studentRecord?.class_division_id)) return true;
                    }
                    return false;
                });

                // Add student information to each event
                const eventsWithStudentInfo = studentEvents.map(event => {
                    // Compute a human-readable class division name
                    let classDivisionName = null;
                    const eventClassDivisions = Array.isArray(event.class_division_ids) ? event.class_division_ids : [];
                    if (event.event_type === 'school_wide') {
                        classDivisionName = 'All Classes';
                    } else if (eventClassDivisions.length > 1) {
                        classDivisionName = `Multiple Classes (${eventClassDivisions.length})`;
                    } else if (event.class && event.class.class_level && event.class.division) {
                        classDivisionName = `${event.class.class_level.name} ${event.class.division}`;
                    }

                    return {
                        ...event,
                        class_division_name: classDivisionName,
                        student_info: {
                            student_id: mapping.student_id,
                            student_name: student?.full_name || 'Unknown',
                            admission_number: student?.admission_number || 'Unknown',
                            class_division_id: studentRecord?.class_division_id || null,
                            class_name: studentRecord?.class_divisions ?
                                `${studentRecord.class_divisions.class_level.name} ${studentRecord.class_divisions.division}` : 'Unknown',
                            roll_number: studentRecord?.roll_number || null
                        }
                    };
                });

                eventsByStudent.push({
                    student_id: mapping.student_id,
                    student_name: student?.full_name || 'Unknown',
                    admission_number: student?.admission_number || 'Unknown',
                    class_info: studentRecord ? {
                        class_division_id: studentRecord.class_division_id,
                        class_name: `${studentRecord.class_divisions.class_level.name} ${studentRecord.class_divisions.division}`,
                        division: studentRecord.class_divisions.division,
                        academic_year: studentRecord.class_divisions.academic_year.year_name,
                        class_level: studentRecord.class_divisions.class_level.name,
                        roll_number: studentRecord.roll_number
                    } : null,
                    events: eventsWithStudentInfo,
                    total_events: eventsWithStudentInfo.length
                });
            }

            // Sort students by name
            eventsByStudent.sort((a, b) => a.student_name.localeCompare(b.student_name));

            // Calculate summary statistics
            const classSpecificEventsTotal = eventsByStudent.reduce((sum, student) => sum + student.total_events, 0);
            const totalEvents = classSpecificEventsTotal + schoolWideEvents.length;
            const studentsWithEvents = eventsByStudent.filter(student => student.total_events > 0).length;
            const studentsWithoutEvents = eventsByStudent.filter(student => student.total_events === 0).length;

            res.json({
                status: 'success',
                data: {
                    school_wide_events: schoolWideEvents,
                    events_by_student: eventsByStudent,
                    summary: {
                        total_students: eventsByStudent.length,
                        total_events: totalEvents,
                        school_wide_events: schoolWideEvents.length,
                        class_specific_events: classSpecificEventsTotal,
                        students_with_events: studentsWithEvents,
                        students_without_events: studentsWithoutEvents,
                        filtered_by_student: !!student_id
                    },
                    filters_applied: {
                        start_date: start_date || null,
                        end_date: end_date || null,
                        event_category: event_category || null,
                        student_id: student_id || null,
                        use_ist: use_ist === 'true'
                    }
                },
                ...(debugInfo ? { debug: debugInfo } : {})
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
                use_ist = 'true',
                debug = 'false',
                show_all = 'false'
            } = req.query;

            // Verify user is a teacher
            if (req.user.role !== 'teacher') {
                return res.status(403).json({
                    status: 'error',
                    message: 'This endpoint is only for teachers'
                });
            }

            // Get all class divisions where teacher is assigned
            const { data: teacherAssignments, error: assignmentsError } = await adminSupabase
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

            // Debug logging for teacher assignments
            console.log('🔍 Teacher Events Debug:', {
                teacher_id: req.user.id,
                teacher_assignments_count: assignedClasses.length,
                class_division_ids: classDivisionIds,
                assignments: assignedClasses,
                class_division_ids_length: classDivisionIds.length,
                class_division_ids_content: classDivisionIds
            });

            const debugInfo = debug === 'true' ? {
                teacher_id: req.user.id,
                use_ist: use_ist === 'true',
                start_date: start_date || null,
                end_date: end_date || null,
                event_category: event_category || null,
                event_type: event_type || null,
                class_division_id: class_division_id || null,
                assigned_class_division_ids: classDivisionIds,
                teacher_assignments_raw: teacherAssignments,
                assignments_error: assignmentsError
            } : null;

            // If teacher has no assigned classes, only show school-wide events
            if (classDivisionIds.length === 0) {
                let query;

                if (use_ist === 'true') {
                    query = adminSupabase.rpc('get_events_with_ist', {
                        p_start_date: start_date,
                        p_end_date: end_date,
                        p_event_type: 'school_wide',
                        p_event_category: event_category
                    });
                } else {
                    query = adminSupabase
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

                let { data, error } = await query;
                if (debugInfo) debugInfo.rpc_or_query_count_initial = Array.isArray(data) ? data.length : (data ? 1 : 0);

                // Fallback: if IST RPC errors or returns no data, try standard query path
                if (use_ist === 'true' && (!data || data.length === 0)) {
                    query = adminSupabase
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

                    if (start_date) query = query.gte('event_date', start_date);
                    if (end_date) query = query.lte('event_date', end_date);
                    if (event_category) query = query.eq('event_category', event_category);
                    query = query.order('event_date', { ascending: true });

                    const fallback = await query;
                    data = fallback.data || [];
                    error = fallback.error;
                }

                // Post-process to filter by status if using IST functions
                let filteredEvents = data || [];
                if (use_ist === 'true' && show_all === 'true') {
                    filteredEvents = data || [];
                } else if (use_ist === 'true') {
                    // Teachers should see approved events and their own pending events
                    filteredEvents = filteredEvents.filter(event => {
                        if (!event) return false;
                        const typeNorm = (event.event_type || '').toString().trim().toLowerCase();
                        if (typeNorm === 'school_wide') return true;
                        const statusNorm = (event.status || '').toString().trim().toLowerCase();
                        const isApproved = statusNorm === 'approved' || !!event.approved_by || !!event.approved_at;
                        if (isApproved) return true;
                        return statusNorm === 'pending' && event.created_by === req.user.id;
                    });
                }
                if (debugInfo) debugInfo.after_status_filter_count = filteredEvents.length;
                if (debugInfo) debugInfo.show_all = show_all === 'true';

                // Add class division name to events
                const processedEvents = filteredEvents.map(event => {
                    let classDivisionName = null;
                    const eventClassDivisions = Array.isArray(event.class_division_ids) ? event.class_division_ids : [];
                    if (event.event_type === 'school_wide') {
                        classDivisionName = 'All Classes';
                    } else if (eventClassDivisions.length > 1) {
                        classDivisionName = `Multiple Classes (${eventClassDivisions.length})`;
                    } else if (event.class && event.class.class_level && event.class.division) {
                        classDivisionName = `${event.class.class_level.name} ${event.class.division}`;
                    }

                    return {
                        ...event,
                        class_division_name: classDivisionName
                    };
                });

                return res.json({
                    status: 'success',
                    data: {
                        events: processedEvents,
                        assigned_classes: []
                    }
                });
            }

            let query;

            if (use_ist === 'true') {
                // Use admin query with teacher-specific filtering (avoid RPC)
                query = adminSupabase
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

                // Try a different approach - use individual queries instead of complex OR conditions
                let allEvents = [];

                // Get school-wide events
                const schoolWideQuery = adminSupabase
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

                const { data: schoolWideEvents, error: schoolWideError } = await schoolWideQuery;
                if (!schoolWideError && schoolWideEvents) {
                    allEvents = [...allEvents, ...schoolWideEvents];
                }

                // Get single class events
                if (classDivisionIds.length > 0) {
                    const singleClassQuery = adminSupabase
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
                        .in('class_division_id', classDivisionIds);

                    const { data: singleClassEvents, error: singleClassError } = await singleClassQuery;
                    if (!singleClassError && singleClassEvents) {
                        allEvents = [...allEvents, ...singleClassEvents];
                    }

                    // Get multi-class events by checking each class individually
                    for (const classId of classDivisionIds) {
                        const multiClassQuery = adminSupabase
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
                            .contains('class_division_ids', [classId]);

                        const { data: multiClassEvents, error: multiClassError } = await multiClassQuery;
                        if (!multiClassError && multiClassEvents) {
                            // Avoid duplicates
                            const existingIds = new Set(allEvents.map(e => e.id));
                            const newEvents = multiClassEvents.filter(e => !existingIds.has(e.id));
                            allEvents = [...allEvents, ...newEvents];
                        }
                    }
                }

                // Remove duplicates and sort
                const uniqueEvents = allEvents.filter((event, index, self) =>
                    index === self.findIndex(e => e.id === event.id)
                );

                let data = uniqueEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
                let error = null;

                // Apply filters to the combined data
                if (start_date) {
                    data = data.filter(event => new Date(event.event_date) >= new Date(start_date));
                }
                if (end_date) {
                    data = data.filter(event => new Date(event.event_date) <= new Date(end_date));
                }
                if (event_category) {
                    data = data.filter(event => event.event_category === event_category);
                }
                if (event_type) {
                    data = data.filter(event => event.event_type === event_type);
                }
                if (class_division_id) {
                    // Verify teacher is assigned to this specific class
                    if (!classDivisionIds.includes(class_division_id)) {
                        return res.status(403).json({
                            status: 'error',
                            message: 'You are not assigned to this class'
                        });
                    }
                    data = data.filter(event =>
                        event.class_division_id === class_division_id ||
                        (event.class_division_ids && event.class_division_ids.includes(class_division_id))
                    );
                }

                // Debug logging for new approach
                console.log('📅 New Query Approach (IST):', {
                    class_division_ids: classDivisionIds,
                    class_division_ids_length: classDivisionIds.length,
                    use_ist: use_ist === 'true',
                    approach: 'individual_queries'
                });
            } else {
                // Use regular query with teacher-specific filtering
                query = adminSupabase
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

                // Try a different approach - use individual queries instead of complex OR conditions
                let allEvents = [];

                // Get school-wide events
                const schoolWideQuery = adminSupabase
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

                const { data: schoolWideEvents, error: schoolWideError } = await schoolWideQuery;
                if (!schoolWideError && schoolWideEvents) {
                    allEvents = [...allEvents, ...schoolWideEvents];
                }

                // Get single class events
                if (classDivisionIds.length > 0) {
                    const singleClassQuery = adminSupabase
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
                        .in('class_division_id', classDivisionIds);

                    const { data: singleClassEvents, error: singleClassError } = await singleClassQuery;
                    if (!singleClassError && singleClassEvents) {
                        allEvents = [...allEvents, ...singleClassEvents];
                    }

                    // Get multi-class events by checking each class individually
                    for (const classId of classDivisionIds) {
                        const multiClassQuery = adminSupabase
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
                            .contains('class_division_ids', [classId]);

                        const { data: multiClassEvents, error: multiClassError } = await multiClassQuery;
                        if (!multiClassError && multiClassEvents) {
                            // Avoid duplicates
                            const existingIds = new Set(allEvents.map(e => e.id));
                            const newEvents = multiClassEvents.filter(e => !existingIds.has(e.id));
                            allEvents = [...allEvents, ...newEvents];
                        }
                    }
                }

                // Remove duplicates and sort
                const uniqueEvents = allEvents.filter((event, index, self) =>
                    index === self.findIndex(e => e.id === event.id)
                );

                let data = uniqueEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
                let error = null;

                // Apply filters to the combined data
                if (start_date) {
                    data = data.filter(event => new Date(event.event_date) >= new Date(start_date));
                }
                if (end_date) {
                    data = data.filter(event => new Date(event.event_date) <= new Date(end_date));
                }
                if (event_category) {
                    data = data.filter(event => event.event_category === event_category);
                }
                if (event_type) {
                    data = data.filter(event => event.event_type === event_type);
                }
                if (class_division_id) {
                    // Verify teacher is assigned to this specific class
                    if (!classDivisionIds.includes(class_division_id)) {
                        return res.status(403).json({
                            status: 'error',
                            message: 'You are not assigned to this class'
                        });
                    }
                    data = data.filter(event =>
                        event.class_division_id === class_division_id ||
                        (event.class_division_ids && event.class_division_ids.includes(class_division_id))
                    );
                }

                // Debug logging for query conditions
                console.log('📅 Query Conditions (Regular):', {
                    conditions: conditions,
                    class_division_ids: classDivisionIds,
                    class_division_ids_length: classDivisionIds.length,
                    use_ist: use_ist === 'true',
                    final_or_condition: conditions.join(',')
                });
            }

            let { data, error } = await query;
            if (debugInfo) debugInfo.rpc_or_query_count_initial = Array.isArray(data) ? data.length : (data ? 1 : 0);

            // Debug logging for events query
            console.log('📅 Events Query Debug:', {
                events_found: Array.isArray(data) ? data.length : 0,
                events_data: data?.slice(0, 3), // Show first 3 events for debugging
                all_event_types: data?.map(e => e.event_type) || [],
                all_class_division_ids: data?.map(e => e.class_division_id) || [],
                class_specific_events: data?.filter(e => e.event_type === 'class_specific') || []
            });

            // Ensure school-wide events are always included for IST path
            if (use_ist === 'true') {
                try {
                    let swQuery = adminSupabase
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
                    if (start_date) swQuery = swQuery.gte('event_date', start_date);
                    if (end_date) swQuery = swQuery.lte('event_date', end_date);
                    if (event_category) swQuery = swQuery.eq('event_category', event_category);
                    swQuery = swQuery.order('event_date', { ascending: true });
                    const swRes = await swQuery;
                    if (debugInfo) debugInfo.school_wide_merge_count = Array.isArray(swRes.data) ? swRes.data.length : 0;
                    const existingIds = new Set((data || []).map(ev => ev.id));
                    const extra = (swRes.data || []).filter(ev => !existingIds.has(ev.id));
                    data = [...(data || []), ...extra];
                    if (debugInfo) debugInfo.after_school_wide_merge_count = data.length;
                    // clear error so fallback won't override merged data
                    error = null;
                } catch (_) { }
            }

            // Fallback: if IST RPC errors or returns no data, try standard query with OR conditions
            if (use_ist === 'true' && (!data || data.length === 0)) {
                query = adminSupabase
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

                const conditions = ['event_type.eq.school_wide'];
                if (classDivisionIds.length > 0) {
                    conditions.push(`class_division_id.in.(${classDivisionIds.join(',')})`);
                    conditions.push(`class_division_ids.ov.{${classDivisionIds.join(',')}}`);
                    conditions.push(`class_divisions.ov.{${classDivisionIds.join(',')}}`);
                }
                query = query.or(conditions.join(','));

                if (start_date) query = query.gte('event_date', start_date);
                if (end_date) query = query.lte('event_date', end_date);
                if (event_category) query = query.eq('event_category', event_category);
                if (event_type) query = query.eq('event_type', event_type);
                if (class_division_id) {
                    if (!classDivisionIds.includes(class_division_id)) {
                        return res.status(403).json({
                            status: 'error',
                            message: 'You are not assigned to this class'
                        });
                    }
                    query = query.eq('class_division_id', class_division_id);
                }
                query = query.order('event_date', { ascending: true });

                const fallback = await query;
                data = fallback.data || [];
                error = fallback.error;
                if (debugInfo) debugInfo.fallback_count = data.length;
            }

            // Post-process to filter by status if using IST functions
            let filteredEvents = data || [];
            if (use_ist === 'true' && show_all === 'true') {
                filteredEvents = data || [];
            } else if (use_ist === 'true') {
                // Teachers should see approved events and their own pending events
                filteredEvents = filteredEvents.filter(event => {
                    if (!event) return false;
                    const typeNorm = (event.event_type || '').toString().trim().toLowerCase();
                    if (typeNorm === 'school_wide') return true;
                    const statusNorm = (event.status || '').toString().trim().toLowerCase();
                    const isApproved = statusNorm === 'approved' || !!event.approved_by || !!event.approved_at;
                    if (isApproved) return true;
                    return statusNorm === 'pending' && event.created_by === req.user.id;
                });
            }
            if (debugInfo) debugInfo.after_status_filter_count = filteredEvents.length;
            if (debugInfo) debugInfo.show_all = show_all === 'true';

            // Choose base events for mapping (bypass filters when show_all=true)
            const baseEvents = (use_ist === 'true' && show_all === 'true') ? (data || []) : filteredEvents;
            if (debugInfo) debugInfo.base_events_count = Array.isArray(baseEvents) ? baseEvents.length : 0;

            // Add class division name(s) to events
            let classIdToName = {};
            try {
                let allClassIds = new Set();
                for (const ev of baseEvents) {
                    if (ev && ev.class_divisions) {
                        let ids = [];
                        if (typeof ev.class_divisions === 'string') {
                            try { ids = JSON.parse(ev.class_divisions); } catch (_) { ids = []; }
                        } else if (Array.isArray(ev.class_divisions)) {
                            ids = ev.class_divisions;
                        }
                        ids.forEach(id => allClassIds.add(id));
                    } else if (Array.isArray(ev.class_division_ids)) {
                        ev.class_division_ids.forEach(id => allClassIds.add(id));
                    }
                }
                const idList = Array.from(allClassIds);
                if (idList.length > 0) {
                    const { data: classesLookup } = await adminSupabase
                        .from('class_divisions')
                        .select('id, division, class_level:class_level_id (name)')
                        .in('id', idList);
                    if (Array.isArray(classesLookup)) {
                        classesLookup.forEach(cd => {
                            if (cd && cd.id && cd.class_level && cd.class_level.name && cd.division) {
                                classIdToName[cd.id] = `${cd.class_level.name} ${cd.division}`;
                            }
                        });
                    }
                }
            } catch (_) { }

            const processedEvents = baseEvents.map(event => {
                let classDivisionName = null;
                let classDivisionNames = null;
                let eventClassDivisions = [];
                if (event.class_divisions) {
                    if (typeof event.class_divisions === 'string') {
                        try { eventClassDivisions = JSON.parse(event.class_divisions); } catch (_) { eventClassDivisions = []; }
                    } else if (Array.isArray(event.class_divisions)) {
                        eventClassDivisions = event.class_divisions;
                    }
                } else if (Array.isArray(event.class_division_ids)) {
                    eventClassDivisions = event.class_division_ids;
                }
                if (event.event_type === 'school_wide') {
                    classDivisionName = 'All Classes';
                    classDivisionNames = [];
                } else if (eventClassDivisions.length > 1) {
                    const names = eventClassDivisions.map(id => classIdToName[id]).filter(Boolean);
                    classDivisionNames = names;
                    classDivisionName = names.length ? names.join(', ') : `Multiple Classes (${eventClassDivisions.length})`;
                } else if (event.class && event.class.class_level && event.class.division) {
                    classDivisionName = `${event.class.class_level.name} ${event.class.division}`;
                    classDivisionNames = [classDivisionName];
                }

                return {
                    ...event,
                    class_division_name: classDivisionName,
                    class_division_names: classDivisionNames
                };
            });

            const responsePayload = {
                status: 'success',
                data: {
                    events: processedEvents,
                    assigned_classes: assignedClasses.map(assignment => ({
                        class_division_id: assignment.class_division_id,
                        assignment_type: assignment.assignment_type,
                        subject: assignment.subject,
                        is_primary: assignment.is_primary,
                        class_info: assignment.class_divisions
                    }))
                }
            };
            if (debugInfo) {
                console.log('Teacher events debug:', debugInfo);
                res.json(responsePayload);
            } else {
                res.json(responsePayload);
            }
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

            // Format class division name and names for events
            let classDivisionName = null;
            let classDivisionNames = null;

            if (isMultiClass) {
                // Multi-class event - fetch all class names
                const { data: classesData } = await adminSupabase
                    .from('class_divisions')
                    .select(`
                        id,
                        division,
                        class_level:class_level_id (name)
                    `)
                    .in('id', classDivisions);

                const classNames = [];
                if (classesData && Array.isArray(classesData)) {
                    for (const classData of classesData) {
                        if (classData && classData.class_level && classData.division) {
                            classNames.push(`${classData.class_level.name} ${classData.division}`);
                        }
                    }
                }

                processedEvent.class_info = {
                    type: 'multi_class',
                    class_count: classDivisions.length,
                    class_ids: classDivisions,
                    class_names: classNames,
                    class_details: classesData ? classesData.map(cls => ({
                        id: cls.id,
                        name: `${cls.class_level.name} ${cls.division}`,
                        class_level: cls.class_level.name,
                        division: cls.division
                    })) : [],
                    message: `Applies to ${classDivisions.length} classes`
                };

                classDivisionNames = classNames;
                classDivisionName = classNames.length ? classNames.join(', ') : `Multiple Classes (${classDivisions.length})`;
            } else if (isSingleClass) {
                // Single class event - fetch class info separately
                if (classDivisions[0]) {
                    const { data: classData } = await adminSupabase
                        .from('class_divisions')
                        .select(`
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        `)
                        .eq('id', classDivisions[0])
                        .single();

                    processedEvent.class_info = classData ? {
                        type: 'single_class',
                        class_count: 1,
                        class_ids: [classDivisions[0]],
                        class_names: [`${classData.class_level.name} ${classData.division}`],
                        class_details: [{
                            id: classData.id,
                            name: `${classData.class_level.name} ${classData.division}`,
                            class_level: classData.class_level.name,
                            division: classData.division,
                            academic_year: classData.academic_year?.year_name
                        }],
                        message: 'Single class event'
                    } : {
                        type: 'single_class',
                        class_count: 1,
                        class_ids: [classDivisions[0]],
                        message: 'Class information not available'
                    };

                    // Set class division name for single class events
                    if (classData && classData.class_level && classData.division) {
                        classDivisionName = `${classData.class_level.name} ${classData.division}`;
                        classDivisionNames = [classDivisionName];
                    }
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
                classDivisionName = 'All Classes';
                classDivisionNames = [];
            } else {
                // Handle events with no class information or empty class_divisions
                if (eventData.event_type === 'school_wide') {
                    processedEvent.class_info = {
                        type: 'school_wide',
                        class_count: 0,
                        message: 'Applies to all classes'
                    };
                    classDivisionName = 'All Classes';
                    classDivisionNames = [];
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

                    // Set class division name for single class events
                    if (classData && classData.class_level && classData.division) {
                        classDivisionName = `${classData.class_level.name} ${classData.division}`;
                        classDivisionNames = [classDivisionName];
                    }
                } else {
                    // Fallback for other cases
                    processedEvent.class_info = {
                        type: 'unknown',
                        class_count: 0,
                        message: 'Class information not available'
                    };
                }
            }

            // Add class division name and names to the response
            processedEvent.class_division_name = classDivisionName;
            processedEvent.class_division_names = classDivisionNames;

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

            // Handle event_date conversion properly
            if (updateData.event_date) {
                // If the date is already in UTC format (ends with Z), use it as is
                if (typeof updateData.event_date === 'string' && updateData.event_date.endsWith('Z')) {
                    // Date is already in UTC, no conversion needed
                    updateData.event_date = updateData.event_date;
                } else if (updateData.timezone === 'Asia/Kolkata') {
                    // Convert IST time to UTC for storage
                    const istOffset = 5.5 * 60 * 60 * 1000;
                    const utcEventDate = new Date(updateData.event_date.getTime() - istOffset);
                    updateData.event_date = utcEventDate.toISOString();
                } else {
                    // For other timezones or if no timezone specified, convert to ISO string
                    updateData.event_date = new Date(updateData.event_date).toISOString();
                }
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

            // Add class division name(s) to events
            let classIdToName = {};
            try {
                let allClassIds = new Set();
                for (const ev of data || []) {
                    if (ev && ev.class_divisions) {
                        let ids = [];
                        if (typeof ev.class_divisions === 'string') {
                            try { ids = JSON.parse(ev.class_divisions); } catch (_) { ids = []; }
                        } else if (Array.isArray(ev.class_divisions)) {
                            ids = ev.class_divisions;
                        }
                        ids.forEach(id => allClassIds.add(id));
                    } else if (Array.isArray(ev.class_division_ids)) {
                        ev.class_division_ids.forEach(id => allClassIds.add(id));
                    }
                }
                const idList = Array.from(allClassIds);
                if (idList.length > 0) {
                    const { data: classesLookup } = await adminSupabase
                        .from('class_divisions')
                        .select('id, division, class_level:class_level_id (name)')
                        .in('id', idList);
                    if (Array.isArray(classesLookup)) {
                        classesLookup.forEach(cd => {
                            if (cd && cd.id && cd.class_level && cd.class_level.name && cd.division) {
                                classIdToName[cd.id] = `${cd.class_level.name} ${cd.division}`;
                            }
                        });
                    }
                }
            } catch (_) { }

            const processedEvents = data.map(event => {
                let classDivisionName = null;
                let classDivisionNames = null;
                let eventClassDivisions = [];
                if (event.class_divisions) {
                    if (typeof event.class_divisions === 'string') {
                        try { eventClassDivisions = JSON.parse(event.class_divisions); } catch (_) { eventClassDivisions = []; }
                    } else if (Array.isArray(event.class_divisions)) {
                        eventClassDivisions = event.class_divisions;
                    }
                } else if (Array.isArray(event.class_division_ids)) {
                    eventClassDivisions = event.class_division_ids;
                }
                if (event.event_type === 'school_wide') {
                    classDivisionName = 'All Classes';
                    classDivisionNames = [];
                } else if (eventClassDivisions.length > 1) {
                    const names = eventClassDivisions.map(id => classIdToName[id]).filter(Boolean);
                    classDivisionNames = names;
                    classDivisionName = names.length ? names.join(', ') : `Multiple Classes (${eventClassDivisions.length})`;
                } else if (event.class && event.class.class_level && event.class.division) {
                    classDivisionName = `${event.class.class_level.name} ${event.class.division}`;
                    classDivisionNames = [classDivisionName];
                }

                return {
                    ...event,
                    class_division_name: classDivisionName,
                    class_division_names: classDivisionNames
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

            // Add class division name(s) to events
            let classIdToName = {};
            try {
                let allClassIds = new Set();
                for (const ev of pendingEvents || []) {
                    if (ev && ev.class_divisions) {
                        let ids = [];
                        if (typeof ev.class_divisions === 'string') {
                            try { ids = JSON.parse(ev.class_divisions); } catch (_) { ids = []; }
                        } else if (Array.isArray(ev.class_divisions)) {
                            ids = ev.class_divisions;
                        }
                        ids.forEach(id => allClassIds.add(id));
                    } else if (Array.isArray(ev.class_division_ids)) {
                        ev.class_division_ids.forEach(id => allClassIds.add(id));
                    }
                }
                const idList = Array.from(allClassIds);
                if (idList.length > 0) {
                    const { data: classesLookup } = await adminSupabase
                        .from('class_divisions')
                        .select('id, division, class_level:class_level_id (name)')
                        .in('id', idList);
                    if (Array.isArray(classesLookup)) {
                        classesLookup.forEach(cd => {
                            if (cd && cd.id && cd.class_level && cd.class_level.name && cd.division) {
                                classIdToName[cd.id] = `${cd.class_level.name} ${cd.division}`;
                            }
                        });
                    }
                }
            } catch (_) { }

            const processedEvents = (pendingEvents || []).map(event => {
                let classDivisionName = null;
                let classDivisionNames = null;
                let eventClassDivisions = [];
                if (event.class_divisions) {
                    if (typeof event.class_divisions === 'string') {
                        try { eventClassDivisions = JSON.parse(event.class_divisions); } catch (_) { eventClassDivisions = []; }
                    } else if (Array.isArray(event.class_divisions)) {
                        eventClassDivisions = event.class_divisions;
                    }
                } else if (Array.isArray(event.class_division_ids)) {
                    eventClassDivisions = event.class_division_ids;
                }
                if (event.event_type === 'school_wide') {
                    classDivisionName = 'All Classes';
                    classDivisionNames = [];
                } else if (eventClassDivisions.length > 1) {
                    const names = eventClassDivisions.map(id => classIdToName[id]).filter(Boolean);
                    classDivisionNames = names;
                    classDivisionName = names.length ? names.join(', ') : `Multiple Classes (${eventClassDivisions.length})`;
                } else if (event.class && event.class.class_level && event.class.division) {
                    classDivisionName = `${event.class.class_level.name} ${event.class.division}`;
                    classDivisionNames = [classDivisionName];
                }

                return {
                    ...event,
                    class_division_name: classDivisionName,
                    class_division_names: classDivisionNames
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

/**
 * Send notifications to parents when events are created
 */
async function sendEventNotifications(event, classDivisions) {
    try {
        console.log('🔔 sendEventNotifications called for event:', event.id, 'type:', event.event_type);

        // Only send notifications for events that target parents
        if (event.event_type === 'teacher_specific') {
            console.log('⏭️ Skipping teacher-specific event');
            return; // Skip teacher-specific events
        }

        // Get all parents with students in the targeted classes
        let parentStudents = [];

        if (event.event_type === 'school_wide') {
            console.log('🌍 Processing school-wide event');
            // School-wide events - get all parents
            const { data: allParentStudents, error } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    parent_id,
                    student_id
                `);

            if (error) {
                console.error('❌ Error fetching parent-student mappings for school-wide event:', error);
                return;
            }
            parentStudents = allParentStudents;
            console.log(`📊 Found ${parentStudents.length} parent-student mappings for school-wide event`);
        } else if (classDivisions && classDivisions.length > 0) {
            // Class-specific events - get parents of students in those classes
            // Get all students in the specified class divisions first
            const { data: studentsInClasses, error: studentsError } = await adminSupabase
                .from('student_academic_records')
                .select('student_id, class_division_id')
                .in('class_division_id', classDivisions)
                .eq('status', 'ongoing');

            if (studentsError) {
                console.error('Error fetching students in classes:', studentsError);
                return;
            }

            const studentIds = studentsInClasses.map(s => s.id);

            // Then get parent mappings for these students
            const { data: classParentStudents, error } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    parent_id,
                    student_id
                `)
                .in('student_id', studentIds);

            if (error) {
                console.error('Error fetching parent-student mappings for class event:', error);
                return;
            }
            parentStudents = classParentStudents;
        }

        // Get all student information
        const studentIds = parentStudents.map(mapping => mapping.student_id);
        const { data: students, error: studentsError } = await adminSupabase
            .from('students_master')
            .select('id, full_name, admission_number')
            .in('id', studentIds);

        if (studentsError) {
            console.error('❌ Error fetching students:', studentsError);
            return;
        }

        // Get student academic records to get class_division_id
        const { data: academicRecords, error: academicError } = await adminSupabase
            .from('student_academic_records')
            .select('student_id, class_division_id')
            .in('student_id', studentIds)
            .eq('status', 'ongoing');

        if (academicError) {
            console.error('❌ Error fetching academic records:', academicError);
            return;
        }

        const studentMap = {};
        students.forEach(student => {
            const academicRecord = academicRecords.find(ar => ar.student_id === student.id);
            studentMap[student.id] = {
                ...student,
                class_division_id: academicRecord?.class_division_id
            };
        });

        // Get class division information for all students
        const classDivisionIds = [...new Set(academicRecords.map(ar => ar.class_division_id))];
        const { data: classDivisions, error: classError } = await adminSupabase
            .from('class_divisions')
            .select(`
                id,
                division,
                class_level:class_level_id (
                    name
                )
            `)
            .in('id', classDivisionIds);

        if (classError) {
            console.error('❌ Error fetching class divisions:', classError);
            return;
        }

        const classDivisionMap = {};
        classDivisions.forEach(cd => {
            classDivisionMap[cd.id] = cd;
        });

        // Group notifications by parent to avoid duplicates
        const parentNotifications = new Map();
        for (const mapping of parentStudents) {
            const student = studentMap[mapping.student_id];
            if (!student) {
                console.error(`❌ Student not found for ID: ${mapping.student_id}`);
                continue;
            }

            const classDivision = classDivisionMap[student.class_division_id];
            const className = classDivision ? `${classDivision.class_level.name} ${classDivision.division}` : 'Unknown Class';

            // Group by parent to avoid duplicate notifications
            if (!parentNotifications.has(mapping.parent_id)) {
                parentNotifications.set(mapping.parent_id, {
                    parentId: mapping.parent_id,
                    students: [],
                    classDivision: classDivision,
                    className: className
                });
            }

            parentNotifications.get(mapping.parent_id).students.push({
                studentId: mapping.student_id,
                studentName: student.full_name,
                className: className
            });
        }

        // Send notifications to each parent (one per parent, not per student)
        console.log(`📤 Sending notifications to ${parentNotifications.size} parents...`);
        const notificationPromises = Array.from(parentNotifications.values()).map(async (parentData) => {
            console.log(`📨 Sending notification to parent ${parentData.parentId} for ${parentData.students.length} students`);

            // Use the first student for the notification (since it's the same event for all)
            const firstStudent = parentData.students[0];

            const result = await notificationService.sendParentNotification({
                parentId: parentData.parentId,
                studentId: firstStudent.studentId,
                type: notificationService.notificationTypes.EVENT,
                title: `New Event: ${event.title}`,
                message: `Date: ${new Date(event.event_date).toLocaleDateString()}\nTime: ${event.start_time || 'All day'}\n\n${event.description}`,
                data: {
                    event_id: event.id,
                    event_type: event.event_type,
                    event_category: event.event_category,
                    event_date: event.event_date,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    student_name: firstStudent.studentName,
                    student_class: firstStudent.className,
                    affected_students: parentData.students.length
                },
                priority: event.event_category === 'exam' ? notificationService.priorityLevels.HIGH : notificationService.priorityLevels.NORMAL,
                relatedId: event.id
            });

            console.log(`✅ Notification result for parent ${parentData.parentId}:`, result.success ? 'SUCCESS' : 'FAILED');
            return result;
        });

        // Send all notifications in parallel (non-blocking) with a small delay
        setTimeout(() => {
            Promise.all(notificationPromises).then(results => {
                const successCount = results.filter(r => r.success).length;
                console.log(`✅ Sent event notifications to ${successCount}/${parentNotifications.size} parents`);
            }).catch(error => {
                console.error('❌ Error in notification sending:', error);
            });
        }, 100); // 100ms delay to ensure API response is sent first

    } catch (error) {
        console.error('Error in sendEventNotifications:', error);
    }
}

export default router; 