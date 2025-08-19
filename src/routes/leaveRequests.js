import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Create leave request
router.post('/',
    authenticate,
    authorize(['parent', 'student', 'teacher', 'admin', 'principal']),
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

            // Verify user has access to this student based on role
            let hasAccess = false;

            if (req.user.role === 'parent') {
                // Check if parent has access to this student using adminSupabase to bypass RLS
                const { data: mapping, error: mappingError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('id')
                    .eq('parent_id', req.user.id)
                    .eq('student_id', student_id)
                    .single();

                console.log('Parent authorization debug:', {
                    parent_id: req.user.id,
                    student_id: student_id,
                    mapping: mapping,
                    mappingError: mappingError,
                    hasMapping: !mappingError && mapping
                });

                hasAccess = !mappingError && mapping;
            } else if (req.user.role === 'student') {
                // Students can only create leave requests for themselves
                hasAccess = req.user.id === student_id;
            } else if (['teacher', 'admin', 'principal'].includes(req.user.role)) {
                // Teachers, admins, and principals can create leave requests for any student
                hasAccess = true;
            }

            console.log('Final authorization check:', {
                user_role: req.user.role,
                user_id: req.user.id,
                student_id: student_id,
                hasAccess: hasAccess
            });

            if (!hasAccess) {
                return res.status(403).json({
                    status: 'error',
                    message: `Not authorized to create leave request for this student. User role: ${req.user.role}, Student ID: ${student_id}`
                });
            }

            // Verify the student exists in students_master table
            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .eq('id', student_id)
                .single();

            if (studentError || !student) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found'
                });
            }

            const { data, error } = await adminSupabase
                .from('leave_requests')
                .insert([{
                    student_id,
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
            let query = adminSupabase
                .from('leave_requests')
                .select(`
                    *,
                    student:student_id (
                        id,
                        full_name,
                        admission_number
                    )
                `);

            // Debug: Log user role and initial query
            console.log('Leave requests debug:', {
                user_role: req.user.role,
                user_id: req.user.id
            });

            // Filter based on user role
            if (req.user.role === 'parent') {
                // Get leave requests for parent's children using adminSupabase
                const { data: children, error: childrenError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('student_id')
                    .eq('parent_id', req.user.id);

                console.log('Parent children debug:', {
                    children: children,
                    children_error: childrenError
                });

                const studentIds = children?.map(child => child.student_id) || [];
                console.log('Student IDs for filtering:', studentIds);

                if (studentIds.length > 0) {
                    query = query.in('student_id', studentIds);
                } else {
                    // If no children, return empty result
                    return res.json({
                        status: 'success',
                        data: { leave_requests: [] }
                    });
                }
            } else if (req.user.role === 'teacher') {
                // Teachers can see all leave requests (they can approve/reject)
                // No filtering needed for teachers
                console.log('Teacher role - no filtering applied');
            } else if (req.user.role === 'admin' || req.user.role === 'principal') {
                // Admins and principals can see all leave requests
                console.log('Admin/Principal role - no filtering applied');
            }

            // Apply status filter if provided
            if (req.query.status) {
                query = query.eq('status', req.query.status);
            }

            // Apply date range overlap filter if provided
            // A leave request overlaps the window [from_date, to_date] if:
            // start_date <= to_date AND end_date >= from_date
            const { from_date, to_date } = req.query;
            if (from_date && to_date) {
                query = query.lte('start_date', to_date).gte('end_date', from_date);
            } else if (from_date) {
                // Any leave that ends on or after from_date
                query = query.gte('end_date', from_date);
            } else if (to_date) {
                // Any leave that starts on or before to_date
                query = query.lte('start_date', to_date);
            }

            // First, let's check if there are any leave requests at all
            const { data: allRequests, error: allError } = await adminSupabase
                .from('leave_requests')
                .select('*');

            console.log('All leave requests check:', {
                all_requests: allRequests,
                all_error: allError,
                all_count: allRequests?.length || 0
            });

            const { data, error } = await query
                .order('created_at', { ascending: false });

            console.log('Final query result:', {
                data: data,
                error: error,
                data_length: data?.length || 0
            });

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
    authorize(['teacher', 'principal', 'admin']),
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

            // For teachers, principals, and admins - all can approve/reject leave requests
            // No additional authorization needed since they're already authorized by role

            // First check if the leave request exists
            const { data: existingRequest, error: checkError } = await adminSupabase
                .from('leave_requests')
                .select('*')
                .eq('id', id)
                .single();

            console.log('Status update debug:', {
                leave_request_id: id,
                existing_request: existingRequest,
                check_error: checkError
            });

            if (checkError || !existingRequest) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Leave request not found'
                });
            }

            const { data, error } = await adminSupabase
                .from('leave_requests')
                .update({
                    status,
                    reviewed_by: req.user.id
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

// Temporary debug endpoint to check table structure
router.get('/debug/table-structure',
    authenticate,
    async (req, res, next) => {
        try {
            // Try to get table info
            const { data, error } = await adminSupabase
                .from('leave_requests')
                .select('*')
                .limit(1);

            // Try to insert a test record to see what columns are available
            const { data: insertData, error: insertError } = await adminSupabase
                .from('leave_requests')
                .insert([{
                    student_id: 'd2e4585e-830c-40ba-b29c-cc62ff146607',
                    start_date: '2025-07-31',
                    end_date: '2025-08-01',
                    reason: 'Test',
                    status: 'pending'
                }])
                .select()
                .single();

            // Get all leave requests
            const { data: allRequests, error: allError } = await adminSupabase
                .from('leave_requests')
                .select('*');

            res.json({
                status: 'success',
                data: {
                    select_error: error,
                    select_data: data,
                    insert_error: insertError,
                    insert_data: insertData,
                    all_requests: allRequests,
                    all_error: allError,
                    message: 'Debugging table structure'
                }
            });
        } catch (error) {
            res.json({
                status: 'error',
                message: error.message
            });
        }
    }
);

export default router; 