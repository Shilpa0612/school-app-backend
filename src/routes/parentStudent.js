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

export default router; 