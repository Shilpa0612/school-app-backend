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

            // Verify the student exists in students_master table with class division info
            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .select(`
                    id, 
                    full_name, 
                    admission_number,
                    student_academic_records (
                        class_division:class_division_id (
                            id,
                            division,
                            level:class_level_id (
                                id,
                                name,
                                sequence_number
                            )
                        ),
                        roll_number
                    )
                `)
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

            // Enhance the response with student and class division information
            const enhancedLeaveRequest = {
                ...data,
                student: student
            };

            res.status(201).json({
                status: 'success',
                data: { leave_request: enhancedLeaveRequest }
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
                        admission_number,
                        student_academic_records (
                            class_division:class_division_id (
                                id,
                                division,
                                level:class_level_id (
                                    id,
                                    name,
                                    sequence_number
                                )
                            ),
                            roll_number
                        )
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

            // Additional filters: by student(s) and class division
            const { student_id: singleStudentId, student_ids: csvStudentIds, class_division_id } = req.query;

            // Build allowed set based on role
            let allowedStudentIds = null; // null means all
            if (req.user.role === 'parent') {
                const { data: childrenForFilter } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('student_id')
                    .eq('parent_id', req.user.id);
                allowedStudentIds = (childrenForFilter || []).map(c => c.student_id);
            } else if (req.user.role === 'student') {
                allowedStudentIds = [req.user.id];
            }

            // Student filter from query params
            let requestedStudentIds = [];
            if (singleStudentId) requestedStudentIds.push(singleStudentId);
            if (csvStudentIds) {
                requestedStudentIds.push(...String(csvStudentIds).split(',').map(s => s.trim()).filter(Boolean));
            }

            // Class division filter -> fetch student ids in that division
            let classDivisionStudentIds = [];
            if (class_division_id) {
                const { data: classStudents, error: classStudentsError } = await adminSupabase
                    .from('student_academic_records')
                    .select('student_id')
                    .eq('class_division_id', class_division_id)
                    .eq('status', 'ongoing');
                if (classStudentsError) throw classStudentsError;
                classDivisionStudentIds = (classStudents || []).map(r => r.student_id);
            }

            // Compute final student set by intersecting available constraints
            let finalStudentIds = null; // null => no student filter
            const intersect = (a, b) => a.filter(x => new Set(b).has(x));

            if (allowedStudentIds !== null) finalStudentIds = allowedStudentIds;
            if (requestedStudentIds.length > 0) {
                finalStudentIds = finalStudentIds === null ? requestedStudentIds : intersect(finalStudentIds, requestedStudentIds);
            }
            if (classDivisionStudentIds.length > 0) {
                finalStudentIds = finalStudentIds === null ? classDivisionStudentIds : intersect(finalStudentIds, classDivisionStudentIds);
            }

            if (finalStudentIds !== null) {
                if (finalStudentIds.length === 0) {
                    return res.json({ status: 'success', data: { leave_requests: [] } });
                }
                query = query.in('student_id', finalStudentIds);
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
                .select(`
                    *,
                    student:student_id (
                        id,
                        full_name,
                        admission_number,
                        student_academic_records (
                            class_division:class_division_id (
                                id,
                                division,
                                level:class_level_id (
                                    id,
                                    name,
                                    sequence_number
                                )
                            ),
                            roll_number
                        )
                    )
                `)
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

// Get leave requests for parent's children
router.get('/my-children',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const { status, student_id, from_date, to_date } = req.query;

            console.log('Parent leave requests debug:', {
                user_id: req.user.id,
                user_role: req.user.role,
                filters: { status, student_id, from_date, to_date }
            });

            // Step 1: Get all children of this parent (simplified query first)
            const { data: children, error: childrenError } = await adminSupabase
                .from('parent_student_mappings')
                .select('student_id')
                .eq('parent_id', req.user.id);

            console.log('Children query result:', {
                children: children,
                childrenError: childrenError,
                childrenCount: children?.length || 0
            });

            if (childrenError) {
                console.error('Children query error:', childrenError);
                throw childrenError;
            }

            if (!children || children.length === 0) {
                return res.json({
                    status: 'success',
                    data: {
                        leave_requests: [],
                        children: [],
                        count: 0,
                        total_count: 0,
                        pagination: {
                            page,
                            limit,
                            total: 0,
                            total_pages: 0,
                            has_next: false,
                            has_prev: false
                        }
                    }
                });
            }

            const studentIds = children.map(child => child.student_id);
            console.log('Student IDs for leave requests:', studentIds);

            // Step 2: Get leave requests with basic student info first
            let leaveQuery = adminSupabase
                .from('leave_requests')
                .select(`
                    *,
                    student:student_id (
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .in('student_id', studentIds)
                .order('created_at', { ascending: false });

            // Apply status filter if provided
            if (status) {
                leaveQuery = leaveQuery.eq('status', status);
            }

            // Apply student filter if provided (must be one of parent's children)
            if (student_id) {
                if (!studentIds.includes(student_id)) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Not authorized to access leave requests for this student'
                    });
                }
                leaveQuery = leaveQuery.eq('student_id', student_id);
            }

            // Apply date range overlap filter if provided
            if (from_date && to_date) {
                leaveQuery = leaveQuery.lte('start_date', to_date).gte('end_date', from_date);
            } else if (from_date) {
                leaveQuery = leaveQuery.gte('end_date', from_date);
            } else if (to_date) {
                leaveQuery = leaveQuery.lte('start_date', to_date);
            }

            console.log('Leave query built, executing...');

            // Get all leave requests first (without pagination for count)
            const { data: allLeaveRequests, error: allLeaveError } = await leaveQuery;

            console.log('All leave requests result:', {
                allLeaveRequests: allLeaveRequests,
                allLeaveError: allLeaveError,
                count: allLeaveRequests?.length || 0
            });

            if (allLeaveError) {
                console.error('Leave requests query error:', allLeaveError);
                throw allLeaveError;
            }

            const totalCount = allLeaveRequests?.length || 0;

            // Apply pagination manually
            const paginatedLeaveRequests = allLeaveRequests?.slice(offset, offset + limit) || [];

            // Step 3: Get detailed student information separately
            const { data: detailedStudents, error: studentsError } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    admission_number,
                    date_of_birth,
                    student_academic_records (
                        class_division:class_division_id (
                            division,
                            level:class_level_id (
                                name,
                                sequence_number
                            )
                        ),
                        roll_number
                    )
                `)
                .in('id', studentIds);

            console.log('Detailed students result:', {
                detailedStudents: detailedStudents,
                studentsError: studentsError,
                count: detailedStudents?.length || 0
            });

            if (studentsError) {
                console.error('Students query error:', studentsError);
                throw studentsError;
            }

            // Create a map for quick student lookup
            const studentMap = {};
            detailedStudents?.forEach(student => {
                studentMap[student.id] = student;
            });

            // Enhance leave requests with detailed student info
            const enhancedLeaveRequests = paginatedLeaveRequests.map(request => ({
                ...request,
                student: studentMap[request.student_id] || request.student
            }));

            // Group leave requests by student for better organization
            const leaveRequestsByStudent = {};
            detailedStudents?.forEach(student => {
                leaveRequestsByStudent[student.id] = {
                    student: student,
                    leave_requests: enhancedLeaveRequests.filter(req => req.student_id === student.id)
                };
            });

            res.json({
                status: 'success',
                data: {
                    leave_requests: enhancedLeaveRequests,
                    leave_requests_by_student: leaveRequestsByStudent,
                    children: detailedStudents?.map(student => ({
                        id: student.id,
                        name: student.full_name,
                        admission_number: student.admission_number,
                        class_info: student.student_academic_records?.[0]?.class_division || null
                    })) || [],
                    count: enhancedLeaveRequests.length,
                    total_count: totalCount,
                    filters: {
                        status: status || null,
                        student_id: student_id || null,
                        from_date: from_date || null,
                        to_date: to_date || null
                    },
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        total_pages: Math.ceil(totalCount / limit),
                        has_next: page < Math.ceil(totalCount / limit),
                        has_prev: page > 1
                    }
                }
            });
        } catch (error) {
            console.error('Parent leave requests error:', error);
            next(error);
        }
    }
);

// Debug endpoint for parent leave requests
router.get('/debug/parent-children',
    authenticate,
    async (req, res, next) => {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;

            console.log('Debug endpoint called:', { userId, userRole });

            // Test 1: Check if user exists
            const { data: user, error: userError } = await adminSupabase
                .from('users')
                .select('id, full_name, role')
                .eq('id', userId)
                .single();

            // Test 2: Check parent-student mappings
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select('*')
                .eq('parent_id', userId);

            // Test 3: Check if leave_requests table exists and has data
            const { data: leaveRequests, error: leaveError } = await adminSupabase
                .from('leave_requests')
                .select('*')
                .limit(5);

            // Test 4: Check students_master table
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .limit(5);

            res.json({
                status: 'success',
                data: {
                    user: { data: user, error: userError },
                    parent_student_mappings: { data: mappings, error: mappingsError },
                    leave_requests: { data: leaveRequests, error: leaveError },
                    students_master: { data: students, error: studentsError },
                    debug_info: {
                        user_id: userId,
                        user_role: userRole,
                        mappings_count: mappings?.length || 0,
                        leave_requests_count: leaveRequests?.length || 0,
                        students_count: students?.length || 0
                    }
                }
            });
        } catch (error) {
            console.error('Debug endpoint error:', error);
            res.status(500).json({
                status: 'error',
                message: error.message,
                stack: error.stack
            });
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