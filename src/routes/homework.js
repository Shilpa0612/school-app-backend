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
        const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(',');
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Create homework
router.post('/',
    authenticate,
    authorize('teacher'),
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

            // Verify teacher is assigned to this class division
            const { data: classData, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('id, teacher_id')
                .eq('id', class_division_id)
                .single();

            if (classError || !classData) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Verify teacher is assigned to this class division
            if (classData.teacher_id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You are not assigned to this class division'
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
                // Teachers see homework for their assigned classes
                query = query.eq('teacher_id', req.user.id);
            } else if (req.user.role === 'parent') {
                // Parents see homework for their children's classes
                const { data: childrenClasses } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        students:students_master (
                            id
                        ),
                        academic_records:student_academic_records (
                            class_division_id
                        )
                    `)
                    .eq('parent_id', req.user.id);

                if (childrenClasses && childrenClasses.length > 0) {
                    const classIds = childrenClasses
                        .filter(mapping => mapping.academic_records && mapping.academic_records.length > 0)
                        .map(mapping => mapping.academic_records[0].class_division_id);

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

            // Get total count for pagination
            const { count, error: countError } = await query.count();
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

// Add homework attachments
router.post('/:id/attachments',
    authenticate,
    authorize('teacher'),
    upload.array('files', 5), // Maximum 5 files
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Verify homework exists and belongs to teacher
            const { data: homework, error: homeworkError } = await adminSupabase
                .from('homework')
                .select('id, teacher_id')
                .eq('id', id)
                .single();

            if (homeworkError || !homework) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Homework not found'
                });
            }

            if (homework.teacher_id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to add attachments to this homework'
                });
            }

            const files = req.files;
            const attachments = [];

            for (const file of files) {
                // Upload file to Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('homework-attachments')
                    .upload(`${id}/${file.originalname}`, file.buffer, {
                        contentType: file.mimetype
                    });

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: { publicUrl } } = supabase.storage
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
                // Teachers see their assigned classes
                const { data: teacherClasses, error: teacherClassesError } = await adminSupabase
                    .from('class_divisions')
                    .select(`
                        id,
                        division,
                        level:class_level_id (name, sequence_number)
                    `)
                    .eq('teacher_id', req.user.id);

                if (!teacherClassesError && teacherClasses) {
                    filters.class_divisions = teacherClasses;
                }
            } else if (req.user.role === 'parent') {
                // Parents see their children's classes
                const { data: childrenClasses, error: childrenClassesError } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        academic_records:student_academic_records (
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
                        .filter(mapping => mapping.academic_records && mapping.academic_records.length > 0)
                        .map(mapping => mapping.academic_records[0].class_division)
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