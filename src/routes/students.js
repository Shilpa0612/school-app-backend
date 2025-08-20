import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Local middleware to surface Multer errors as proper HTTP responses
const safeUploadPhoto = (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            // Multer file size limit
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    status: 'error',
                    message: 'File too large. Maximum allowed size is 2MB',
                    code: err.code
                });
            }
            // Other Multer or parsing errors
            return res.status(400).json({
                status: 'error',
                message: err.message || 'Invalid upload request',
                code: err.code || undefined
            });
        }
        next();
    });
};

// Get all students with pagination and filters (Admin/Principal only)
router.get('/',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const {
                page = 1,
                limit = 20,
                search,
                class_division_id,
                class_level_id,
                academic_year_id,
                status = 'active',
                unlinked_only = false
            } = req.query;

            // Build query
            let query = adminSupabase
                .from('students_master')
                .select(`
                    *,
                    student_academic_records(
                        *,
                        class_division:class_division_id(
                            *,
                            level:class_level_id(*),
                            teacher:teacher_id(id, full_name),
                            academic_year:academic_year_id(*)
                        )
                    ),
                    parent_student_mappings(
                        *,
                        parent:parent_id(
                            id,
                            full_name,
                            phone_number,
                            email
                        )
                    )
                `);

            // Apply filters
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,admission_number.ilike.%${search}%`);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (class_division_id) {
                query = query.eq('student_academic_records.class_division_id', class_division_id);
            }

            if (class_level_id) {
                query = query.eq('student_academic_records.class_division.level.id', class_level_id);
            }

            if (academic_year_id) {
                query = query.eq('student_academic_records.class_division.academic_year_id', academic_year_id);
            }

            // Get all students first for filtering
            const { data: allStudents, error } = await query;

            if (error) {
                logger.error('Error fetching students:', error);
                throw error;
            }

            // Filter by unlinked only if requested
            let filteredStudents = allStudents;
            if (unlinked_only === 'true') {
                filteredStudents = allStudents.filter(student =>
                    !student.parent_student_mappings || student.parent_student_mappings.length === 0
                );
            }

            // Apply pagination
            const totalCount = filteredStudents.length;
            const offset = (page - 1) * limit;
            const paginatedStudents = filteredStudents.slice(offset, offset + limit);

            // Get available filters for response
            const { data: academicYears } = await adminSupabase
                .from('academic_years')
                .select('id, year_name')
                .order('year_name', { ascending: false });

            const { data: classLevels } = await adminSupabase
                .from('class_levels')
                .select('id, name, sequence_number')
                .order('sequence_number');

            const { data: classDivisions } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    level:class_level_id(id, name),
                    teacher:teacher_id(id, full_name),
                    academic_year:academic_year_id(id, year_name)
                `)
                .order('level.sequence_number')
                .order('division');

            res.json({
                status: 'success',
                data: {
                    students: paginatedStudents.map(student => ({
                        id: student.id,
                        full_name: student.full_name,
                        admission_number: student.admission_number,
                        date_of_birth: student.date_of_birth,
                        admission_date: student.admission_date,
                        status: student.status,
                        student_academic_records: student.student_academic_records,
                        parent_student_mappings: student.parent_student_mappings
                    })),
                    count: paginatedStudents.length,
                    total_count: totalCount,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount,
                        total_pages: Math.ceil(totalCount / limit),
                        has_next: page < Math.ceil(totalCount / limit),
                        has_prev: page > 1
                    },
                    filters: {
                        search: search || null,
                        class_division_id: class_division_id || null,
                        class_level_id: class_level_id || null,
                        academic_year_id: academic_year_id || null,
                        status: status || 'active',
                        unlinked_only: unlinked_only === 'true'
                    },
                    available_filters: {
                        academic_years: academicYears,
                        class_levels: classLevels,
                        class_divisions: classDivisions
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Create new student (Admin/Principal only)
router.post('/',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('admission_number').notEmpty().withMessage('Admission number is required'),
        body('full_name').notEmpty().withMessage('Full name is required'),
        body('date_of_birth').isDate().withMessage('Valid date of birth is required'),
        body('admission_date').isDate().withMessage('Valid admission date is required'),
        body('class_division_id').isUUID().withMessage('Valid class division ID is required'),
        body('roll_number').notEmpty().withMessage('Roll number is required')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                admission_number,
                full_name,
                date_of_birth,
                admission_date,
                class_division_id,
                roll_number
            } = req.body;

            // Verify class division exists
            const { data: classDivision, error: divisionError } = await adminSupabase
                .from('class_divisions')
                .select('id')
                .eq('id', class_division_id)
                .single();

            if (divisionError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Start a transaction
            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .insert([{
                    admission_number,
                    full_name,
                    date_of_birth,
                    admission_date,
                    status: 'active'
                }])
                .select()
                .single();

            if (studentError) {
                logger.error('Error creating student:', studentError);
                const errPayload = {
                    code: studentError.code,
                    message: studentError.message,
                    details: studentError.details,
                    hint: studentError.hint
                };
                // Handle duplicate admission number
                if ((studentError.code === '23505') || /duplicate key/i.test(studentError.message || '')) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Admission number already exists',
                        error: errPayload
                    });
                }
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to create student',
                    error: errPayload
                });
            }

            // Create academic record
            const { data: academicRecord, error: recordError } = await adminSupabase
                .from('student_academic_records')
                .insert([{
                    student_id: student.id,
                    class_division_id,
                    roll_number,
                    status: 'ongoing'
                }])
                .select()
                .single();

            if (recordError) {
                logger.error('Error creating academic record:', recordError);
                const errPayload = {
                    code: recordError.code,
                    message: recordError.message,
                    details: recordError.details,
                    hint: recordError.hint
                };
                // Handle duplicate roll number per class or existing academic record
                if ((recordError.code === '23505') || /duplicate key/i.test(recordError.message || '')) {
                    const friendly = /roll_number/i.test(recordError.message || '')
                        ? 'Roll number already exists for this class'
                        : 'Academic record already exists for this student';
                    return res.status(400).json({
                        status: 'error',
                        message: friendly,
                        error: errPayload
                    });
                }
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to create academic record',
                    error: errPayload
                });
            }

            res.status(201).json({
                status: 'success',
                data: {
                    student,
                    academic_record: academicRecord
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get students by class division
router.get('/class/:class_division_id',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            // Verify class division exists
            const { data: classDivision, error: divisionError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    level:class_level_id (
                        name,
                        sequence_number
                    ),
                    teacher:teacher_id (
                        id,
                        full_name
                    )
                `)
                .eq('id', class_division_id)
                .single();

            if (divisionError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Check if teacher is authorized to access this class
            if (req.user.role === 'teacher' && classDivision.teacher?.id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to access this class division'
                });
            }

            // Get students in this class division
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    admission_number,
                    date_of_birth,
                    status,
                    profile_photo_path,
                    student_academic_records!inner (
                        id,
                        roll_number,
                        status,
                        class_division_id
                    )
                `)
                .eq('status', 'active')
                .eq('student_academic_records.class_division_id', class_division_id)
                .order('full_name');

            if (studentsError) {
                logger.error('Error fetching students:', studentsError);
                throw studentsError;
            }

            // Sort students by roll number
            const sortedStudents = students.sort((a, b) => {
                const rollA = parseInt(a.student_academic_records[0]?.roll_number) || 0;
                const rollB = parseInt(b.student_academic_records[0]?.roll_number) || 0;
                return rollA - rollB;
            });

            // Apply pagination
            const totalCount = sortedStudents.length;
            const paginatedStudents = sortedStudents.slice(offset, offset + limit);

            // Attach profile photo URL
            const withPhotoUrls = await Promise.all(sortedStudents.map(async (s) => {
                let profile_photo_url = null;
                if (s.profile_photo_path) {
                    const path = s.profile_photo_path.replace('profile-pictures/', '');
                    const { data } = supabase.storage.from('profile-pictures').getPublicUrl(path);
                    profile_photo_url = data?.publicUrl || null;
                }
                return { ...s, profile_photo_url };
            }));

            res.json({
                status: 'success',
                data: {
                    class_division: classDivision,
                    students: withPhotoUrls.slice(offset, offset + limit),
                    count: paginatedStudents.length,
                    total_count: totalCount,
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
            next(error);
        }
    }
);

// Get students for a class division with teacher assignments and principal info
router.get('/class/:class_division_id/details',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;

            // Verify class division and fetch context
            const { data: classDivision, error: divisionError } = await adminSupabase
                .from('class_divisions')
                .select(`
					id,
					division,
					academic_year_id,
					class_level_id,
					teacher:teacher_id(id, full_name)
				`)
                .eq('id', class_division_id)
                .single();

            if (divisionError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Additional authorization for teachers: allow if assigned via new junction table or legacy teacher_id
            if (req.user.role === 'teacher') {
                let isAssigned = false;

                // Check legacy assignment
                if (classDivision.teacher?.id === req.user.id) {
                    isAssigned = true;
                } else {
                    // Check many-to-many assignments
                    const { data: mmAssign } = await adminSupabase
                        .from('class_teacher_assignments')
                        .select('id')
                        .eq('class_division_id', class_division_id)
                        .eq('teacher_id', req.user.id)
                        .eq('is_active', true)
                        .limit(1)
                        .maybeSingle();
                    isAssigned = !!mmAssign;
                }

                if (!isAssigned) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Not authorized to access this class division'
                    });
                }
            }

            // Get academic year and class level info
            let academicYear = null;
            if (classDivision.academic_year_id) {
                const { data } = await adminSupabase
                    .from('academic_years')
                    .select('id, year_name')
                    .eq('id', classDivision.academic_year_id)
                    .single();
                academicYear = data || null;
            }

            let classLevel = null;
            if (classDivision.class_level_id) {
                const { data } = await adminSupabase
                    .from('class_levels')
                    .select('id, name, sequence_number')
                    .eq('id', classDivision.class_level_id)
                    .single();
                classLevel = data || null;
            }

            // Get students in this class division
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select(`
					id,
					full_name,
					admission_number,
					date_of_birth,
					status,
					student_academic_records!inner (
						id,
						roll_number,
						status,
						class_division_id
					)
				`)
                .eq('status', 'active')
                .eq('student_academic_records.class_division_id', class_division_id)
                .order('full_name');

            if (studentsError) {
                logger.error('Error fetching students:', studentsError);
                throw studentsError;
            }

            // Get assigned teachers (many-to-many) with contact + subject
            const { data: teacherAssignments, error: assignmentError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
					id,
					teacher_id,
					assignment_type,
					subject,
					is_primary,
					assigned_date,
					is_active,
					teacher:teacher_id (
						id,
						full_name,
						phone_number,
						email
					)
				`)
                .eq('class_division_id', class_division_id)
                .eq('is_active', true)
                .order('is_primary', { ascending: false })
                .order('assigned_date', { ascending: true });

            if (assignmentError) {
                logger.error('Error fetching teacher assignments:', assignmentError);
            }

            const teachers = (teacherAssignments || []).map(a => ({
                assignment_id: a.id,
                teacher_id: a.teacher_id,
                assignment_type: a.assignment_type,
                subject: a.subject || null,
                is_primary: a.is_primary,
                assigned_date: a.assigned_date,
                is_active: a.is_active,
                teacher_info: {
                    id: a.teacher?.id || a.teacher_id,
                    full_name: a.teacher?.full_name || null,
                    phone_number: a.teacher?.phone_number || null,
                    email: a.teacher?.email || null
                }
            }));

            // Get principal info (first principal user)
            const { data: principalUser } = await adminSupabase
                .from('users')
                .select('id, full_name')
                .eq('role', 'principal')
                .limit(1)
                .maybeSingle();

            // Sort students by roll number
            const sortedStudents = students.sort((a, b) => {
                const rollA = parseInt(a.student_academic_records[0]?.roll_number) || 0;
                const rollB = parseInt(b.student_academic_records[0]?.roll_number) || 0;
                return rollA - rollB;
            });

            res.json({
                status: 'success',
                data: {
                    class_division: {
                        id: classDivision.id,
                        division: classDivision.division,
                        class_level: classLevel,
                        academic_year: academicYear
                    },
                    principal: principalUser ? { id: principalUser.id, full_name: principalUser.full_name } : null,
                    teachers,
                    students: sortedStudents
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get students by class level (e.g., all Grade 1 students)
router.get('/level/:class_level_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { class_level_id } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            // Verify class level exists
            const { data: classLevel, error: levelError } = await adminSupabase
                .from('class_levels')
                .select('id, name, sequence_number')
                .eq('id', class_level_id)
                .single();

            if (levelError || !classLevel) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class level not found'
                });
            }

            // Get all class divisions for this level
            const { data: classDivisions, error: divisionsError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    teacher:teacher_id (
                        id,
                        full_name
                    )
                `)
                .eq('class_level_id', class_level_id);

            if (divisionsError) {
                logger.error('Error fetching class divisions:', divisionsError);
                throw divisionsError;
            }

            // Get students from all divisions of this level
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    admission_number,
                    date_of_birth,
                    status,
                    student_academic_records!inner (
                        id,
                        roll_number,
                        status,
                        class_division:class_division_id (
                            id,
                            division,
                            teacher:teacher_id (
                                id,
                                full_name
                            )
                        )
                    )
                `)
                .eq('status', 'active')
                .in('student_academic_records.class_division_id', classDivisions.map(cd => cd.id))
                .order('full_name');

            if (studentsError) {
                logger.error('Error fetching students:', studentsError);
                throw studentsError;
            }

            // Sort students by division and roll number
            const sortedStudents = students.sort((a, b) => {
                const divisionA = a.student_academic_records[0]?.class_division?.division || '';
                const divisionB = b.student_academic_records[0]?.class_division?.division || '';

                // First sort by division
                if (divisionA !== divisionB) {
                    return divisionA.localeCompare(divisionB);
                }

                // Then sort by roll number within division
                const rollA = parseInt(a.student_academic_records[0]?.roll_number) || 0;
                const rollB = parseInt(b.student_academic_records[0]?.roll_number) || 0;
                return rollA - rollB;
            });

            // Apply pagination
            const totalCount = sortedStudents.length;
            const paginatedStudents = sortedStudents.slice(offset, offset + limit);

            res.json({
                status: 'success',
                data: {
                    class_level: classLevel,
                    class_divisions: classDivisions,
                    students: paginatedStudents,
                    count: paginatedStudents.length,
                    total_count: totalCount,
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
            next(error);
        }
    }
);

// Get all class divisions with student counts
router.get('/divisions/summary',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { academic_year_id } = req.query;

            // Get current active academic year if not specified
            let currentAcademicYearId = academic_year_id;
            if (!currentAcademicYearId) {
                const { data: activeYear, error: yearError } = await adminSupabase
                    .from('academic_years')
                    .select('id, name')
                    .eq('is_active', true)
                    .single();

                if (yearError) {
                    logger.error('Error fetching active academic year:', yearError);
                    throw yearError;
                }

                currentAcademicYearId = activeYear.id;
            }

            // Get all class divisions with enhanced details
            const { data: divisions, error: divisionsError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    level:class_level_id (
                        id,
                        name,
                        sequence_number
                    ),
                    teacher:teacher_id (
                        id,
                        full_name
                    ),
                    academic_year:academic_year_id (
                        id,
                        name,
                        is_active
                    ),
                    student_academic_records (
                        id
                    )
                `)
                .eq('academic_year_id', currentAcademicYearId);

            if (divisionsError) {
                logger.error('Error fetching divisions:', divisionsError);
                throw divisionsError;
            }

            // Get subject teachers for all divisions
            const divisionIds = divisions.map(div => div.id);
            const { data: subjectTeachers, error: subjectTeachersError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    class_division_id,
                    teacher_id,
                    subject,
                    is_active,
                    teacher:teacher_id (
                        id,
                        full_name
                    )
                `)
                .in('class_division_id', divisionIds)
                .eq('is_active', true);

            if (subjectTeachersError) {
                logger.error('Error fetching subject teachers:', subjectTeachersError);
                throw subjectTeachersError;
            }

            // Get subjects for all divisions
            const { data: divisionSubjects, error: subjectsError } = await adminSupabase
                .from('class_division_subjects')
                .select(`
                    class_division_id,
                    subject:subject_id (
                        id,
                        name,
                        code
                    )
                `)
                .in('class_division_id', divisionIds);

            if (subjectsError) {
                logger.error('Error fetching division subjects:', subjectsError);
                throw subjectsError;
            }

            // Process the data to get comprehensive division information
            const divisionsWithDetails = divisions.map(division => {
                // Get subject teachers for this division
                const divisionSubjectTeachers = subjectTeachers
                    .filter(st => st.class_division_id === division.id)
                    .map(st => ({
                        id: st.teacher_id,
                        name: st.teacher.full_name,
                        subject: st.subject,
                        is_class_teacher: division.teacher?.id === st.teacher_id
                    }));

                // Get subjects for this division
                const divisionSubjectsList = divisionSubjects
                    .filter(ds => ds.class_division_id === division.id)
                    .map(ds => ({
                        id: ds.subject.id,
                        name: ds.subject.name,
                        code: ds.subject.code
                    }));

                return {
                    id: division.id,
                    division: division.division,
                    level: division.level,
                    academic_year: division.academic_year,
                    class_teacher: division.teacher ? {
                        id: division.teacher.id,
                        name: division.teacher.full_name,
                        is_class_teacher: true
                    } : null,
                    subject_teachers: divisionSubjectTeachers,
                    subjects: divisionSubjectsList,
                    student_count: division.student_academic_records?.length || 0
                };
            }).sort((a, b) => {
                // First sort by level sequence
                if (a.level.sequence_number !== b.level.sequence_number) {
                    return a.level.sequence_number - b.level.sequence_number;
                }
                // Then sort by division within the same level
                return a.division.localeCompare(b.division);
            });

            res.json({
                status: 'success',
                data: {
                    divisions: divisionsWithDetails,
                    total_divisions: divisionsWithDetails.length,
                    total_students: divisionsWithDetails.reduce((sum, div) => sum + div.student_count, 0),
                    academic_year: {
                        id: currentAcademicYearId,
                        name: divisions[0]?.academic_year?.name || 'Unknown'
                    },
                    summary: {
                        total_subject_teachers: subjectTeachers.length,
                        total_subjects: divisionSubjects.length,
                        divisions_with_class_teachers: divisionsWithDetails.filter(d => d.class_teacher).length,
                        divisions_with_subject_teachers: divisionsWithDetails.filter(d => d.subject_teachers.length > 0).length
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get divisions summary for a specific teacher (Admin/Principal only)
router.get('/divisions/teacher/:teacher_id/summary',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { teacher_id } = req.params;
            const { academic_year_id } = req.query;

            // Validate teacher_id
            if (!teacher_id) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Teacher ID is required'
                });
            }

            // Verify teacher exists
            const { data: teacher, error: teacherError } = await adminSupabase
                .from('users')
                .select('id, full_name, role')
                .eq('id', teacher_id)
                .eq('role', 'teacher')
                .single();

            if (teacherError || !teacher) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Teacher not found'
                });
            }

            // Get current active academic year if not specified
            let currentAcademicYearId = academic_year_id;
            if (!currentAcademicYearId) {
                const { data: activeYear, error: yearError } = await adminSupabase
                    .from('academic_years')
                    .select('id, name')
                    .eq('is_active', true)
                    .single();

                if (yearError) {
                    logger.error('Error fetching active academic year:', yearError);
                    throw yearError;
                }

                currentAcademicYearId = activeYear.id;
            }

            // Get class divisions where this teacher is assigned (both legacy and many-to-many)
            const [{ data: legacyDivisions }, { data: mmAssignments }] = await Promise.all([
                adminSupabase
                    .from('class_divisions')
                    .select(`
                        id,
                        division,
                        level:class_level_id (
                            id,
                            name,
                            sequence_number
                        ),
                        teacher:teacher_id (
                            id,
                            full_name
                        ),
                        academic_year:academic_year_id (
                            id,
                            name,
                            is_active
                        ),
                        student_academic_records (
                            id
                        )
                    `)
                    .eq('teacher_id', teacher_id)
                    .eq('academic_year_id', currentAcademicYearId),
                adminSupabase
                    .from('class_teacher_assignments')
                    .select(`
                        id,
                        class_division_id,
                        assignment_type,
                        subject,
                        is_primary,
                        is_active,
                        class_division:class_division_id (
                            id,
                            division,
                            level:class_level_id (
                                id,
                                name,
                                sequence_number
                            ),
                            teacher:teacher_id (
                                id,
                                full_name
                            ),
                            academic_year:academic_year_id (
                                id,
                                name,
                                is_active
                            ),
                            student_academic_records (
                                id
                            )
                        )
                    `)
                    .eq('teacher_id', teacher_id)
                    .eq('is_active', true)
                    .eq('class_division.academic_year_id', currentAcademicYearId)
            ]);

            // Combine and deduplicate divisions
            const allDivisions = [];
            const divisionIds = new Set();

            // Add legacy divisions
            if (legacyDivisions) {
                legacyDivisions.forEach(div => {
                    if (!divisionIds.has(div.id)) {
                        divisionIds.add(div.id);
                        allDivisions.push({
                            ...div,
                            assignment_type: 'class_teacher',
                            is_primary: true,
                            subject: null
                        });
                    }
                });
            }

            // Add many-to-many assignments
            if (mmAssignments) {
                mmAssignments.forEach(assignment => {
                    if (!divisionIds.has(assignment.class_division.id)) {
                        divisionIds.add(assignment.class_division.id);
                        allDivisions.push({
                            ...assignment.class_division,
                            assignment_type: assignment.assignment_type,
                            is_primary: assignment.is_primary,
                            subject: assignment.subject
                        });
                    }
                });
            }

            // Get subject teachers for all divisions
            const divisionIdsArray = Array.from(divisionIds);
            const { data: subjectTeachers, error: subjectTeachersError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    class_division_id,
                    teacher_id,
                    subject,
                    assignment_type,
                    is_active,
                    teacher:teacher_id (
                        id,
                        full_name
                    )
                `)
                .in('class_division_id', divisionIdsArray)
                .eq('is_active', true);

            if (subjectTeachersError) {
                logger.error('Error fetching subject teachers:', subjectTeachersError);
                throw subjectTeachersError;
            }

            // Get subjects for all divisions
            const { data: divisionSubjects, error: subjectsError } = await adminSupabase
                .from('class_division_subjects')
                .select(`
                    class_division_id,
                    subject:subject_id (
                        id,
                        name,
                        code
                    )
                `)
                .in('class_division_id', divisionIdsArray);

            if (subjectsError) {
                logger.error('Error fetching division subjects:', subjectsError);
                throw subjectsError;
            }

            // Process the data to get comprehensive division information
            const divisionsWithDetails = allDivisions.map(division => {
                // Get subject teachers for this division
                const divisionSubjectTeachers = subjectTeachers
                    .filter(st => st.class_division_id === division.id)
                    .map(st => ({
                        id: st.teacher_id,
                        name: st.teacher.full_name,
                        subject: st.subject,
                        assignment_type: st.assignment_type,
                        is_class_teacher: division.teacher?.id === st.teacher_id
                    }));

                // Get subjects for this division
                const divisionSubjectsList = divisionSubjects
                    .filter(ds => ds.class_division_id === division.id)
                    .map(ds => ({
                        id: ds.subject.id,
                        name: ds.subject.name,
                        code: ds.subject.code
                    }));

                return {
                    id: division.id,
                    division: division.division,
                    level: division.level,
                    academic_year: division.academic_year,
                    class_teacher: division.teacher ? {
                        id: division.teacher.id,
                        name: division.teacher.full_name,
                        is_class_teacher: true
                    } : null,
                    subject_teachers: divisionSubjectTeachers,
                    subjects: divisionSubjectsList,
                    student_count: division.student_academic_records?.length || 0,
                    teacher_assignment: {
                        type: division.assignment_type,
                        is_primary: division.is_primary,
                        subject: division.subject
                    }
                };
            }).sort((a, b) => {
                // First sort by level sequence
                if (a.level.sequence_number !== b.level.sequence_number) {
                    return a.level.sequence_number - b.level.sequence_number;
                }
                // Then sort by division within the same level
                return a.division.localeCompare(b.division);
            });

            // Separate primary and secondary assignments
            const primaryAssignments = divisionsWithDetails.filter(d => d.teacher_assignment.is_primary);
            const secondaryAssignments = divisionsWithDetails.filter(d => !d.teacher_assignment.is_primary);

            res.json({
                status: 'success',
                data: {
                    teacher: {
                        id: teacher.id,
                        name: teacher.full_name,
                        role: teacher.role
                    },
                    divisions: divisionsWithDetails,
                    primary_assignments: primaryAssignments,
                    secondary_assignments: secondaryAssignments,
                    total_divisions: divisionsWithDetails.length,
                    total_students: divisionsWithDetails.reduce((sum, div) => sum + div.student_count, 0),
                    academic_year: {
                        id: currentAcademicYearId,
                        name: allDivisions[0]?.academic_year?.name || 'Unknown'
                    },
                    summary: {
                        total_subject_teachers: subjectTeachers.length,
                        total_subjects: divisionSubjects.length,
                        divisions_with_class_teachers: divisionsWithDetails.filter(d => d.class_teacher).length,
                        divisions_with_subject_teachers: divisionsWithDetails.filter(d => d.subject_teachers.length > 0).length,
                        primary_assignments_count: primaryAssignments.length,
                        secondary_assignments_count: secondaryAssignments.length,
                        subjects_taught: [...new Set(divisionsWithDetails
                            .filter(d => d.teacher_assignment.subject)
                            .map(d => d.teacher_assignment.subject))]
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Link student to parent
router.post('/:student_id/link-parent',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('parent_id').isUUID().withMessage('Valid parent ID is required'),
        body('relationship').isIn(['father', 'mother', 'guardian']).withMessage('Invalid relationship'),
        body('is_primary_guardian').isBoolean().withMessage('Primary guardian flag must be boolean'),
        body('access_level').isIn(['full', 'restricted', 'readonly']).withMessage('Invalid access level')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { student_id } = req.params;
            const { parent_id, relationship, is_primary_guardian, access_level } = req.body;

            // Check if student exists
            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .select('id')
                .eq('id', student_id)
                .single();

            if (studentError || !student) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found'
                });
            }

            // Check if parent exists and is actually a parent
            const { data: parent, error: parentError } = await adminSupabase
                .from('users')
                .select('id')
                .eq('id', parent_id)
                .eq('role', 'parent')
                .single();

            if (parentError || !parent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent not found or user is not a parent'
                });
            }

            // Check if mapping already exists
            const { data: existingMapping } = await adminSupabase
                .from('parent_student_mappings')
                .select('id')
                .eq('student_id', student_id)
                .eq('parent_id', parent_id)
                .single();

            if (existingMapping) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Parent is already linked to this student'
                });
            }

            // Create mapping
            const { data: mapping, error: createError } = await adminSupabase
                .from('parent_student_mappings')
                .insert([{
                    student_id,
                    parent_id,
                    relationship,
                    is_primary_guardian,
                    access_level
                }])
                .select()
                .single();

            if (createError) {
                logger.error('Error creating parent-student mapping:', createError);
                throw createError;
            }

            res.status(201).json({
                status: 'success',
                data: { mapping }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get student details
router.get('/:student_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { student_id } = req.params;

            // Check access permission
            const canAccess = await checkStudentAccess(req.user.id, req.user.role, student_id);
            if (!canAccess) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You do not have permission to view this student\'s details'
                });
            }

            const { data: student, error } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    admission_number,
                    date_of_birth,
                    admission_date,
                    status,
                    profile_photo_path,
                    student_academic_records (
                        id,
                        roll_number,
                        status,
                        class_division:class_division_id (
                            id,
                            division,
                            level:class_level_id (
                                id,
                                name,
                                sequence_number
                            ),
                            teacher:teacher_id (
                                id,
                                full_name
                            )
                        )
                    ),
                    parent_mappings:parent_student_mappings (
                        id,
                        relationship,
                        is_primary_guardian,
                        access_level,
                        parent:parent_id (
                            id,
                            full_name,
                            phone_number
                        )
                    )
                `)
                .eq('id', student_id)
                .single();

            if (error || !student) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found'
                });
            }

            let profile_photo_url = null;
            if (student.profile_photo_path) {
                const path = student.profile_photo_path.replace('profile-pictures/', '');
                const { data: publicData } = supabase.storage.from('profile-pictures').getPublicUrl(path);
                profile_photo_url = publicData?.publicUrl || null;
            }

            res.json({
                status: 'success',
                data: { student: { ...student, profile_photo_url } }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Update student details
router.put('/:student_id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
        body('date_of_birth').optional().isDate().withMessage('Valid date of birth is required'),
        body('status').optional().isIn(['active', 'inactive', 'transferred']).withMessage('Invalid status')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { student_id } = req.params;
            const updateData = req.body;

            // Check if student exists
            const { data: existingStudent, error: checkError } = await adminSupabase
                .from('students_master')
                .select('id')
                .eq('id', student_id)
                .single();

            if (checkError || !existingStudent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found'
                });
            }

            // Update student
            const { data: updatedStudent, error: updateError } = await adminSupabase
                .from('students_master')
                .update(updateData)
                .eq('id', student_id)
                .select()
                .single();

            if (updateError) {
                logger.error('Error updating student:', updateError);
                throw updateError;
            }

            res.json({
                status: 'success',
                data: { student: updatedStudent }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete student (soft delete)
router.delete('/:student_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { student_id } = req.params;

            // Check if student exists
            const { data: existingStudent, error: checkError } = await adminSupabase
                .from('students_master')
                .select('id')
                .eq('id', student_id)
                .single();

            if (checkError || !existingStudent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found'
                });
            }

            // Soft delete by setting status to inactive
            const { error: deleteError } = await adminSupabase
                .from('students_master')
                .update({ status: 'inactive' })
                .eq('id', student_id);

            if (deleteError) {
                logger.error('Error deleting student:', deleteError);
                throw deleteError;
            }

            res.json({
                status: 'success',
                message: 'Student deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

// Helper function to check if user can access student
async function checkStudentAccess(userId, userRole, studentId) {
    try {
        // Admin and principal can access all students
        if (userRole === 'admin' || userRole === 'principal') {
            return true;
        }

        // Teachers can access students in their assigned classes
        if (userRole === 'teacher') {
            const { data: student, error } = await adminSupabase
                .from('students_master')
                .select(`
                    student_academic_records!inner (
                        class_division:class_division_id (
                            teacher_id
                        )
                    )
                `)
                .eq('id', studentId)
                .eq('student_academic_records.class_division.teacher_id', userId)
                .single();

            return !error && student;
        }

        // Parents can access their linked students
        if (userRole === 'parent') {
            const { data: mapping, error } = await adminSupabase
                .from('parent_student_mappings')
                .select('id')
                .eq('student_id', studentId)
                .eq('parent_id', userId)
                .single();

            return !error && mapping;
        }

        return false;
    } catch (error) {
        logger.error('Error checking student access:', error);
        return false;
    }
}

export default router;

// Upload student profile photo (Admin/Principal/Teacher)
router.post('/:student_id/profile-photo',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    safeUploadPhoto,
    async (req, res, next) => {
        try {
            const { student_id } = req.params;
            const file = req.file;
            if (!file) {
                return res.status(400).json({ status: 'error', message: 'No file uploaded' });
            }

            // Verify student exists
            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .select('id')
                .eq('id', student_id)
                .single();
            if (studentError || !student) {
                return res.status(404).json({ status: 'error', message: 'Student not found' });
            }

            // Upload to Supabase Storage
            const filePath = `students/${student_id}/avatar.jpg`;
            const { error: uploadError } = await adminSupabase.storage
                .from('profile-pictures')
                .upload(filePath, file.buffer, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: file.mimetype
                });
            if (uploadError) {
                logger.error('Supabase Storage upload error', {
                    message: uploadError.message,
                    name: uploadError.name,
                    statusCode: uploadError.statusCode
                });
                return res.status(502).json({
                    status: 'error',
                    message: uploadError.message || 'Upload failed',
                    code: uploadError.statusCode || undefined
                });
            }

            // Save path in DB
            const { error: updateError } = await adminSupabase
                .from('students_master')
                .update({ profile_photo_path: `profile-pictures/${filePath}` })
                .eq('id', student_id);
            if (updateError) {
                logger.error('DB update error for profile_photo_path', {
                    message: updateError.message,
                    details: updateError.details,
                    hint: updateError.hint,
                    code: updateError.code
                });
                return res.status(502).json({
                    status: 'error',
                    message: updateError.message || 'Failed to save profile photo path',
                    code: updateError.code || undefined
                });
            }

            // Public URL
            const { data: publicUrlData } = supabase.storage
                .from('profile-pictures')
                .getPublicUrl(filePath);

            return res.status(201).json({
                status: 'success',
                data: {
                    student_id,
                    profile_photo_path: `profile-pictures/${filePath}`,
                    profile_photo_url: publicUrlData?.publicUrl || null
                }
            });
        } catch (error) {
            next(error);
        }
    }
);