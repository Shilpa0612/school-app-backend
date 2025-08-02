import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

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
                throw studentError;
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
                throw recordError;
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

            res.json({
                status: 'success',
                data: {
                    class_division: classDivision,
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
            // Get all class divisions with student counts
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
                    student_academic_records (
                        id
                    )
                `);

            if (divisionsError) {
                logger.error('Error fetching divisions:', divisionsError);
                throw divisionsError;
            }

            // Process the data to get student counts and sort by level sequence and division
            const divisionsWithCounts = divisions.map(division => ({
                id: division.id,
                division: division.division,
                level: division.level,
                teacher: division.teacher,
                student_count: division.student_academic_records?.length || 0
            })).sort((a, b) => {
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
                    divisions: divisionsWithCounts,
                    total_divisions: divisionsWithCounts.length,
                    total_students: divisionsWithCounts.reduce((sum, div) => sum + div.student_count, 0)
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
            const { data: existingMapping, error: mappingError } = await adminSupabase
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

            res.json({
                status: 'success',
                data: { student }
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