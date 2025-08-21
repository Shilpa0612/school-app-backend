import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Create parent (Admin/Principal only)
router.post('/',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('full_name').notEmpty().trim().withMessage('Full name is required'),
        body('phone_number').matches(/^[0-9]{10}$/).withMessage('Invalid phone number format (10 digits)'),
        body('email').optional().isEmail().withMessage('Invalid email format'),
        body('initial_password').optional().isLength({ min: 6 }).withMessage('Initial password must be at least 6 characters')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    errors: errors.array()
                });
            }

            const { full_name, phone_number, email, initial_password } = req.body;

            // Check if parent already exists
            const { data: existingParent } = await adminSupabase
                .from('users')
                .select('id, is_registered')
                .eq('phone_number', phone_number)
                .single();

            if (existingParent) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Parent with this phone number already exists',
                    data: {
                        parent_id: existingParent.id,
                        is_registered: existingParent.is_registered
                    }
                });
            }

            // Create parent record
            const { data: newParent, error: parentError } = await adminSupabase
                .from('users')
                .insert([{
                    phone_number,
                    full_name,
                    email,
                    role: 'parent',
                    is_registered: false,
                    password_hash: null,
                    initial_password: initial_password || null,
                    initial_password_set_at: initial_password ? new Date().toISOString() : null
                }])
                .select('id, full_name, phone_number, email, role, is_registered, initial_password')
                .single();

            if (parentError) {
                logger.error('Error creating parent:', parentError);
                throw parentError;
            }

            res.status(201).json({
                status: 'success',
                data: {
                    parent: {
                        id: newParent.id,
                        full_name: newParent.full_name,
                        phone_number: newParent.phone_number,
                        email: newParent.email,
                        role: newParent.role,
                        is_registered: newParent.is_registered
                    },
                    registration_instructions: {
                        message: 'Parent can now register using their phone number',
                        endpoint: 'POST /api/auth/register',
                        required_fields: ['phone_number', 'password', 'role: "parent"']
                    },
                    initial_password: newParent.initial_password || null,
                    note: 'Use /api/parents/:parent_id/link-students to link this parent to students'
                },
                message: 'Parent created successfully. Parent can now register using their phone number.'
            });

        } catch (error) {
            logger.error('Error in create parent endpoint:', error);
            next(error);
        }
    }
);

// Get all parents (Admin/Principal only)
router.get('/',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { page = 1, limit = 20, search } = req.query;
            const offset = (page - 1) * limit;

            let query = adminSupabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    phone_number,
                    email,
                    role,
                    is_registered,
                    created_at,
                    updated_at
                `)
                .eq('role', 'parent');

            // Add search filter
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`);
            }

            // Get total count
            const { count, error: countError } = await query.count();

            if (countError) {
                logger.error('Error getting parents count:', countError);
            }

            // Get paginated results
            const { data: parents, error } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                logger.error('Error fetching parents:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch parents',
                    details: error.message
                });
            }

            // Get parent-student mappings for each parent
            const parentIds = parents.map(p => p.id);
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    parent_id,
                    relationship,
                    is_primary_guardian,
                    student:student_id(
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .in('parent_id', parentIds);

            if (mappingsError) {
                logger.error('Error fetching parent mappings:', mappingsError);
            }

            // Group mappings by parent
            const mappingsByParent = {};
            if (mappings) {
                mappings.forEach(mapping => {
                    if (!mappingsByParent[mapping.parent_id]) {
                        mappingsByParent[mapping.parent_id] = [];
                    }
                    mappingsByParent[mapping.parent_id].push(mapping);
                });
            }

            // Add student information to parents
            const parentsWithStudents = parents.map(parent => ({
                ...parent,
                students: mappingsByParent[parent.id] || []
            }));

            res.json({
                status: 'success',
                data: {
                    parents: parentsWithStudents,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit),
                        has_next: offset + limit < (count || 0),
                        has_prev: page > 1
                    }
                }
            });

        } catch (error) {
            logger.error('Error fetching parents:', error);
            next(error);
        }
    }
);

// Get specific parent (Admin/Principal only)
router.get('/:parent_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { parent_id } = req.params;

            // Get parent details
            const { data: parent, error: parentError } = await adminSupabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    phone_number,
                    email,
                    role,
                    is_registered,
                    created_at,
                    updated_at
                `)
                .eq('id', parent_id)
                .eq('role', 'parent')
                .single();

            if (parentError || !parent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent not found'
                });
            }

            // Get parent's students
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    id,
                    relationship,
                    is_primary_guardian,
                    access_level,
                    created_at,
                    student:student_id(
                        id,
                        full_name,
                        admission_number,
                        date_of_birth,
                        status
                    )
                `)
                .eq('parent_id', parent_id);

            if (mappingsError) {
                logger.error('Error fetching parent mappings:', mappingsError);
            }

            res.json({
                status: 'success',
                data: {
                    parent,
                    students: mappings || []
                }
            });

        } catch (error) {
            logger.error('Error fetching parent details:', error);
            next(error);
        }
    }
);

// Update parent (Admin/Principal only)
router.put('/:parent_id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('full_name').optional().notEmpty().trim().withMessage('Full name cannot be empty'),
        body('email').optional().isEmail().withMessage('Invalid email format'),
        body('initial_password').optional().isLength({ min: 6 }).withMessage('Initial password must be at least 6 characters')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    errors: errors.array()
                });
            }

            const { parent_id } = req.params;
            const { full_name, email, initial_password } = req.body;

            // Check if parent exists
            const { data: existingParent, error: fetchError } = await adminSupabase
                .from('users')
                .select('id, role')
                .eq('id', parent_id)
                .eq('role', 'parent')
                .single();

            if (fetchError || !existingParent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent not found'
                });
            }

            // Prepare update data
            const updateData = {};
            if (full_name !== undefined) updateData.full_name = full_name;
            if (email !== undefined) updateData.email = email;
            if (initial_password !== undefined) {
                updateData.initial_password = initial_password;
                updateData.initial_password_set_at = new Date().toISOString();
            }

            // Update parent
            const { data: updatedParent, error: updateError } = await adminSupabase
                .from('users')
                .update(updateData)
                .eq('id', parent_id)
                .select('id, full_name, phone_number, email, role, is_registered, initial_password')
                .single();

            if (updateError) {
                logger.error('Error updating parent:', updateError);
                throw updateError;
            }

            res.json({
                status: 'success',
                data: {
                    parent: updatedParent
                },
                message: 'Parent updated successfully'
            });

        } catch (error) {
            logger.error('Error updating parent:', error);
            next(error);
        }
    }
);

// Delete parent (Admin/Principal only)
router.delete('/:parent_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { parent_id } = req.params;

            // Check if parent exists
            const { data: existingParent, error: fetchError } = await adminSupabase
                .from('users')
                .select('id, role')
                .eq('id', parent_id)
                .eq('role', 'parent')
                .single();

            if (fetchError || !existingParent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent not found'
                });
            }

            // Check if parent has any student mappings
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select('id')
                .eq('parent_id', parent_id);

            if (mappingsError) {
                logger.error('Error checking parent mappings:', mappingsError);
                throw mappingsError;
            }

            if (mappings && mappings.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot delete parent with linked students. Please unlink all students first.',
                    data: {
                        linked_students_count: mappings.length
                    }
                });
            }

            // Delete parent
            const { error: deleteError } = await adminSupabase
                .from('users')
                .delete()
                .eq('id', parent_id);

            if (deleteError) {
                logger.error('Error deleting parent:', deleteError);
                throw deleteError;
            }

            res.json({
                status: 'success',
                message: 'Parent deleted successfully'
            });

        } catch (error) {
            logger.error('Error deleting parent:', error);
            next(error);
        }
    }
);

// Link students to parent (Admin/Principal only)
router.post('/:parent_id/link-students',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('students').isArray({ min: 1 }).withMessage('At least one student is required'),
        body('students.*.student_id').isUUID().withMessage('Valid student ID is required'),
        body('students.*.relationship').isIn(['father', 'mother', 'guardian']).withMessage('Invalid relationship'),
        body('students.*.is_primary_guardian').isBoolean().withMessage('Primary guardian flag must be boolean'),
        body('students.*.access_level').isIn(['full', 'restricted', 'readonly']).withMessage('Invalid access level')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    errors: errors.array()
                });
            }

            const { parent_id } = req.params;
            const { students } = req.body;

            // Check if parent exists
            const { data: parent, error: parentError } = await adminSupabase
                .from('users')
                .select('id, role')
                .eq('id', parent_id)
                .eq('role', 'parent')
                .single();

            if (parentError || !parent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent not found'
                });
            }

            // Check for primary guardian conflicts
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

            // Check if mappings already exist
            for (const student of students) {
                const { data: existingMapping } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('id')
                    .eq('student_id', student.student_id)
                    .eq('parent_id', parent_id)
                    .single();

                if (existingMapping) {
                    return res.status(400).json({
                        status: 'error',
                        message: `Parent is already linked to student ${student.student_id}`
                    });
                }
            }

            // Create mappings
            const { data: mappings, error: createError } = await adminSupabase
                .from('parent_student_mappings')
                .insert(students.map(student => ({
                    parent_id,
                    student_id: student.student_id,
                    relationship: student.relationship,
                    is_primary_guardian: student.is_primary_guardian,
                    access_level: student.access_level
                })))
                .select(`
                    id,
                    relationship,
                    is_primary_guardian,
                    access_level,
                    student:student_id(
                        id,
                        full_name,
                        admission_number
                    )
                `);

            if (createError) {
                logger.error('Error creating parent-student mappings:', createError);
                throw createError;
            }

            res.status(201).json({
                status: 'success',
                data: {
                    parent_id,
                    mappings
                },
                message: 'Students linked to parent successfully'
            });

        } catch (error) {
            logger.error('Error linking students to parent:', error);
            next(error);
        }
    }
);

// Unlink student from parent (Admin/Principal only)
router.delete('/:parent_id/unlink-student/:student_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { parent_id, student_id } = req.params;

            // Check if mapping exists
            const { data: mapping, error: fetchError } = await adminSupabase
                .from('parent_student_mappings')
                .select('id, is_primary_guardian')
                .eq('parent_id', parent_id)
                .eq('student_id', student_id)
                .single();

            if (fetchError || !mapping) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent-student mapping not found'
                });
            }

            // Delete mapping
            const { error: deleteError } = await adminSupabase
                .from('parent_student_mappings')
                .delete()
                .eq('id', mapping.id);

            if (deleteError) {
                logger.error('Error unlinking student from parent:', deleteError);
                throw deleteError;
            }

            res.json({
                status: 'success',
                message: 'Student unlinked from parent successfully',
                data: {
                    was_primary_guardian: mapping.is_primary_guardian
                }
            });

        } catch (error) {
            logger.error('Error unlinking student from parent:', error);
            next(error);
        }
    }
);

export default router;
