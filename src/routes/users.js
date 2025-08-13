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

        // Check if user has a staff record
        let staffInfo = null;
        if (['admin', 'principal', 'teacher'].includes(user.role)) {
            const { data: staff, error: staffError } = await adminSupabase
                .from('staff')
                .select('id, department, designation, joining_date, is_active')
                .eq('user_id', req.user.id)
                .single();

            if (!staffError && staff) {
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

// Get children (for parents)
router.get('/children',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            // Debug: Log the authenticated user
            console.log('Authenticated user:', {
                id: req.user.id,
                name: req.user.full_name,
                role: req.user.role
            });

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

            // Debug: Log the mappings found
            console.log('Mappings found:', mappings);

            const children = mappings.map(mapping => ({
                ...mapping.students,
                relationship: mapping.relationship,
                is_primary_guardian: mapping.is_primary_guardian
            }));

            res.json({
                status: 'success',
                data: {
                    children,
                    debug: {
                        authenticated_user_id: req.user.id,
                        mappings_count: mappings.length
                    }
                }
            });
        } catch (error) {
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

export default router; 