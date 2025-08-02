import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Link parent to student(s)
router.post('/link',
    authenticate,
    authorize('parent'),
    [
        body('student_details').isArray().withMessage('Student details must be an array'),
        body('student_details.*.admission_number').notEmpty().withMessage('Admission number is required'),
        body('student_details.*.student_name').notEmpty().withMessage('Student name is required'),
        body('student_details.*.relationship').isIn(['father', 'mother', 'guardian']).withMessage('Invalid relationship type'),
        body('student_details.*.is_primary_guardian').isBoolean().withMessage('Primary guardian flag must be boolean')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { student_details } = req.body;
            const results = [];

            for (const detail of student_details) {
                try {
                    // Verify student exists
                    const { data: student, error: studentError } = await supabase
                        .from('students_master')
                        .select('id, full_name')
                        .eq('admission_number', detail.admission_number)
                        .single();

                    if (studentError || !student) {
                        results.push({
                            admission_number: detail.admission_number,
                            status: 'error',
                            message: 'Student not found'
                        });
                        continue;
                    }

                    // Verify student name matches
                    if (student.full_name.toLowerCase() !== detail.student_name.toLowerCase()) {
                        results.push({
                            admission_number: detail.admission_number,
                            status: 'error',
                            message: 'Student name does not match records'
                        });
                        continue;
                    }

                    // Check existing mappings
                    const { data: existingMapping, error: mappingError } = await supabase
                        .from('parent_student_mappings')
                        .select('id, is_primary_guardian')
                        .eq('student_id', student.id)
                        .eq('parent_id', req.user.id)
                        .single();

                    if (existingMapping) {
                        results.push({
                            admission_number: detail.admission_number,
                            status: 'error',
                            message: 'Relationship already exists'
                        });
                        continue;
                    }

                    // Check if trying to become primary guardian
                    if (detail.is_primary_guardian) {
                        const { data: existingPrimaryGuardian } = await supabase
                            .from('parent_student_mappings')
                            .select('id, parent_id')
                            .eq('student_id', student.id)
                            .eq('is_primary_guardian', true)
                            .single();

                        if (existingPrimaryGuardian) {
                            results.push({
                                admission_number: detail.admission_number,
                                status: 'error',
                                message: 'Student already has a primary guardian'
                            });
                            continue;
                        }
                    }

                    // Create new mapping
                    const { data: newMapping, error: insertError } = await adminSupabase
                        .from('parent_student_mappings')
                        .insert([{
                            parent_id: req.user.id,
                            student_id: student.id,
                            relationship: detail.relationship,
                            is_primary_guardian: detail.is_primary_guardian
                        }])
                        .select()
                        .single();

                    if (insertError) throw insertError;

                    // Notify existing guardians
                    const { data: otherGuardians } = await supabase
                        .from('parent_student_mappings')
                        .select('parent_id')
                        .eq('student_id', student.id)
                        .neq('parent_id', req.user.id);

                    if (otherGuardians?.length > 0) {
                        // TODO: Implement notification system
                        logger.info('Should notify other guardians', {
                            student_id: student.id,
                            new_guardian: req.user.id,
                            other_guardians: otherGuardians
                        });
                    }

                    results.push({
                        admission_number: detail.admission_number,
                        status: 'success',
                        data: newMapping
                    });

                } catch (error) {
                    logger.error('Error processing student link:', error);
                    results.push({
                        admission_number: detail.admission_number,
                        status: 'error',
                        message: 'Internal server error'
                    });
                }
            }

            res.json({
                status: 'success',
                data: { results }
            });

        } catch (error) {
            next(error);
        }
    }
);

// Get parent-student mappings
router.get('/mappings',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            const { data, error } = await supabase
                .from('parent_student_mappings')
                .select(`
                    id,
                    relationship,
                    is_primary_guardian,
                    student:student_id (
                        id,
                        full_name,
                        admission_number,
                        class:class_id (
                            id,
                            name,
                            section,
                            teacher:teacher_id (
                                id,
                                full_name
                            )
                        )
                    )
                `)
                .eq('parent_id', req.user.id);

            if (error) throw error;

            res.json({
                status: 'success',
                data: { mappings: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update parent-student relationship
router.put('/mappings/:id',
    authenticate,
    authorize('parent'),
    [
        body('relationship').optional().isIn(['father', 'mother', 'guardian']),
        body('is_primary_guardian').optional().isBoolean()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const { relationship, is_primary_guardian } = req.body;

            // Verify mapping exists and belongs to user
            const { data: existingMapping, error: mappingError } = await supabase
                .from('parent_student_mappings')
                .select('id, student_id, is_primary_guardian')
                .eq('id', id)
                .eq('parent_id', req.user.id)
                .single();

            if (mappingError || !existingMapping) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Mapping not found'
                });
            }

            // If trying to become primary guardian, check if one already exists
            if (is_primary_guardian && !existingMapping.is_primary_guardian) {
                const { data: existingPrimaryGuardian } = await supabase
                    .from('parent_student_mappings')
                    .select('id')
                    .eq('student_id', existingMapping.student_id)
                    .eq('is_primary_guardian', true)
                    .single();

                if (existingPrimaryGuardian) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Student already has a primary guardian'
                    });
                }
            }

            // Update mapping
            const updateData = {};
            if (relationship) updateData.relationship = relationship;
            if (typeof is_primary_guardian !== 'undefined') updateData.is_primary_guardian = is_primary_guardian;

            const { data, error } = await supabase
                .from('parent_student_mappings')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

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

// ==================== PARENT MANAGEMENT ENDPOINTS ====================

// Get all parents (Admin/Principal only)
router.get('/parents',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { 
                page = 1, 
                limit = 20, 
                class_id, 
                search,
                is_active = true 
            } = req.query;
            
            const offset = (page - 1) * limit;

            // Build query for parents
            let query = adminSupabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    phone_number,
                    email,
                    role,
                    is_active,
                    created_at,
                    parent_student_mappings!inner(
                        student:student_id(
                            id,
                            full_name,
                            admission_number,
                            class:class_id(
                                id,
                                name,
                                section,
                                level:class_level_id(name)
                            )
                        )
                    )
                `)
                .eq('role', 'parent')
                .eq('is_active', is_active)
                .order('full_name', { ascending: true });

            // Apply class filter
            if (class_id) {
                query = query.eq('parent_student_mappings.student.class_id', class_id);
            }

            // Apply search filter
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
            }

            // Get total count
            const { count, error: countError } = await adminSupabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'parent')
                .eq('is_active', is_active);

            if (countError) {
                logger.error('Error getting parents count:', countError);
            }

            // Get paginated results
            const { data: parents, error } = await query
                .range(offset, offset + limit - 1);

            if (error) {
                logger.error('Error fetching parents:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch parents'
                });
            }

            // Process and format the data
            const formattedParents = parents.map(parent => ({
                id: parent.id,
                full_name: parent.full_name,
                phone_number: parent.phone_number,
                email: parent.email,
                role: parent.role,
                is_active: parent.is_active,
                created_at: parent.created_at,
                children: parent.parent_student_mappings.map(mapping => ({
                    id: mapping.student.id,
                    full_name: mapping.student.full_name,
                    admission_number: mapping.student.admission_number,
                    class: mapping.student.class,
                    relationship: mapping.relationship,
                    is_primary_guardian: mapping.is_primary_guardian
                }))
            }));

            res.json({
                status: 'success',
                data: {
                    parents: formattedParents,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit)
                    }
                }
            });

        } catch (error) {
            logger.error('Error in get all parents:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

// Get parents by class (Admin/Principal only)
router.get('/parents/class/:class_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { class_id } = req.params;
            const { 
                page = 1, 
                limit = 20, 
                search,
                is_active = true 
            } = req.query;
            
            const offset = (page - 1) * limit;

            // Verify class exists
            const { data: classData, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('id, name, section')
                .eq('id', class_id)
                .single();

            if (classError || !classData) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class not found'
                });
            }

            // Build query for parents in specific class
            let query = adminSupabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    phone_number,
                    email,
                    role,
                    is_active,
                    created_at,
                    parent_student_mappings!inner(
                        student:student_id(
                            id,
                            full_name,
                            admission_number,
                            class:class_id(
                                id,
                                name,
                                section,
                                level:class_level_id(name)
                            )
                        )
                    )
                `)
                .eq('role', 'parent')
                .eq('is_active', is_active)
                .eq('parent_student_mappings.student.class_id', class_id)
                .order('full_name', { ascending: true });

            // Apply search filter
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
            }

            // Get total count for this class
            const { count, error: countError } = await adminSupabase
                .from('parent_student_mappings')
                .select('parent_id', { count: 'exact', head: true })
                .eq('student.class_id', class_id)
                .eq('parent.role', 'parent')
                .eq('parent.is_active', is_active);

            if (countError) {
                logger.error('Error getting parents count for class:', countError);
            }

            // Get paginated results
            const { data: parents, error } = await query
                .range(offset, offset + limit - 1);

            if (error) {
                logger.error('Error fetching parents by class:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch parents'
                });
            }

            // Process and format the data
            const formattedParents = parents.map(parent => ({
                id: parent.id,
                full_name: parent.full_name,
                phone_number: parent.phone_number,
                email: parent.email,
                role: parent.role,
                is_active: parent.is_active,
                created_at: parent.created_at,
                children: parent.parent_student_mappings
                    .filter(mapping => mapping.student.class.id === class_id)
                    .map(mapping => ({
                        id: mapping.student.id,
                        full_name: mapping.student.full_name,
                        admission_number: mapping.student.admission_number,
                        class: mapping.student.class,
                        relationship: mapping.relationship,
                        is_primary_guardian: mapping.is_primary_guardian
                    }))
            }));

            res.json({
                status: 'success',
                data: {
                    class: classData,
                    parents: formattedParents,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit)
                    }
                }
            });

        } catch (error) {
            logger.error('Error in get parents by class:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

// Get specific parent details (Admin/Principal only)
router.get('/parents/:parent_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { parent_id } = req.params;

            const { data: parent, error } = await adminSupabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    phone_number,
                    email,
                    role,
                    is_active,
                    created_at,
                    parent_student_mappings(
                        id,
                        relationship,
                        is_primary_guardian,
                        student:student_id(
                            id,
                            full_name,
                            admission_number,
                            date_of_birth,
                            gender,
                            class:class_id(
                                id,
                                name,
                                section,
                                level:class_level_id(name),
                                teacher:teacher_id(
                                    id,
                                    full_name,
                                    phone_number
                                )
                            )
                        )
                    )
                `)
                .eq('id', parent_id)
                .eq('role', 'parent')
                .single();

            if (error || !parent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent not found'
                });
            }

            // Format the response
            const formattedParent = {
                id: parent.id,
                full_name: parent.full_name,
                phone_number: parent.phone_number,
                email: parent.email,
                role: parent.role,
                is_active: parent.is_active,
                created_at: parent.created_at,
                children: parent.parent_student_mappings.map(mapping => ({
                    id: mapping.student.id,
                    full_name: mapping.student.full_name,
                    admission_number: mapping.student.admission_number,
                    date_of_birth: mapping.student.date_of_birth,
                    gender: mapping.student.gender,
                    class: mapping.student.class,
                    relationship: mapping.relationship,
                    is_primary_guardian: mapping.is_primary_guardian
                }))
            };

            res.json({
                status: 'success',
                data: { parent: formattedParent }
            });

        } catch (error) {
            logger.error('Error in get parent details:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

// Update parent details (Admin/Principal only)
router.put('/parents/:parent_id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('full_name').optional().notEmpty().trim().withMessage('Full name cannot be empty'),
        body('phone_number').optional().matches(/^[0-9]{10}$/).withMessage('Invalid phone number format'),
        body('email').optional().isEmail().withMessage('Invalid email format'),
        body('is_active').optional().isBoolean().withMessage('Active status must be boolean')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { parent_id } = req.params;
            const updateData = req.body;

            // Check if parent exists
            const { data: existingParent, error: checkError } = await adminSupabase
                .from('users')
                .select('id, role')
                .eq('id', parent_id)
                .eq('role', 'parent')
                .single();

            if (checkError || !existingParent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent not found'
                });
            }

            // Check for duplicate phone number if updating
            if (updateData.phone_number) {
                const { data: duplicatePhone } = await adminSupabase
                    .from('users')
                    .select('id')
                    .eq('phone_number', updateData.phone_number)
                    .neq('id', parent_id)
                    .single();

                if (duplicatePhone) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Phone number already exists'
                    });
                }
            }

            // Check for duplicate email if updating
            if (updateData.email) {
                const { data: duplicateEmail } = await adminSupabase
                    .from('users')
                    .select('id')
                    .eq('email', updateData.email)
                    .neq('id', parent_id)
                    .single();

                if (duplicateEmail) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Email already exists'
                    });
                }
            }

            // Update parent
            const { data: updatedParent, error } = await adminSupabase
                .from('users')
                .update(updateData)
                .eq('id', parent_id)
                .select('id, full_name, phone_number, email, role, is_active, updated_at')
                .single();

            if (error) {
                logger.error('Error updating parent:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to update parent'
                });
            }

            res.json({
                status: 'success',
                data: { parent: updatedParent }
            });

        } catch (error) {
            logger.error('Error in update parent:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

export default router; 