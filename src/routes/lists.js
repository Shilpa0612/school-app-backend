import express from 'express';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ==================== UNIFORMS ====================

// List uniforms
router.get('/uniforms', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, grade_level, gender, season, is_required } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('uniforms')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters
        if (grade_level) {
            query = query.eq('grade_level', grade_level);
        }

        if (gender) {
            query = query.eq('gender', gender);
        }

        if (season) {
            query = query.eq('season', season);
        }

        if (is_required !== undefined) {
            query = query.eq('is_required', is_required === 'true');
        }

        // Get total count
        const { count, error: countError } = await supabase
            .from('uniforms')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            logger.error('Error getting uniforms count:', countError);
        }

        // Get paginated results
        const { data: uniforms, error } = await query
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching uniforms:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch uniforms'
            });
        }

        res.json({
            status: 'success',
            data: {
                uniforms,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in list uniforms:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Create uniform
router.post('/uniforms', authenticate, async (req, res) => {
    try {
        const { name, description, grade_level, gender, season, price, supplier, notes, is_required } = req.body;

        // Check permissions (only admins and principals can create uniforms)
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can create uniforms'
            });
        }

        // Validate required fields
        if (!name || !grade_level) {
            return res.status(400).json({
                status: 'error',
                message: 'Name and grade level are required'
            });
        }

        // Validate gender
        if (gender && !['boys', 'girls', 'unisex'].includes(gender)) {
            return res.status(400).json({
                status: 'error',
                message: 'Gender must be boys, girls, or unisex'
            });
        }

        // Validate season
        if (season && !['summer', 'winter', 'all'].includes(season)) {
            return res.status(400).json({
                status: 'error',
                message: 'Season must be summer, winter, or all'
            });
        }

        const { data: uniform, error } = await adminSupabase
            .from('uniforms')
            .insert({
                name,
                description,
                grade_level,
                gender,
                season,
                price: price ? parseFloat(price) : null,
                supplier,
                notes,
                is_required: is_required !== undefined ? is_required : true,
                created_by: req.user.id
            })
            .select()
            .single();

        if (error) {
            logger.error('Error creating uniform:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create uniform'
            });
        }

        res.status(201).json({
            status: 'success',
            data: uniform
        });

    } catch (error) {
        logger.error('Error in create uniform:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update uniform
router.put('/uniforms/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can update uniforms'
            });
        }

        // Validate gender if provided
        if (updateData.gender && !['boys', 'girls', 'unisex'].includes(updateData.gender)) {
            return res.status(400).json({
                status: 'error',
                message: 'Gender must be boys, girls, or unisex'
            });
        }

        // Validate season if provided
        if (updateData.season && !['summer', 'winter', 'all'].includes(updateData.season)) {
            return res.status(400).json({
                status: 'error',
                message: 'Season must be summer, winter, or all'
            });
        }

        // Filter out fields that don't exist in uniforms table
        const allowedFields = ['name', 'description', 'grade_level', 'gender', 'season', 'price', 'supplier', 'notes', 'is_required'];
        const filteredData = {};

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                filteredData[key] = value;
            }
        }

        const { data: uniform, error } = await adminSupabase
            .from('uniforms')
            .update(filteredData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Uniform not found'
                });
            }
            logger.error('Error updating uniform:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update uniform'
            });
        }

        res.json({
            status: 'success',
            data: uniform
        });

    } catch (error) {
        logger.error('Error in update uniform:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Delete uniform
router.delete('/uniforms/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can delete uniforms'
            });
        }

        const { error } = await adminSupabase
            .from('uniforms')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Error deleting uniform:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to delete uniform'
            });
        }

        res.json({
            status: 'success',
            message: 'Uniform deleted successfully'
        });

    } catch (error) {
        logger.error('Error in delete uniform:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// ==================== BOOKS ====================

// List books
router.get('/books', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, grade_level, subject, is_required } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('books')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters
        if (grade_level) {
            query = query.eq('grade_level', grade_level);
        }

        if (subject) {
            query = query.eq('subject', subject);
        }

        if (is_required !== undefined) {
            query = query.eq('is_required', is_required === 'true');
        }

        // Get total count
        const { count, error: countError } = await supabase
            .from('books')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            logger.error('Error getting books count:', countError);
        }

        // Get paginated results
        const { data: books, error } = await query
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching books:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch books'
            });
        }

        res.json({
            status: 'success',
            data: {
                books,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in list books:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Create book
router.post('/books', authenticate, async (req, res) => {
    try {
        const { title, author, publisher, isbn, grade_level, subject, edition, price, supplier, notes, is_required } = req.body;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can create books'
            });
        }

        // Validate required fields
        if (!title || !grade_level) {
            return res.status(400).json({
                status: 'error',
                message: 'Title and grade level are required'
            });
        }

        const { data: book, error } = await adminSupabase
            .from('books')
            .insert({
                title,
                author,
                publisher,
                isbn,
                grade_level,
                subject,
                edition,
                price: price ? parseFloat(price) : null,
                supplier,
                notes,
                is_required: is_required !== undefined ? is_required : true,
                created_by: req.user.id
            })
            .select()
            .single();

        if (error) {
            logger.error('Error creating book:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create book'
            });
        }

        res.status(201).json({
            status: 'success',
            data: book
        });

    } catch (error) {
        logger.error('Error in create book:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update book
router.put('/books/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can update books'
            });
        }

        const { data: book, error } = await adminSupabase
            .from('books')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Book not found'
                });
            }
            logger.error('Error updating book:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update book'
            });
        }

        res.json({
            status: 'success',
            data: book
        });

    } catch (error) {
        logger.error('Error in update book:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Delete book
router.delete('/books/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can delete books'
            });
        }

        const { error } = await adminSupabase
            .from('books')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Error deleting book:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to delete book'
            });
        }

        res.json({
            status: 'success',
            message: 'Book deleted successfully'
        });

    } catch (error) {
        logger.error('Error in delete book:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// ==================== STAFF ====================

// List staff
router.get('/staff', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, role, department, is_active } = req.query;
        const offset = (page - 1) * limit;

        // First get staff with user information
        let query = supabase
            .from('staff')
            .select(`
                *,
                user:user_id (
                    id,
                    full_name,
                    email,
                    phone_number,
                    role
                )
            `)
            .order('created_at', { ascending: false });

        // Apply filters
        if (role) {
            query = query.eq('role', role);
        }

        if (department) {
            query = query.eq('department', department);
        }

        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        // Get total count
        const { count, error: countError } = await supabase
            .from('staff')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            logger.error('Error getting staff count:', countError);
        }

        // Get paginated staff results
        const { data: staffData, error: staffError } = await query
            .range(offset, offset + limit - 1);

        if (staffError) {
            logger.error('Error fetching staff:', staffError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch staff'
            });
        }

        // Get class assignments for teachers
        const teacherIds = staffData
            .filter(s => s.user?.role === 'teacher')
            .map(s => s.user_id)
            .filter(Boolean);

        // Get teacher assignments using the same approach as class details endpoint
        const { data: teacherAssignments, error: assignmentError } = await supabase
            .from('class_teacher_assignments')
            .select(`
                id,
                teacher_id,
                assignment_type,
                subject,
                is_primary,
                assigned_date,
                is_active,
                class_division:class_division_id (
                    id,
                    division,
                    academic_year:academic_year_id (
                        id,
                        year_name,
                        is_active
                    ),
                    class_level:class_level_id (
                        id,
                        name,
                        sequence_number
                    )
                ),
                teacher:teacher_id (
                    id,
                    full_name,
                    phone_number,
                    email
                )
            `)
            .in('teacher_id', teacherIds)
            .eq('is_active', true)
            .order('is_primary', { ascending: false })
            .order('assigned_date', { ascending: true });

        // Debug: Check all assignments in the table
        console.log('=== STARTING DEBUG QUERIES ===');
        const { data: allAssignments, error: allAssignmentsError } = await supabase
            .from('class_teacher_assignments')
            .select('teacher_id, assignment_type, is_active')
            .limit(10);

        console.log('=== DEBUG QUERY 1 COMPLETED ===');
        console.log('All assignments in table:', allAssignments);
        console.log('All assignments error:', allAssignmentsError);

        // Debug: Check all class divisions
        const { data: allClassDivisions, error: allClassDivisionsError } = await supabase
            .from('class_divisions')
            .select('id, division, teacher_id')
            .limit(10);

        console.log('=== DEBUG QUERY 2 COMPLETED ===');
        console.log('All class divisions:', allClassDivisions);
        console.log('All class divisions error:', allClassDivisionsError);

        // Debug: Check if there are any class divisions with teachers
        const { data: classDivisionsWithTeachers, error: classDivisionsWithTeachersError } = await supabase
            .from('class_divisions')
            .select('id, division, teacher_id')
            .not('teacher_id', 'is', null)
            .limit(10);

        console.log('=== DEBUG QUERY 3 COMPLETED ===');
        console.log('Class divisions with teachers:', classDivisionsWithTeachers);
        console.log('Class divisions with teachers error:', classDivisionsWithTeachersError);

        // Debug: Check if there are any class divisions at all
        const { data: allClassDivisionsCount, error: allClassDivisionsCountError } = await supabase
            .from('class_divisions')
            .select('id', { count: 'exact' });

        console.log('=== DEBUG QUERY 4 COMPLETED ===');
        console.log('Total class divisions count:', allClassDivisionsCount);
        console.log('Total class divisions count error:', allClassDivisionsCountError);

        // Debug: Check staff data structure
        console.log('=== DEBUG QUERY 5 COMPLETED ===');
        console.log('Staff data structure:');
        staffData.forEach((staff, index) => {
            console.log(`${index}: ${staff.full_name} - user_id: ${staff.user_id}, user.id: ${staff.user?.id}`);
        });
        console.log('=== ALL DEBUG QUERIES COMPLETED ===');

        // Get legacy assignments (from class_divisions table)
        const { data: legacyAssignments, error: legacyError } = await supabase
            .from('class_divisions')
            .select(`
                id,
                division,
                teacher_id,
                academic_year:academic_year_id (
                    id,
                    year_name,
                    is_active
                ),
                class_level:class_level_id (
                    id,
                    name,
                    sequence_number
                )
            `)
            .in('teacher_id', teacherIds)
            .not('teacher_id', 'is', null);

        // Log for debugging
        console.log('Teacher IDs:', teacherIds);
        console.log('Teacher assignments:', teacherAssignments);
        console.log('Legacy assignments:', legacyAssignments);
        console.log('Assignment error:', assignmentError);
        console.log('Legacy error:', legacyError);

        if (assignmentError) {
            logger.error('Error fetching teacher assignments:', assignmentError);
        }

        // Process and combine the data
        const staff = staffData.map(staffMember => {
            console.log('Processing staff member:', staffMember.full_name, 'User ID:', staffMember.user_id);
            // Only process assignments for teachers
            if (staffMember.user?.role === 'teacher') {
                // Get teacher assignments for this specific teacher
                const teacherAssignmentsForThisTeacher = teacherAssignments
                    ?.filter(a => a.teacher_id === staffMember.user_id) || [];

                // Get legacy class teacher assignments
                const legacyClassTeacher = legacyAssignments
                    ?.filter(a => a.teacher_id === staffMember.user_id)
                    .map(a => ({
                        class_division_id: a.id,
                        class_name: `${a.class_level.name} ${a.division}`,
                        academic_year: a.academic_year.year_name,
                        is_primary: true,
                        is_legacy: true
                    })) || [];

                console.log('Staff member:', staffMember.full_name);
                console.log('Legacy assignments found:', legacyClassTeacher.length);
                console.log('Teacher assignments found:', teacherAssignmentsForThisTeacher.length);

                // Group assignments by type
                const newClassTeacherDivisions = teacherAssignmentsForThisTeacher
                    .filter(a => a.assignment_type === 'class_teacher')
                    .map(a => ({
                        class_division_id: a.class_division.id,
                        class_name: `${a.class_division.class_level.name} ${a.class_division.division}`,
                        academic_year: a.class_division.academic_year.year_name,
                        is_primary: a.is_primary,
                        is_legacy: false
                    }));

                const subjectTeacherDetails = teacherAssignmentsForThisTeacher
                    .filter(a => a.assignment_type === 'subject_teacher')
                    .map(a => ({
                        class_division_id: a.class_division.id,
                        class_name: `${a.class_division.class_level.name} ${a.class_division.division}`,
                        academic_year: a.class_division.academic_year.year_name,
                        subject: a.subject
                    }));

                // Combine legacy and new class teacher assignments
                const allClassTeacherDivisions = [...legacyClassTeacher, ...newClassTeacherDivisions];

                // Get unique subjects taught
                const subjects = [...new Set(allClassTeacherDivisions
                    .map(a => a.subject)
                    .filter(Boolean)
                    .concat(subjectTeacherDetails.map(s => s.subject).filter(Boolean)))];

                return {
                    ...staffMember,
                    teaching_details: {
                        class_teacher_of: allClassTeacherDivisions,
                        subject_teacher_of: subjectTeacherDetails,
                        subjects_taught: subjects
                    }
                };
            }
            return staffMember;
        });

        if (staffError) {
            logger.error('Error fetching staff:', staffError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch staff'
            });
        }

        res.json({
            status: 'success',
            data: {
                staff,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in list staff:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Create staff
router.post('/staff', authenticate, async (req, res) => {
    try {
        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can create staff members'
            });
        }

        const {
            full_name,
            phone_number,
            email,
            role,
            subject,
            department,
            designation,
            joining_date,
            address,
            emergency_contact,
            emergency_contact_phone,
            user_id // Optional - if linking to existing user
        } = req.body;

        // Validate required fields
        if (!full_name || !role) {
            return res.status(400).json({
                status: 'error',
                message: 'Full name and role are required'
            });
        }

        // If user_id is provided, verify the user exists and is a teacher
        if (user_id) {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user_id)
                .eq('role', 'teacher')
                .single();

            if (userError || !user) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid user_id or user is not a teacher'
                });
            }

            // Check if staff record already exists for this user
            const { data: existingStaff } = await supabase
                .from('staff')
                .select('*')
                .eq('user_id', user_id)
                .single();

            if (existingStaff) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Staff record already exists for this user'
                });
            }
        }

        // Check for duplicate phone number or email
        if (phone_number) {
            const { data: existingPhone } = await supabase
                .from('staff')
                .select('*')
                .eq('phone_number', phone_number)
                .single();

            if (existingPhone) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Phone number already exists'
                });
            }
        }

        if (email) {
            const { data: existingEmail } = await supabase
                .from('staff')
                .select('*')
                .eq('email', email)
                .single();

            if (existingEmail) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Email already exists'
                });
            }
        }

        const staffData = {
            user_id: user_id || null,
            full_name,
            phone_number,
            email,
            role,
            subject,
            department,
            designation,
            joining_date,
            address,
            emergency_contact,
            emergency_contact_phone,
            is_active: true,
            created_by: req.user.id
        };

        const { data: staff, error } = await supabase
            .from('staff')
            .insert(staffData)
            .select()
            .single();

        if (error) {
            console.error('Error creating staff member:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create staff member'
            });
        }

        res.status(201).json({
            status: 'success',
            data: {
                message: 'Staff member created successfully',
                staff: staff
            }
        });

    } catch (error) {
        console.error('Error creating staff member:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update staff
router.put('/staff/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can update staff'
            });
        }

        // Filter out fields that don't exist in staff table
        const allowedFields = ['full_name', 'phone_number', 'email', 'role', 'subject', 'department', 'designation', 'joining_date', 'address', 'emergency_contact', 'emergency_contact_phone', 'is_active'];
        const filteredData = {};

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                filteredData[key] = value;
            }
        }

        const { data: staff, error } = await adminSupabase
            .from('staff')
            .update(filteredData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Staff not found'
                });
            }
            logger.error('Error updating staff:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update staff'
            });
        }

        res.json({
            status: 'success',
            data: staff
        });

    } catch (error) {
        logger.error('Error in update staff:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Delete staff
router.delete('/staff/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can delete staff'
            });
        }

        const { error } = await adminSupabase
            .from('staff')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Error deleting staff:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to delete staff'
            });
        }

        res.json({
            status: 'success',
            message: 'Staff deleted successfully'
        });

    } catch (error) {
        logger.error('Error in delete staff:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Sync teachers to staff table
router.post('/staff/sync', authenticate, async (req, res) => {
    try {
        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can sync staff'
            });
        }

        // Get all users with teacher role who don't have staff records
        const { data: teachers, error: teachersError } = await adminSupabase
            .from('users')
            .select('id, full_name, phone_number, role')
            .eq('role', 'teacher');

        if (teachersError) {
            logger.error('Error fetching teachers:', teachersError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch teachers'
            });
        }

        if (!teachers || teachers.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No teachers found'
            });
        }

        // Get existing staff to avoid duplicates (check by phone)
        const { data: existingStaff, error: existingError } = await adminSupabase
            .from('staff')
            .select('phone_number');

        if (existingError) {
            logger.error('Error fetching existing staff:', existingError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch existing staff'
            });
        }

        // Filter out teachers who already have staff records (by phone)
        const existingPhones = existingStaff.map(staff => staff.phone_number).filter(Boolean);

        const newTeachers = teachers.filter(teacher =>
            !existingPhones.includes(teacher.phone_number)
        );

        if (newTeachers.length === 0) {
            return res.json({
                status: 'success',
                message: 'All teachers are already synced to staff table',
                data: {
                    synced: 0,
                    total_teachers: teachers.length
                }
            });
        }

        // Create staff records for new teachers
        const staffData = newTeachers.map(teacher => ({
            full_name: teacher.full_name,
            phone_number: teacher.phone_number,
            role: 'teacher',
            department: 'Teaching',
            designation: 'Teacher',
            is_active: true,
            created_by: req.user.id
        }));

        const { data: newStaff, error: insertError } = await adminSupabase
            .from('staff')
            .insert(staffData)
            .select();

        if (insertError) {
            logger.error('Error creating staff records:', insertError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create staff records'
            });
        }

        // Create user accounts for staff who don't have them
        const staffWithoutUsers = newStaff.filter(staff => !staff.user_id);
        const createdUsers = [];

        for (const staff of staffWithoutUsers) {
            // Generate a default password (you might want to change this)
            const defaultPassword = 'Staff@123';

            // Hash password
            const bcrypt = await import('bcrypt');
            const passwordHash = await bcrypt.default.hash(defaultPassword, 10);

            // Create user account
            const { data: user, error: userError } = await adminSupabase
                .from('users')
                .insert({
                    full_name: staff.full_name,
                    phone_number: staff.phone_number,
                    role: 'teacher', // Default role for staff
                    password_hash: passwordHash
                })
                .select('id, full_name, phone_number')
                .single();

            if (!userError && user) {
                createdUsers.push({
                    staff_id: staff.id,
                    user_id: user.id,
                    phone_number: user.phone_number,
                    default_password: defaultPassword
                });
            }
        }

        res.json({
            status: 'success',
            message: 'Teachers synced to staff table successfully',
            data: {
                synced: newStaff.length,
                total_teachers: teachers.length,
                new_staff: newStaff,
                created_users: createdUsers,
                note: 'Default password for new users is: Staff@123'
            }
        });

    } catch (error) {
        logger.error('Error in sync staff:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Create staff member with user account
router.post('/staff/with-user', authenticate, async (req, res) => {
    try {
        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can create staff with user accounts'
            });
        }

        const {
            full_name,
            phone_number,
            role = 'teacher',
            department = 'Teaching',
            designation = 'Teacher',
            password = 'Staff@123', // Default password
            user_role = 'teacher' // Role for the user account
        } = req.body;

        // Normalize and validate user role for account creation
        const normalizedUserRole = String(user_role || 'teacher').toLowerCase();
        const allowedUserRoles = ['admin', 'principal', 'teacher', 'parent'];
        if (!allowedUserRoles.includes(normalizedUserRole)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid user_role. Allowed: admin, principal, teacher, parent'
            });
        }

        // Validate required fields
        if (!full_name || !phone_number) {
            return res.status(400).json({
                status: 'error',
                message: 'Full name and phone number are required'
            });
        }

        // Check if user already exists
        const { data: existingUser } = await adminSupabase
            .from('users')
            .select('id')
            .eq('phone_number', phone_number)
            .single();

        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'User with this phone number already exists'
            });
        }

        // Check if staff already exists
        const { data: existingStaff } = await adminSupabase
            .from('staff')
            .select('id')
            .eq('phone_number', phone_number)
            .single();

        if (existingStaff) {
            return res.status(400).json({
                status: 'error',
                message: 'Staff with this phone number already exists'
            });
        }

        // Hash password
        const bcrypt = await import('bcrypt');
        const passwordHash = await bcrypt.default.hash(password, 10);

        // Create user account first
        const { data: user, error: userError } = await adminSupabase
            .from('users')
            .insert({
                full_name,
                phone_number,
                role: normalizedUserRole,
                password_hash: passwordHash
            })
            .select('id, full_name, phone_number')
            .single();

        if (userError) {
            logger.error('Error creating user:', userError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create user account'
            });
        }

        // Create staff record
        const { data: staff, error: staffError } = await adminSupabase
            .from('staff')
            .insert({
                full_name,
                phone_number,
                role,
                department,
                designation,
                is_active: true,
                created_by: req.user.id,
                user_id: user.id
            })
            .select()
            .single();

        if (staffError) {
            logger.error('Error creating staff:', staffError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create staff record'
            });
        }

        res.status(201).json({
            status: 'success',
            message: 'Staff member and user account created successfully',
            data: {
                staff,
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    phone_number: user.phone_number
                },
                login_credentials: {
                    phone_number: user.phone_number,
                    password: password
                }
            }
        });

    } catch (error) {
        logger.error('Error in create staff with user:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Sync existing staff records to use same ID as user records (fix for existing data)
router.post('/staff/sync-ids', authenticate, async (req, res, next) => {
    try {
        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can sync staff IDs'
            });
        }

        // Get all staff records
        const { data: allStaff, error: staffError } = await adminSupabase
            .from('staff')
            .select('*');

        if (staffError) throw staffError;

        let syncedCount = 0;
        let errors = [];

        for (const staff of allStaff) {
            try {
                // Find user with same phone number
                const { data: user, error: userError } = await adminSupabase
                    .from('users')
                    .select('id, role')
                    .eq('phone_number', staff.phone_number)
                    .eq('role', 'teacher')
                    .single();

                if (user && user.id !== staff.id) {
                    // Update staff record to use user ID
                    const { error: updateError } = await adminSupabase
                        .from('staff')
                        .update({ id: user.id })
                        .eq('id', staff.id);

                    if (!updateError) {
                        syncedCount++;
                    } else {
                        errors.push(`Failed to update staff ${staff.full_name}: ${updateError.message}`);
                    }
                }
            } catch (error) {
                errors.push(`Error processing staff ${staff.full_name}: ${error.message}`);
            }
        }

        res.json({
            status: 'success',
            message: 'Staff ID sync completed',
            data: {
                total_staff: allStaff.length,
                synced_count: syncedCount,
                errors: errors.length > 0 ? errors : null
            }
        });

    } catch (error) {
        logger.error('Error in staff ID sync:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get teachers with staff and user information for assignment purposes
router.get('/teachers-for-assignment', authenticate, async (req, res) => {
    try {
        // Check permissions - only admin, principal, and teachers can view this
        if (!['admin', 'principal', 'teacher'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get all teachers with their staff and user information
        const { data: teachersData, error } = await adminSupabase
            .from('staff')
            .select(`
                id,
                user_id,
                full_name,
                phone_number,
                department,
                designation,
                is_active,
                users!inner(id, full_name, role)
            `)
            .eq('role', 'teacher')
            .eq('is_active', true)
            .eq('users.role', 'teacher');

        if (error) {
            logger.error('Error fetching teachers for assignment:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch teachers'
            });
        }

        // Format the response for easy use in frontend
        const teachers = teachersData.map(teacher => ({
            staff_id: teacher.id,
            user_id: teacher.user_id || teacher.users.id,
            teacher_id: teacher.user_id || teacher.users.id, // Use this for class assignment
            full_name: teacher.full_name,
            staff_name: teacher.full_name,
            user_name: teacher.users.full_name,
            phone_number: teacher.phone_number,
            department: teacher.department,
            designation: teacher.designation,
            role: teacher.users.role
        }));

        res.json({
            status: 'success',
            data: {
                teachers,
                total: teachers.length,
                message: 'Use teacher_id field for class division assignments'
            }
        });

    } catch (error) {
        logger.error('Error in teachers-for-assignment endpoint:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Backfill staff.user_id for existing staff (optionally create missing users)
router.post('/staff/backfill-user-ids', authenticate, async (req, res) => {
    try {
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        const createMissing = (req.query.create_missing === 'true');
        const defaultPassword = req.body?.default_password || 'Staff@123';

        // First, check if user_id column exists in staff table
        const { data: columnCheck, error: columnError } = await adminSupabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'staff')
            .eq('column_name', 'user_id')
            .single();

        if (columnError || !columnCheck) {
            // user_id column doesn't exist, create it
            const { error: alterError } = await adminSupabase.rpc('exec_sql', {
                sql: 'ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE'
            });

            if (alterError) {
                logger.error('Error adding user_id column:', alterError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to add user_id column to staff table. Please run this SQL manually: ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE'
                });
            }
        }

        // Get all staff with null user_id
        const { data: staffList, error: staffError } = await adminSupabase
            .from('staff')
            .select('*')
            .is('user_id', null);

        if (staffError) {
            logger.error('Error fetching staff without user_id:', staffError);
            return res.status(500).json({ status: 'error', message: 'Failed to fetch staff' });
        }

        let linked = 0;
        let created = 0;
        const failures = [];

        for (const staff of (staffList || [])) {
            try {
                // Try to find existing user by phone_number and role
                const { data: user, error: userError } = await adminSupabase
                    .from('users')
                    .select('id')
                    .eq('phone_number', staff.phone_number)
                    .eq('role', staff.role)
                    .single();

                if (user && !userError) {
                    const { error: linkError } = await adminSupabase
                        .from('staff')
                        .update({ user_id: user.id })
                        .eq('id', staff.id);
                    if (linkError) throw linkError;
                    linked++;
                    continue;
                }

                if (!createMissing) {
                    failures.push({ staff_id: staff.id, reason: 'No matching user; set create_missing=true to auto-create' });
                    continue;
                }

                // Create user account for the staff
                const bcrypt = (await import('bcrypt')).default;
                const passwordHash = await bcrypt.hash(defaultPassword, 10);

                const { data: newUser, error: createUserError } = await adminSupabase
                    .from('users')
                    .insert({
                        full_name: staff.full_name,
                        phone_number: staff.phone_number,
                        role: staff.role,
                        password_hash: passwordHash
                    })
                    .select('id')
                    .single();

                if (createUserError || !newUser) throw createUserError || new Error('User create failed');

                const { error: linkNewError } = await adminSupabase
                    .from('staff')
                    .update({ user_id: newUser.id })
                    .eq('id', staff.id);
                if (linkNewError) throw linkNewError;

                created++;
            } catch (e) {
                failures.push({ staff_id: staff.id, reason: e?.message || 'unknown' });
            }
        }

        res.json({
            status: 'success',
            data: {
                processed: staffList?.length || 0,
                linked,
                created,
                failures
            }
        });
    } catch (error) {
        logger.error('Error in backfill-user-ids:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

// Test endpoint to check database structure
router.get('/test-db', async (req, res) => {
    try {
        console.log('=== TESTING DATABASE STRUCTURE ===');

        // Test 1: Check if class_teacher_assignments table exists
        const { data: tableTest1, error: error1 } = await supabase
            .from('class_teacher_assignments')
            .select('id')
            .limit(1);

        console.log('Table test 1 result:', tableTest1);
        console.log('Table test 1 error:', error1);

        // Test 2: Check if class_divisions table exists
        const { data: tableTest2, error: error2 } = await supabase
            .from('class_divisions')
            .select('id')
            .limit(1);

        console.log('Table test 2 result:', tableTest2);
        console.log('Table test 2 error:', error2);

        // Test 3: Check table structure
        const { data: tableInfo, error: error3 } = await supabase
            .rpc('get_table_info', { table_name: 'class_teacher_assignments' });

        console.log('Table info result:', tableInfo);
        console.log('Table info error:', error3);

        res.json({
            status: 'success',
            message: 'Database structure test completed',
            data: {
                class_teacher_assignments: { data: tableTest1, error: error1 },
                class_divisions: { data: tableTest2, error: error2 },
                table_info: { data: tableInfo, error: error3 }
            }
        });

    } catch (error) {
        console.error('Test endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Test failed',
            error: error.message
        });
    }
});

// Test endpoint to create sample data
router.post('/create-test-data', async (req, res) => {
    try {
        console.log('=== CREATING TEST DATA ===');

        // First, check if we have any academic years
        const { data: academicYears, error: academicYearsError } = await supabase
            .from('academic_years')
            .select('id, year_name')
            .eq('is_active', true)
            .limit(1);

        if (academicYearsError || !academicYears || academicYears.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No active academic year found. Please create an academic year first.'
            });
        }

        const academicYearId = academicYears[0].id;
        console.log('Using academic year:', academicYearId);

        // Check if we have any class levels
        const { data: classLevels, error: classLevelsError } = await supabase
            .from('class_levels')
            .select('id, name')
            .limit(2);

        if (classLevelsError || !classLevels || classLevels.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No class levels found. Please create class levels first.'
            });
        }

        console.log('Found class levels:', classLevels);

        // Create test class divisions
        const testDivisions = [
            {
                division: 'A',
                class_level_id: classLevels[0].id,
                academic_year_id: academicYearId
            },
            {
                division: 'B',
                class_level_id: classLevels[0].id,
                academic_year_id: academicYearId
            }
        ];

        const { data: createdDivisions, error: divisionsError } = await supabase
            .from('class_divisions')
            .insert(testDivisions)
            .select('id, division, class_level_id, academic_year_id');

        if (divisionsError) {
            console.error('Error creating divisions:', divisionsError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create class divisions',
                error: divisionsError.message
            });
        }

        console.log('Created divisions:', createdDivisions);

        // Get first teacher from staff
        const { data: teachers, error: teachersError } = await supabase
            .from('staff')
            .select('user_id')
            .eq('role', 'teacher')
            .limit(1);

        if (teachersError || !teachers || teachers.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'No teachers found in staff table'
            });
        }

        const teacherId = teachers[0].user_id;
        console.log('Using teacher ID:', teacherId);

        // Create teacher assignments
        const testAssignments = [
            {
                class_division_id: createdDivisions[0].id,
                teacher_id: teacherId,
                assignment_type: 'class_teacher',
                is_primary: true,
                is_active: true
            },
            {
                class_division_id: createdDivisions[1].id,
                teacher_id: teacherId,
                assignment_type: 'subject_teacher',
                subject: 'Mathematics',
                is_primary: false,
                is_active: true
            }
        ];

        const { data: createdAssignments, error: assignmentsError } = await supabase
            .from('class_teacher_assignments')
            .insert(testAssignments)
            .select('id, class_division_id, teacher_id, assignment_type, subject');

        if (assignmentsError) {
            console.error('Error creating assignments:', assignmentsError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create teacher assignments',
                error: assignmentsError.message
            });
        }

        console.log('Created assignments:', createdAssignments);

        res.json({
            status: 'success',
            message: 'Test data created successfully',
            data: {
                academic_year: academicYears[0],
                class_levels: classLevels,
                divisions: createdDivisions,
                assignments: createdAssignments
            }
        });

    } catch (error) {
        console.error('Create test data error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create test data',
            error: error.message
        });
    }
});

export default router; 