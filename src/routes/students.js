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
                    *,
                    academic_records:student_academic_records(
                        id,
                        class_division:class_division_id(
                            id,
                            division,
                            class_level:class_level_id(
                                name,
                                sequence_number
                            )
                        ),
                        roll_number,
                        status
                    ),
                    guardians:parent_student_mappings(
                        id,
                        relationship,
                        is_primary_guardian,
                        access_level,
                        parent:parent_id(
                            id,
                            full_name,
                            phone_number,
                            email
                        )
                    )
                `)
                .eq('id', student_id)
                .single();

            if (error) {
                logger.error('Error fetching student details:', error);
                throw error;
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

// Helper function to check student access
async function checkStudentAccess(userId, userRole, studentId) {
    console.log('Checking access for:', { userId, userRole, studentId });

    if (['admin', 'principal'].includes(userRole)) {
        console.log('Admin/Principal access granted');
        return true;
    }

    if (userRole === 'teacher') {
        // Check if teacher is assigned to student's class
        const { data, error } = await adminSupabase
            .from('student_academic_records')
            .select(`
                class_division:class_division_id(
                    id,
                    teacher_id
                )
            `)
            .eq('student_id', studentId)
            .eq('status', 'ongoing')
            .limit(1);

        console.log('Teacher access check result:', { data, error });

        if (error) {
            console.error('Error checking teacher access:', error);
            return false;
        }

        const hasAccess = data && data.length > 0 && data[0]?.class_division?.teacher_id === userId;
        console.log('Teacher access details:', {
            dataLength: data?.length,
            classDivision: data?.[0]?.class_division,
            teacherId: data?.[0]?.class_division?.teacher_id,
            userId: userId,
            teacherIdType: typeof data?.[0]?.class_division?.teacher_id,
            userIdType: typeof userId,
            hasAccess: hasAccess
        });
        return hasAccess;
    }

    if (userRole === 'parent') {
        // Check if parent is linked to student
        const { data, error } = await adminSupabase
            .from('parent_student_mappings')
            .select('id')
            .eq('parent_id', userId)
            .eq('student_id', studentId)
            .limit(1);

        console.log('Parent access check result:', { data, error });

        if (error) {
            console.error('Error checking parent access:', error);
            return false;
        }

        const hasAccess = data && data.length > 0;
        console.log('Parent has access:', hasAccess);
        return hasAccess;
    }

    console.log('No access - unknown role');
    return false;
}

// Debug endpoint to check class assignments
router.get('/debug/class-assignment/:student_id',
    authenticate,
    async (req, res, next) => {
        try {
            const { student_id } = req.params;

            // Get student's academic record
            const { data: academicRecord, error: academicError } = await adminSupabase
                .from('student_academic_records')
                .select(`
                    id,
                    student_id,
                    class_division_id,
                    status,
                    class_division:class_division_id (
                        id,
                        division,
                        teacher_id,
                        level:class_level_id (
                            name,
                            sequence_number
                        )
                    )
                `)
                .eq('student_id', student_id)
                .eq('status', 'ongoing')
                .single();

            if (academicError) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Error fetching academic record',
                    error: academicError
                });
            }

            res.json({
                status: 'success',
                data: {
                    academic_record: academicRecord,
                    authenticated_user: {
                        id: req.user.id,
                        name: req.user.full_name,
                        role: req.user.role
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Debug endpoint to check all class divisions
router.get('/debug/class-divisions',
    authenticate,
    async (req, res, next) => {
        try {
            const { data: classDivisions, error } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    teacher_id,
                    teacher:teacher_id (
                        id,
                        full_name,
                        role
                    ),
                    level:class_level_id (
                        name,
                        sequence_number
                    )
                `);

            if (error) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Error fetching class divisions',
                    error: error
                });
            }

            res.json({
                status: 'success',
                data: {
                    class_divisions: classDivisions,
                    authenticated_user: {
                        id: req.user.id,
                        name: req.user.full_name,
                        role: req.user.role
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router; 