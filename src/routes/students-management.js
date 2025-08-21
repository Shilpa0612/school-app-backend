import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Create student (Admin/Principal only)
router.post('/',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('admission_number').notEmpty().trim().withMessage('Admission number is required'),
        body('full_name').notEmpty().trim().withMessage('Full name is required'),
        body('date_of_birth').isDate().withMessage('Valid date of birth is required'),
        body('admission_date').isDate().withMessage('Valid admission date is required'),
        body('class_division_id').isUUID().withMessage('Valid class division ID is required'),
        body('roll_number').notEmpty().trim().withMessage('Roll number is required'),
        body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
        body('address').optional().trim().withMessage('Address must be a string'),
        body('emergency_contact').optional().matches(/^[0-9]{10}$/).withMessage('Emergency contact must be 10 digits')
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
                admission_number,
                full_name,
                date_of_birth,
                admission_date,
                class_division_id,
                roll_number,
                gender,
                address,
                emergency_contact
            } = req.body;

            // Check if admission number already exists
            const { data: existingStudent } = await adminSupabase
                .from('students_master')
                .select('id, admission_number')
                .eq('admission_number', admission_number)
                .single();

            if (existingStudent) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Student with this admission number already exists',
                    data: {
                        student_id: existingStudent.id,
                        admission_number: existingStudent.admission_number
                    }
                });
            }

            // Verify class division exists
            const { data: classDivision, error: divisionError } = await adminSupabase
                .from('class_divisions')
                .select('id, division, level:class_level_id(name, sequence_number)')
                .eq('id', class_division_id)
                .single();

            if (divisionError || !classDivision) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Check if roll number is already taken in this class
            const { data: existingRoll } = await adminSupabase
                .from('student_academic_records')
                .select('id')
                .eq('class_division_id', class_division_id)
                .eq('roll_number', roll_number)
                .single();

            if (existingRoll) {
                return res.status(400).json({
                    status: 'error',
                    message: `Roll number ${roll_number} is already taken in this class`
                });
            }

            // Start transaction - create student and academic record
            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .insert([{
                    admission_number,
                    full_name,
                    date_of_birth,
                    admission_date,
                    gender,
                    address,
                    emergency_contact,
                    status: 'active'
                }])
                .select()
                .single();

            if (studentError) {
                logger.error('Error creating student:', studentError);
                throw studentError;
            }

            // Create academic record
            const { data: academicRecord, error: academicError } = await adminSupabase
                .from('student_academic_records')
                .insert([{
                    student_id: student.id,
                    class_division_id,
                    roll_number,
                    academic_year_id: classDivision.academic_year_id,
                    status: 'active'
                }])
                .select(`
                    id,
                    roll_number,
                    status,
                    class_division:class_division_id(
                        id,
                        division,
                        level:class_level_id(
                            name,
                            sequence_number
                        )
                    )
                `)
                .single();

            if (academicError) {
                logger.error('Error creating academic record:', academicError);
                // Rollback student creation
                await adminSupabase
                    .from('students_master')
                    .delete()
                    .eq('id', student.id);
                throw academicError;
            }

            res.status(201).json({
                status: 'success',
                data: {
                    student: {
                        id: student.id,
                        admission_number: student.admission_number,
                        full_name: student.full_name,
                        date_of_birth: student.date_of_birth,
                        admission_date: student.admission_date,
                        gender: student.gender,
                        address: student.address,
                        emergency_contact: student.emergency_contact,
                        status: student.status
                    },
                    academic_record: academicRecord,
                    note: 'Use /api/students/:student_id/link-parents to link this student to parents'
                },
                message: 'Student created successfully'
            });

        } catch (error) {
            logger.error('Error in create student endpoint:', error);
            next(error);
        }
    }
);

// Get all students (Admin/Principal only)
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
                status = 'active'
            } = req.query;
            const offset = (page - 1) * limit;

            let query = adminSupabase
                .from('students_master')
                .select(`
                    id,
                    admission_number,
                    full_name,
                    date_of_birth,
                    admission_date,
                    gender,
                    address,
                    emergency_contact,
                    status,
                    created_at,
                    updated_at,
                    academic_records!inner(
                        id,
                        roll_number,
                        status,
                        class_division:class_division_id(
                            id,
                            division,
                            level:class_level_id(
                                name,
                                sequence_number
                            )
                        )
                    )
                `)
                .eq('status', status);

            // Add search filter
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,admission_number.ilike.%${search}%`);
            }

            // Add class division filter
            if (class_division_id) {
                query = query.eq('academic_records.class_division_id', class_division_id);
            }

            // Get total count
            const { count, error: countError } = await query.count();

            if (countError) {
                logger.error('Error getting students count:', countError);
            }

            // Get paginated results
            const { data: students, error } = await query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                logger.error('Error fetching students:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch students',
                    details: error.message
                });
            }

            // Get parent mappings for each student
            const studentIds = students.map(s => s.id);
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    relationship,
                    is_primary_guardian,
                    access_level,
                    parent:parent_id(
                        id,
                        full_name,
                        phone_number,
                        email
                    )
                `)
                .in('student_id', studentIds);

            if (mappingsError) {
                logger.error('Error fetching student mappings:', mappingsError);
            }

            // Group mappings by student
            const mappingsByStudent = {};
            if (mappings) {
                mappings.forEach(mapping => {
                    if (!mappingsByStudent[mapping.student_id]) {
                        mappingsByStudent[mapping.student_id] = [];
                    }
                    mappingsByStudent[mapping.student_id].push(mapping);
                });
            }

            // Add parent information to students
            const studentsWithParents = students.map(student => ({
                ...student,
                parents: mappingsByStudent[student.id] || []
            }));

            res.json({
                status: 'success',
                data: {
                    students: studentsWithParents,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit),
                        has_next: offset + limit < (count || 0),
                        has_prev: page > 1
                    }
                }
            });

        } catch (error) {
            logger.error('Error fetching students:', error);
            next(error);
        }
    }
);

// Get specific student (Admin/Principal only)
router.get('/:student_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { student_id } = req.params;

            // Get student details with academic records
            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    admission_number,
                    full_name,
                    date_of_birth,
                    admission_date,
                    gender,
                    address,
                    emergency_contact,
                    status,
                    created_at,
                    updated_at,
                    academic_records(
                        id,
                        roll_number,
                        status,
                        class_division:class_division_id(
                            id,
                            division,
                            level:class_level_id(
                                name,
                                sequence_number
                            ),
                            teacher:teacher_id(
                                id,
                                full_name
                            )
                        ),
                        academic_year:academic_year_id(
                            id,
                            year_name
                        )
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

            // Get student's parents
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    id,
                    relationship,
                    is_primary_guardian,
                    access_level,
                    created_at,
                    parent:parent_id(
                        id,
                        full_name,
                        phone_number,
                        email,
                        is_registered
                    )
                `)
                .eq('student_id', student_id);

            if (mappingsError) {
                logger.error('Error fetching student mappings:', mappingsError);
            }

            res.json({
                status: 'success',
                data: {
                    student,
                    parents: mappings || []
                }
            });

        } catch (error) {
            logger.error('Error fetching student details:', error);
            next(error);
        }
    }
);

// Update student (Admin/Principal only)
router.put('/:student_id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('full_name').optional().notEmpty().trim().withMessage('Full name cannot be empty'),
        body('date_of_birth').optional().isDate().withMessage('Valid date of birth is required'),
        body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
        body('address').optional().trim().withMessage('Address must be a string'),
        body('emergency_contact').optional().matches(/^[0-9]{10}$/).withMessage('Emergency contact must be 10 digits'),
        body('status').optional().isIn(['active', 'inactive', 'transferred', 'graduated']).withMessage('Invalid status')
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

            const { student_id } = req.params;
            const { full_name, date_of_birth, gender, address, emergency_contact, status } = req.body;

            // Check if student exists
            const { data: existingStudent, error: fetchError } = await adminSupabase
                .from('students_master')
                .select('id')
                .eq('id', student_id)
                .single();

            if (fetchError || !existingStudent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found'
                });
            }

            // Prepare update data
            const updateData = {};
            if (full_name !== undefined) updateData.full_name = full_name;
            if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
            if (gender !== undefined) updateData.gender = gender;
            if (address !== undefined) updateData.address = address;
            if (emergency_contact !== undefined) updateData.emergency_contact = emergency_contact;
            if (status !== undefined) updateData.status = status;

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
                data: {
                    student: updatedStudent
                },
                message: 'Student updated successfully'
            });

        } catch (error) {
            logger.error('Error updating student:', error);
            next(error);
        }
    }
);

// Delete student (Admin/Principal only)
router.delete('/:student_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { student_id } = req.params;

            // Check if student exists
            const { data: existingStudent, error: fetchError } = await adminSupabase
                .from('students_master')
                .select('id, admission_number')
                .eq('id', student_id)
                .single();

            if (fetchError || !existingStudent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found'
                });
            }

            // Check if student has any parent mappings
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select('id')
                .eq('student_id', student_id);

            if (mappingsError) {
                logger.error('Error checking student mappings:', mappingsError);
                throw mappingsError;
            }

            if (mappings && mappings.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot delete student with linked parents. Please unlink all parents first.',
                    data: {
                        linked_parents_count: mappings.length
                    }
                });
            }

            // Delete student (academic records will be deleted via CASCADE)
            const { error: deleteError } = await adminSupabase
                .from('students_master')
                .delete()
                .eq('id', student_id);

            if (deleteError) {
                logger.error('Error deleting student:', deleteError);
                throw deleteError;
            }

            res.json({
                status: 'success',
                message: 'Student deleted successfully',
                data: {
                    admission_number: existingStudent.admission_number
                }
            });

        } catch (error) {
            logger.error('Error deleting student:', error);
            next(error);
        }
    }
);

// Link parents to student (Admin/Principal only)
router.post('/:student_id/link-parents',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('parents').isArray({ min: 1 }).withMessage('At least one parent is required'),
        body('parents.*.parent_id').isUUID().withMessage('Valid parent ID is required'),
        body('parents.*.relationship').isIn(['father', 'mother', 'guardian']).withMessage('Invalid relationship'),
        body('parents.*.is_primary_guardian').isBoolean().withMessage('Primary guardian flag must be boolean'),
        body('parents.*.access_level').isIn(['full', 'restricted', 'readonly']).withMessage('Invalid access level')
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

            const { student_id } = req.params;
            const { parents } = req.body;

            // Check if student exists
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

            // Check for primary guardian conflicts
            const primaryGuardians = parents.filter(p => p.is_primary_guardian);
            if (primaryGuardians.length > 1) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Only one parent can be primary guardian'
                });
            }

            if (primaryGuardians.length === 1) {
                const { data: existingPrimary } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('id')
                    .eq('student_id', student_id)
                    .eq('is_primary_guardian', true)
                    .single();

                if (existingPrimary) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Student already has a primary guardian'
                    });
                }
            }

            // Check if mappings already exist
            for (const parent of parents) {
                const { data: existingMapping } = await adminSupabase
                    .from('parent_student_mappings')
                    .select('id')
                    .eq('student_id', student_id)
                    .eq('parent_id', parent.parent_id)
                    .single();

                if (existingMapping) {
                    return res.status(400).json({
                        status: 'error',
                        message: `Parent ${parent.parent_id} is already linked to this student`
                    });
                }
            }

            // Create mappings
            const { data: mappings, error: createError } = await adminSupabase
                .from('parent_student_mappings')
                .insert(parents.map(parent => ({
                    student_id,
                    parent_id: parent.parent_id,
                    relationship: parent.relationship,
                    is_primary_guardian: parent.is_primary_guardian,
                    access_level: parent.access_level
                })))
                .select(`
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
                `);

            if (createError) {
                logger.error('Error creating parent-student mappings:', createError);
                throw createError;
            }

            res.status(201).json({
                status: 'success',
                data: {
                    student: {
                        id: student.id,
                        full_name: student.full_name,
                        admission_number: student.admission_number
                    },
                    mappings
                },
                message: 'Parents linked to student successfully'
            });

        } catch (error) {
            logger.error('Error linking parents to student:', error);
            next(error);
        }
    }
);

// Unlink parent from student (Admin/Principal only)
router.delete('/:student_id/unlink-parent/:parent_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { student_id, parent_id } = req.params;

            // Check if mapping exists
            const { data: mapping, error: fetchError } = await adminSupabase
                .from('parent_student_mappings')
                .select('id, is_primary_guardian')
                .eq('student_id', student_id)
                .eq('parent_id', parent_id)
                .single();

            if (fetchError || !mapping) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent-student mapping not found'
                });
            }

            // Delete mapping
            const { error: deleteError } = await adminSupabase
                .from('parent_student_mappings')
                .delete()
                .eq('id', mapping.id);

            if (deleteError) {
                logger.error('Error unlinking parent from student:', deleteError);
                throw deleteError;
            }

            res.json({
                status: 'success',
                message: 'Parent unlinked from student successfully',
                data: {
                    was_primary_guardian: mapping.is_primary_guardian
                }
            });

        } catch (error) {
            logger.error('Error unlinking parent from student:', error);
            next(error);
        }
    }
);

export default router;
