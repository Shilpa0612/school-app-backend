import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Create leave request
router.post('/',
    authenticate,
    authorize('parent'),
    [
        body('student_id').isUUID(),
        body('start_date').isISO8601().toDate(),
        body('end_date').isISO8601().toDate(),
        body('reason').notEmpty().trim()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { student_id, start_date, end_date, reason } = req.body;

            // Verify parent has access to this student
            const { data: mapping, error: mappingError } = await supabase
                .from('parent_student_mappings')
                .select('id')
                .eq('parent_id', req.user.id)
                .eq('student_id', student_id)
                .single();

            if (mappingError || !mapping) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to create leave request for this student'
                });
            }

            const { data, error } = await supabase
                .from('leave_requests')
                .insert([{
                    student_id,
                    requested_by: req.user.id,
                    start_date,
                    end_date,
                    reason,
                    status: 'pending'
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { leave_request: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get leave requests
router.get('/',
    authenticate,
    async (req, res, next) => {
        try {
            let query = supabase
                .from('leave_requests')
                .select(`
                    *,
                    student:student_id (
                        id,
                        full_name,
                        class:class_id (
                            id,
                            name,
                            section,
                            teacher:teacher_id (id, full_name)
                        )
                    ),
                    requester:requested_by (id, full_name, role),
                    approver:approved_by (id, full_name, role)
                `);

            // Filter based on user role
            if (req.user.role === 'parent') {
                // Get leave requests for parent's children
                const { data: children } = await supabase
                    .from('parent_student_mappings')
                    .select('student_id')
                    .eq('parent_id', req.user.id);

                const studentIds = children.map(child => child.student_id);
                query = query.in('student_id', studentIds);
            } else if (req.user.role === 'teacher') {
                // Get leave requests for teacher's class students
                const { data: classStudents } = await supabase
                    .from('classes')
                    .select('students!inner (id)')
                    .eq('teacher_id', req.user.id);

                const studentIds = classStudents.map(student => student.id);
                query = query.in('student_id', studentIds);
            }

            // Apply status filter if provided
            if (req.query.status) {
                query = query.eq('status', req.query.status);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false });

            if (error) throw error;

            res.json({
                status: 'success',
                data: { leave_requests: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update leave request status
router.put('/:id/status',
    authenticate,
    authorize('teacher', 'principal'),
    [
        body('status').isIn(['approved', 'rejected'])
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const { status } = req.body;

            // If teacher, verify they are assigned to student's class
            if (req.user.role === 'teacher') {
                const { data: leaveRequest, error: leaveError } = await supabase
                    .from('leave_requests')
                    .select(`
                        student:student_id (
                            class:class_id (teacher_id)
                        )
                    `)
                    .eq('id', id)
                    .single();

                if (leaveError || !leaveRequest || leaveRequest.student.class.teacher_id !== req.user.id) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Not authorized to update this leave request'
                    });
                }
            }

            const { data, error } = await supabase
                .from('leave_requests')
                .update({
                    status,
                    approved_by: req.user.id
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { leave_request: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router; 