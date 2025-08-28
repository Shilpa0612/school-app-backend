import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
// Subjects: CRUD
router.post('/subjects',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('name').isString().trim().notEmpty(),
        body('code').optional().isString().trim()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const { name, code } = req.body;
            const { data, error } = await adminSupabase
                .from('calendar_events')
                .insert([{
                    title,
                    description,
                    event_date: utcEventDate.toISOString(),
                    event_type: finalEventType,
                    class_division_id: finalClassDivisionId,
                    class_division_ids: finalClassDivisionIds,
                    is_multi_class: finalIsMultiClass,
                    is_single_day,
                    start_time,
                    end_time,
                    event_category,
                    timezone,
                    status: eventStatus,
                    created_by: req.user.id
                }])
                // ✅ CORRECT CODE - Use this:
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
            res.status(201).json({ status: 'success', data: { subject: data } });
        } catch (error) { next(error); }
    }
);

router.get('/subjects',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const includeInactive = req.query.include_inactive === 'true';
            let query = adminSupabase.from('subjects').select('*').order('name');
            if (!includeInactive) query = query.eq('is_active', true);
            const { data, error } = await query;
            if (error) throw error;
            res.json({ status: 'success', data: { subjects: data } });
        } catch (error) { next(error); }
    }
);

router.put('/subjects/:id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('name').optional().isString().trim().notEmpty(),
        body('code').optional().isString().trim(),
        body('is_active').optional().isBoolean()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const updates = {};
            const { name, code, is_active } = req.body;
            if (name !== undefined) updates.name = name;
            if (code !== undefined) updates.code = code;
            if (is_active !== undefined) updates.is_active = is_active;
            if (Object.keys(updates).length === 0) return res.status(400).json({ status: 'error', message: 'No fields to update' });
            const { data, error } = await adminSupabase
                .from('subjects')
                .update(updates)
                .eq('id', req.params.id)
                .select()
                .single();
            if (error) throw error;
            res.json({ status: 'success', data: { subject: data } });
        } catch (error) { next(error); }
    }
);

router.delete('/subjects/:id',
    authenticate,
    authorize(['admin']),
    async (req, res, next) => {
        try {
            const { error } = await adminSupabase
                .from('subjects')
                .update({ is_active: false })
                .eq('id', req.params.id);
            if (error) throw error;
            res.json({ status: 'success', message: 'Subject deactivated' });
        } catch (error) { next(error); }
    }
);

// Class division subjects: assign, list, edit, remove
router.post('/class-divisions/:id/subjects',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('subject_ids').isArray({ min: 1 }),
        body('mode').optional().isIn(['replace', 'append'])
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            const { id: class_division_id } = req.params;
            const { subject_ids, mode = 'replace' } = req.body;

            // Verify class division exists
            const { data: classDiv, error: classErr } = await adminSupabase
                .from('class_divisions')
                .select('id')
                .eq('id', class_division_id)
                .single();
            if (classErr || !classDiv) return res.status(404).json({ status: 'error', message: 'Class division not found' });

            // Fetch currently active mappings
            const { data: current } = await adminSupabase
                .from('class_division_subjects')
                .select('id, subject_id')
                .eq('class_division_id', class_division_id)
                .eq('is_active', true);

            const currentIds = new Set((current || []).map(c => c.subject_id));
            const incomingIds = new Set(subject_ids);

            const toActivate = [...incomingIds].filter(id => !currentIds.has(id));
            const toDeactivate = mode === 'replace'
                ? [...currentIds].filter(id => !incomingIds.has(id))
                : [];

            // Activate new
            let activated = [];
            if (toActivate.length) {
                const { data: ins, error: insErr } = await adminSupabase
                    .from('class_division_subjects')
                    .insert(toActivate.map(sid => ({
                        class_division_id,
                        subject_id: sid,
                        is_active: true,
                        assigned_by: req.user.id
                    })))
                    .select();
                if (insErr) throw insErr;
                activated = ins || [];
            }

            // Deactivate removed
            let deactivatedCount = 0;
            if (toDeactivate.length) {
                const { error: deactErr } = await adminSupabase
                    .from('class_division_subjects')
                    .update({ is_active: false })
                    .eq('class_division_id', class_division_id)
                    .in('subject_id', toDeactivate);
                if (deactErr) throw deactErr;
                deactivatedCount = toDeactivate.length;
            }

            // Return full active list
            const { data: activeList } = await adminSupabase
                .from('class_division_subjects')
                .select('subject:subject_id(id, name, code)')
                .eq('class_division_id', class_division_id)
                .eq('is_active', true)
                .order('assigned_at', { ascending: true });

            res.status(201).json({
                status: 'success',
                data: {
                    activated,
                    deactivated: deactivatedCount,
                    subjects: (activeList || []).map(r => r.subject)
                }
            });
        } catch (error) { next(error); }
    }
);

router.get('/class-divisions/:id/subjects',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const { data, error } = await adminSupabase
                .from('class_division_subjects')
                .select('subject:subject_id(id, name, code)')
                .eq('class_division_id', id)
                .eq('is_active', true)
                .order('assigned_at');
            if (error) throw error;
            res.json({ status: 'success', data: { subjects: (data || []).map(r => r.subject) } });
        } catch (error) { next(error); }
    }
);

router.delete('/class-divisions/:id/subjects/:subject_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { id, subject_id } = req.params;
            const { error } = await adminSupabase
                .from('class_division_subjects')
                .update({ is_active: false })
                .eq('class_division_id', id)
                .eq('subject_id', subject_id)
                .eq('is_active', true);
            if (error) throw error;
            res.json({ status: 'success', message: 'Subject removed from class division' });
        } catch (error) { next(error); }
    }
);


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

// Get current user's teacher ID and assigned class divisions (teachers only) - Updated for many-to-many
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

            // Try to get assignments from new junction table first
            const { data: newAssignments, error: newAssignmentError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    assignment_type,
                    subject,
                    is_primary,
                    assigned_date,
                    class_division:class_division_id (
                        id,
                        division,
                        academic_year_id,
                        class_level_id,
                        academic_year:academic_year_id (
                            year_name
                        ),
                        class_level:class_level_id (
                            name,
                            sequence_number
                        )
                    )
                `)
                .eq('teacher_id', req.user.id)
                .eq('is_active', true)
                .order('is_primary', { ascending: false })
                .order('assigned_date', { ascending: true });

            let classesWithDetails = [];
            let usingLegacyData = false;

            if (newAssignmentError) {
                // Fallback to legacy method if junction table doesn't exist
                logger.info('Using legacy class assignment method for teacher:', req.user.id);
                usingLegacyData = true;

                const { data: assignedClasses, error: classError } = await adminSupabase
                    .from('class_divisions')
                    .select(`
                    id,
                    division,
                    academic_year_id,
                    class_level_id
                `)
                    .eq('teacher_id', req.user.id);

                if (classError) {
                    logger.error('Error fetching assigned classes (legacy):', classError);
                } else if (assignedClasses && assignedClasses.length > 0) {
                    for (const classDiv of assignedClasses) {
                        // Get academic year
                        const { data: academicYear } = await adminSupabase
                            .from('academic_years')
                            .select('year_name')
                            .eq('id', classDiv.academic_year_id)
                            .single();

                        // Get class level
                        const { data: classLevel } = await adminSupabase
                            .from('class_levels')
                            .select('name, sequence_number')
                            .eq('id', classDiv.class_level_id)
                            .single();

                        classesWithDetails.push({
                            assignment_id: `legacy-${classDiv.id}`,
                            class_division_id: classDiv.id,
                            division: classDiv.division,
                            class_name: `${classLevel?.name || 'Unknown'} ${classDiv.division}`,
                            class_level: classLevel?.name || 'Unknown',
                            sequence_number: classLevel?.sequence_number || 0,
                            academic_year: academicYear?.year_name || 'Unknown',
                            assignment_type: 'class_teacher',
                            subject: null, // Legacy assignments don't have subject info
                            is_primary: true,
                            assigned_date: null
                        });
                    }
                }
            } else {
                // Use new many-to-many assignments
                classesWithDetails = newAssignments.map(assignment => ({
                    assignment_id: assignment.id,
                    class_division_id: assignment.class_division.id,
                    division: assignment.class_division.division,
                    class_name: `${assignment.class_division.class_level?.name || 'Unknown'} ${assignment.class_division.division}`,
                    class_level: assignment.class_division.class_level?.name || 'Unknown',
                    sequence_number: assignment.class_division.class_level?.sequence_number || 0,
                    academic_year: assignment.class_division.academic_year?.year_name || 'Unknown',
                    assignment_type: assignment.assignment_type,
                    subject: assignment.subject, // Include the subject taught
                    is_primary: assignment.is_primary,
                    assigned_date: assignment.assigned_date
                }));
            }

            // Separate primary and non-primary classes
            const primaryClasses = classesWithDetails.filter(c => c.is_primary);
            const secondaryClasses = classesWithDetails.filter(c => !c.is_primary);

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
                    },
                    assigned_classes: classesWithDetails,
                    primary_classes: primaryClasses,
                    secondary_classes: secondaryClasses,
                    total_assigned_classes: classesWithDetails.length,
                    total_primary_classes: primaryClasses.length,
                    total_secondary_classes: secondaryClasses.length,
                    has_assignments: classesWithDetails.length > 0,
                    using_legacy_data: usingLegacyData,
                    assignment_summary: {
                        primary_teacher_for: primaryClasses.length,
                        subject_teacher_for: secondaryClasses.filter(c => c.assignment_type === 'subject_teacher').length,
                        assistant_teacher_for: secondaryClasses.filter(c => c.assignment_type === 'assistant_teacher').length,
                        substitute_teacher_for: secondaryClasses.filter(c => c.assignment_type === 'substitute_teacher').length
                    },
                    subjects_taught: classesWithDetails
                        .filter(c => c.assignment_type === 'subject_teacher' && c.subject)
                        .map(c => c.subject)
                        .filter((subject, index, arr) => arr.indexOf(subject) === index) // Remove duplicates
                }
            });
        } catch (error) {
            logger.error('Error getting teacher information:', error);
            next(error);
        }
    }
);

// Get all teachers for assignment purposes
router.get('/teachers',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            // First get all teachers from users table
            const { data: usersData, error: usersError } = await adminSupabase
                .from('users')
                .select('id, full_name, phone_number, email')
                .eq('role', 'teacher');

            if (usersError) {
                logger.error('Error fetching teacher users:', usersError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch teachers from users table'
                });
            }

            if (!usersData || usersData.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        teachers: [],
                        total: 0,
                        message: 'No teachers found'
                    }
                });
            }

            // Get their staff information
            const userIds = usersData.map(user => user.id);
            const { data: staffData, error: staffError } = await adminSupabase
                .from('staff')
                .select('id, user_id, department, designation, is_active')
                .in('user_id', userIds)
                .eq('is_active', true);

            if (staffError) {
                logger.error('Error fetching staff data:', staffError);
                // Continue without staff data if error
            }

            // Combine the data
            const teachers = usersData.map(user => {
                const staffInfo = staffData?.find(staff => staff.user_id === user.id);
                return {
                    teacher_id: user.id, // Use this for class assignments
                    user_id: user.id,
                    staff_id: staffInfo?.id || null,
                    full_name: user.full_name,
                    phone_number: user.phone_number,
                    email: user.email,
                    department: staffInfo?.department || null,
                    designation: staffInfo?.designation || null,
                    is_active: staffInfo?.is_active || true
                };
            });

            res.json({
                status: 'success',
                data: {
                    teachers,
                    total: teachers.length,
                    message: 'Use teacher_id for class division assignments'
                }
            });

        } catch (error) {
            logger.error('Error in get teachers endpoint:', error);
            next(error);
        }
    }
);

// Get teachers assigned to a specific class division (supports multiple teachers)
router.get('/class-divisions/:id/teachers',
    authenticate,
    authorize(['admin', 'principal', 'teacher', 'parent']),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // First get the class division basic info
            const { data: classDivision, error: divisionError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    academic_year_id,
                    class_level_id
                `)
                .eq('id', id)
                .single();

            if (divisionError) {
                logger.error('Error fetching class division:', divisionError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch class division'
                });
            }

            if (!classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Get academic year info
            let academicYear = null;
            if (classDivision.academic_year_id) {
                const { data: yearData } = await adminSupabase
                    .from('academic_years')
                    .select('year_name')
                    .eq('id', classDivision.academic_year_id)
                    .single();
                academicYear = yearData;
            }

            // Get class level info
            let classLevel = null;
            if (classDivision.class_level_id) {
                const { data: levelData } = await adminSupabase
                    .from('class_levels')
                    .select('name, sequence_number')
                    .eq('id', classDivision.class_level_id)
                    .single();
                classLevel = levelData;
            }

            // Get all teachers assigned to this class using the new junction table
            const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    teacher_id,
                    assignment_type,
                    subject,
                    is_primary,
                    assigned_date,
                    is_active,
                    teacher:teacher_id (
                        id,
                        full_name,
                        phone_number,
                        email
                    )
                `)
                .eq('class_division_id', id)
                .eq('is_active', true)
                .order('is_primary', { ascending: false })
                .order('assigned_date', { ascending: true });

            if (assignmentError) {
                logger.error('Error fetching teacher assignments:', assignmentError);
                // Fallback to old method if junction table doesn't exist yet
                const { data: oldTeacher } = await adminSupabase
                    .from('class_divisions')
                    .select(`
                        teacher_id,
                        teacher:teacher_id (
                            id,
                            full_name,
                            phone_number,
                            email
                        )
                    `)
                    .eq('id', id)
                    .single();

                const teachers = oldTeacher?.teacher ? [{
                    id: `legacy-${oldTeacher.teacher_id}`,
                    teacher_id: oldTeacher.teacher_id,
                    assignment_type: 'class_teacher',
                    is_primary: true,
                    assigned_date: new Date().toISOString(),
                    is_active: true,
                    teacher: oldTeacher.teacher
                }] : [];

                return res.json({
                    status: 'success',
                    data: {
                        class_division: {
                            id: classDivision.id,
                            division: classDivision.division,
                            class_name: `${classLevel?.name || 'Unknown'} ${classDivision.division}`,
                            academic_year: academicYear?.year_name || 'Unknown',
                            sequence_number: classLevel?.sequence_number || 0
                        },
                        teachers,
                        primary_teacher: teachers.find(t => t.is_primary) || null,
                        total_teachers: teachers.length,
                        has_teachers: teachers.length > 0,
                        using_legacy_data: true
                    }
                });
            }

            // Get staff info for each teacher
            const teachersWithStaffInfo = [];
            for (const assignment of teacherAssignments) {
                const { data: staffData } = await adminSupabase
                    .from('staff')
                    .select('id, department, designation')
                    .eq('user_id', assignment.teacher_id)
                    .single();

                teachersWithStaffInfo.push({
                    assignment_id: assignment.id,
                    teacher_id: assignment.teacher_id,
                    assignment_type: assignment.assignment_type,
                    subject: assignment.subject || null,
                    is_primary: assignment.is_primary,
                    assigned_date: assignment.assigned_date,
                    is_active: assignment.is_active,
                    teacher_info: {
                        id: assignment.teacher.id,
                        full_name: assignment.teacher.full_name,
                        phone_number: assignment.teacher.phone_number,
                        email: assignment.teacher.email,
                        staff_id: staffData?.id || null,
                        department: staffData?.department || null,
                        designation: staffData?.designation || null
                    }
                });
            }

            // Format the response
            const response = {
                class_division: {
                    id: classDivision.id,
                    division: classDivision.division,
                    class_name: `${classLevel?.name || 'Unknown'} ${classDivision.division}`,
                    academic_year: academicYear?.year_name || 'Unknown',
                    sequence_number: classLevel?.sequence_number || 0
                },
                teachers: teachersWithStaffInfo,
                primary_teacher: teachersWithStaffInfo.find(t => t.is_primary) || null,
                total_teachers: teachersWithStaffInfo.length,
                has_teachers: teachersWithStaffInfo.length > 0,
                using_legacy_data: false
            };

            res.json({
                status: 'success',
                data: response
            });

        } catch (error) {
            logger.error('Error in get class division teachers endpoint:', error);
            next(error);
        }
    }
);

// Legacy endpoint for backward compatibility - Get single teacher (primary teacher)
router.get('/class-divisions/:id/teacher',
    authenticate,
    authorize(['admin', 'principal', 'teacher', 'parent']),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Get the primary teacher using the new multiple teachers endpoint
            const teachersResponse = await new Promise((resolve, reject) => {
                req.url = `/class-divisions/${id}/teachers`;
                router.handle(req, res, (err) => {
                    if (err) reject(err);
                    else resolve(res);
                });
            });

            // This is a simplified response for backward compatibility
            // The actual implementation would extract primary teacher from the multiple teachers response
            // For now, redirect to the new endpoint
            req.url = `/class-divisions/${id}/teachers`;
            return router.handle(req, res, next);

        } catch (error) {
            logger.error('Error in legacy get class division teacher endpoint:', error);
            next(error);
        }
    }
);

// Assign teacher to class (supports multiple teachers)
router.post('/class-divisions/:id/assign-teacher',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('teacher_id').isUUID().withMessage('Valid teacher ID is required'),
        body('assignment_type').optional().isIn(['class_teacher', 'subject_teacher', 'assistant_teacher', 'substitute_teacher']).withMessage('Valid assignment type required'),
        body('is_primary').optional().isBoolean().withMessage('is_primary must be boolean'),
        body('subject').optional().isString().trim().isLength({ min: 1 }).withMessage('subject must be a non-empty string')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id: class_division_id } = req.params;
            const { teacher_id, assignment_type = 'class_teacher', is_primary = false } = req.body;
            const subject = (req.body.subject ?? null);

            // Verify class division exists
            const { data: classDivision, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('id, division')
                .eq('id', class_division_id)
                .single();

            if (classError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Verify teacher exists and has teacher role
            const { data: teacher, error: teacherError } = await adminSupabase
                .from('users')
                .select('id, full_name, role')
                .eq('id', teacher_id)
                .eq('role', 'teacher')
                .single();

            if (teacherError || !teacher) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Teacher not found or invalid role'
                });
            }

            // If subject_teacher, require subject and validate against class_division_subjects if configured
            if (assignment_type === 'subject_teacher' && (!subject || String(subject).trim().length === 0)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Subject is required when assignment_type is subject_teacher'
                });
            }

            // Validate subject if provided (for both subject_teacher and class_teacher)
            if (subject && String(subject).trim().length > 0) {
                // If class has subjects configured, ensure provided subject exists in mapping (by name or code)
                const { data: mappedSubjects } = await adminSupabase
                    .from('class_division_subjects')
                    .select('subject:subject_id(id, name, code)')
                    .eq('class_division_id', class_division_id)
                    .eq('is_active', true);
                if (mappedSubjects && mappedSubjects.length > 0) {
                    const allowed = mappedSubjects.some(ms => ms.subject?.name === subject || ms.subject?.code === subject);
                    if (!allowed) {
                        return res.status(400).json({
                            status: 'error',
                            message: 'Subject not assigned to this class division'
                        });
                    }
                }
            }

            // Check if assignment already exists
            let dupQuery = adminSupabase
                .from('class_teacher_assignments')
                .select('id')
                .eq('class_division_id', class_division_id)
                .eq('teacher_id', teacher_id)
                .eq('assignment_type', assignment_type)
                .eq('is_active', true);
            if (subject && String(subject).trim().length > 0) {
                dupQuery = dupQuery.eq('subject', subject);
            }
            const { data: existingAssignment } = await dupQuery.single();

            if (existingAssignment) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Teacher is already assigned to this class with the same assignment type'
                });
            }

            // If assigning as primary, check if primary already exists
            if (is_primary) {
                const { data: existingPrimary } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id, teacher_id')
                    .eq('class_division_id', class_division_id)
                    .eq('is_primary', true)
                    .eq('is_active', true)
                    .single();

                if (existingPrimary) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Class already has a primary teacher',
                        existing_primary_teacher_id: existingPrimary.teacher_id
                    });
                }
            }

            // Create the assignment
            const { data: assignment, error: assignmentError } = await adminSupabase
                .from('class_teacher_assignments')
                .insert([{
                    class_division_id,
                    teacher_id,
                    assignment_type,
                    subject: subject && String(subject).trim().length > 0 ? subject : null,
                    is_primary,
                    assigned_by: req.user.id,
                    is_active: true
                }])
                .select(`
                    *,
                    teacher:teacher_id (
                        id,
                        full_name,
                        phone_number,
                        email
                    )
                `)
                .single();

            if (assignmentError) {
                logger.error('Error creating teacher assignment:', assignmentError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to assign teacher to class'
                });
            }

            res.status(201).json({
                status: 'success',
                data: {
                    assignment,
                    message: `Teacher ${teacher.full_name} successfully assigned to class as ${assignment_type}${is_primary ? ' (Primary Teacher)' : ''}`
                }
            });

        } catch (error) {
            logger.error('Error in assign teacher endpoint:', error);
            next(error);
        }
    }
);

// Remove teacher from class
router.delete('/class-divisions/:id/remove-teacher/:teacher_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { id: class_division_id, teacher_id } = req.params;
            const { assignment_type } = req.query;

            // Build the query
            let query = adminSupabase
                .from('class_teacher_assignments')
                .select('*')
                .eq('class_division_id', class_division_id)
                .eq('teacher_id', teacher_id)
                .eq('is_active', true);

            // If assignment_type is specified, filter by it
            if (assignment_type) {
                query = query.eq('assignment_type', assignment_type);
            }

            const { data: assignments, error: fetchError } = await query;

            if (fetchError) {
                logger.error('Error fetching teacher assignments:', fetchError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch teacher assignments'
                });
            }

            if (!assignments || assignments.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Teacher assignment not found'
                });
            }

            // Deactivate the assignment(s) instead of deleting
            const assignmentIds = assignments.map(a => a.id);
            const { error: updateError } = await adminSupabase
                .from('class_teacher_assignments')
                .update({
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .in('id', assignmentIds);

            if (updateError) {
                logger.error('Error removing teacher assignment:', updateError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to remove teacher assignment'
                });
            }

            res.json({
                status: 'success',
                data: {
                    removed_assignments: assignments.length,
                    assignment_ids: assignmentIds
                },
                message: 'Teacher successfully removed from class'
            });

        } catch (error) {
            logger.error('Error in remove teacher endpoint:', error);
            next(error);
        }
    }
);

// Update teacher assignment (change assignment type or primary status)
router.put('/class-divisions/:id/teacher-assignment/:assignment_id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('assignment_type').optional().isIn(['class_teacher', 'subject_teacher', 'assistant_teacher', 'substitute_teacher']),
        body('is_primary').optional().isBoolean(),
        body('subject').optional().isString().trim().isLength({ min: 1 }).withMessage('subject must be a non-empty string')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id: class_division_id, assignment_id } = req.params;
            const { assignment_type, is_primary } = req.body;
            const subject = (req.body.subject ?? undefined);

            // Verify assignment exists
            const { data: existingAssignment, error: fetchError } = await adminSupabase
                .from('class_teacher_assignments')
                .select('*')
                .eq('id', assignment_id)
                .eq('class_division_id', class_division_id)
                .eq('is_active', true)
                .single();

            if (fetchError || !existingAssignment) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Teacher assignment not found'
                });
            }

            // If updating to primary, check if another primary exists
            if (is_primary === true && !existingAssignment.is_primary) {
                const { data: existingPrimary } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id, teacher_id')
                    .eq('class_division_id', class_division_id)
                    .eq('is_primary', true)
                    .eq('is_active', true)
                    .neq('id', assignment_id)
                    .single();

                if (existingPrimary) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Class already has a primary teacher',
                        existing_primary_teacher_id: existingPrimary.teacher_id
                    });
                }
            }

            // Build update object
            const updateData = {};
            if (assignment_type !== undefined) updateData.assignment_type = assignment_type;
            if (is_primary !== undefined) updateData.is_primary = is_primary;
            if (subject !== undefined) updateData.subject = subject;

            // If resulting type is subject_teacher, ensure subject is present
            const resultingType = assignment_type !== undefined ? assignment_type : existingAssignment.assignment_type;
            const resultingSubject = subject !== undefined ? subject : existingAssignment.subject;
            if (resultingType === 'subject_teacher' && (!resultingSubject || String(resultingSubject).trim().length === 0)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Subject is required when assignment_type is subject_teacher'
                });
            }

            // Allow class_teacher to optionally specify subject
            // This enables class teachers to also teach specific subjects

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No valid fields to update'
                });
            }

            // Update the assignment
            const { data: updatedAssignment, error: updateError } = await adminSupabase
                .from('class_teacher_assignments')
                .update(updateData)
                .eq('id', assignment_id)
                .select(`
                    *,
                    teacher:teacher_id (
                        id,
                        full_name,
                        phone_number,
                        email
                    )
                `)
                .single();

            if (updateError) {
                logger.error('Error updating teacher assignment:', updateError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to update teacher assignment'
                });
            }

            res.json({
                status: 'success',
                data: { assignment: updatedAssignment },
                message: 'Teacher assignment updated successfully'
            });

        } catch (error) {
            logger.error('Error in update teacher assignment endpoint:', error);
            next(error);
        }
    }
);

// Get all classes for a teacher (with assignment details)
router.get('/teachers/:teacher_id/classes',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const { teacher_id } = req.params;

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

            // Get all class assignments for this teacher
            const { data: assignments, error: assignmentError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    assignment_type,
                    subject,
                    is_primary,
                    assigned_date,
                    is_active,
                    class_division:class_division_id (
                        id,
                        division,
                        academic_year_id,
                        class_level_id,
                        academic_year:academic_year_id (
                            year_name
                        ),
                        class_level:class_level_id (
                            name,
                            sequence_number
                        )
                    )
                `)
                .eq('teacher_id', teacher_id)
                .eq('is_active', true)
                .order('is_primary', { ascending: false })
                .order('assigned_date', { ascending: true });

            if (assignmentError) {
                logger.error('Error fetching teacher assignments:', assignmentError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch teacher assignments'
                });
            }

            // Format the assignments
            const formattedAssignments = assignments.map(assignment => ({
                assignment_id: assignment.id,
                assignment_type: assignment.assignment_type,
                subject: assignment.subject, // Include the subject taught
                is_primary: assignment.is_primary,
                assigned_date: assignment.assigned_date,
                class_info: {
                    class_division_id: assignment.class_division.id,
                    division: assignment.class_division.division,
                    class_name: `${assignment.class_division.class_level?.name || 'Unknown'} ${assignment.class_division.division}`,
                    class_level: assignment.class_division.class_level?.name || 'Unknown',
                    sequence_number: assignment.class_division.class_level?.sequence_number || 0,
                    academic_year: assignment.class_division.academic_year?.year_name || 'Unknown'
                }
            }));

            res.json({
                status: 'success',
                data: {
                    teacher: {
                        id: teacher.id,
                        full_name: teacher.full_name
                    },
                    assignments: formattedAssignments,
                    primary_classes: formattedAssignments.filter(a => a.is_primary),
                    total_assignments: formattedAssignments.length,
                    has_assignments: formattedAssignments.length > 0,
                    subjects_taught: formattedAssignments
                        .filter(a => a.assignment_type === 'subject_teacher' && a.subject)
                        .map(a => a.subject)
                        .filter((subject, index, arr) => arr.indexOf(subject) === index) // Remove duplicates
                }
            });

        } catch (error) {
            logger.error('Error in get teacher classes endpoint:', error);
            next(error);
        }
    }
);

// Bulk assign teachers to multiple classes
router.post('/bulk-assign-teachers',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('assignments').isArray().withMessage('Assignments must be an array'),
        body('assignments.*.class_division_id').isUUID().withMessage('Valid class division ID required'),
        body('assignments.*.teacher_id').isUUID().withMessage('Valid teacher ID required'),
        body('assignments.*.assignment_type').optional().isIn(['class_teacher', 'subject_teacher', 'assistant_teacher', 'substitute_teacher']),
        body('assignments.*.is_primary').optional().isBoolean(),
        body('assignments.*.subject').optional().isString().trim().isLength({ min: 1 }).withMessage('subject must be a non-empty string')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { assignments } = req.body;
            const results = {
                successful: [],
                failed: [],
                total: assignments.length
            };

            for (const assignment of assignments) {
                try {
                    const {
                        class_division_id,
                        teacher_id,
                        assignment_type = 'class_teacher',
                        is_primary = false
                    } = assignment;
                    const subject = (assignment.subject ?? null);

                    // If subject_teacher, require subject
                    if (assignment_type === 'subject_teacher' && (!subject || String(subject).trim().length === 0)) {
                        results.failed.push({ assignment, error: 'Subject is required when assignment_type is subject_teacher' });
                        continue;
                    }

                    // Check if assignment already exists
                    let existingQuery = adminSupabase
                        .from('class_teacher_assignments')
                        .select('id')
                        .eq('class_division_id', class_division_id)
                        .eq('teacher_id', teacher_id)
                        .eq('assignment_type', assignment_type)
                        .eq('is_active', true);
                    if (subject && String(subject).trim().length > 0) {
                        existingQuery = existingQuery.eq('subject', subject);
                    }
                    const { data: existing } = await existingQuery.single();

                    if (existing) {
                        results.failed.push({
                            assignment,
                            error: 'Assignment already exists'
                        });
                        continue;
                    }

                    // If primary, check for existing primary teacher
                    if (is_primary) {
                        const { data: existingPrimary } = await adminSupabase
                            .from('class_teacher_assignments')
                            .select('id')
                            .eq('class_division_id', class_division_id)
                            .eq('is_primary', true)
                            .eq('is_active', true)
                            .single();

                        if (existingPrimary) {
                            results.failed.push({
                                assignment,
                                error: 'Class already has a primary teacher'
                            });
                            continue;
                        }
                    }

                    // Create the assignment
                    const { data: newAssignment, error: createError } = await adminSupabase
                        .from('class_teacher_assignments')
                        .insert([{
                            class_division_id,
                            teacher_id,
                            assignment_type,
                            subject: subject && String(subject).trim().length > 0 ? subject : null,
                            is_primary,
                            assigned_by: req.user.id,
                            is_active: true
                        }])
                        .select()
                        .single();

                    if (createError) {
                        results.failed.push({
                            assignment,
                            error: createError.message
                        });
                    } else {
                        results.successful.push(newAssignment);
                    }

                } catch (error) {
                    results.failed.push({
                        assignment,
                        error: error.message
                    });
                }
            }

            res.status(201).json({
                status: 'success',
                data: results,
                message: `Bulk assignment completed: ${results.successful.length} successful, ${results.failed.length} failed`
            });

        } catch (error) {
            logger.error('Error in bulk assign teachers endpoint:', error);
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

            if (studentError) {
                const errPayload = {
                    code: studentError.code,
                    message: studentError.message,
                    details: studentError.details,
                    hint: studentError.hint
                };
                // Duplicate admission number
                if ((studentError.code === '23505') || /duplicate key/i.test(studentError.message || '')) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Admission number already exists',
                        error: errPayload
                    });
                }
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to create student',
                    error: errPayload
                });
            }

            // Assign to class
            const { data: record, error: recordError } = await supabase
                .rpc('assign_student_to_class', {
                    p_student_id: student.id,
                    p_class_division_id: class_division_id,
                    p_roll_number: roll_number
                });

            if (recordError) {
                const errPayload = {
                    code: recordError.code,
                    message: recordError.message,
                    details: recordError.details,
                    hint: recordError.hint
                };
                if ((recordError.code === '23505') || /duplicate key/i.test(recordError.message || '')) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Roll number already exists for this class',
                        error: errPayload
                    });
                }
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to assign student to class',
                    error: errPayload
                });
            }

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

// Get all teachers with their assigned classes (including subject teachers) - For Principal
router.get('/teachers-with-assignments',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            // Get all teachers from users table
            const { data: teachers, error: teachersError } = await adminSupabase
                .from('users')
                .select('id, full_name, phone_number, email, role')
                .eq('role', 'teacher');

            if (teachersError) {
                logger.error('Error fetching teachers:', teachersError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch teachers'
                });
            }

            if (!teachers || teachers.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        teachers: [],
                        total: 0,
                        message: 'No teachers found'
                    }
                });
            }

            // Get all teacher assignments
            const teacherIds = teachers.map(t => t.id);
            const { data: assignments, error: assignmentsError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    teacher_id,
                    assignment_type,
                    subject,
                    is_primary,
                    assigned_date,
                    is_active,
                    class_division:class_division_id (
                        id,
                        division,
                        academic_year:academic_year_id (
                            year_name
                        ),
                        class_level:class_level_id (
                            name,
                            sequence_number
                        )
                    )
                `)
                .in('teacher_id', teacherIds)
                .eq('is_active', true)
                .order('is_primary', { ascending: false })
                .order('assigned_date', { ascending: true });

            if (assignmentsError) {
                logger.error('Error fetching teacher assignments:', assignmentsError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch teacher assignments'
                });
            }

            // Get staff information for teachers
            const { data: staffData, error: staffError } = await adminSupabase
                .from('staff')
                .select('id, user_id, department, designation, is_active')
                .in('user_id', teacherIds)
                .eq('is_active', true);

            if (staffError) {
                logger.error('Error fetching staff data:', staffError);
                // Continue without staff data
            }

            // Group assignments by teacher
            const assignmentsByTeacher = {};
            (assignments || []).forEach(assignment => {
                if (!assignmentsByTeacher[assignment.teacher_id]) {
                    assignmentsByTeacher[assignment.teacher_id] = [];
                }
                assignmentsByTeacher[assignment.teacher_id].push(assignment);
            });

            // Build the response
            const teachersWithAssignments = teachers.map(teacher => {
                const teacherAssignments = assignmentsByTeacher[teacher.id] || [];
                const staffInfo = staffData?.find(s => s.user_id === teacher.id);

                // Separate assignments by type
                const primaryClasses = teacherAssignments.filter(a => a.is_primary);
                const subjectTeacherAssignments = teacherAssignments.filter(a =>
                    a.assignment_type === 'subject_teacher' && !a.is_primary
                );
                const assistantAssignments = teacherAssignments.filter(a =>
                    a.assignment_type === 'assistant_teacher' && !a.is_primary
                );
                const substituteAssignments = teacherAssignments.filter(a =>
                    a.assignment_type === 'substitute_teacher' && !a.is_primary
                );

                // Get unique subjects taught
                const subjectsTaught = teacherAssignments
                    .filter(a => a.subject)
                    .map(a => a.subject)
                    .filter((subject, index, arr) => arr.indexOf(subject) === index);

                return {
                    teacher_id: teacher.id,
                    full_name: teacher.full_name,
                    phone_number: teacher.phone_number,
                    email: teacher.email,
                    role: teacher.role,
                    staff_info: staffInfo ? {
                        staff_id: staffInfo.id,
                        department: staffInfo.department,
                        designation: staffInfo.designation,
                        is_active: staffInfo.is_active
                    } : null,
                    assignments: {
                        total: teacherAssignments.length,
                        primary_classes: primaryClasses.map(a => ({
                            assignment_id: a.id,
                            class_division_id: a.class_division.id,
                            class_name: `${a.class_division.class_level.name} ${a.class_division.division}`,
                            academic_year: a.class_division.academic_year.year_name,
                            assignment_type: a.assignment_type,
                            is_primary: a.is_primary,
                            assigned_date: a.assigned_date
                        })),
                        subject_teacher_assignments: subjectTeacherAssignments.map(a => ({
                            assignment_id: a.id,
                            class_division_id: a.class_division.id,
                            class_name: `${a.class_division.class_level.name} ${a.class_division.division}`,
                            academic_year: a.class_division.academic_year.year_name,
                            subject: a.subject,
                            assignment_type: a.assignment_type,
                            is_primary: a.is_primary,
                            assigned_date: a.assigned_date
                        })),
                        assistant_assignments: assistantAssignments.map(a => ({
                            assignment_id: a.id,
                            class_division_id: a.class_division.id,
                            class_name: `${a.class_division.class_level.name} ${a.class_division.division}`,
                            academic_year: a.class_division.academic_year.year_name,
                            assignment_type: a.assignment_type,
                            is_primary: a.is_primary,
                            assigned_date: a.assigned_date
                        })),
                        substitute_assignments: substituteAssignments.map(a => ({
                            assignment_id: a.id,
                            class_division_id: a.class_division.id,
                            class_name: `${a.class_division.class_level.name} ${a.class_division.division}`,
                            academic_year: a.class_division.academic_year.year_name,
                            assignment_type: a.assignment_type,
                            is_primary: a.is_primary,
                            assigned_date: a.assigned_date
                        }))
                    },
                    summary: {
                        total_classes: teacherAssignments.length,
                        primary_teacher_for: primaryClasses.length,
                        subject_teacher_for: subjectTeacherAssignments.length,
                        assistant_teacher_for: assistantAssignments.length,
                        substitute_teacher_for: substituteAssignments.length,
                        subjects_taught: subjectsTaught,
                        has_assignments: teacherAssignments.length > 0
                    }
                };
            });

            // Sort teachers by name
            teachersWithAssignments.sort((a, b) => a.full_name.localeCompare(b.full_name));

            res.json({
                status: 'success',
                data: {
                    teachers: teachersWithAssignments,
                    total: teachersWithAssignments.length,
                    summary: {
                        total_teachers: teachersWithAssignments.length,
                        teachers_with_assignments: teachersWithAssignments.filter(t => t.summary.has_assignments).length,
                        teachers_without_assignments: teachersWithAssignments.filter(t => !t.summary.has_assignments).length,
                        total_primary_assignments: teachersWithAssignments.reduce((sum, t) => sum + t.summary.primary_teacher_for, 0),
                        total_subject_assignments: teachersWithAssignments.reduce((sum, t) => sum + t.summary.subject_teacher_for, 0)
                    }
                }
            });

        } catch (error) {
            logger.error('Error in get teachers with assignments endpoint:', error);
            next(error);
        }
    }
);

// Delete class level (Admin/Principal only)
router.delete('/class-levels/:id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const classLevelId = req.params.id;

            // First, check if the class level exists
            const { data: classLevel, error: classLevelError } = await adminSupabase
                .from('class_levels')
                .select('id, name')
                .eq('id', classLevelId)
                .single();

            if (classLevelError || !classLevel) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class level not found'
                });
            }

            // Check if any class divisions under this level have students
            const { data: classDivisionsWithStudents, error: studentsError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    students!inner(id)
                `)
                .eq('class_level_id', classLevelId);

            if (studentsError) {
                logger.error('Error checking students in class divisions:', studentsError);
                throw studentsError;
            }

            if (classDivisionsWithStudents && classDivisionsWithStudents.length > 0) {
                const divisionsWithStudents = classDivisionsWithStudents.map(cd => cd.division);
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot delete class level because it has class divisions with enrolled students',
                    data: {
                        class_level_id: classLevelId,
                        class_level_name: classLevel.name,
                        divisions_with_students: divisionsWithStudents,
                        total_divisions_with_students: divisionsWithStudents.length
                    }
                });
            }

            // Check if there are any class divisions under this level (even without students)
            const { data: classDivisions, error: divisionsError } = await adminSupabase
                .from('class_divisions')
                .select('id, division')
                .eq('class_level_id', classLevelId);

            if (divisionsError) {
                logger.error('Error checking class divisions:', divisionsError);
                throw divisionsError;
            }

            if (classDivisions && classDivisions.length > 0) {
                const divisionNames = classDivisions.map(cd => cd.division);
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot delete class level because it has class divisions. Please delete the class divisions first.',
                    data: {
                        class_level_id: classLevelId,
                        class_level_name: classLevel.name,
                        existing_divisions: divisionNames,
                        total_divisions: divisionNames.length
                    }
                });
            }

            // If no class divisions exist, we can safely delete the class level
            const { error: deleteError } = await adminSupabase
                .from('class_levels')
                .delete()
                .eq('id', classLevelId);

            if (deleteError) {
                logger.error('Error deleting class level:', deleteError);
                throw deleteError;
            }

            res.json({
                status: 'success',
                message: 'Class level deleted successfully',
                data: {
                    deleted_class_level: {
                        id: classLevelId,
                        name: classLevel.name
                    }
                }
            });

        } catch (error) {
            logger.error('Error in delete class level endpoint:', error);
            next(error);
        }
    }
);

// Delete class division (Admin/Principal only)
router.delete('/class-divisions/:id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const classDivisionId = req.params.id;

            // First, check if the class division exists
            const { data: classDivision, error: classDivisionError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    class_levels!inner(id, name)
                `)
                .eq('id', classDivisionId)
                .single();

            if (classDivisionError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Check if this class division has any enrolled students
            const { data: students, error: studentsError } = await adminSupabase
                .from('students')
                .select('id, first_name, last_name')
                .eq('class_division_id', classDivisionId);

            if (studentsError) {
                logger.error('Error checking students in class division:', studentsError);
                throw studentsError;
            }

            if (students && students.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot delete class division because it has enrolled students',
                    data: {
                        class_division_id: classDivisionId,
                        class_name: `${classDivision.class_levels.name} ${classDivision.division}`,
                        enrolled_students_count: students.length,
                        students: students.map(s => ({
                            id: s.id,
                            name: `${s.first_name} ${s.last_name}`
                        }))
                    }
                });
            }

            // If no students are enrolled, we can safely delete the class division
            // This will cascade delete related records (teacher assignments, subjects, etc.)
            const { error: deleteError } = await adminSupabase
                .from('class_divisions')
                .delete()
                .eq('id', classDivisionId);

            if (deleteError) {
                logger.error('Error deleting class division:', deleteError);
                throw deleteError;
            }

            res.json({
                status: 'success',
                message: 'Class division deleted successfully',
                data: {
                    deleted_class_division: {
                        id: classDivisionId,
                        class_name: `${classDivision.class_levels.name} ${classDivision.division}`,
                        class_level_id: classDivision.class_levels.id,
                        class_level_name: classDivision.class_levels.name,
                        division: classDivision.division
                    }
                }
            });

        } catch (error) {
            logger.error('Error in delete class division endpoint:', error);
            next(error);
        }
    }
);

export default router;