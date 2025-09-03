import express from 'express';
import multer from 'multer';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Local middleware to surface Multer errors as proper HTTP responses
const safeUploadPhoto = (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    status: 'error',
                    message: 'File too large. Maximum allowed size is 2MB',
                    code: err.code
                });
            }
            return res.status(400).json({
                status: 'error',
                message: err.message || 'Invalid upload request',
                code: err.code || undefined
            });
        }
        next();
    });
};

// OPTIMIZED: Get all students with pagination and filters (Admin/Principal only)
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

            const offset = (page - 1) * limit;

            // OPTIMIZATION 1: Use database-level pagination instead of fetching all records
            const selectColumns = `
                    id,
                    full_name,
                    admission_number,
                    date_of_birth,
                    admission_date,
                    status,
                    created_at
        `;

            // Helper to apply common filters to any query builder
            const applyFilters = (qb) => {
                if (status) {
                    qb = qb.eq('status', status);
                }
                if (search) {
                    // Case-insensitive OR on name or admission number
                    qb = qb.or(`full_name.ilike.%${search}%,admission_number.ilike.%${search}%`);
                }
                return qb;
            };

            // Build count query (head request with exact count)
            let countQuery = applyFilters(
                adminSupabase
                    .from('students_master')
                    .select('id', { count: 'exact', head: true })
            );

            // OPTIMIZATION 2: Apply filters at database level
            const { count, error: countError } = await countQuery;
            if (countError) {
                logger.error('Error getting students count:', countError);
                throw countError;
            }

            // Apply pagination
            let dataQuery = applyFilters(
                adminSupabase
                    .from('students_master')
                    .select(selectColumns)
            );

            const { data: students, error } = await dataQuery
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                logger.error('Error fetching students:', error);
                throw error;
            }

            // OPTIMIZATION 4: Batch fetch related data only for returned students
            const studentIds = students.map(s => s.id);

            // Fetch academic records in batch
            const { data: academicRecords, error: academicError } = await adminSupabase
                .from('student_academic_records')
                .select(`
                    student_id,
                    roll_number,
                    status,
    class_division: class_division_id(
                        id,
                        division,
        level: class_level_id(
                            id,
                            name,
                            sequence_number
                        ),
        teacher: teacher_id(id, full_name),
        academic_year: academic_year_id(id, year_name)
                    )
                `)
                .in('student_id', studentIds)
                .eq('status', 'ongoing');

            if (academicError) {
                logger.error('Error fetching academic records:', academicError);
            }

            // Fetch parent mappings in batch
            const { data: parentMappings, error: mappingError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    relationship,
                    is_primary_guardian,
                    access_level,
    parent: parent_id(
                        id,
                        full_name,
                        phone_number,
                        email
                    )
                `)
                .in('student_id', studentIds);

            if (mappingError) {
                logger.error('Error fetching parent mappings:', mappingError);
            }

            // OPTIMIZATION 5: Process data in memory efficiently
            const academicByStudent = {};
            if (academicRecords) {
                academicRecords.forEach(record => {
                    if (!academicByStudent[record.student_id]) {
                        academicByStudent[record.student_id] = [];
                    }
                    academicByStudent[record.student_id].push(record);
                });
            }

            const mappingsByStudent = {};
            if (parentMappings) {
                parentMappings.forEach(mapping => {
                    if (!mappingsByStudent[mapping.student_id]) {
                        mappingsByStudent[mapping.student_id] = [];
                    }
                    mappingsByStudent[mapping.student_id].push(mapping);
                });
            }

            // OPTIMIZATION 6: Apply unlinked filter in memory (small dataset)
            let filteredStudents = students;
            if (unlinked_only === 'true') {
                filteredStudents = students.filter(student =>
                    !mappingsByStudent[student.id] || mappingsByStudent[student.id].length === 0
                );
            }

            // Apply class filters in memory (small dataset)
            if (class_division_id || class_level_id || academic_year_id) {
                filteredStudents = filteredStudents.filter(student => {
                    const records = academicByStudent[student.id] || [];
                    return records.some(record => {
                        if (class_division_id && record.class_division?.id !== class_division_id) return false;
                        if (class_level_id && record.class_division?.level?.id !== class_level_id) return false;
                        if (academic_year_id && record.class_division?.academic_year?.id !== academic_year_id) return false;
                        return true;
                    });
                });
            }

            // OPTIMIZATION 7: Fetch filter options only once per request
            const [academicYears, classLevels, classDivisions] = await Promise.all([
                adminSupabase
                    .from('academic_years')
                    .select('id, year_name')
                    .order('year_name', { ascending: false }),
                adminSupabase
                    .from('class_levels')
                    .select('id, name, sequence_number')
                    .order('sequence_number'),
                adminSupabase
                    .from('class_divisions')
                    .select(`
                        id,
                        division,
    level: class_level_id(id, name),
        teacher: teacher_id(id, full_name),
            academic_year: academic_year_id(id, year_name)
                    `)
                    .order('level.sequence_number')
                    .order('division')
            ]);

            // Build response with attached data
            const studentsWithData = filteredStudents.map(student => ({
                id: student.id,
                full_name: student.full_name,
                admission_number: student.admission_number,
                date_of_birth: student.date_of_birth,
                admission_date: student.admission_date,
                status: student.status,
                student_academic_records: academicByStudent[student.id] || [],
                parent_student_mappings: mappingsByStudent[student.id] || []
            }));

            res.json({
                status: 'success',
                data: {
                    students: studentsWithData,
                    count: studentsWithData.length,
                    total_count: count || 0,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit),
                        has_next: offset + limit < (count || 0),
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
                        academic_years: academicYears.data || [],
                        class_levels: classLevels.data || [],
                        class_divisions: classDivisions.data || []
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// OPTIMIZED: Get students by class division
router.get('/class/:class_division_id',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            // OPTIMIZATION 1: Single query to get class division with all related data
            const { data: classDivision, error: divisionError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
    level: class_level_id(
                        name,
                        sequence_number
                    ),
        teacher: teacher_id(
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

            // Check teacher authorization
            if (req.user.role === 'teacher' && classDivision.teacher?.id !== req.user.id) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to access this class division'
                });
            }

            // OPTIMIZATION 2: Use database-level pagination with optimized query
            const { data: students, error: studentsError, count } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    admission_number,
                    date_of_birth,
                    status,
                    profile_photo_path,
    student_academic_records!inner(
                        id,
                        roll_number,
                        status,
                        class_division_id
                    )
                `, { count: 'exact' })
                .eq('status', 'active')
                .eq('student_academic_records.class_division_id', class_division_id)
                .order('student_academic_records.roll_number', { ascending: true })
                .range(offset, offset + limit - 1);

            if (studentsError) {
                logger.error('Error fetching students:', studentsError);
                throw studentsError;
            }

            // OPTIMIZATION 3: Generate photo URLs in batch
            const studentsWithPhotos = students.map(student => {
                let profile_photo_url = null;
                if (student.profile_photo_path) {
                    const path = student.profile_photo_path.replace('profile-pictures/', '');
                    const { data } = adminSupabase.storage.from('profile-pictures').getPublicUrl(path);
                    profile_photo_url = data?.publicUrl || null;
                }
                return { ...student, profile_photo_url };
            });

            res.json({
                status: 'success',
                data: {
                    class_division: classDivision,
                    students: studentsWithPhotos,
                    count: studentsWithPhotos.length,
                    total_count: count || 0,
                    pagination: {
                        page,
                        limit,
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit),
                        has_next: offset + limit < (count || 0),
                        has_prev: page > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// OPTIMIZED: Get student details
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

            // OPTIMIZATION 1: Single optimized query with all related data
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
    student_academic_records(
                        id,
                        roll_number,
                        status,
        class_division: class_division_id(
                            id,
                            division,
            level: class_level_id(
                                id,
                                name,
                                sequence_number
                            ),
            teacher: teacher_id(
                                id,
                                full_name
                            )
                        )
                    ),
    parent_mappings: parent_student_mappings(
                        id,
                        relationship,
                        is_primary_guardian,
                        access_level,
        parent: parent_id(
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

            // OPTIMIZATION 2: Generate photo URL efficiently
            let profile_photo_url = null;
            if (student.profile_photo_path) {
                const path = student.profile_photo_path.replace('profile-pictures/', '');
                const { data: publicData } = adminSupabase.storage.from('profile-pictures').getPublicUrl(path);
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

// Helper function to check if user can access student (optimized)
async function checkStudentAccess(userId, userRole, studentId) {
    try {
        // Admin and principal can access all students
        if (userRole === 'admin' || userRole === 'principal') {
            return true;
        }

        // OPTIMIZATION: Use single query for teacher access check
        if (userRole === 'teacher') {
            const { data: student, error } = await adminSupabase
                .from('students_master')
                .select(`
student_academic_records!inner(
    class_division: class_division_id(
                            teacher_id
                        )
                    )
                `)
                .eq('id', studentId)
                .eq('student_academic_records.class_division.teacher_id', userId)
                .single();

            return !error && student;
        }

        // OPTIMIZATION: Use single query for parent access check
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
