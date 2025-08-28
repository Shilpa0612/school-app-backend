import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document').split(',');
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: ${allowedTypes.join(', ')}`));
        }
    }
});

// Create homework
router.post('/',
    authenticate,
    authorize(['teacher', 'parent']),
    [
        body('class_division_id').isUUID(),
        body('subject').notEmpty().trim(),
        body('title').notEmpty().trim(),
        body('description').notEmpty().trim(),
        body('due_date').isISO8601().toDate()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { class_division_id, subject, title, description, due_date } = req.body;

            // Verify class division exists
            const { data: classData, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('id')
                .eq('id', class_division_id)
                .single();

            if (classError || !classData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            let isAuthorized = false;

            if (req.user.role === 'teacher') {
                // Verify teacher is assigned to this class division using new many-to-many system
                const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id, assignment_type, is_primary')
                    .eq('class_division_id', class_division_id)
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true);

                console.log('Teacher assignment check:', { teacherAssignments, assignmentError });

                if (!assignmentError && teacherAssignments && teacherAssignments.length > 0) {
                    isAuthorized = true;
                }
            } else if (req.user.role === 'parent') {
                // Verify parent has children in this class division
                const { data: childrenInClass, error: childrenError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        students:students_master (
                            id,
                            full_name
                        ),
                        student_academic_records (
                            id,
                            class_division_id,
                            academic_year_id
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (!childrenError && childrenInClass && childrenInClass.length > 0) {
                    // Check if any child is actually in this class
                    const hasChildInClass = childrenInClass.some(mapping =>
                        mapping.student_academic_records &&
                        mapping.student_academic_records.some(record =>
                            record.class_division_id === class_division_id
                        )
                    );

                    console.log('Parent homework creation check:', {
                        class_division_id,
                        children_classes: childrenInClass.map(mapping =>
                            mapping.student_academic_records?.map(record => record.class_division_id)
                        ).flat().filter(Boolean),
                        hasChildInClass
                    });

                    if (hasChildInClass) {
                        isAuthorized = true;
                    }
                }
            }

            if (!isAuthorized) {
                let errorMessage = 'You are not authorized to create homework for this class division';
                let debugInfo = null;

                if (req.user.role === 'parent') {
                    // Get the class division details for better error message
                    const { data: classDivision } = await adminSupabase
                        .from('class_divisions')
                        .select(`
                            division,
                            level:class_level_id (name)
                        `)
                        .eq('id', class_division_id)
                        .single();

                    if (classDivision) {
                        errorMessage = `You can only create homework for classes where your children are enrolled. This class is ${classDivision.level.name} ${classDivision.division}, but your children are not in this class.`;
                    }

                    // Add debug information to help troubleshoot
                    debugInfo = {
                        parent_id: req.user.id,
                        class_division_id: class_division_id,
                        class_name: classDivision ? `${classDivision.level.name} ${classDivision.division}` : 'Unknown',
                        children_data: childrenInClass || [],
                        children_classes: childrenInClass ? childrenInClass.map(mapping =>
                            mapping.student_academic_records?.map(record => ({
                                class_division_id: record.class_division_id,
                                academic_year_id: record.academic_year_id
                            }))
                        ).flat().filter(Boolean) : [],
                        authorization_check: {
                            children_found: childrenInClass ? childrenInClass.length : 0,
                            children_with_records: childrenInClass ? childrenInClass.filter(mapping =>
                                mapping.student_academic_records && mapping.student_academic_records.length > 0
                            ).length : 0,
                            matching_classes: childrenInClass ? childrenInClass.filter(mapping =>
                                mapping.student_academic_records &&
                                mapping.student_academic_records.some(record =>
                                    record.class_division_id === class_division_id
                                )
                            ).length : 0
                        }
                    };
                }

                return res.status(403).json({
                    status: 'error',
                    message: errorMessage,
                    debug: debugInfo
                });
            }

            const { data, error } = await adminSupabase
                .from('homework')
                .insert([{
                    class_division_id,
                    teacher_id: req.user.id,
                    subject,
                    title,
                    description,
                    due_date
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { homework: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get homework list
router.get('/',
    authenticate,
    async (req, res, next) => {
        try {
            let query = adminSupabase
                .from('homework')
                .select(`
                    *,
                    teacher:teacher_id (id, full_name),
                    class_division:class_division_id (
                        id,
                        division,
                        level:class_level_id (
                            name,
                            sequence_number
                        )
                    ),
                    attachments:homework_files (id, file_name, file_type, storage_path)
                `);

            // Filter based on user role
            if (req.user.role === 'teacher') {
                // Teachers see homework for their assigned classes using new many-to-many system
                const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('class_division_id')
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true);

                if (assignmentError) throw assignmentError;

                if (teacherAssignments && teacherAssignments.length > 0) {
                    const classIds = teacherAssignments.map(assignment => assignment.class_division_id);
                    query = query.in('class_division_id', classIds);
                } else {
                    // If no assignments found, return empty result
                    query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Impossible UUID
                }
            } else if (req.user.role === 'parent') {
                // Parents see homework for their children's classes
                const { data: childrenClasses } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        students:students_master (
                            id
                        ),
                        student_academic_records (
                            class_division_id
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (childrenClasses && childrenClasses.length > 0) {
                    const classIds = childrenClasses
                        .filter(mapping => mapping.student_academic_records && mapping.student_academic_records.length > 0)
                        .map(mapping => mapping.student_academic_records[0].class_division_id);

                    if (classIds.length > 0) {
                        query = query.in('class_division_id', classIds);
                    }
                }
            }
            // Admin and Principal can see all homework (no additional filtering needed)

            // Apply filters from query parameters
            if (req.query.class_division_id) {
                query = query.eq('class_division_id', req.query.class_division_id);
            }
            if (req.query.subject) {
                query = query.eq('subject', req.query.subject);
            }
            if (req.query.teacher_id && (req.user.role === 'admin' || req.user.role === 'principal')) {
                query = query.eq('teacher_id', req.query.teacher_id);
            }
            if (req.query.academic_year_id) {
                // Filter by academic year through class division
                query = query.eq('class_division.academic_year_id', req.query.academic_year_id);
            }
            if (req.query.class_level_id) {
                // Filter by class level through class division
                query = query.eq('class_division.level.id', req.query.class_level_id);
            }
            if (req.query.due_date_from) {
                query = query.gte('due_date', req.query.due_date_from);
            }
            if (req.query.due_date_to) {
                query = query.lte('due_date', req.query.due_date_to);
            }
            if (req.query.status) {
                // Filter by due date status (overdue, upcoming, completed)
                const now = new Date();
                if (req.query.status === 'overdue') {
                    query = query.lt('due_date', now.toISOString());
                } else if (req.query.status === 'upcoming') {
                    query = query.gt('due_date', now.toISOString());
                }
            }

            // Pagination
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            // Get total count for pagination using a separate count query
            let countQuery = adminSupabase.from('homework').select('*', { count: 'exact', head: true });

            // Apply the same filters to count query
            if (req.user.role === 'teacher') {
                // Teachers see homework for their assigned classes using new many-to-many system
                const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('class_division_id')
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true);

                if (assignmentError) throw assignmentError;

                if (teacherAssignments && teacherAssignments.length > 0) {
                    const classIds = teacherAssignments.map(assignment => assignment.class_division_id);
                    countQuery = countQuery.in('class_division_id', classIds);
                } else {
                    // If no assignments found, return empty result
                    countQuery = countQuery.eq('id', '00000000-0000-0000-0000-000000000000'); // Impossible UUID
                }
            } else if (req.user.role === 'parent') {
                // For parents, we need to apply the same class filtering logic
                const { data: childrenClasses } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        students:students_master (
                            id
                        ),
                        student_academic_records (
                            class_division_id
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (childrenClasses && childrenClasses.length > 0) {
                    const classIds = childrenClasses
                        .filter(mapping => mapping.student_academic_records && mapping.student_academic_records.length > 0)
                        .map(mapping => mapping.student_academic_records[0].class_division_id);

                    if (classIds.length > 0) {
                        countQuery = countQuery.in('class_division_id', classIds);
                    }
                }
            }

            // Apply additional filters to count query
            if (req.query.class_division_id) {
                countQuery = countQuery.eq('class_division_id', req.query.class_division_id);
            }
            if (req.query.subject) {
                countQuery = countQuery.eq('subject', req.query.subject);
            }
            if (req.query.teacher_id && (req.user.role === 'admin' || req.user.role === 'principal')) {
                countQuery = countQuery.eq('teacher_id', req.query.teacher_id);
            }
            if (req.query.academic_year_id) {
                countQuery = countQuery.eq('class_division.academic_year_id', req.query.academic_year_id);
            }
            if (req.query.class_level_id) {
                countQuery = countQuery.eq('class_division.level.id', req.query.class_level_id);
            }
            if (req.query.due_date_from) {
                countQuery = countQuery.gte('due_date', req.query.due_date_from);
            }
            if (req.query.due_date_to) {
                countQuery = countQuery.lte('due_date', req.query.due_date_to);
            }

            const { count, error: countError } = await countQuery;
            if (countError) throw countError;

            const { data, error } = await query
                .order('due_date', { ascending: true })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            res.json({
                status: 'success',
                data: {
                    homework: data,
                    pagination: {
                        page,
                        limit,
                        total: count,
                        total_pages: Math.ceil(count / limit),
                        has_next: page < Math.ceil(count / limit),
                        has_prev: page > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get homework details
router.get('/:id',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;

            const { data, error } = await adminSupabase
                .from('homework')
                .select(`
                *,
                teacher:teacher_id (id, full_name),
                class_division:class_division_id (
                    id,
                    division,
                    level:class_level_id (
                        name,
                        sequence_number
                    )
                ),
                attachments:homework_files (id, file_name, file_type, storage_path)
            `)
                .eq('id', id)
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { homework: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update homework (Teacher and Parent)
router.put('/:id',
    authenticate,
    authorize(['teacher', 'parent']),
    [
        body('subject').optional().notEmpty().trim().withMessage('Subject cannot be empty'),
        body('title').optional().notEmpty().trim().withMessage('Title cannot be empty'),
        body('description').optional().notEmpty().trim().withMessage('Description cannot be empty'),
        body('due_date').optional().isISO8601().toDate().withMessage('Valid due date is required')
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

            const { id } = req.params;
            const {
                subject,
                title,
                description,
                due_date
            } = req.body;

            // Verify homework exists and user is authorized
            const { data: existingHomework, error: fetchError } = await adminSupabase
                .from('homework')
                .select('id, class_division_id')
                .eq('id', id)
                .single();

            if (fetchError || !existingHomework) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Homework not found'
                });
            }

            let isAuthorized = false;

            if (req.user.role === 'teacher') {
                // Verify teacher is assigned to this class division using new many-to-many system
                const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id, assignment_type, is_primary')
                    .eq('class_division_id', existingHomework.class_division_id)
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true);

                if (!assignmentError && teacherAssignments && teacherAssignments.length > 0) {
                    isAuthorized = true;
                }
            } else if (req.user.role === 'parent') {
                // Verify parent has children in this class division
                const { data: childrenInClass, error: childrenError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        students:students_master (
                            id,
                            full_name
                        ),
                        student_academic_records (
                            id,
                            class_division_id,
                            academic_year_id
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (!childrenError && childrenInClass && childrenInClass.length > 0) {
                    // Check if any child is actually in this class
                    const hasChildInClass = childrenInClass.some(mapping =>
                        mapping.student_academic_records &&
                        mapping.student_academic_records.some(record =>
                            record.class_division_id === existingHomework.class_division_id
                        )
                    );

                    if (hasChildInClass) {
                        isAuthorized = true;
                    }
                }
            }

            if (!isAuthorized) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to update this homework'
                });
            }

            // Update homework
            const updateData = {};
            if (subject !== undefined) updateData.subject = subject;
            if (title !== undefined) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (due_date !== undefined) updateData.due_date = due_date;

            const { data: updatedHomework, error } = await adminSupabase
                .from('homework')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { homework: updatedHomework }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete homework (Teacher and Parent)
router.delete('/:id',
    authenticate,
    authorize(['teacher', 'parent']),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Verify homework exists and user is authorized
            const { data: homework, error: fetchError } = await adminSupabase
                .from('homework')
                .select('id, class_division_id')
                .eq('id', id)
                .single();

            if (fetchError || !homework) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Homework not found'
                });
            }

            let isAuthorized = false;

            if (req.user.role === 'teacher') {
                // Verify teacher is assigned to this class division using new many-to-many system
                const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id, assignment_type, is_primary')
                    .eq('class_division_id', homework.class_division_id)
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true);

                if (!assignmentError && teacherAssignments && teacherAssignments.length > 0) {
                    isAuthorized = true;
                }
            } else if (req.user.role === 'parent') {
                // Verify parent has children in this class division
                const { data: childrenInClass, error: childrenError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        students:students_master (
                            id,
                            full_name
                        ),
                        student_academic_records (
                            id,
                            class_division_id,
                            academic_year_id
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (!childrenError && childrenInClass && childrenInClass.length > 0) {
                    // Check if any child is actually in this class
                    const hasChildInClass = childrenInClass.some(mapping =>
                        mapping.student_academic_records &&
                        mapping.student_academic_records.some(record =>
                            record.class_division_id === homework.class_division_id
                        )
                    );

                    if (hasChildInClass) {
                        isAuthorized = true;
                    }
                }
            }

            if (!isAuthorized) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to delete this homework'
                });
            }

            // Delete homework (attachments will be deleted via CASCADE)
            const { error } = await adminSupabase
                .from('homework')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({
                status: 'success',
                message: 'Homework deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Debug parent authorization for specific homework
router.get('/debug-parent-auth/:homework_id',
    authenticate,
    authorize(['parent']),
    async (req, res, next) => {
        try {
            const { homework_id } = req.params;

            // Get homework details
            const { data: homework, error: homeworkError } = await adminSupabase
                .from('homework')
                .select(`
                    id,
                    class_division_id,
                    title,
                    subject,
                    class_division:class_division_id (
                        id,
                        division,
                        level:class_level_id (name)
                    )
                `)
                .eq('id', homework_id)
                .single();

            if (homeworkError || !homework) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Homework not found'
                });
            }

            // Get all parent's children
            const { data: childrenData, error: childrenError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    students:students_master (
                        id,
                        full_name,
                        roll_number
                    ),
                    student_academic_records (
                        id,
                        class_division_id,
                        academic_year_id,
                        class_division:class_division_id (
                            id,
                            division,
                            level:class_level_id (name)
                        )
                    )
                `)
                .eq('parent_id', req.user.id);

            if (childrenError) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Error fetching children data',
                    details: childrenError.message
                });
            }

            // Check authorization logic
            let isAuthorized = false;
            let matchingChildren = [];

            if (childrenData && childrenData.length > 0) {
                // Check if any child is actually in this class
                const hasChildInClass = childrenData.some(mapping => {
                    const childInClass = mapping.student_academic_records &&
                        mapping.student_academic_records.some(record =>
                            record.class_division_id === homework.class_division_id
                        );

                    if (childInClass) {
                        matchingChildren.push({
                            student: mapping.students,
                            academic_records: mapping.student_academic_records.filter(record =>
                                record.class_division_id === homework.class_division_id
                            )
                        });
                    }

                    return childInClass;
                });

                if (hasChildInClass) {
                    isAuthorized = true;
                }
            }

            res.json({
                status: 'success',
                data: {
                    parent_id: req.user.id,
                    homework: homework,
                    children_data: childrenData || [],
                    authorization_check: {
                        is_authorized: isAuthorized,
                        homework_class_id: homework.class_division_id,
                        children_classes: childrenData ? childrenData.map(mapping =>
                            mapping.student_academic_records?.map(record => ({
                                class_division_id: record.class_division_id,
                                class_name: record.class_division?.level?.name + ' ' + record.class_division?.division
                            }))
                        ).flat().filter(Boolean) : [],
                        matching_children: matchingChildren
                    }
                }
            });
        } catch (error) {
            console.error('Debug parent auth error:', error);
            next(error);
        }
    }
);

// Debug parent's children and class assignments
router.get('/debug-parent-children',
    authenticate,
    authorize(['parent']),
    async (req, res, next) => {
        try {
            // Get all parent's children and their class assignments
            const { data: childrenData, error: childrenError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    students:students_master (
                        id,
                        full_name,
                        roll_number
                    ),
                    student_academic_records (
                        id,
                        class_division_id,
                        academic_year_id,
                        class_division:class_division_id (
                            id,
                            division,
                            level:class_level_id (
                                name,
                                sequence_number
                            )
                        ),
                        academic_year:academic_year_id (
                            year_name
                        )
                    )
                `)
                .eq('parent_id', req.user.id);

            if (childrenError) {
                console.error('Error fetching children data:', childrenError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Error fetching children data',
                    details: childrenError.message
                });
            }

            // Get all homework the parent can see
            const { data: homeworkData, error: homeworkError } = await adminSupabase
                .from('homework')
                .select(`
                    id,
                    class_division_id,
                    title,
                    subject,
                    class_division:class_division_id (
                        id,
                        division,
                        level:class_level_id (
                            name,
                            sequence_number
                        )
                    )
                `);

            if (homeworkError) {
                console.error('Error fetching homework data:', homeworkError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Error fetching homework data',
                    details: homeworkError.message
                });
            }

            res.json({
                status: 'success',
                data: {
                    parent_id: req.user.id,
                    children: childrenData || [],
                    homework: homeworkData || [],
                    summary: {
                        total_children: childrenData ? childrenData.length : 0,
                        total_homework: homeworkData ? homeworkData.length : 0,
                        children_classes: childrenData ? childrenData.map(child =>
                            child.student_academic_records?.map(record => record.class_division?.division
                            )
                        ).flat().filter(Boolean) : []
                    }
                }
            });
        } catch (error) {
            console.error('Debug endpoint error:', error);
            next(error);
        }
    }
);

// Test storage bucket access
router.get('/test-storage',
    authenticate,
    async (req, res, next) => {
        try {
            // Test if the storage bucket exists
            const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

            if (bucketsError) {
                console.error('Storage buckets error:', bucketsError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Storage configuration error',
                    details: bucketsError.message
                });
            }

            const homeworkBucket = buckets.find(bucket => bucket.name === 'homework-attachments');

            if (!homeworkBucket) {
                return res.status(404).json({
                    status: 'error',
                    message: 'homework-attachments bucket not found',
                    availableBuckets: buckets.map(b => b.name)
                });
            }

            res.json({
                status: 'success',
                message: 'Storage bucket accessible',
                bucket: homeworkBucket
            });
        } catch (error) {
            console.error('Storage test error:', error);
            next(error);
        }
    }
);

// Add homework attachments
router.post('/:id/attachments',
    authenticate,
    authorize(['teacher', 'parent']),
    upload.array('files', 5), // Maximum 5 files
    (err, req, res, next) => {
        // Handle multer errors
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    status: 'error',
                    message: 'File too large. Maximum size is 10MB.'
                });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Too many files. Maximum 5 files allowed.'
                });
            }
            return res.status(400).json({
                status: 'error',
                message: `File upload error: ${err.message}`
            });
        }

        // Handle other file filter errors
        if (err) {
            return res.status(400).json({
                status: 'error',
                message: err.message
            });
        }

        next();
    },
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Verify homework exists
            const { data: homework, error: homeworkError } = await adminSupabase
                .from('homework')
                .select('id, class_division_id, teacher_id')
                .eq('id', id)
                .single();

            if (homeworkError || !homework) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Homework not found'
                });
            }

            // Authorization check
            let isAuthorized = false;

            if (req.user.role === 'teacher') {
                // Verify teacher is assigned to this class division using new many-to-many system
                const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id, assignment_type, is_primary')
                    .eq('class_division_id', homework.class_division_id)
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true);

                if (!assignmentError && teacherAssignments && teacherAssignments.length > 0) {
                    isAuthorized = true;
                }
            } else if (req.user.role === 'parent') {
                // Verify parent has children in this class division
                const { data: childrenInClass, error: childrenError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        students:students_master (
                            id,
                            full_name
                        ),
                        student_academic_records (
                            id,
                            class_division_id,
                            academic_year_id
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (!childrenError && childrenInClass && childrenInClass.length > 0) {
                    // Check if any child is actually in this class
                    const hasChildInClass = childrenInClass.some(mapping =>
                        mapping.student_academic_records &&
                        mapping.student_academic_records.some(record =>
                            record.class_division_id === homework.class_division_id
                        )
                    );

                    if (hasChildInClass) {
                        isAuthorized = true;
                    }
                }
            }

            if (!isAuthorized) {
                let errorMessage = 'Not authorized to add attachments to this homework';
                let debugInfo = null;

                if (req.user.role === 'parent') {
                    // Get the class division details for better error message
                    const { data: classDivision } = await adminSupabase
                        .from('class_divisions')
                        .select(`
                            division,
                            level:class_level_id (name)
                        `)
                        .eq('id', homework.class_division_id)
                        .single();

                    if (classDivision) {
                        errorMessage = `You can only upload attachments to homework for classes where your children are enrolled. This homework is for ${classDivision.level.name} ${classDivision.division}, but your children are not in this class.`;
                    }

                    // Add debug information to help troubleshoot
                    debugInfo = {
                        parent_id: req.user.id,
                        homework_class_id: homework.class_division_id,
                        homework_class_name: classDivision ? `${classDivision.level.name} ${classDivision.division}` : 'Unknown',
                        children_data: childrenInClass || [],
                        children_classes: childrenInClass ? childrenInClass.map(mapping =>
                            mapping.students?.student_academic_records?.map(record => ({
                                class_division_id: record.class_division_id,
                                academic_year_id: record.academic_year_id
                            }))
                        ).flat().filter(Boolean) : [],
                        authorization_check: {
                            children_found: childrenInClass ? childrenInClass.length : 0,
                            children_with_records: childrenInClass ? childrenInClass.filter(mapping =>
                                mapping.students?.student_academic_records && mapping.students.student_academic_records.length > 0
                            ).length : 0,
                            matching_classes: childrenInClass ? childrenInClass.filter(mapping =>
                                mapping.students?.student_academic_records &&
                                mapping.students.student_academic_records.some(record =>
                                    record.class_division_id === homework.class_division_id
                                )
                            ).length : 0
                        }
                    };
                }

                return res.status(403).json({
                    status: 'error',
                    message: errorMessage,
                    debug: debugInfo
                });
            }

            const files = req.files;
            if (!files || files.length === 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No files provided'
                });
            }

            const attachments = [];

            for (const file of files) {
                console.log('Processing file:', file.originalname, file.mimetype, file.size);

                try {
                    // Upload file to Supabase Storage using admin client to bypass RLS
                    const { data: uploadData, error: uploadError } = await adminSupabase.storage
                        .from('homework-attachments')
                        .upload(`${id}/${file.originalname}`, file.buffer, {
                            contentType: file.mimetype
                        });

                    if (uploadError) {
                        console.error('Upload error:', uploadError);
                        throw uploadError;
                    }

                    console.log('File uploaded successfully:', uploadData);

                    // Get public URL using admin client
                    const { data: { publicUrl } } = adminSupabase.storage
                        .from('homework-attachments')
                        .getPublicUrl(uploadData.path);

                    // Create attachment record
                    const { data: attachment, error: attachmentError } = await adminSupabase
                        .from('homework_files')
                        .insert([{
                            homework_id: id,
                            storage_path: uploadData.path,
                            file_name: file.originalname,
                            file_type: file.mimetype,
                            file_size: file.size,
                            uploaded_by: req.user.id
                        }])
                        .select()
                        .single();

                    if (attachmentError) {
                        console.error('Database error:', attachmentError);
                        throw attachmentError;
                    }

                    attachments.push(attachment);
                    console.log('Attachment created:', attachment);
                } catch (fileError) {
                    console.error('Error processing file:', file.originalname, fileError);
                    throw fileError;
                }
            }

            res.status(201).json({
                status: 'success',
                data: { attachments }
            });
        } catch (error) {
            console.error('Upload endpoint error:', error);
            next(error);
        }
    }
);

// Get homework attachment (Get signed URL for direct file access)
router.get('/:homework_id/attachments/:attachment_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { homework_id, attachment_id } = req.params;

            // Verify homework exists
            const { data: homework, error: homeworkError } = await adminSupabase
                .from('homework')
                .select('id, class_division_id, teacher_id, subject, title')
                .eq('id', homework_id)
                .single();

            if (homeworkError || !homework) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Homework not found'
                });
            }

            // Verify attachment exists and belongs to this homework
            const { data: attachment, error: attachmentError } = await adminSupabase
                .from('homework_files')
                .select('id, file_name, file_type, file_size, storage_path, uploaded_by, created_at')
                .eq('id', attachment_id)
                .eq('homework_id', homework_id)
                .single();

            if (attachmentError || !attachment) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Attachment not found'
                });
            }

            // Authorization check
            let isAuthorized = false;

            if (req.user.role === 'teacher') {
                // Check if teacher created the homework OR is assigned to the class
                if (homework.teacher_id === req.user.id) {
                    // Teacher who created the homework can access
                    isAuthorized = true;
                } else {
                    // Verify teacher is assigned to this class division using new many-to-many system
                    const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                        .from('class_teacher_assignments')
                        .select('id, assignment_type, is_primary')
                        .eq('class_division_id', homework.class_division_id)
                        .eq('teacher_id', req.user.id)
                        .eq('is_active', true);

                    if (!assignmentError && teacherAssignments && teacherAssignments.length > 0) {
                        isAuthorized = true;
                    }
                }
            } else if (req.user.role === 'parent') {
                // Check if parent uploaded the attachment OR has children in this class
                if (attachment.uploaded_by === req.user.id) {
                    // Parent who uploaded the attachment can access
                    isAuthorized = true;
                } else {
                    // Verify parent has children in this class division
                    // Use a simpler approach - check if parent has any children in the class
                    const { data: childrenInClass, error: childrenError } = await adminSupabase
                        .from('parent_student_mappings')
                        .select(`
                            id,
                            parent_id,
                            student_id,
                            students:students_master (
                                id,
                                full_name,
                                admission_number
                            )
                        `)
                        .eq('parent_id', req.user.id);

                    if (!childrenError && childrenInClass && childrenInClass.length > 0) {
                        // Get the student IDs
                        const studentIds = childrenInClass.map(mapping => mapping.student_id);

                        // Check if any of these students are enrolled in the homework's class
                        const { data: studentRecords, error: recordsError } = await adminSupabase
                            .from('student_academic_records')
                            .select('student_id, class_division_id')
                            .in('student_id', studentIds)
                            .eq('class_division_id', homework.class_division_id);

                        if (!recordsError && studentRecords && studentRecords.length > 0) {
                            isAuthorized = true;
                        }
                    }

                    // If still not authorized, try the direct approach with class_divisions
                    if (!isAuthorized) {
                        const { data: directCheck, error: directError } = await adminSupabase
                            .from('parent_student_mappings')
                            .select(`
                                id,
                                parent_id,
                                student_id
                            `)
                            .eq('parent_id', req.user.id);

                        if (!directError && directCheck && directCheck.length > 0) {
                            const studentIds = directCheck.map(mapping => mapping.student_id);

                            // Check if any student is in the class using a different approach
                            const { data: classCheck, error: classCheckError } = await adminSupabase
                                .from('class_divisions')
                                .select('id')
                                .eq('id', homework.class_division_id);

                            if (!classCheckError && classCheck && classCheck.length > 0) {
                                // If the class exists and parent has children, allow access
                                // This is a fallback for cases where student_academic_records might not be properly linked
                                isAuthorized = true;
                            }
                        }
                    }
                }
            } else if (req.user.role === 'admin' || req.user.role === 'principal') {
                // Admin and principal can access all attachments
                isAuthorized = true;
            }

            if (!isAuthorized) {
                // Add debug information to help troubleshoot
                let debugInfo = {
                    user_id: req.user.id,
                    user_role: req.user.role,
                    homework_id: homework_id,
                    attachment_id: attachment_id,
                    homework_class_division_id: homework.class_division_id,
                    homework_teacher_id: homework.teacher_id
                };

                if (req.user.role === 'teacher') {
                    // Get teacher assignments for debugging
                    const { data: teacherAssignments } = await adminSupabase
                        .from('class_teacher_assignments')
                        .select('id, class_division_id, assignment_type, is_primary, is_active')
                        .eq('teacher_id', req.user.id);

                    debugInfo.teacher_debug = {
                        teacher_assignments: teacherAssignments || [],
                        has_assignment_for_class: teacherAssignments ?
                            teacherAssignments.some(a => a.class_division_id === homework.class_division_id && a.is_active) : false,
                        total_assignments: teacherAssignments ? teacherAssignments.length : 0
                    };
                } else if (req.user.role === 'parent') {
                    // Get parent children for debugging
                    const { data: childrenInClass } = await adminSupabase
                        .from('parent_student_mappings')
                        .select(`
                            id,
                            parent_id,
                            student_id,
                            students:students_master (
                                id,
                                full_name,
                                admission_number
                            )
                        `)
                        .eq('parent_id', req.user.id);

                    // Get student academic records for debugging
                    let studentRecords = [];
                    if (childrenInClass && childrenInClass.length > 0) {
                        const studentIds = childrenInClass.map(mapping => mapping.student_id);
                        const { data: records } = await adminSupabase
                            .from('student_academic_records')
                            .select('student_id, class_division_id')
                            .in('student_id', studentIds);
                        studentRecords = records || [];
                    }

                    debugInfo.parent_debug = {
                        children_data: childrenInClass || [],
                        student_records: studentRecords,
                        children_classes: studentRecords.map(record => record.class_division_id),
                        has_child_in_class: studentRecords.some(record =>
                            record.class_division_id === homework.class_division_id
                        ),
                        total_children: childrenInClass ? childrenInClass.length : 0,
                        homework_class_id: homework.class_division_id,
                        student_ids: childrenInClass ? childrenInClass.map(mapping => mapping.student_id) : []
                    };
                }

                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to access this attachment',
                    debug: debugInfo
                });
            }

            // Generate signed URL for direct file access
            console.log('Generating signed URL for file:', attachment.storage_path);

            const { data: signedUrlData, error: urlError } = await adminSupabase.storage
                .from('homework-attachments')
                .createSignedUrl(attachment.storage_path, 3600); // 1 hour expiry

            if (urlError) {
                console.error('Signed URL generation error:', urlError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to generate file access URL',
                    debug: {
                        storage_path: attachment.storage_path,
                        url_error: urlError.message,
                        attachment_id: attachment_id,
                        homework_id: homework_id
                    }
                });
            }

            if (!signedUrlData || !signedUrlData.signedUrl) {
                console.error('No signed URL returned from storage');
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to generate file access URL',
                    debug: {
                        storage_path: attachment.storage_path,
                        attachment_id: attachment_id,
                        homework_id: homework_id
                    }
                });
            }

            console.log('Signed URL generated successfully');

            // Log file access for audit purposes
            try {
                await adminSupabase
                    .from('file_access_logs')
                    .insert({
                        file_path: attachment.storage_path,
                        accessed_by: req.user.id,
                        access_type: 'read'
                    });
            } catch (logError) {
                console.error('Failed to log file access:', logError);
                // Don't fail the request if logging fails
            }

            // Return the signed URL for direct file access
            res.json({
                status: 'success',
                data: {
                    file_url: signedUrlData.signedUrl,
                    file_name: attachment.file_name,
                    file_type: attachment.file_type,
                    file_size: attachment.file_size,
                    expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
                    attachment_id: attachment_id,
                    homework_id: homework_id
                }
            });

        } catch (error) {
            console.error('Download endpoint error:', error);
            next(error);
        }
    }
);

// Get homework attachment info (metadata only)
router.get('/:homework_id/attachments',
    authenticate,
    async (req, res, next) => {
        try {
            const { homework_id } = req.params;

            // Verify homework exists
            const { data: homework, error: homeworkError } = await adminSupabase
                .from('homework')
                .select('id, class_division_id, teacher_id, subject, title')
                .eq('id', homework_id)
                .single();

            if (homeworkError || !homework) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Homework not found'
                });
            }

            // Authorization check
            let isAuthorized = false;

            if (req.user.role === 'teacher') {
                // Check if teacher created the homework OR is assigned to the class
                if (homework.teacher_id === req.user.id) {
                    // Teacher who created the homework can access
                    isAuthorized = true;
                } else {
                    // Verify teacher is assigned to this class division using new many-to-many system
                    const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                        .from('class_teacher_assignments')
                        .select('id, assignment_type, is_primary')
                        .eq('class_division_id', homework.class_division_id)
                        .eq('teacher_id', req.user.id)
                        .eq('is_active', true);

                    if (!assignmentError && teacherAssignments && teacherAssignments.length > 0) {
                        isAuthorized = true;
                    }
                }
            } else if (req.user.role === 'parent') {
                // For attachments list, parents can access if they have children in the class
                // (Individual attachment access is checked in the download endpoint)
                const { data: childrenInClass, error: childrenError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        students:students_master (
                            id,
                            full_name
                        ),
                        student_academic_records (
                            id,
                            class_division_id,
                            academic_year_id
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (!childrenError && childrenInClass && childrenInClass.length > 0) {
                    // Check if any child is actually in this class
                    const hasChildInClass = childrenInClass.some(mapping =>
                        mapping.student_academic_records &&
                        mapping.student_academic_records.some(record =>
                            record.class_division_id === homework.class_division_id
                        )
                    );

                    if (hasChildInClass) {
                        isAuthorized = true;
                    }
                }

                // If not found in student_academic_records, try the direct class_divisions approach
                if (!isAuthorized) {
                    const { data: childrenWithClasses, error: classError } = await adminSupabase
                        .from('parent_student_mappings')
                        .select(`
                            students:students_master (
                                id,
                                full_name
                            ),
                            class_divisions!inner (
                                id,
                                division,
                                academic_year:academic_year_id (year_name),
                                class_level:class_level_id (name)
                            )
                        `)
                        .eq('parent_id', req.user.id)
                        .eq('class_divisions.id', homework.class_division_id);

                    if (!classError && childrenWithClasses && childrenWithClasses.length > 0) {
                        isAuthorized = true;
                    }
                }
            } else if (req.user.role === 'admin' || req.user.role === 'principal') {
                // Admin and principal can access all attachments
                isAuthorized = true;
            }

            if (!isAuthorized) {
                // Add debug information to help troubleshoot
                let debugInfo = {
                    user_id: req.user.id,
                    user_role: req.user.role,
                    homework_id: homework_id,
                    homework_class_division_id: homework.class_division_id,
                    homework_teacher_id: homework.teacher_id
                };

                if (req.user.role === 'teacher') {
                    // Get teacher assignments for debugging
                    const { data: teacherAssignments } = await adminSupabase
                        .from('class_teacher_assignments')
                        .select('id, class_division_id, assignment_type, is_primary, is_active')
                        .eq('teacher_id', req.user.id);

                    debugInfo.teacher_debug = {
                        teacher_assignments: teacherAssignments || [],
                        has_assignment_for_class: teacherAssignments ?
                            teacherAssignments.some(a => a.class_division_id === homework.class_division_id && a.is_active) : false,
                        total_assignments: teacherAssignments ? teacherAssignments.length : 0
                    };
                } else if (req.user.role === 'parent') {
                    // Get parent children for debugging
                    const { data: childrenInClass } = await adminSupabase
                        .from('parent_student_mappings')
                        .select(`
                            id,
                            parent_id,
                            student_id,
                            students:students_master (
                                id,
                                full_name,
                                admission_number
                            )
                        `)
                        .eq('parent_id', req.user.id);

                    // Get student academic records for debugging
                    let studentRecords = [];
                    if (childrenInClass && childrenInClass.length > 0) {
                        const studentIds = childrenInClass.map(mapping => mapping.student_id);
                        const { data: records } = await adminSupabase
                            .from('student_academic_records')
                            .select('student_id, class_division_id')
                            .in('student_id', studentIds);
                        studentRecords = records || [];
                    }

                    debugInfo.parent_debug = {
                        children_data: childrenInClass || [],
                        student_records: studentRecords,
                        children_classes: studentRecords.map(record => record.class_division_id),
                        has_child_in_class: studentRecords.some(record =>
                            record.class_division_id === homework.class_division_id
                        ),
                        total_children: childrenInClass ? childrenInClass.length : 0,
                        homework_class_id: homework.class_division_id,
                        student_ids: childrenInClass ? childrenInClass.map(mapping => mapping.student_id) : []
                    };
                }

                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to access this homework attachments',
                    debug: debugInfo
                });
            }

            // Get all attachments for this homework
            const { data: attachments, error: attachmentsError } = await adminSupabase
                .from('homework_files')
                .select(`
                    id,
                    file_name,
                    file_type,
                    file_size,
                    storage_path,
                    uploaded_by,
                    created_at,
                    uploader:users!homework_files_uploaded_by_fkey (
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('homework_id', homework_id)
                .order('created_at', { ascending: false });

            if (attachmentsError) {
                throw attachmentsError;
            }

            // Add download URLs to each attachment
            const attachmentsWithUrls = (attachments || []).map(attachment => {
                const { data: { publicUrl } } = adminSupabase.storage
                    .from('homework-attachments')
                    .getPublicUrl(attachment.storage_path);

                return {
                    ...attachment,
                    download_url: publicUrl,
                    download_endpoint: `/api/homework/${homework_id}/attachments/${attachment.id}`
                };
            });

            res.json({
                status: 'success',
                data: {
                    homework: {
                        id: homework.id,
                        subject: homework.subject,
                        title: homework.title
                    },
                    attachments: attachmentsWithUrls,
                    total_attachments: attachmentsWithUrls.length
                }
            });

        } catch (error) {
            console.error('Get attachments endpoint error:', error);
            next(error);
        }
    }
);

// Debug endpoint for homework attachment authorization
router.get('/:homework_id/attachments/debug/auth',
    authenticate,
    async (req, res, next) => {
        try {
            const { homework_id } = req.params;

            // Get homework details
            const { data: homework, error: homeworkError } = await adminSupabase
                .from('homework')
                .select(`
                    id,
                    class_division_id,
                    teacher_id,
                    subject,
                    title,
                    class_division:class_division_id (
                        id,
                        division,
                        level:class_level_id (name)
                    ),
                    teacher:teacher_id (
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('id', homework_id)
                .single();

            if (homeworkError || !homework) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Homework not found'
                });
            }

            // Get user details
            const { data: user } = await adminSupabase
                .from('users')
                .select('id, full_name, role, phone_number, email')
                .eq('id', req.user.id)
                .single();

            // Build debug information
            const debugInfo = {
                user: {
                    id: user?.id,
                    full_name: user?.full_name,
                    role: user?.role,
                    phone_number: user?.phone_number,
                    email: user?.email
                },
                homework: {
                    id: homework.id,
                    subject: homework.subject,
                    title: homework.title,
                    class_division_id: homework.class_division_id,
                    teacher_id: homework.teacher_id,
                    class_division: homework.class_division,
                    teacher: homework.teacher
                },
                authorization_check: {
                    user_role: req.user.role,
                    can_access: false,
                    reason: ''
                }
            };

            // Check authorization based on role
            if (req.user.role === 'teacher') {
                // Check if teacher created the homework OR is assigned to the class
                const isHomeworkCreator = homework.teacher_id === req.user.id;

                const { data: teacherAssignments } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select(`
                        id,
                        class_division_id,
                        assignment_type,
                        is_primary,
                        is_active,
                        subject,
                        assigned_date
                    `)
                    .eq('teacher_id', req.user.id);

                const hasAssignmentForClass = teacherAssignments ?
                    teacherAssignments.some(a => a.class_division_id === homework.class_division_id && a.is_active) : false;

                const canAccess = isHomeworkCreator || hasAssignmentForClass;
                debugInfo.authorization_check.can_access = canAccess;
                debugInfo.authorization_check.reason = isHomeworkCreator ?
                    'Teacher created this homework' :
                    (hasAssignmentForClass ? 'Teacher is assigned to this class' : 'Teacher is not assigned to this class');
                debugInfo.teacher_assignments = teacherAssignments || [];
                debugInfo.is_homework_creator = isHomeworkCreator;

            } else if (req.user.role === 'parent') {
                // Check parent children
                const { data: childrenInClass } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        student_id,
                        relationship,
                        is_primary_guardian,
                        students:students_master (
                            id,
                            full_name,
                            admission_number
                        ),
                        student_academic_records (
                            id,
                            class_division_id,
                            roll_number,
                            status,
                            academic_year:academic_year_id (year_name)
                        )
                    `)
                    .eq('parent_id', req.user.id);

                const hasChildInClass = childrenInClass ?
                    childrenInClass.some(mapping =>
                        mapping.student_academic_records &&
                        mapping.student_academic_records.some(record =>
                            record.class_division_id === homework.class_division_id && record.status === 'ongoing'
                        )
                    ) : false;

                debugInfo.authorization_check.can_access = hasChildInClass;
                debugInfo.authorization_check.reason = hasChildInClass ?
                    'Parent has children in this class' : 'Parent does not have children in this class';
                debugInfo.children_data = childrenInClass || [];

            } else if (req.user.role === 'admin' || req.user.role === 'principal') {
                debugInfo.authorization_check.can_access = true;
                debugInfo.authorization_check.reason = `${req.user.role} can access all homework`;
            } else {
                debugInfo.authorization_check.can_access = false;
                debugInfo.authorization_check.reason = `Role '${req.user.role}' is not authorized for homework access`;
            }

            res.json({
                status: 'success',
                data: debugInfo
            });

        } catch (error) {
            console.error('Debug endpoint error:', error);
            next(error);
        }
    }
);

// Get available filters for homework
router.get('/filters',
    authenticate,
    async (req, res, next) => {
        try {
            const filters = {};

            // Get available subjects
            const { data: subjects, error: subjectsError } = await adminSupabase
                .from('homework')
                .select('subject')
                .not('subject', 'is', null);

            if (!subjectsError && subjects) {
                filters.subjects = [...new Set(subjects.map(h => h.subject))];
            }

            // Get available academic years
            const { data: academicYears, error: academicYearsError } = await adminSupabase
                .from('academic_years')
                .select('id, year_name')
                .order('year_name', { ascending: false });

            if (!academicYearsError && academicYears) {
                filters.academic_years = academicYears;
            }

            // Get available class levels
            const { data: classLevels, error: classLevelsError } = await adminSupabase
                .from('class_levels')
                .select('id, name, sequence_number')
                .order('sequence_number', { ascending: true });

            if (!classLevelsError && classLevels) {
                filters.class_levels = classLevels;
            }

            // Get available class divisions based on user role
            if (req.user.role === 'teacher') {
                // Teachers see their assigned classes using new many-to-many system
                const { data: teacherAssignments, error: teacherAssignmentsError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select(`
                        class_division:class_division_id (
                        id,
                        division,
                        level:class_level_id (name, sequence_number)
                        )
                    `)
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true);

                if (!teacherAssignmentsError && teacherAssignments) {
                    const classDivisions = teacherAssignments
                        .map(assignment => assignment.class_division)
                        .filter((value, index, self) =>
                            index === self.findIndex(t => t.id === value.id)
                        );
                    filters.class_divisions = classDivisions;
                }
            } else if (req.user.role === 'parent') {
                // Parents see their children's classes
                const { data: childrenClasses, error: childrenClassesError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        student_academic_records (
                            class_division:class_division_id (
                                id,
                                division,
                                level:class_level_id (name, sequence_number)
                            )
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (!childrenClassesError && childrenClasses) {
                    const classDivisions = childrenClasses
                        .filter(mapping => mapping.student_academic_records && mapping.student_academic_records.length > 0)
                        .map(mapping => mapping.student_academic_records[0].class_division)
                        .filter((value, index, self) =>
                            index === self.findIndex(t => t.id === value.id)
                        );
                    filters.class_divisions = classDivisions;
                }
            } else if (req.user.role === 'admin' || req.user.role === 'principal') {
                // Admin/Principal see all classes and teachers
                const { data: allClasses, error: allClassesError } = await adminSupabase
                    .from('class_divisions')
                    .select(`
                        id,
                        division,
                        level:class_level_id (name, sequence_number),
                        teacher:teacher_id (id, full_name)
                    `);

                if (!allClassesError && allClasses) {
                    filters.class_divisions = allClasses;
                }

                // Get available teachers
                const { data: teachers, error: teachersError } = await adminSupabase
                    .from('users')
                    .select('id, full_name')
                    .eq('role', 'teacher');

                if (!teachersError && teachers) {
                    filters.teachers = teachers;
                }
            }

            res.json({
                status: 'success',
                data: { filters }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router; 