import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(',');
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Create classwork (Teacher only)
router.post('/',
    authenticate,
    authorize('teacher'),
    [
        body('class_division_id').isUUID().withMessage('Valid class division ID is required'),
        body('subject').notEmpty().trim().withMessage('Subject is required'),
        body('summary').notEmpty().trim().withMessage('Summary is required'),
        body('topics_covered').isArray({ min: 1 }).withMessage('At least one topic must be covered'),
        body('topics_covered.*').notEmpty().trim().withMessage('Topic names cannot be empty'),
        body('date').optional().isISO8601().toDate().withMessage('Valid date is required'),
        body('is_shared_with_parents').optional().isBoolean().withMessage('Share with parents must be boolean')
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

            const {
                class_division_id,
                subject,
                summary,
                topics_covered,
                date,
                is_shared_with_parents = true
            } = req.body;

            // Verify teacher is assigned to this class
            const { data: classData, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('teacher_id')
                .eq('id', class_division_id)
                .single();

            if (classError || !classData) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            if (classData.teacher_id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to create classwork for this class'
                });
            }

            // Use provided date or default to today
            const classworkDate = date ? new Date(date) : new Date();

            // Create classwork
            const { data: classwork, error } = await adminSupabase
                .from('classwork')
                .insert([{
                    class_division_id,
                    teacher_id: req.user.id,
                    subject,
                    summary,
                    topics_covered,
                    date: classworkDate.toISOString().split('T')[0],
                    is_shared_with_parents
                }])
                .select()
                .single();

            if (error) throw error;

            // Create topic records if provided
            if (topics_covered && topics_covered.length > 0) {
                const topicRecords = topics_covered.map(topic => ({
                    classwork_id: classwork.id,
                    topic_name: topic,
                    topic_description: null
                }));

                const { error: topicError } = await adminSupabase
                    .from('classwork_topics')
                    .insert(topicRecords);

                if (topicError) {
                    logger.error('Error creating topic records:', topicError);
                    // Don't fail the request, just log the error
                }
            }

            res.status(201).json({
                status: 'success',
                data: { classwork }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get classwork list
router.get('/',
    authenticate,
    async (req, res, next) => {
        try {
            const {
                class_division_id,
                subject,
                date_from,
                date_to,
                page = 1,
                limit = 20
            } = req.query;

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Build query
            let query = adminSupabase
                .from('classwork')
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
                    attachments:classwork_attachments (id, file_name, file_type, file_size),
                    topics:classwork_topics (id, topic_name, topic_description)
                `);

            // Apply filters based on user role
            if (req.user.role === 'teacher') {
                // Teachers see their own classwork
                query = query.eq('teacher_id', req.user.id);
            } else if (req.user.role === 'parent') {
                // Parents see shared classwork for their children's classes
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
                // Only show shared classwork for parents
                query = query.eq('is_shared_with_parents', true);
            }
            // Admin and Principal can see all classwork

            // Apply additional filters
            if (class_division_id) {
                query = query.eq('class_division_id', class_division_id);
            }
            if (subject) {
                query = query.eq('subject', subject);
            }
            if (date_from) {
                query = query.gte('date', date_from);
            }
            if (date_to) {
                query = query.lte('date', date_to);
            }

            // Get total count for pagination using a separate count query
            let countQuery = adminSupabase.from('classwork').select('*', { count: 'exact', head: true });

            // Apply the same filters to count query
            if (req.user.role === 'teacher') {
                countQuery = countQuery.eq('teacher_id', req.user.id);
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
                countQuery = countQuery.eq('is_shared_with_parents', true);
            }

            if (class_division_id) {
                countQuery = countQuery.eq('class_division_id', class_division_id);
            }
            if (subject) {
                countQuery = countQuery.eq('subject', subject);
            }
            if (date_from) {
                countQuery = countQuery.gte('date', date_from);
            }
            if (date_to) {
                countQuery = countQuery.lte('date', date_to);
            }

            const { count, error: countError } = await countQuery;
            if (countError) throw countError;

            // Apply pagination and ordering
            const { data: classwork, error } = await query
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .range(offset, offset + parseInt(limit) - 1);

            if (error) throw error;

            res.json({
                status: 'success',
                data: {
                    classwork,
                    count: classwork.length,
                    total_count: count,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count,
                        total_pages: Math.ceil(count / parseInt(limit)),
                        has_next: parseInt(page) < Math.ceil(count / parseInt(limit)),
                        has_prev: parseInt(page) > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get specific classwork by ID
router.get('/:id',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Get classwork with details using the database function
            const { data: classworkDetails, error } = await adminSupabase
                .rpc('get_classwork_with_details', { p_classwork_id: id });

            if (error || !classworkDetails || classworkDetails.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Classwork not found'
                });
            }

            const classwork = classworkDetails[0];

            // Check authorization
            if (req.user.role === 'teacher' && classwork.teacher_id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to view this classwork'
                });
            }

            if (req.user.role === 'parent') {
                // Check if parent has children in this class and classwork is shared
                if (!classwork.is_shared_with_parents) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'This classwork is not shared with parents'
                    });
                }

                const { data: parentAccess } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('id')
                    .eq('parent_id', req.user.id)
                    .eq('students.student_academic_records.class_division_id', classwork.class_division_id)
                    .single();

                if (!parentAccess) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Not authorized to view this classwork'
                    });
                }
            }

            res.json({
                status: 'success',
                data: { classwork }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update classwork (Teacher only)
router.put('/:id',
    authenticate,
    authorize('teacher'),
    [
        body('subject').optional().notEmpty().trim().withMessage('Subject cannot be empty'),
        body('summary').optional().notEmpty().trim().withMessage('Summary cannot be empty'),
        body('topics_covered').optional().isArray({ min: 1 }).withMessage('At least one topic must be covered'),
        body('topics_covered.*').optional().notEmpty().trim().withMessage('Topic names cannot be empty'),
        body('is_shared_with_parents').optional().isBoolean().withMessage('Share with parents must be boolean')
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
                summary,
                topics_covered,
                is_shared_with_parents
            } = req.body;

            // Verify classwork exists and belongs to teacher
            const { data: existingClasswork, error: fetchError } = await adminSupabase
                .from('classwork')
                .select('id, teacher_id')
                .eq('id', id)
                .single();

            if (fetchError || !existingClasswork) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Classwork not found'
                });
            }

            if (existingClasswork.teacher_id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to update this classwork'
                });
            }

            // Update classwork
            const updateData = {};
            if (subject !== undefined) updateData.subject = subject;
            if (summary !== undefined) updateData.summary = summary;
            if (is_shared_with_parents !== undefined) updateData.is_shared_with_parents = is_shared_with_parents;

            const { data: updatedClasswork, error } = await adminSupabase
                .from('classwork')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Update topics if provided
            if (topics_covered) {
                // Delete existing topics
                await adminSupabase
                    .from('classwork_topics')
                    .delete()
                    .eq('classwork_id', id);

                // Insert new topics
                if (topics_covered.length > 0) {
                    const topicRecords = topics_covered.map(topic => ({
                        classwork_id: id,
                        topic_name: topic,
                        topic_description: null
                    }));

                    await adminSupabase
                        .from('classwork_topics')
                        .insert(topicRecords);
                }
            }

            res.json({
                status: 'success',
                data: { classwork: updatedClasswork }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete classwork (Teacher only)
router.delete('/:id',
    authenticate,
    authorize('teacher'),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Verify classwork exists and belongs to teacher
            const { data: classwork, error: fetchError } = await adminSupabase
                .from('classwork')
                .select('id, teacher_id')
                .eq('id', id)
                .single();

            if (fetchError || !classwork) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Classwork not found'
                });
            }

            if (classwork.teacher_id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to delete this classwork'
                });
            }

            // Delete classwork (attachments and topics will be deleted via CASCADE)
            const { error } = await adminSupabase
                .from('classwork')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({
                status: 'success',
                message: 'Classwork deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Add attachments to classwork
router.post('/:id/attachments',
    authenticate,
    authorize('teacher'),
    upload.array('files', 5), // Maximum 5 files
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Verify classwork exists and belongs to teacher
            const { data: classwork, error: classworkError } = await adminSupabase
                .from('classwork')
                .select('id, teacher_id')
                .eq('id', id)
                .single();

            if (classworkError || !classwork) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Classwork not found'
                });
            }

            if (classwork.teacher_id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to add attachments to this classwork'
                });
            }

            const files = req.files;
            const attachments = [];

            for (const file of files) {
                // Upload file to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('classwork-attachments')
                    .upload(`${id}/${file.originalname}`, file.buffer, {
                        contentType: file.mimetype
                    });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('classwork-attachments')
                    .getPublicUrl(uploadData.path);

                // Create attachment record
                const { data: attachment, error: attachmentError } = await adminSupabase
                    .from('classwork_attachments')
                    .insert([{
                        classwork_id: id,
                        storage_path: uploadData.path,
                        file_name: file.originalname,
                        file_type: file.mimetype,
                        file_size: file.size,
                        uploaded_by: req.user.id
                    }])
                    .select()
                    .single();

                if (attachmentError) throw attachmentError;
                attachments.push(attachment);
            }

            res.status(201).json({
                status: 'success',
                data: { attachments }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get classwork by class and date range
router.get('/class/:class_division_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const { date_from, date_to, page = 1, limit = 20 } = req.query;

            // Check authorization
            if (req.user.role === 'teacher') {
                // Verify teacher is assigned to this class
                const { data: classData, error: classError } = await adminSupabase
                    .from('class_divisions')
                    .select('teacher_id')
                    .eq('id', class_division_id)
                    .single();

                if (classError || !classData || classData.teacher_id !== req.user.id) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Not authorized to access this class'
                    });
                }
            } else if (req.user.role === 'parent') {
                // Check if parent has children in this class
                const { data: parentAccess } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('id')
                    .eq('parent_id', req.user.id)
                    .eq('students.student_academic_records.class_division_id', class_division_id)
                    .single();

                if (!parentAccess) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Not authorized to access this class'
                    });
                }
            }

            // Use database function to get classwork
            const startDate = date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Default to 30 days ago
            const endDate = date_to || new Date().toISOString().split('T')[0]; // Default to today

            const { data: classwork, error } = await adminSupabase
                .rpc('get_classwork_by_class_and_date_range', {
                    p_class_division_id: class_division_id,
                    p_start_date: startDate,
                    p_end_date: endDate
                });

            if (error) throw error;

            // Apply pagination
            const offset = (parseInt(page) - 1) * parseInt(limit);
            const paginatedClasswork = classwork.slice(offset, offset + parseInt(limit));

            res.json({
                status: 'success',
                data: {
                    classwork: paginatedClasswork,
                    count: paginatedClasswork.length,
                    total_count: classwork.length,
                    date_range: {
                        from: startDate,
                        to: endDate
                    },
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: classwork.length,
                        total_pages: Math.ceil(classwork.length / parseInt(limit)),
                        has_next: parseInt(page) < Math.ceil(classwork.length / parseInt(limit)),
                        has_prev: parseInt(page) > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router; 