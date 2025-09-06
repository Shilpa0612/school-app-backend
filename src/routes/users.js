import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// List all users (Admin/Principal only) with pagination, optional role and search filters
router.get('/',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const { role, search } = req.query;

            // Base query
            let query = adminSupabase
                .from('users')
                .select('id, full_name, role, phone_number, email, preferred_language, last_login, created_at');

            // Filters
            if (role) {
                query = query.eq('role', role);
            }
            if (search) {
                // Search by name, phone, or email
                query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`);
            }

            // Count total with same filters
            let countQuery = adminSupabase.from('users').select('*', { count: 'exact', head: true });
            if (role) countQuery = countQuery.eq('role', role);
            if (search) countQuery = countQuery.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`);
            const { count, error: countError } = await countQuery;
            if (countError) throw countError;

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            res.json({
                status: 'success',
                data: {
                    users: data,
                    pagination: {
                        page,
                        limit,
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit),
                        has_next: page < Math.ceil((count || 0) / limit),
                        has_prev: page > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get user profile
router.get('/profile', authenticate, async (req, res, next) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, phone_number, role, full_name, email, preferred_language, last_login')
            .eq('id', req.user.id)
            .single();

        if (error) throw error;

        // OPTIMIZATION: Only fetch staff info if needed (for admin/principal/teacher)
        let staffInfo = null;
        if (['admin', 'principal', 'teacher'].includes(user.role)) {
            // Use a more efficient query with only needed fields
            const { data: staff, error: staffError } = await adminSupabase
                .from('staff')
                .select('id, department, designation, joining_date, is_active')
                .eq('user_id', req.user.id)
                .maybeSingle(); // Use maybeSingle to avoid error if no record exists

            if (staff) {
                staffInfo = {
                    staff_id: staff.id,
                    department: staff.department,
                    designation: staff.designation,
                    joining_date: staff.joining_date,
                    is_active: staff.is_active
                };
            }
        }

        const profileData = {
            user,
            staff: staffInfo,
            // Include IDs for easy reference
            ids: {
                user_id: user.id,
                staff_id: staffInfo?.staff_id || null,
                // For teachers, this is the ID to use for class assignments
                teacher_id: user.role === 'teacher' ? user.id : null
            }
        };

        res.json({
            status: 'success',
            data: profileData
        });
    } catch (error) {
        next(error);
    }
});

// Update user profile
router.put('/profile',
    authenticate,
    [
        body('full_name').optional().notEmpty().trim(),
        body('email').optional().isEmail(),
        body('preferred_language').optional().isIn(['english', 'hindi', 'marathi'])
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { full_name, email, preferred_language } = req.body;
            const updateData = {};

            if (full_name) updateData.full_name = full_name;
            if (email) updateData.email = email;
            if (preferred_language) updateData.preferred_language = preferred_language;

            const { data, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', req.user.id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { user: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update any user (Admin/Principal only)
router.put('/:user_id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('full_name').optional().notEmpty().trim(),
        body('email').optional().isEmail(),
        body('phone_number').optional().isString().trim(),
        body('preferred_language').optional().isIn(['english', 'hindi', 'marathi']),
        body('role').optional().isIn(['admin', 'principal', 'teacher', 'parent'])
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { user_id } = req.params;
            const updates = req.body;

            // Prevent changing own role accidentally without intent
            if (updates.role && !['admin', 'principal', 'teacher', 'parent'].includes(updates.role)) {
                return res.status(400).json({ status: 'error', message: 'Invalid role' });
            }

            const { data: updated, error } = await adminSupabase
                .from('users')
                .update(updates)
                .eq('id', user_id)
                .select('id, full_name, role, phone_number, email, preferred_language, last_login')
                .single();

            if (error) throw error;

            res.json({ status: 'success', data: { user: updated } });
        } catch (error) {
            next(error);
        }
    }
);

// Update parent details (Admin/Principal only) – ensures the user is a parent
router.put('/parents/:parent_id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('full_name').optional().notEmpty().trim(),
        body('email').optional().isEmail(),
        body('phone_number').optional().isString().trim(),
        body('preferred_language').optional().isIn(['english', 'hindi', 'marathi'])
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { parent_id } = req.params;

            // Verify target user is a parent
            const { data: target, error: fetchError } = await adminSupabase
                .from('users')
                .select('id, role')
                .eq('id', parent_id)
                .single();
            if (fetchError || !target) {
                return res.status(404).json({ status: 'error', message: 'User not found' });
            }
            if (target.role !== 'parent') {
                return res.status(400).json({ status: 'error', message: 'User is not a parent' });
            }

            const { data: updated, error } = await adminSupabase
                .from('users')
                .update(req.body)
                .eq('id', parent_id)
                .select('id, full_name, role, phone_number, email, preferred_language, last_login')
                .single();

            if (error) throw error;

            res.json({ status: 'success', data: { parent: updated } });
        } catch (error) {
            next(error);
        }
    }
);

// Get children with class and teacher information (for parents) - OPTIMIZED VERSION
router.get('/children',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            console.time('children_endpoint_optimized');

            // SINGLE OPTIMIZED QUERY: Get all data in one go with proper joins
            const { data: childrenData, error } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    relationship,
                    is_primary_guardian,
                    students:students_master!inner (
                        id,
                        full_name,
                        admission_number,
                        profile_photo_path,
                        student_academic_records!inner (
                            id,
                            roll_number,
                            status,
                            class_division:class_division_id (
                                id,
                                division,
                                academic_year:academic_year_id (year_name),
                                class_level:class_level_id (name),
                                teacher:teacher_id (
                                    id,
                                    full_name,
                                    phone_number,
                                    email
                                )
                            )
                        )
                    )
                `)
                .eq('parent_id', req.user.id)
                .eq('students.student_academic_records.status', 'ongoing');

            if (error) {
                console.error('Error fetching children data:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch children data'
                });
            }

            console.time('data_processing');

            // Process data in memory (much faster than multiple queries)
            const children = (childrenData || []).map((mapping) => {
                const student = mapping.students;
                const academicRecord = student.student_academic_records?.[0];
                const classDivision = academicRecord?.class_division;

                // Check if profile photo exists for onboarding
                const hasProfilePhoto = !!(student.profile_photo_path && student.profile_photo_path.trim() !== '');

                // Build the response object
                const childInfo = {
                    id: student.id,
                    name: student.full_name,
                    admission_number: student.admission_number,
                    relationship: mapping.relationship,
                    is_primary_guardian: mapping.is_primary_guardian,
                    onboarding: hasProfilePhoto, // true if profile photo exists, false otherwise
                    profile_photo_path: student.profile_photo_path || null
                };

                // Add class information if available
                if (classDivision) {
                    childInfo.class_info = {
                        class_division_id: classDivision.id,
                        class_name: `${classDivision.class_level?.name || 'Unknown'} ${classDivision.division}`,
                        division: classDivision.division,
                        academic_year: classDivision.academic_year?.year_name,
                        roll_number: academicRecord.roll_number,
                        teacher: classDivision.teacher ? {
                            id: classDivision.teacher.id,
                            name: classDivision.teacher.full_name,
                            phone_number: classDivision.teacher.phone_number,
                            email: classDivision.teacher.email
                        } : null
                    };
                } else {
                    childInfo.class_info = null;
                }

                return childInfo;
            });

            console.timeEnd('data_processing');

            // Calculate summary statistics
            const totalChildren = children.length;
            const childrenWithPhotos = children.filter(c => c.onboarding).length;
            const childrenWithoutPhotos = children.filter(c => !c.onboarding).length;
            const childrenWithClassInfo = children.filter(c => c.class_info).length;

            console.timeEnd('children_endpoint_optimized');

            res.json({
                status: 'success',
                data: {
                    children: children.sort((a, b) => a.name.localeCompare(b.name)),
                    summary: {
                        total_children: totalChildren,
                        children_with_profile_photos: childrenWithPhotos,
                        children_without_profile_photos: childrenWithoutPhotos,
                        children_with_class_info: childrenWithClassInfo,
                        onboarding_completion_rate: totalChildren > 0 ? Math.round((childrenWithPhotos / totalChildren) * 100) : 0
                    }
                }
            });

        } catch (error) {
            console.error('Error in /children endpoint:', error);
            next(error);
        }
    }
);

// Get children's teachers for the authenticated parent (OPTIMIZED VERSION)
router.get('/children/teachers',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            console.time('children_teachers_optimized');

            // SINGLE OPTIMIZED QUERY: Get all data in one go with proper joins
            const { data: childrenData, error } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    relationship,
                    is_primary_guardian,
                    students:students_master!inner (
                        id,
                        full_name,
                        admission_number,
                        student_academic_records!inner (
                            class_division_id,
                            roll_number,
                            status,
                            class_division:class_division_id (
                                id,
                                division,
                                academic_year:academic_year_id (year_name),
                                class_level:class_level_id (name),
                                class_teacher_assignments!inner (
                                    id,
                                    assignment_type,
                                    subject,
                                    is_primary,
                                    assigned_date,
                                    teacher:teacher_id (
                                        id,
                                        full_name,
                                        phone_number,
                                        email
                                    )
                                )
                            )
                        )
                    )
                `)
                .eq('parent_id', req.user.id)
                .eq('students.student_academic_records.status', 'ongoing')
                .eq('students.student_academic_records.class_division.class_teacher_assignments.is_active', true);

            if (error) throw error;

            console.time('data_processing');

            // Process data in memory (much faster than multiple queries)
            const children = (childrenData || []).map((mapping) => {
                const student = mapping.students;
                const academicRecord = student.student_academic_records?.[0];
                const classDivision = academicRecord?.class_division;

                if (!classDivision || !classDivision.class_teacher_assignments) {
                    return null;
                }

                const teachers = classDivision.class_teacher_assignments.map((assignment) => ({
                    assignment_id: assignment.id,
                    teacher_id: assignment.teacher.id,
                    full_name: assignment.teacher.full_name,
                    phone_number: assignment.teacher.phone_number,
                    email: assignment.teacher.email,
                    assignment_type: assignment.assignment_type,
                    subject: assignment.subject,
                    is_primary: assignment.is_primary,
                    assigned_date: assignment.assigned_date,
                    contact_info: {
                        phone: assignment.teacher.phone_number,
                        email: assignment.teacher.email
                    }
                }));

                const classInfo = {
                    class_division_id: classDivision.id,
                    class_name: `${classDivision.class_level?.name || 'Unknown'} ${classDivision.division}`,
                    division: classDivision.division,
                    academic_year: classDivision.academic_year?.year_name,
                    class_level: classDivision.class_level?.name,
                    roll_number: academicRecord.roll_number
                };

                return {
                    student_id: mapping.student_id,
                    student_name: student.full_name,
                    admission_number: student.admission_number,
                    relationship: mapping.relationship,
                    is_primary_guardian: mapping.is_primary_guardian,
                    class_info: classInfo,
                    teachers: teachers
                };
            }).filter(Boolean); // Remove null entries

            // OPTIMIZED CHAT INFO: Single query for all chat threads
            const teacherIds = [...new Set(children.flatMap(c => c.teachers.map(t => t.teacher_id)))];
            let chatInfoMap = new Map();

            if (teacherIds.length > 0) {
                // Get all chat threads where parent and teachers are participants
                const { data: chatThreads, error: chatError } = await adminSupabase
                    .from('chat_threads')
                    .select(`
                        id,
                        title,
                        thread_type,
                        created_at,
                        updated_at,
                        participants:chat_participants(
                            user_id,
                            role,
                            last_read_at,
                            user:users(full_name, role)
                        ),
                        message_count:chat_messages(count)
                    `)
                    .eq('thread_type', 'direct')
                    .or(`participants.user_id.eq.${req.user.id},participants.user_id.in.(${teacherIds.join(',')})`);

                if (!chatError && chatThreads) {
                    // Build chat info map for quick lookup
                    chatThreads.forEach(thread => {
                        const participants = thread.participants || [];
                        const hasParent = participants.some(p => p.user_id === req.user.id);
                        const teacherParticipant = participants.find(p => teacherIds.includes(p.user_id));

                        if (hasParent && teacherParticipant) {
                            chatInfoMap.set(teacherParticipant.user_id, {
                                has_thread: true,
                                thread_id: thread.id,
                                message_count: thread.message_count?.[0]?.count || 0,
                                participants: participants,
                                thread_title: thread.title,
                                thread_type: thread.thread_type,
                                created_at: thread.created_at,
                                updated_at: thread.updated_at
                            });
                        }
                    });
                }
            }

            // Add chat info to teachers
            children.forEach(child => {
                child.teachers.forEach(teacher => {
                    teacher.chat_info = chatInfoMap.get(teacher.teacher_id) || {
                        has_thread: false,
                        thread_id: null,
                        message_count: 0,
                        participants: []
                    };
                });
            });

            console.timeEnd('data_processing');

            // Get principal info (single query)
            const { data: principal } = await adminSupabase
                .from('users')
                .select('id, full_name, email, phone_number')
                .eq('role', 'principal')
                .limit(1)
                .maybeSingle();

            // Calculate summary statistics
            const allTeachers = children.flatMap(c => c.teachers);
            const teachersWithChat = allTeachers.filter(t => t.chat_info.has_thread).length;
            const teachersWithoutChat = allTeachers.filter(t => !t.chat_info.has_thread).length;
            const allClasses = new Set(children.map(c => c.class_info?.class_division_id).filter(Boolean));

            console.timeEnd('children_teachers_optimized');

            res.json({
                status: 'success',
                data: {
                    children: children.sort((a, b) => a.student_name.localeCompare(b.student_name)),
                    principal: principal ? {
                        id: principal.id,
                        full_name: principal.full_name,
                        email: principal.email,
                        phone_number: principal.phone_number,
                        role: 'principal',
                        contact_info: {
                            phone: principal.phone_number,
                            email: principal.email
                        }
                    } : null,
                    summary: {
                        total_children: children.length,
                        total_teachers: allTeachers.length,
                        total_classes: allClasses.size,
                        children_with_teachers: children.filter(c => c.teachers.length > 0).length,
                        children_without_teachers: children.filter(c => c.teachers.length === 0).length,
                        teachers_with_chat: teachersWithChat,
                        teachers_without_chat: teachersWithoutChat
                    }
                }
            });
        } catch (error) {
            console.error('Error in get children teachers:', error);
            next(error);
        }
    }
);

// Debug endpoint to check parent-student mappings (temporary)
router.get('/debug/mappings',
    authenticate,
    async (req, res, next) => {
        try {
            // Get all parent-student mappings
            const { data: allMappings, error: allError } = await supabase
                .from('parent_student_mappings')
                .select('*');

            if (allError) throw allError;

            // Get mappings for current user
            const { data: userMappings, error: userError } = await supabase
                .from('parent_student_mappings')
                .select('*')
                .eq('parent_id', req.user.id);

            if (userError) throw userError;

            // Get mappings for the specific student
            const { data: studentMappings, error: studentError } = await supabase
                .from('parent_student_mappings')
                .select('*')
                .eq('student_id', 'd2e4585e-830c-40ba-b29c-cc62ff146607');

            if (studentError) throw studentError;

            // Check if the specific student exists
            const { data: student, error: studentCheckError } = await supabase
                .from('students_master')
                .select('*')
                .eq('id', 'd2e4585e-830c-40ba-b29c-cc62ff146607');

            if (studentCheckError) throw studentCheckError;

            res.json({
                status: 'success',
                data: {
                    authenticated_user: {
                        id: req.user.id,
                        name: req.user.full_name,
                        role: req.user.role
                    },
                    student_info: student,
                    all_mappings: allMappings,
                    user_mappings: userMappings,
                    student_specific_mappings: studentMappings,
                    summary: {
                        total_mappings: allMappings?.length || 0,
                        user_mappings_count: userMappings?.length || 0,
                        student_mappings_count: studentMappings?.length || 0
                    }
                }
            });
        } catch (error) {
            console.error('Debug endpoint error:', error);
            next(error);
        }
    }
);

// Quick fix endpoint to create missing parent-student mapping (temporary)
router.post('/fix-mapping',
    authenticate,
    async (req, res, next) => {
        try {
            // Check if user is parent
            if (req.user.role !== 'parent') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only parents can use this endpoint'
                });
            }

            // First, let's check what mappings exist for this student
            const { data: existingMappings, error: mappingsError } = await supabase
                .from('parent_student_mappings')
                .select(`
                    id,
                    parent_id,
                    relationship,
                    is_primary_guardian,
                    parent:parent_id (
                        id,
                        full_name,
                        phone_number
                    )
                `)
                .eq('student_id', 'd2e4585e-830c-40ba-b29c-cc62ff146607');

            if (mappingsError) throw mappingsError;

            // Check if current user already has a mapping
            const userMapping = existingMappings.find(m => m.parent_id === req.user.id);

            if (userMapping) {
                return res.status(400).json({
                    status: 'error',
                    message: 'You already have a mapping for this student',
                    data: { existing_mapping: userMapping }
                });
            }

            // Check if there's already a primary guardian
            const primaryGuardian = existingMappings.find(m => m.is_primary_guardian);

            if (primaryGuardian) {
                // Create mapping as non-primary guardian
                const { data: mapping, error } = await supabase
                    .from('parent_student_mappings')
                    .insert([{
                        parent_id: req.user.id,
                        student_id: 'd2e4585e-830c-40ba-b29c-cc62ff146607',
                        relationship: 'father',
                        is_primary_guardian: false,
                        access_level: 'full'
                    }])
                    .select()
                    .single();

                if (error) throw error;

                res.json({
                    status: 'success',
                    data: {
                        mapping,
                        existing_mappings: existingMappings,
                        note: 'Created as secondary guardian since primary guardian already exists'
                    },
                    message: 'Parent-student mapping created successfully'
                });
            } else {
                // Create mapping as primary guardian
                const { data: mapping, error } = await supabase
                    .from('parent_student_mappings')
                    .insert([{
                        parent_id: req.user.id,
                        student_id: 'd2e4585e-830c-40ba-b29c-cc62ff146607',
                        relationship: 'father',
                        is_primary_guardian: true,
                        access_level: 'full'
                    }])
                    .select()
                    .single();

                if (error) throw error;

                res.json({
                    status: 'success',
                    data: {
                        mapping,
                        existing_mappings: existingMappings
                    },
                    message: 'Parent-student mapping created successfully as primary guardian'
                });
            }
        } catch (error) {
            next(error);
        }
    }
);

// Manual mapping creation endpoint (bypasses triggers)
router.post('/create-mapping-manual',
    authenticate,
    async (req, res, next) => {
        try {
            // Check if user is parent
            if (req.user.role !== 'parent') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only parents can use this endpoint'
                });
            }

            // First, let's see what's in the database
            const { data: existingMappings, error: mappingsError } = await supabase
                .from('parent_student_mappings')
                .select('*')
                .eq('student_id', 'd2e4585e-830c-40ba-b29c-cc62ff146607');

            if (mappingsError) throw mappingsError;

            // Check if current user already has a mapping
            const userMapping = existingMappings.find(m => m.parent_id === req.user.id);

            if (userMapping) {
                return res.status(400).json({
                    status: 'error',
                    message: 'You already have a mapping for this student',
                    data: { existing_mapping: userMapping }
                });
            }

            // If there are existing mappings, make this one non-primary
            const isPrimary = existingMappings.length === 0;

            // Create the mapping
            const { data: mapping, error } = await supabase
                .from('parent_student_mappings')
                .insert([{
                    parent_id: req.user.id,
                    student_id: 'd2e4585e-830c-40ba-b29c-cc62ff146607',
                    relationship: 'father',
                    is_primary_guardian: isPrimary,
                    access_level: 'full'
                }])
                .select()
                .single();

            if (error) {
                console.error('Database error:', error);
                throw error;
            }

            res.json({
                status: 'success',
                data: {
                    mapping,
                    existing_mappings: existingMappings,
                    created_as_primary: isPrimary
                },
                message: 'Parent-student mapping created successfully'
            });
        } catch (error) {
            console.error('Error in create-mapping-manual:', error);
            next(error);
        }
    }
);

// Debug endpoint to see all students
router.get('/debug/students',
    authenticate,
    async (req, res, next) => {
        try {
            // Get all students
            const { data: students, error: studentsError } = await supabase
                .from('students_master')
                .select('*');

            if (studentsError) throw studentsError;

            // Get all users with role 'parent'
            const { data: parents, error: parentsError } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'parent');

            if (parentsError) throw parentsError;

            res.json({
                status: 'success',
                data: {
                    students: students,
                    parents: parents,
                    summary: {
                        total_students: students?.length || 0,
                        total_parents: parents?.length || 0
                    }
                }
            });
        } catch (error) {
            console.error('Debug students error:', error);
            next(error);
        }
    }
);

// Delete parent-student mapping
router.delete('/mappings/:mapping_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { mapping_id } = req.params;

            // Check if user is parent and owns this mapping, or is admin/principal
            if (req.user.role === 'parent') {
                // Verify the mapping belongs to this parent
                const { data: mapping, error: mappingError } = await supabase
                    .from('parent_student_mappings')
                    .select('*')
                    .eq('id', mapping_id)
                    .eq('parent_id', req.user.id)
                    .single();

                if (mappingError || !mapping) {
                    return res.status(404).json({
                        status: 'error',
                        message: 'Mapping not found or you do not have permission to delete it'
                    });
                }
            } else if (!['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Unauthorized to delete parent-student mappings'
                });
            }

            // Delete the mapping
            const { error: deleteError } = await adminSupabase
                .from('parent_student_mappings')
                .delete()
                .eq('id', mapping_id);

            if (deleteError) throw deleteError;

            res.json({
                status: 'success',
                message: 'Parent-student mapping deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Force delete mapping for debugging
router.delete('/force-delete-mapping/:mapping_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { mapping_id } = req.params;
            const { error } = await adminSupabase
                .from('parent_student_mappings')
                .delete()
                .eq('id', mapping_id);
            if (error) {
                console.error('Force delete error:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Force delete failed',
                    db_error: error
                });
            }
            res.json({
                status: 'success',
                message: 'Force delete succeeded'
            });
        } catch (error) {
            console.error('Force delete catch error:', error);
            next(error);
        }
    }
);

// Get all parent-student mappings (for admin/principal)
router.get('/all-mappings',
    authenticate,
    async (req, res, next) => {
        try {
            // Only admin and principal can view all mappings
            if (!['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Unauthorized to view all mappings'
                });
            }

            const { data: mappings, error } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    *,
                    parent:parent_id (
                        id,
                        full_name,
                        phone_number,
                        email
                    ),
                    student:students_master (
                        id,
                        full_name,
                        admission_number
                    )
                `);

            if (error) throw error;

            res.json({
                status: 'success',
                data: { mappings }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get parent's own mappings (bypasses RLS)
router.get('/my-mappings',
    authenticate,
    async (req, res, next) => {
        try {
            // Check if user is parent
            if (req.user.role !== 'parent') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only parents can use this endpoint'
                });
            }

            const { data: mappings, error } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    *,
                    parent:parent_id (
                        id,
                        full_name,
                        phone_number,
                        email
                    ),
                    student:students_master (
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .eq('parent_id', req.user.id);

            if (error) throw error;

            res.json({
                status: 'success',
                data: {
                    mappings,
                    authenticated_user: {
                        id: req.user.id,
                        name: req.user.full_name,
                        role: req.user.role
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Debug endpoint to check student mappings
router.get('/debug/student-mappings/:student_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { student_id } = req.params;

            // Get all mappings for this student
            const { data: mappings, error } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    *,
                    parent:parent_id (
                        id,
                        full_name,
                        phone_number,
                        email
                    ),
                    student:students_master (
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .eq('student_id', student_id);

            if (error) throw error;

            // Check for primary guardians
            const primaryGuardians = mappings.filter(m => m.is_primary_guardian);

            res.json({
                status: 'success',
                data: {
                    student_id,
                    all_mappings: mappings,
                    primary_guardians: primaryGuardians,
                    summary: {
                        total_mappings: mappings.length,
                        primary_guardian_count: primaryGuardians.length
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Database health check endpoint
router.get('/debug/database',
    authenticate,
    async (req, res, next) => {
        try {
            // Check if we can connect to different tables
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('count')
                .limit(1);

            const { data: students, error: studentsError } = await supabase
                .from('students_master')
                .select('count')
                .limit(1);

            const { data: mappings, error: mappingsError } = await supabase
                .from('parent_student_mappings')
                .select('count')
                .limit(1);

            res.json({
                status: 'success',
                data: {
                    database_connection: 'working',
                    table_access: {
                        users: usersError ? 'error' : 'accessible',
                        students_master: studentsError ? 'error' : 'accessible',
                        parent_student_mappings: mappingsError ? 'error' : 'accessible'
                    },
                    errors: {
                        users: usersError?.message,
                        students: studentsError?.message,
                        mappings: mappingsError?.message
                    }
                }
            });
        } catch (error) {
            console.error('Database health check error:', error);
            next(error);
        }
    }
);

// Quick test endpoint to create a student (temporary)
router.post('/create-test-student',
    authenticate,
    async (req, res, next) => {
        try {
            // Only allow admin/principal or the specific parent to create test data
            if (!['admin', 'principal'].includes(req.user.role) && req.user.id !== '2299de5c-63ff-4e60-8ae1-71600b29ba86') {
                return res.status(403).json({
                    status: 'error',
                    message: 'Unauthorized to create test data'
                });
            }

            // First, check if we have any class divisions
            const { data: classDivisions, error: classError } = await supabase
                .from('class_divisions')
                .select('id, division')
                .limit(1);

            if (classError) throw classError;

            let classDivisionId = null;
            if (classDivisions && classDivisions.length > 0) {
                classDivisionId = classDivisions[0].id;
            }

            // Create a test student
            const { data: student, error: studentError } = await supabase
                .from('students_master')
                .insert([{
                    admission_number: 'TEST001',
                    full_name: 'Test Student',
                    date_of_birth: '2018-01-01',
                    admission_date: '2025-01-01',
                    status: 'active'
                }])
                .select()
                .single();

            if (studentError) throw studentError;

            // If we have a class division, create academic record
            if (classDivisionId) {
                const { error: academicError } = await supabase
                    .from('student_academic_records')
                    .insert([{
                        student_id: student.id,
                        class_division_id: classDivisionId,
                        roll_number: '01',
                        status: 'ongoing'
                    }]);

                if (academicError) {
                    console.warn('Could not create academic record:', academicError);
                }
            }

            res.json({
                status: 'success',
                data: {
                    student,
                    class_division_used: classDivisionId,
                    note: 'Test student created. You can now link this student to your parent account.'
                },
                message: 'Test student created successfully'
            });
        } catch (error) {
            console.error('Error creating test student:', error);
            next(error);
        }
    }
);

// Clear all parent-student mappings (admin/principal only)
router.delete('/clear-all-mappings',
    authenticate,
    async (req, res, next) => {
        try {
            // Only admin and principal can clear all mappings
            if (!['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Unauthorized to clear all mappings'
                });
            }

            // Get count before deletion
            const { data: mappings, error: countError } = await supabase
                .from('parent_student_mappings')
                .select('id');

            if (countError) throw countError;

            // Delete all mappings
            const { error: deleteError } = await supabase
                .from('parent_student_mappings')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (deleteError) throw deleteError;

            res.json({
                status: 'success',
                data: {
                    deleted_count: mappings?.length || 0
                },
                message: 'All parent-student mappings cleared successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Add this new endpoint after the existing endpoints
router.post('/sync-teacher-to-staff/:user_id', authenticate, async (req, res, next) => {
    try {
        const { user_id } = req.params;

        // Check if user is admin/principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can sync teachers to staff'
            });
        }

        // Get user details
        const user = await supabase
            .from('users')
            .select('*')
            .eq('id', user_id)
            .eq('role', 'teacher')
            .single();

        if (!user.data) {
            return res.status(404).json({
                status: 'error',
                message: 'Teacher not found'
            });
        }

        // Check if already exists in staff table
        const existingStaff = await supabase
            .from('staff')
            .select('*')
            .eq('user_id', user_id)
            .single();

        if (existingStaff.data) {
            return res.status(400).json({
                status: 'error',
                message: 'Teacher already exists in staff table'
            });
        }

        // Create staff record
        const staffData = {
            user_id: user_id,
            full_name: user.data.full_name,
            phone_number: user.data.phone_number,
            email: user.data.email,
            role: 'teacher',
            is_active: true,
            created_by: req.user.id
        };

        const { data: staff, error } = await supabase
            .from('staff')
            .insert(staffData)
            .select()
            .single();

        if (error) {
            console.error('Error creating staff record:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create staff record'
            });
        }

        res.json({
            status: 'success',
            data: {
                message: 'Teacher synced to staff table successfully',
                staff: staff
            }
        });

    } catch (error) {
        console.error('Error syncing teacher to staff:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Add endpoint to sync all teachers to staff
router.post('/sync-all-teachers', authenticate, async (req, res, next) => {
    try {
        // Check if user is admin/principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can sync all teachers'
            });
        }

        // Get all teachers
        const { data: teachers, error: teachersError } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'teacher');

        if (teachersError) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch teachers'
            });
        }

        let syncedCount = 0;
        let skippedCount = 0;

        for (const teacher of teachers) {
            // Check if already exists in staff table
            const existingStaff = await supabase
                .from('staff')
                .select('*')
                .eq('user_id', teacher.id)
                .single();

            if (!existingStaff.data) {
                // Create staff record
                const staffData = {
                    user_id: teacher.id,
                    full_name: teacher.full_name,
                    phone_number: teacher.phone_number,
                    email: teacher.email,
                    role: 'teacher',
                    is_active: true,
                    created_by: req.user.id
                };

                await supabase
                    .from('staff')
                    .insert(staffData);

                syncedCount++;
            } else {
                skippedCount++;
            }
        }

        res.json({
            status: 'success',
            data: {
                message: 'Teachers sync completed',
                synced: syncedCount,
                skipped: skippedCount,
                total: teachers.length
            }
        });

    } catch (error) {
        console.error('Error syncing all teachers:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get all linked parents and principal for a teacher (based on their class/subject assignments)
router.get('/teacher-linked-parents',
    authenticate,
    authorize(['teacher', 'admin', 'principal']),
    async (req, res, next) => {
        try {
            const teacherId = req.user.role === 'teacher' ? req.user.id : req.query.teacher_id;
            const classDivisionId = req.query.class_division_id; // New filter parameter
            let classDivision = null; // Declare at top level

            if (!teacherId) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Teacher ID is required'
                });
            }

            // Validate class division ID if provided
            if (classDivisionId) {
                const { data: classDivisionData, error: classError } = await adminSupabase
                    .from('class_divisions')
                    .select('id, division, class_level:class_level_id(name)')
                    .eq('id', classDivisionId)
                    .single();

                if (classError || !classDivisionData) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid class division ID provided'
                    });
                }

                classDivision = classDivisionData; // Assign to top-level variable
            }

            // Verify teacher exists
            const { data: teacher, error: teacherError } = await adminSupabase
                .from('users')
                .select('id, full_name, role')
                .eq('id', teacherId)
                .eq('role', 'teacher')
                .single();

            if (teacherError || !teacher) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Teacher not found'
                });
            }

            // Get all class assignments for this teacher
            let teacherAssignmentsQuery = adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    assignment_type,
                    subject,
                    is_primary,
                    class_division:class_division_id (
                        id,
                        division,
                        academic_year:academic_year_id (year_name),
                        class_level:class_level_id (name)
                    )
                `)
                .eq('teacher_id', teacherId)
                .eq('is_active', true);

            // Apply class division filter if provided
            if (classDivisionId) {
                teacherAssignmentsQuery = teacherAssignmentsQuery.eq('class_division_id', classDivisionId);
            }

            const { data: teacherAssignments, error: assignmentError } = await teacherAssignmentsQuery;

            if (assignmentError) {
                console.error('Error fetching teacher assignments:', assignmentError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch teacher assignments'
                });
            }

            if (!teacherAssignments || teacherAssignments.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        teacher: {
                            id: teacher.id,
                            full_name: teacher.full_name
                        },
                        linked_parents: [],
                        principal: null,
                        total_linked_parents: 0,
                        message: 'No class assignments found for this teacher'
                    }
                });
            }

            // Get all class division IDs where teacher is assigned
            const classDivisionIds = teacherAssignments.map(assignment => assignment.class_division.id);

            // Get all students in these classes
            const { data: students, error: studentsError } = await adminSupabase
                .from('student_academic_records')
                .select(`
                    student_id,
                    class_division_id,
                    roll_number,
                    students:students_master (
                        id,
                        full_name,
                        parent_student_mappings (
                            parent_id,
                            parents:users (
                                id,
                                full_name,
                                email,
                                phone_number
                            )
                        )
                    )
                `)
                .in('class_division_id', classDivisionIds)
                .eq('status', 'ongoing');

            if (studentsError) {
                console.error('Error fetching students:', studentsError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch students'
                });
            }

            // Get principal information
            const { data: principal, error: principalError } = await adminSupabase
                .from('users')
                .select('id, full_name, email, phone_number, role')
                .eq('role', 'principal')
                .limit(1)
                .single();

            if (principalError) {
                console.error('Error fetching principal:', principalError);
                // Continue without principal info
            }

            // Extract and deduplicate parents
            const parentMap = new Map();
            const studentParentMap = new Map();

            (students || []).forEach(studentRecord => {
                const student = studentRecord.students;
                if (student && student.parent_student_mappings) {
                    student.parent_student_mappings.forEach(mapping => {
                        const parent = mapping.parents;
                        if (parent && !parentMap.has(parent.id)) {
                            parentMap.set(parent.id, {
                                parent_id: parent.id,
                                full_name: parent.full_name,
                                email: parent.email,
                                phone_number: parent.phone_number,
                                linked_students: []
                            });
                        }

                        // Add student to parent's linked students
                        if (parentMap.has(parent.id)) {
                            const parentData = parentMap.get(parent.id);
                            const studentInfo = {
                                student_id: student.id,
                                student_name: student.full_name,
                                roll_number: studentRecord.roll_number,
                                class_division_id: studentRecord.class_division_id,
                                teacher_assignments: teacherAssignments.filter(assignment =>
                                    assignment.class_division.id === studentRecord.class_division_id
                                ).map(assignment => ({
                                    assignment_type: assignment.assignment_type,
                                    subject: assignment.subject,
                                    is_primary: assignment.is_primary,
                                    class_name: `${assignment.class_division.class_level.name} ${assignment.class_division.division}`,
                                    academic_year: assignment.class_division.academic_year.year_name
                                }))
                            };

                            // Check if student already exists for this parent
                            const existingStudent = parentData.linked_students.find(s => s.student_id === student.id);
                            if (!existingStudent) {
                                parentData.linked_students.push(studentInfo);
                            } else {
                                // Merge teacher assignments
                                studentInfo.teacher_assignments.forEach(assignment => {
                                    const existingAssignment = existingStudent.teacher_assignments.find(a =>
                                        a.assignment_type === assignment.assignment_type &&
                                        a.subject === assignment.subject
                                    );
                                    if (!existingAssignment) {
                                        existingStudent.teacher_assignments.push(assignment);
                                    }
                                });
                            }
                        }
                    });
                }
            });

            // Convert map to array and sort by parent name
            const linkedParents = Array.from(parentMap.values()).sort((a, b) =>
                a.full_name.localeCompare(b.full_name)
            );

            // Get chat thread information for each parent
            const parentsWithChatInfo = await Promise.all(
                linkedParents.map(async (parent) => {
                    try {
                        // Check if there's an existing chat thread between teacher and parent
                        // First, get all threads where teacher is a participant
                        const { data: teacherThreads, error: teacherThreadError } = await adminSupabase
                            .from('chat_participants')
                            .select('thread_id')
                            .eq('user_id', teacherId);

                        if (teacherThreadError || !teacherThreads || teacherThreads.length === 0) {
                            return {
                                ...parent,
                                chat_info: {
                                    has_thread: false,
                                    thread_id: null,
                                    message_count: 0,
                                    participants: []
                                }
                            };
                        }

                        // Get all threads where parent is a participant
                        const { data: parentThreads, error: parentThreadError } = await adminSupabase
                            .from('chat_participants')
                            .select('thread_id')
                            .eq('user_id', parent.parent_id);

                        if (parentThreadError || !parentThreads || parentThreads.length === 0) {
                            return {
                                ...parent,
                                chat_info: {
                                    has_thread: false,
                                    thread_id: null,
                                    message_count: 0,
                                    participants: []
                                }
                            };
                        }

                        // Find common thread IDs
                        const teacherThreadIds = teacherThreads.map(t => t.thread_id);
                        const parentThreadIds = parentThreads.map(t => t.thread_id);
                        const commonThreadIds = teacherThreadIds.filter(id => parentThreadIds.includes(id));

                        if (commonThreadIds.length === 0) {
                            return {
                                ...parent,
                                chat_info: {
                                    has_thread: false,
                                    thread_id: null,
                                    message_count: 0,
                                    participants: []
                                }
                            };
                        }

                        // Get the thread details (take the first common thread)
                        const { data: thread, error: threadError } = await adminSupabase
                            .from('chat_threads')
                            .select(`
                                id,
                                title,
                                thread_type,
                                created_at,
                                updated_at,
                                participants:chat_participants(
                                    user_id,
                                    role,
                                    last_read_at,
                                    user:users(full_name, role)
                                )
                            `)
                            .eq('id', commonThreadIds[0])
                            .eq('thread_type', 'direct')
                            .single();

                        if (threadError || !thread) {
                            // No existing thread
                            return {
                                ...parent,
                                chat_info: {
                                    has_thread: false,
                                    thread_id: null,
                                    message_count: 0,
                                    participants: []
                                }
                            };
                        }

                        // Get message count for this thread
                        const { count: messageCount, error: countError } = await adminSupabase
                            .from('chat_messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('thread_id', thread.id);

                        if (countError) {
                            console.error('Error getting message count for thread:', thread.id, countError);
                        }

                        return {
                            ...parent,
                            chat_info: {
                                has_thread: true,
                                thread_id: thread.id,
                                message_count: messageCount || 0,
                                participants: thread.participants || [],
                                thread_title: thread.title,
                                thread_type: thread.thread_type,
                                created_at: thread.created_at,
                                updated_at: thread.updated_at
                            }
                        };
                    } catch (error) {
                        console.error('Error getting chat info for parent:', parent.parent_id, error);
                        return {
                            ...parent,
                            chat_info: {
                                has_thread: false,
                                thread_id: null,
                                message_count: 0,
                                participants: []
                            }
                        };
                    }
                })
            );

            // Calculate summary statistics
            const totalStudents = new Set(students?.map(s => s.student_id) || []).size;
            const totalClasses = new Set(classDivisionIds).size;

            res.json({
                status: 'success',
                data: {
                    teacher: {
                        id: teacher.id,
                        full_name: teacher.full_name,
                        assignments: teacherAssignments.map(assignment => ({
                            assignment_type: assignment.assignment_type,
                            subject: assignment.subject,
                            is_primary: assignment.is_primary,
                            class_name: `${assignment.class_division.class_level.name} ${assignment.class_division.division}`,
                            academic_year: assignment.class_division.academic_year.year_name
                        }))
                    },
                    linked_parents: parentsWithChatInfo,
                    principal: principal ? {
                        id: principal.id,
                        full_name: principal.full_name,
                        email: principal.email,
                        phone_number: principal.phone_number,
                        role: principal.role
                    } : null,
                    filters: {
                        class_division_id: classDivisionId || null,
                        class_division_name: classDivision ? `${classDivision.class_level?.name || 'Unknown'} ${classDivision.division || 'Unknown'}` : null
                    },
                    summary: {
                        total_linked_parents: parentsWithChatInfo.length,
                        total_students: totalStudents,
                        total_classes: totalClasses,
                        total_assignments: teacherAssignments.length,
                        primary_teacher_for: teacherAssignments.filter(a => a.is_primary).length,
                        subject_teacher_for: teacherAssignments.filter(a => !a.is_primary).length,
                        parents_with_chat: parentsWithChatInfo.filter(p => p.chat_info.has_thread).length,
                        parents_without_chat: parentsWithChatInfo.filter(p => !p.chat_info.has_thread).length
                    }
                }
            });

        } catch (error) {
            console.error('Error in get teacher linked parents:', error);
            next(error);
        }
    }
);

// Get children's teachers for the authenticated parent (enhanced for messaging)
router.get('/children/teachers',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            // Fetch the parent's child mappings with student details
            const { data: mappings, error: mappingError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    relationship,
                    is_primary_guardian,
                    students:students_master (
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .eq('parent_id', req.user.id);

            if (mappingError) throw mappingError;

            const studentIds = (mappings || []).map(m => m.student_id);
            if (studentIds.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        children: [],
                        principal: null,
                        summary: {
                            total_children: 0,
                            total_teachers: 0,
                            total_classes: 0
                        }
                    }
                });
            }

            // Get ongoing academic records for these students with class details
            const { data: records, error: recError } = await adminSupabase
                .from('student_academic_records')
                .select(`
                    student_id,
                    class_division_id,
                    roll_number,
                    status,
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
                .in('student_id', studentIds)
                .eq('status', 'ongoing');

            if (recError) throw recError;

            const classIds = Array.from(new Set((records || []).map(r => r.class_division_id).filter(Boolean)));
            if (classIds.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        children: mappings.map(m => ({
                            student_id: m.student_id,
                            student_name: m.students?.full_name || 'Unknown',
                            admission_number: m.students?.admission_number || 'Unknown',
                            relationship: m.relationship,
                            is_primary_guardian: m.is_primary_guardian,
                            class_info: null,
                            teachers: []
                        })),
                        principal: null,
                        summary: {
                            total_children: studentIds.length,
                            total_teachers: 0,
                            total_classes: 0
                        }
                    }
                });
            }

            // Fetch teacher assignments for these classes
            const { data: assignments, error: aErr } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    class_division_id,
                    teacher_id,
                    assignment_type,
                    subject,
                    is_primary,
                    assigned_date,
                    teacher:teacher_id (
                        id,
                        full_name,
                        phone_number,
                        email
                    )
                `)
                .in('class_division_id', classIds)
                .eq('is_active', true)
                .order('is_primary', { ascending: false })
                .order('assigned_date', { ascending: true });

            if (aErr) throw aErr;

            // Build map class_division_id -> teachers
            const classToTeachers = new Map();
            for (const a of assignments || []) {
                const arr = classToTeachers.get(a.class_division_id) || [];
                arr.push({
                    assignment_id: a.id,
                    teacher_id: a.teacher_id,
                    full_name: a.teacher?.full_name || null,
                    phone_number: a.teacher?.phone_number || null,
                    email: a.teacher?.email || null,
                    assignment_type: a.assignment_type,
                    subject: a.subject || null,
                    is_primary: a.is_primary,
                    assigned_date: a.assigned_date
                });
                classToTeachers.set(a.class_division_id, arr);
            }

            // Optionally include legacy teacher_id if no assignments exist
            if ((assignments || []).length === 0) {
                const { data: legacyClasses } = await adminSupabase
                    .from('class_divisions')
                    .select(`
                        id,
                        teacher:teacher_id (
                            id,
                            full_name,
                            phone_number,
                            email
                        )
                    `)
                    .in('id', classIds);

                for (const lc of legacyClasses || []) {
                    if (lc.teacher) {
                        classToTeachers.set(lc.id, [{
                            assignment_id: `legacy-${lc.id}`,
                            teacher_id: lc.teacher.id,
                            full_name: lc.teacher.full_name,
                            phone_number: lc.teacher.phone_number,
                            email: lc.teacher.email,
                            assignment_type: 'class_teacher',
                            subject: null,
                            is_primary: true,
                            assigned_date: null
                        }]);
                    }
                }
            }

            // Get principal info
            const { data: principal } = await adminSupabase
                .from('users')
                .select('id, full_name, email, phone_number')
                .eq('role', 'principal')
                .limit(1)
                .maybeSingle();

            // Assemble response by child with comprehensive information
            const children = [];
            const allTeachers = new Set();
            const allClasses = new Set();

            for (const mapping of mappings || []) {
                const student = mapping.students;
                const record = (records || []).find(r => r.student_id === mapping.student_id);

                let classInfo = null;
                let teachers = [];

                if (record && record.class_division) {
                    classInfo = {
                        class_division_id: record.class_division_id,
                        class_name: `${record.class_division.class_level.name} ${record.class_division.division}`,
                        division: record.class_division.division,
                        academic_year: record.class_division.academic_year.year_name,
                        class_level: record.class_division.class_level.name,
                        roll_number: record.roll_number
                    };

                    teachers = classToTeachers.get(record.class_division_id) || [];

                    // Add to sets for summary
                    allClasses.add(record.class_division_id);
                    teachers.forEach(t => allTeachers.add(t.teacher_id));
                }

                children.push({
                    student_id: mapping.student_id,
                    student_name: student?.full_name || 'Unknown',
                    admission_number: student?.admission_number || 'Unknown',
                    relationship: mapping.relationship,
                    is_primary_guardian: mapping.is_primary_guardian,
                    class_info: classInfo,
                    teachers: teachers.map(teacher => ({
                        assignment_id: teacher.assignment_id,
                        teacher_id: teacher.teacher_id,
                        full_name: teacher.full_name,
                        phone_number: teacher.phone_number,
                        email: teacher.email,
                        assignment_type: teacher.assignment_type,
                        subject: teacher.subject,
                        is_primary: teacher.is_primary,
                        assigned_date: teacher.assigned_date,
                        contact_info: {
                            phone: teacher.phone_number,
                            email: teacher.email
                        }
                    }))
                });
            }

            // Sort children by name
            children.sort((a, b) => a.student_name.localeCompare(b.student_name));

            // Get chat thread information for each teacher
            const childrenWithChatInfo = await Promise.all(
                children.map(async (child) => {
                    const teachersWithChatInfo = await Promise.all(
                        child.teachers.map(async (teacher) => {
                            try {
                                // Check if there's an existing chat thread between parent and teacher
                                // First, get all threads where parent is a participant
                                const { data: parentThreads, error: parentThreadError } = await adminSupabase
                                    .from('chat_participants')
                                    .select('thread_id')
                                    .eq('user_id', req.user.id);

                                if (parentThreadError || !parentThreads || parentThreads.length === 0) {
                                    return {
                                        ...teacher,
                                        chat_info: {
                                            has_thread: false,
                                            thread_id: null,
                                            message_count: 0,
                                            participants: []
                                        }
                                    };
                                }

                                // Get all threads where teacher is a participant
                                const { data: teacherThreads, error: teacherThreadError } = await adminSupabase
                                    .from('chat_participants')
                                    .select('thread_id')
                                    .eq('user_id', teacher.teacher_id);

                                if (teacherThreadError || !teacherThreads || teacherThreads.length === 0) {
                                    return {
                                        ...teacher,
                                        chat_info: {
                                            has_thread: false,
                                            thread_id: null,
                                            message_count: 0,
                                            participants: []
                                        }
                                    };
                                }

                                // Find common thread IDs
                                const parentThreadIds = parentThreads.map(t => t.thread_id);
                                const teacherThreadIds = teacherThreads.map(t => t.thread_id);
                                const commonThreadIds = parentThreadIds.filter(id => teacherThreadIds.includes(id));

                                if (commonThreadIds.length === 0) {
                                    return {
                                        ...teacher,
                                        chat_info: {
                                            has_thread: false,
                                            thread_id: null,
                                            message_count: 0,
                                            participants: []
                                        }
                                    };
                                }

                                // Get the thread details (take the first common thread)
                                const { data: thread, error: threadError } = await adminSupabase
                                    .from('chat_threads')
                                    .select(`
                                        id,
                                        title,
                                        thread_type,
                                        created_at,
                                        updated_at,
                                        participants:chat_participants(
                                            user_id,
                                            role,
                                            last_read_at,
                                            user:users(full_name, role)
                                        )
                                    `)
                                    .eq('id', commonThreadIds[0])
                                    .eq('thread_type', 'direct')
                                    .single();

                                if (threadError || !thread) {
                                    return {
                                        ...teacher,
                                        chat_info: {
                                            has_thread: false,
                                            thread_id: null,
                                            message_count: 0,
                                            participants: []
                                        }
                                    };
                                }

                                // Get message count for this thread
                                const { count: messageCount, error: countError } = await adminSupabase
                                    .from('chat_messages')
                                    .select('*', { count: 'exact', head: true })
                                    .eq('thread_id', thread.id);

                                if (countError) {
                                    console.error('Error getting message count for thread:', thread.id, countError);
                                }

                                return {
                                    ...teacher,
                                    chat_info: {
                                        has_thread: true,
                                        thread_id: thread.id,
                                        message_count: messageCount || 0,
                                        participants: thread.participants || [],
                                        thread_title: thread.title,
                                        thread_type: thread.thread_type,
                                        created_at: thread.created_at,
                                        updated_at: thread.updated_at
                                    }
                                };
                            } catch (error) {
                                console.error('Error getting chat info for teacher:', teacher.teacher_id, error);
                                return {
                                    ...teacher,
                                    chat_info: {
                                        has_thread: false,
                                        thread_id: null,
                                        message_count: 0,
                                        participants: []
                                    }
                                };
                            }
                        })
                    );

                    return {
                        ...child,
                        teachers: teachersWithChatInfo
                    };
                })
            );

            // Calculate chat-related summary statistics
            const allTeachersWithChat = childrenWithChatInfo.flatMap(child => child.teachers);
            const teachersWithChat = allTeachersWithChat.filter(t => t.chat_info.has_thread).length;
            const teachersWithoutChat = allTeachersWithChat.filter(t => !t.chat_info.has_thread).length;

            res.json({
                status: 'success',
                data: {
                    children: childrenWithChatInfo,
                    principal: principal ? {
                        id: principal.id,
                        full_name: principal.full_name,
                        email: principal.email,
                        phone_number: principal.phone_number,
                        role: 'principal',
                        contact_info: {
                            phone: principal.phone_number,
                            email: principal.email
                        }
                    } : null,
                    summary: {
                        total_children: childrenWithChatInfo.length,
                        total_teachers: allTeachers.size,
                        total_classes: allClasses.size,
                        children_with_teachers: childrenWithChatInfo.filter(c => c.teachers.length > 0).length,
                        children_without_teachers: childrenWithChatInfo.filter(c => c.teachers.length === 0).length,
                        teachers_with_chat: teachersWithChat,
                        teachers_without_chat: teachersWithoutChat
                    }
                }
            });
        } catch (error) {
            console.error('Error in get children teachers:', error);
            next(error);
        }
    }
);

// Update staff date of birth (Admin only)
router.put('/staff/:id/date-of-birth',
    authenticate,
    authorize('admin'),
    [
        body('date_of_birth').isISO8601().toDate().withMessage('Date of birth must be a valid date')
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
            const { date_of_birth } = req.body;

            // Check if staff exists
            const { data: staff, error: staffError } = await adminSupabase
                .from('staff')
                .select('id, full_name, role')
                .eq('id', id)
                .single();

            if (staffError || !staff) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Staff member not found'
                });
            }

            // Update the date of birth
            const { data: updatedStaff, error: updateError } = await adminSupabase
                .from('staff')
                .update({ date_of_birth })
                .eq('id', id)
                .select('id, full_name, role, date_of_birth')
                .single();

            if (updateError) {
                console.error('Error updating staff date of birth:', updateError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to update date of birth'
                });
            }

            res.json({
                status: 'success',
                message: 'Staff date of birth updated successfully',
                data: {
                    staff: updatedStaff
                }
            });

        } catch (error) {
            next(error);
        }
    }
);

// Get staff birthdays (Admin/Principal)
router.get('/staff/birthdays',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { date, upcoming_days = 30 } = req.query;

            let query = adminSupabase
                .from('staff')
                .select(`
                    id,
                    full_name,
                    role,
                    date_of_birth,
                    email,
                    phone_number,
                    department
                `)
                .not('date_of_birth', 'is', null);

            if (date) {
                // Filter by specific date
                const targetDate = new Date(date);
                query = query
                    .eq('date_of_birth', targetDate.toISOString().split('T')[0]);
            } else {
                // Filter for upcoming birthdays
                const today = new Date();
                const upcomingDate = new Date();
                upcomingDate.setDate(today.getDate() + parseInt(upcoming_days));

                // Get month and day for today
                const todayMonth = today.getMonth() + 1;
                const todayDay = today.getDate();
                const upcomingMonth = upcomingDate.getMonth() + 1;
                const upcomingDay = upcomingDate.getDate();

                // Complex query for upcoming birthdays across year boundary
                if (upcomingMonth >= todayMonth) {
                    // Same year or next year
                    query = query.or(`and(extract(month from date_of_birth).gte.${todayMonth},extract(day from date_of_birth).gte.${todayDay}),and(extract(month from date_of_birth).lte.${upcomingMonth},extract(day from date_of_birth).lte.${upcomingDay})`);
                } else {
                    // Crosses year boundary
                    query = query.or(`and(extract(month from date_of_birth).gte.${todayMonth},extract(day from date_of_birth).gte.${todayDay}),and(extract(month from date_of_birth).lte.${upcomingMonth},extract(day from date_of_birth).lte.${upcomingDay})`);
                }
            }

            const { data: staff, error } = await query.order('date_of_birth');

            if (error) {
                console.error('Error fetching staff birthdays:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch staff birthdays'
                });
            }

            // Calculate days until birthday for each staff member
            const staffWithBirthdayInfo = staff.map(member => {
                const birthday = new Date(member.date_of_birth);
                const today = new Date();
                const nextBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());

                if (nextBirthday < today) {
                    nextBirthday.setFullYear(today.getFullYear() + 1);
                }

                const daysUntilBirthday = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));

                return {
                    ...member,
                    days_until_birthday: daysUntilBirthday,
                    is_upcoming: daysUntilBirthday <= parseInt(upcoming_days)
                };
            });

            // Sort by upcoming birthdays
            staffWithBirthdayInfo.sort((a, b) => {
                if (a.is_upcoming && !b.is_upcoming) return -1;
                if (!a.is_upcoming && b.is_upcoming) return 1;
                return a.days_until_birthday - b.days_until_birthday;
            });

            res.json({
                status: 'success',
                data: {
                    staff: staffWithBirthdayInfo,
                    summary: {
                        total_staff: staffWithBirthdayInfo.length,
                        upcoming_birthdays: staffWithBirthdayInfo.filter(s => s.is_upcoming).length,
                        filter_date: date || null,
                        upcoming_days: parseInt(upcoming_days)
                    }
                }
            });

        } catch (error) {
            next(error);
        }
    }
);

// Get all chats for principal with filtering (Admin/Principal only)
router.get('/principal/chats',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const {
                start_date,
                end_date,
                class_division_id,
                chat_type = 'all', // 'direct', 'group', 'all'
                includes_me = 'all', // 'yes', 'no', 'all'
                page = 1,
                limit = 20
            } = req.query;

            const offset = (page - 1) * limit;
            const principalId = req.user.id;

            // Build base query for chat threads
            let query = adminSupabase
                .from('chat_threads')
                .select(`
                    id,
                    title,
                    thread_type,
                    created_at,
                    updated_at,
                    created_by,
                    participants:chat_participants(
                        user_id,
                        role,
                        last_read_at,
                        user:users(
                            id,
                            full_name,
                            role,
                            email,
                            phone_number
                        )
                    ),
                    last_message:chat_messages(
                        id,
                        content,
                        created_at,
                        sender:users!chat_messages_sender_id_fkey(
                            id,
                            full_name,
                            role
                        )
                    )
                `)
                .order('updated_at', { ascending: false });

            // Apply date range filter
            if (start_date) {
                query = query.gte('created_at', new Date(start_date).toISOString());
            }
            if (end_date) {
                query = query.lte('created_at', new Date(end_date).toISOString());
            }

            // Apply chat type filter
            if (chat_type !== 'all') {
                query = query.eq('thread_type', chat_type);
            }

            // If class_division_id is provided, pre-compute relevant user IDs (teachers, parents, students)
            let relevantUserIds = null;
            if (class_division_id) {
                relevantUserIds = new Set();

                // 1) Teachers for this division (assignments and legacy class teacher)
                const [assignmentsRes, legacyTeacherRes] = await Promise.all([
                    adminSupabase
                        .from('class_teacher_assignments')
                        .select('teacher_id')
                        .eq('class_division_id', class_division_id)
                        .eq('is_active', true),
                    adminSupabase
                        .from('class_divisions')
                        .select('teacher_id')
                        .eq('id', class_division_id)
                        .single()
                ]);
                (assignmentsRes.data || []).forEach(a => a.teacher_id && relevantUserIds.add(a.teacher_id));
                if (legacyTeacherRes.data?.teacher_id) relevantUserIds.add(legacyTeacherRes.data.teacher_id);

                // 2) Students in this division
                const { data: sar } = await adminSupabase
                    .from('student_academic_records')
                    .select('student_id')
                    .eq('class_division_id', class_division_id)
                    .eq('status', 'ongoing');
                const studentIds = (sar || []).map(r => r.student_id);

                // 3) Parents of those students
                if (studentIds.length > 0) {
                    const { data: parentMaps } = await adminSupabase
                        .from('parent_student_mappings')
                        .select('parent_id')
                        .in('student_id', studentIds);
                    (parentMaps || []).forEach(m => m.parent_id && relevantUserIds.add(m.parent_id));
                }

                // 4) Convert to array for querying
                relevantUserIds = Array.from(relevantUserIds);

                // If none found, short-circuit to empty result
                if (relevantUserIds.length === 0) {
                    return res.json({
                        status: 'success',
                        data: {
                            threads: [],
                            filters: { start_date, end_date, class_division_id, chat_type, includes_me, page: parseInt(page), limit: parseInt(limit) },
                            pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, total_pages: 0, has_next: false, has_prev: page > 1 },
                            summary: { total_threads: 0, direct_chats: 0, group_chats: 0, includes_principal: 0, excludes_principal: 0, total_messages: 0, average_messages_per_thread: 0, participant_stats: { total_unique: 0, teachers: 0, parents: 0, students: 0, admins: 0 } }
                        }
                    });
                }

                // Restrict threads to those that include at least one relevant user
                // by first fetching thread_ids from chat_participants
                const { data: participantThreads, error: participantErr } = await adminSupabase
                    .from('chat_participants')
                    .select('thread_id')
                    .in('user_id', relevantUserIds);

                if (participantErr) {
                    console.error('Error fetching participant threads for division filter:', participantErr);
                    return res.status(500).json({ status: 'error', message: 'Failed to apply class filter' });
                }

                const filteredThreadIds = Array.from(new Set((participantThreads || []).map(pt => pt.thread_id)));

                if (filteredThreadIds.length === 0) {
                    return res.json({
                        status: 'success',
                        data: {
                            threads: [],
                            filters: { start_date, end_date, class_division_id, chat_type, includes_me, page: parseInt(page), limit: parseInt(limit) },
                            pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, total_pages: 0, has_next: false, has_prev: page > 1 },
                            summary: { total_threads: 0, direct_chats: 0, group_chats: 0, includes_principal: 0, excludes_principal: 0, total_messages: 0, average_messages_per_thread: 0, participant_stats: { total_unique: 0, teachers: 0, parents: 0, students: 0, admins: 0 } }
                        }
                    });
                }

                query = query.in('id', filteredThreadIds);

                // Attach for count filtering below
                req._filteredThreadIds = filteredThreadIds;
            }

            // Get total count for pagination (apply filters if any)
            let countBase = adminSupabase.from('chat_threads').select('*', { count: 'exact', head: true });
            if (chat_type !== 'all') countBase = countBase.eq('thread_type', chat_type);
            if (start_date) countBase = countBase.gte('created_at', new Date(start_date).toISOString());
            if (end_date) countBase = countBase.lte('created_at', new Date(end_date).toISOString());
            if (class_division_id && Array.isArray(req._filteredThreadIds) && req._filteredThreadIds.length > 0) {
                countBase = countBase.in('id', req._filteredThreadIds);
            }
            const { count: totalCount, error: countError } = await countBase;

            if (countError) {
                console.error('Error getting total count:', countError);
            }

            // Get all threads with pagination
            const { data: threads, error: threadsError } = await query
                .range(offset, offset + limit - 1);

            if (threadsError) {
                console.error('Error fetching chat threads:', threadsError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch chat threads'
                });
            }

            // Process threads to add additional information
            const processedThreads = await Promise.all(
                (threads || []).map(async (thread) => {
                    try {
                        // Check if principal is a participant
                        const isPrincipalParticipant = thread.participants.some(
                            p => p.user_id === principalId
                        );

                        // Apply "includes me" filter
                        if (includes_me === 'yes' && !isPrincipalParticipant) {
                            return null;
                        }
                        if (includes_me === 'no' && isPrincipalParticipant) {
                            return null;
                        }

                        // Get message count
                        const { count: messageCount, error: countError } = await adminSupabase
                            .from('chat_messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('thread_id', thread.id);

                        if (countError) {
                            console.error('Error getting message count for thread:', thread.id, countError);
                        }

                        // Get participant details with roles
                        const baseParticipants = thread.participants.map(p => ({
                            user_id: p.user_id,
                            role: p.role,
                            last_read_at: p.last_read_at,
                            user: p.user,
                            is_principal: p.user_id === principalId
                        }));

                        // Enrich participant metadata for parent/teacher relative to class_division_id (if provided)
                        const participants = await Promise.all((baseParticipants || []).map(async (p) => {
                            const enriched = { ...p };
                            if (class_division_id) {
                                try {
                                    if (p.user?.role === 'parent') {
                                        // Find this parent's children in the given division
                                        const { data: childMaps } = await adminSupabase
                                            .from('parent_student_mappings')
                                            .select('student_id')
                                            .eq('parent_id', p.user.id);
                                        const studentIds = (childMaps || []).map(m => m.student_id);
                                        let childrenInDivision = [];
                                        if (studentIds.length > 0) {
                                            const { data: records } = await adminSupabase
                                                .from('student_academic_records')
                                                .select(`
                                                    student_id,
                                                    roll_number,
                                                    class_division_id,
                                                    students:students_master (id, full_name)
                                                `)
                                                .in('student_id', studentIds)
                                                .eq('class_division_id', class_division_id)
                                                .eq('status', 'ongoing');
                                            childrenInDivision = (records || []).map(r => ({
                                                id: r.students?.id || r.student_id,
                                                full_name: r.students?.full_name || null,
                                                roll_number: r.roll_number
                                            }));
                                        }
                                        enriched.parent_of_in_division = childrenInDivision;
                                    } else if (p.user?.role === 'teacher') {
                                        // Determine teacher role in this division (class teacher / subject teacher subjects)
                                        const [{ data: ta }] = await Promise.all([
                                            adminSupabase
                                                .from('class_teacher_assignments')
                                                .select('assignment_type, subject')
                                                .eq('teacher_id', p.user.id)
                                                .eq('class_division_id', class_division_id)
                                                .eq('is_active', true)
                                        ]);

                                        // Legacy check for class teacher
                                        const { data: legacyClass } = await adminSupabase
                                            .from('class_divisions')
                                            .select('teacher_id')
                                            .eq('id', class_division_id)
                                            .single();

                                        const isClassTeacher = (ta || []).some(a => a.assignment_type === 'class_teacher') || (legacyClass?.teacher_id === p.user.id);
                                        const subjects = Array.from(new Set((ta || [])
                                            .map(a => a.subject)
                                            .filter(Boolean)));
                                        enriched.teacher_role_in_division = {
                                            is_class_teacher: isClassTeacher,
                                            subjects
                                        };
                                    }
                                } catch (metaErr) {
                                    // Non-fatal; leave unenriched if error
                                }
                            }
                            return enriched;
                        }));

                        // Categorize participants
                        const teachers = participants.filter(p => p.user.role === 'teacher');
                        const parents = participants.filter(p => p.user.role === 'parent');
                        const students = participants.filter(p => p.user.role === 'student');
                        const admins = participants.filter(p => p.user.role === 'admin');

                        // Get class division info if available (for group chats)
                        let classInfo = null;
                        if (thread.thread_type === 'group' && class_division_id) {
                            const { data: classData, error: classError } = await adminSupabase
                                .from('class_divisions')
                                .select(`
                                    id,
                                    division,
                                    academic_year:academic_year_id (year_name),
                                    class_level:class_level_id (name)
                                `)
                                .eq('id', class_division_id)
                                .single();

                            if (!classError && classData) {
                                classInfo = {
                                    id: classData.id,
                                    name: `${classData.class_level.name} ${classData.division}`,
                                    academic_year: classData.academic_year.year_name
                                };
                            }
                        }

                        // Apply class division filter
                        if (class_division_id && classInfo && classInfo.id !== class_division_id) {
                            return null;
                        }

                        return {
                            thread_id: thread.id,
                            title: thread.title,
                            thread_type: thread.thread_type,
                            created_at: thread.created_at,
                            updated_at: thread.updated_at,
                            created_by: thread.created_by,
                            message_count: messageCount || 0,
                            is_principal_participant: isPrincipalParticipant,
                            participants: {
                                all: participants,
                                teachers: teachers,
                                parents: parents,
                                students: students,
                                admins: admins,
                                count: participants.length
                            },
                            last_message: thread.last_message ? {
                                id: thread.last_message.id,
                                content: thread.last_message.content,
                                created_at: thread.last_message.created_at,
                                sender: thread.last_message.sender
                            } : null,
                            class_info: classInfo,
                            badges: {
                                includes_principal: isPrincipalParticipant,
                                is_group: thread.thread_type === 'group',
                                is_direct: thread.thread_type === 'direct',
                                has_teachers: teachers.length > 0,
                                has_parents: parents.length > 0,
                                has_students: students.length > 0,
                                has_admins: admins.length > 0
                            }
                        };
                    } catch (error) {
                        console.error('Error processing thread:', thread.id, error);
                        return null;
                    }
                })
            );

            // Filter out null values and apply final filters
            const filteredThreads = processedThreads.filter(thread => thread !== null);

            // Calculate summary statistics
            const totalThreads = filteredThreads.length;
            const directChats = filteredThreads.filter(t => t.thread_type === 'direct').length;
            const groupChats = filteredThreads.filter(t => t.thread_type === 'group').length;
            const includesPrincipal = filteredThreads.filter(t => t.is_principal_participant).length;
            const excludesPrincipal = filteredThreads.filter(t => !t.is_principal_participant).length;
            const totalMessages = filteredThreads.reduce((sum, t) => sum + t.message_count, 0);

            // Get participant statistics
            const allParticipants = filteredThreads.flatMap(t => t.participants.all);
            const uniqueParticipants = [...new Set(allParticipants.map(p => p.user_id))];
            const participantStats = {
                total_unique: uniqueParticipants.length,
                teachers: filteredThreads.reduce((sum, t) => sum + t.participants.teachers.length, 0),
                parents: filteredThreads.reduce((sum, t) => sum + t.participants.parents.length, 0),
                students: filteredThreads.reduce((sum, t) => sum + t.participants.students.length, 0),
                admins: filteredThreads.reduce((sum, t) => sum + t.participants.admins.length, 0)
            };

            res.json({
                status: 'success',
                data: {
                    threads: filteredThreads,
                    filters: {
                        start_date,
                        end_date,
                        class_division_id,
                        chat_type,
                        includes_me,
                        page: parseInt(page),
                        limit: parseInt(limit)
                    },
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount || 0,
                        total_pages: Math.ceil((totalCount || 0) / limit),
                        has_next: offset + limit < (totalCount || 0),
                        has_prev: page > 1
                    },
                    summary: {
                        total_threads: totalThreads,
                        direct_chats: directChats,
                        group_chats: groupChats,
                        includes_principal: includesPrincipal,
                        excludes_principal: excludesPrincipal,
                        total_messages: totalMessages,
                        average_messages_per_thread: totalThreads > 0 ? Math.round(totalMessages / totalThreads) : 0,
                        participant_stats: participantStats
                    }
                }
            });

        } catch (error) {
            console.error('Error in get principal chats:', error);
            next(error);
        }
    }
);

// ============================================================================
// GET DIVISION PARENTS FOR TEACHER CHAT (Minimal data)
// ============================================================================

router.get('/division/:class_division_id/parents',
    authenticate,
    authorize(['teacher', 'admin', 'principal']),
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const teacherId = req.user.id;

            console.log('Division parents access request:', {
                teacher_id: teacherId,
                class_division_id,
                user_role: req.user.role
            });

            // Validate class_division_id format
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(class_division_id)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid class_division_id format. Must be a valid UUID'
                });
            }

            // Verify teacher has access to this division (either as class teacher or subject teacher)
            // Admin and Principal always have access
            let hasAccess = (req.user.role === 'admin' || req.user.role === 'principal');

            console.log('Checking teacher access for division:', {
                teacher_id: teacherId,
                class_division_id,
                step: 'starting access check'
            });

            // Debug: Check all assignments for this teacher (skip if admin/principal)
            let allTeacherAssignments = null;
            let allAssignmentsError = null;
            if (!hasAccess) {
                const result = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('*')
                    .eq('teacher_id', teacherId)
                    .eq('is_active', true);
                allTeacherAssignments = result.data;
                allAssignmentsError = result.error;
            }

            console.log('All teacher assignments found:', {
                teacher_id: teacherId,
                total_assignments: allTeacherAssignments?.length || 0,
                assignments: allTeacherAssignments?.map(a => ({
                    id: a.id,
                    class_division_id: a.class_division_id,
                    assignment_type: a.assignment_type,
                    subject: a.subject,
                    is_active: a.is_active
                })) || [],
                error: allAssignmentsError
            });

            // Check if teacher has any assignment for this division in class_teacher_assignments table
            const { data: teacherAssignments, error: teacherAssignmentError } = await adminSupabase
                .from('class_teacher_assignments')
                .select('id, assignment_type, subject')
                .eq('teacher_id', teacherId)
                .eq('class_division_id', class_division_id)
                .eq('is_active', true);

            // If no assignment found with teacher_id, try user_id field
            let teacherAssignmentsByUserId = null;
            if (!teacherAssignments || teacherAssignments.length === 0) {
                const { data: assignmentsByUserId, error: userIdError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id, assignment_type, subject')
                    .eq('user_id', teacherId)
                    .eq('class_division_id', class_division_id)
                    .eq('is_active', true);

                teacherAssignmentsByUserId = assignmentsByUserId;
                console.log('Tried user_id field check:', {
                    teacher_id: teacherId,
                    class_division_id,
                    data: assignmentsByUserId,
                    error: userIdError,
                    found_assignment: assignmentsByUserId && assignmentsByUserId.length > 0
                });
            }

            console.log('class_teacher_assignments check result:', {
                teacher_id: teacherId,
                class_division_id,
                data: teacherAssignments,
                error: teacherAssignmentError,
                found_assignment: teacherAssignments && teacherAssignments.length > 0,
                data_by_user_id: teacherAssignmentsByUserId
            });

            if ((teacherAssignments && teacherAssignments.length > 0) || (teacherAssignmentsByUserId && teacherAssignmentsByUserId.length > 0)) {
                const assignments = teacherAssignments || teacherAssignmentsByUserId;
                hasAccess = true;
                console.log('Teacher access granted via class_teacher_assignments:', {
                    teacher_id: teacherId,
                    class_division_id,
                    total_assignments: assignments.length,
                    assignments: assignments.map(a => ({
                        assignment_type: a.assignment_type,
                        subject: a.subject
                    })),
                    used_field: teacherAssignments ? 'teacher_id' : 'user_id'
                });
            } else {
                console.log('No assignment found in class_teacher_assignments, checking legacy table...');

                // Fallback: Check legacy class_divisions table if class_teacher_assignments doesn't have the data
                const { data: classTeacherCheck, error: classTeacherError } = await adminSupabase
                    .from('class_divisions')
                    .select('id')
                    .eq('id', class_division_id)
                    .eq('teacher_id', teacherId)
                    .single();

                console.log('class_divisions check result:', {
                    teacher_id: teacherId,
                    class_division_id,
                    data: classTeacherCheck,
                    error: classTeacherError,
                    found_class_teacher: !!classTeacherCheck
                });

                if (classTeacherCheck) {
                    hasAccess = true;
                    console.log('Teacher access granted via legacy class_divisions table');
                }
            }

            console.log('Final access decision:', {
                teacher_id: teacherId,
                class_division_id,
                has_access: hasAccess,
                reason: hasAccess ? 'Access granted' : 'No assignments found in any table'
            });

            if (!hasAccess) {
                console.log('Teacher access denied:', {
                    teacher_id: teacherId,
                    class_division_id,
                    reason: 'No assignments found in any table'
                });
                return res.status(403).json({
                    status: 'error',
                    message: 'You do not have access to this class division'
                });
            }

            // Get all students in this division with minimal data
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    student_academic_records!inner (
                        roll_number,
                        class_division_id
                    )
                `)
                .eq('status', 'active')
                .eq('student_academic_records.class_division_id', class_division_id)
                .eq('student_academic_records.status', 'ongoing');

            if (studentsError) {
                console.log('Error fetching students:', studentsError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch students'
                });
            }

            // Sort students by roll number on the client side
            const sortedStudents = (students || []).sort((a, b) => {
                const rollA = parseInt(a.student_academic_records[0]?.roll_number) || 0;
                const rollB = parseInt(b.student_academic_records[0]?.roll_number) || 0;
                return rollA - rollB;
            });

            if (!sortedStudents || sortedStudents.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        class_division_id,
                        students: [],
                        total_students: 0,
                        total_parents: 0
                    }
                });
            }

            // Get parent information for all students
            const studentIds = sortedStudents.map(s => s.id);
            const { data: parentMappings, error: parentError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    parent_id,
                    relationship,
                    is_primary_guardian,
                    parent:users!parent_student_mappings_parent_id_fkey (
                        id,
                        full_name,
                        email,
                        phone_number
                    )
                `)
                .in('student_id', studentIds);

            if (parentError) {
                console.log('Error fetching parent mappings:', parentError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch parent information'
                });
            }

            // Organize data by student with parent information
            const studentsWithParents = sortedStudents.map(student => {
                const studentRecord = student.student_academic_records[0];
                const studentParents = parentMappings?.filter(pm => pm.student_id === student.id) || [];

                return {
                    student: {
                        id: student.id,
                        name: student.full_name,
                        roll_number: studentRecord?.roll_number || 'N/A'
                    },
                    parents: studentParents.map(pm => ({
                        id: pm.parent.id,
                        name: pm.parent.full_name,
                        email: pm.parent.email,
                        phone_number: pm.parent.phone_number,
                        relationship: pm.relationship,
                        is_primary_guardian: pm.is_primary_guardian
                    }))
                };
            });

            // Get unique parent count
            const uniqueParentIds = new Set();
            studentsWithParents.forEach(swp => {
                swp.parents.forEach(parent => {
                    uniqueParentIds.add(parent.id);
                });
            });

            res.json({
                status: 'success',
                data: {
                    class_division_id,
                    students: studentsWithParents,
                    total_students: sortedStudents.length,
                    total_parents: uniqueParentIds.size,
                    summary: {
                        students_with_parents: studentsWithParents.filter(swp => swp.parents.length > 0).length,
                        students_without_parents: studentsWithParents.filter(swp => swp.parents.length === 0).length
                    }
                }
            });

        } catch (error) {
            console.log('Error fetching division parents:', error);
            next(error);
        }
    }
);

// ============================================================================

export default router; 