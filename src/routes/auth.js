import bcrypt from 'bcryptjs';
import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { adminSupabase, monitoredSupabase, queryOptimizer } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Register validation middleware
const registerValidation = [
    body('phone_number').matches(/^[0-9]{10}$/).withMessage('Invalid phone number format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').isIn(['admin', 'principal', 'teacher', 'parent']).withMessage('Invalid role'),
    body('full_name').notEmpty().withMessage('Full name is required')
];

// Create parent record validation middleware
const createParentValidation = [
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('phone_number').matches(/^[0-9]{10}$/).withMessage('Invalid phone number format'),
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email format'),
    body('student_details').isArray({ min: 1 }).withMessage('At least one student detail is required'),
    body('student_details.*.admission_number').notEmpty().withMessage('Admission number is required'),
    body('student_details.*.relationship').isIn(['father', 'mother', 'guardian']).withMessage('Invalid relationship'),
    body('student_details.*.is_primary_guardian').isBoolean().withMessage('Primary guardian must be boolean')
];

// Create parent record (Admin/Principal/Teacher)
router.post('/create-parent', createParentValidation, async (req, res, next) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { full_name, phone_number, email, student_details } = req.body;
        // Optional initial plaintext password provided by admin/principal/teacher
        const initial_password = req.body.initial_password || null;

        // Check if parent already exists
        const { data: existingParent } = await adminSupabase
            .from('users')
            .select('id')
            .eq('phone_number', phone_number)
            .single();

        if (existingParent) {
            return res.status(400).json({
                status: 'error',
                message: 'Parent with this phone number already exists'
            });
        }

        // Verify all students exist
        const admissionNumbers = student_details.map(detail => detail.admission_number);
        logger.info('Looking for students with admission numbers:', admissionNumbers);

        const { data: students, error: studentsError } = await adminSupabase
            .from('students_master')
            .select('id, admission_number, full_name')
            .in('admission_number', admissionNumbers);

        if (studentsError) {
            logger.error('Error fetching students:', studentsError);
            throw studentsError;
        }

        logger.info('Found students:', students);

        if (students.length !== admissionNumbers.length) {
            const foundNumbers = students.map(s => s.admission_number);
            const missingNumbers = admissionNumbers.filter(num => !foundNumbers.includes(num));
            logger.error('Missing students:', missingNumbers);
            return res.status(400).json({
                status: 'error',
                message: `Students not found: ${missingNumbers.join(', ')}`
            });
        }

        // Check for primary guardian conflicts
        const primaryGuardianCount = student_details.filter(detail => detail.is_primary_guardian).length;
        if (primaryGuardianCount > 1) {
            return res.status(400).json({
                status: 'error',
                message: 'Only one student can have this parent as primary guardian'
            });
        }

        // Create parent record (without password - they'll register themselves)
        const { data: newParent, error: parentError } = await adminSupabase
            .from('users')
            .insert([
                {
                    phone_number,
                    full_name,
                    email,
                    role: 'parent',
                    is_registered: false, // Flag to indicate they haven't registered yet
                    password_hash: null, // Explicitly set to null for unregistered parents
                    initial_password: initial_password,
                    initial_password_set_at: initial_password ? new Date().toISOString() : null
                }
            ])
            .select()
            .single();

        if (parentError) {
            logger.error('Error creating parent:', parentError);
            throw parentError;
        }

        // Prepare student mappings for the link-students endpoint
        const studentMappings = student_details.map(detail => {
            const student = students.find(s => s.admission_number === detail.admission_number);
            return {
                student_id: student.id,
                relationship: detail.relationship,
                is_primary_guardian: detail.is_primary_guardian,
                access_level: 'full'
            };
        });

        // Use the existing link-students endpoint to create parent-student mappings
        const linkStudentsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/academic/link-students`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization
            },
            body: JSON.stringify({
                parent_id: newParent.id,
                students: studentMappings
            })
        });

        if (!linkStudentsResponse.ok) {
            // If linking fails, delete the parent record
            await adminSupabase
                .from('users')
                .delete()
                .eq('id', newParent.id);

            const errorData = await linkStudentsResponse.json();
            return res.status(linkStudentsResponse.status).json({
                status: 'error',
                message: 'Failed to link students to parent',
                details: errorData
            });
        }

        const linkResult = await linkStudentsResponse.json();

        res.status(201).json({
            status: 'success',
            data: {
                parent: {
                    id: newParent.id,
                    full_name: newParent.full_name,
                    phone_number: newParent.phone_number,
                    email: newParent.email,
                    role: newParent.role,
                    is_registered: false
                },
                students: students.map(student => ({
                    id: student.id,
                    admission_number: student.admission_number,
                    full_name: student.full_name
                })),
                mappings: studentMappings.map(mapping => ({
                    relationship: mapping.relationship,
                    is_primary_guardian: mapping.is_primary_guardian,
                    access_level: mapping.access_level
                })),
                registration_instructions: {
                    message: 'Parent can now register using their phone number',
                    endpoint: 'POST /api/auth/register',
                    required_fields: ['phone_number', 'password', 'role: "parent"']
                },
                initial_password: initial_password || null,
                note: 'Parent-student mappings created using /api/academic/link-students endpoint'
            },
            message: 'Parent record created successfully. Parent can now register using their phone number.'
        });

    } catch (error) {
        logger.error('Error in create-parent endpoint:', error);
        return next(error);
    }
});

// Bulk create parents with student linking - OPTIMIZED
router.post('/bulk-create-parents',
    [
        body('parents').isArray({ min: 1, max: 200 }).withMessage('Parents must be an array (max 200 parents)'),
        body('parents.*.full_name').notEmpty().withMessage('Full name is required'),
        body('parents.*.phone_number').isMobilePhone().withMessage('Valid phone number is required'),
        body('parents.*.email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email format'),
        body('parents.*.students').optional().isArray().withMessage('Students must be an array'),
        body('parents.*.students.*.student_id').optional().isUUID().withMessage('Valid student ID required'),
        body('parents.*.students.*.admission_number').optional().notEmpty().withMessage('Admission number required if student_id not provided'),
        body('parents.*.students.*.relationship').optional().isIn(['father', 'mother', 'guardian']).withMessage('Valid relationship required'),
        body('parents.*.students.*.is_primary_guardian').optional().isBoolean().withMessage('Primary guardian must be boolean'),
        body('parents.*.students.*.access_level').optional().isIn(['full', 'restricted', 'readonly']).withMessage('Valid access level required')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { parents } = req.body;

            // OPTIMIZATION 1: Check for duplicate phone numbers in batch
            const phoneNumbers = parents.map(p => p.phone_number);
            const phoneSet = new Set();
            const duplicates = [];

            phoneNumbers.forEach(phone => {
                if (phoneSet.has(phone)) {
                    duplicates.push(phone);
                } else {
                    phoneSet.add(phone);
                }
            });

            if (duplicates.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: `Duplicate phone numbers in batch: ${duplicates.join(', ')}`
                });
            }

            // OPTIMIZATION 2: Collect and validate student data if provided
            const allStudentIds = new Set();
            const allAdmissionNumbers = new Set();
            const parentStudentMappings = [];
            const primaryGuardianConflicts = new Map();

            for (let i = 0; i < parents.length; i++) {
                const parent = parents[i];
                if (parent.students && parent.students.length > 0) {
                    for (const student of parent.students) {
                        // Collect student identifiers
                        if (student.student_id) {
                            allStudentIds.add(student.student_id);
                        }
                        if (student.admission_number) {
                            allAdmissionNumbers.add(student.admission_number);
                        }

                        // Set defaults for student linking
                        const studentLink = {
                            parentIndex: i,
                            student_id: student.student_id || null,
                            admission_number: student.admission_number || null,
                            relationship: student.relationship || 'guardian',
                            is_primary_guardian: student.is_primary_guardian || false,
                            access_level: student.access_level || 'full'
                        };
                        parentStudentMappings.push(studentLink);

                        // Track primary guardian conflicts
                        if (studentLink.is_primary_guardian) {
                            const studentKey = student.student_id || student.admission_number;
                            if (primaryGuardianConflicts.has(studentKey)) {
                                primaryGuardianConflicts.set(studentKey, primaryGuardianConflicts.get(studentKey) + 1);
                            } else {
                                primaryGuardianConflicts.set(studentKey, 1);
                            }
                        }
                    }
                }
            }

            // Check for primary guardian conflicts
            const conflictingStudents = [];
            for (const [studentKey, count] of primaryGuardianConflicts) {
                if (count > 1) {
                    conflictingStudents.push(studentKey);
                }
            }

            if (conflictingStudents.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: `Multiple primary guardians specified for students: ${conflictingStudents.join(', ')}`
                });
            }

            // OPTIMIZATION 3: Parallel validation queries
            const validationPromises = [
                // Check existing parents
                adminSupabase
                    .from('users')
                    .select('phone_number')
                    .in('phone_number', phoneNumbers)
                    .eq('role', 'parent')
            ];

            // Add student validation if students are provided
            if (allStudentIds.size > 0) {
                validationPromises.push(
                    adminSupabase
                        .from('students_master')
                        .select('id, admission_number')
                        .in('id', Array.from(allStudentIds))
                );
            }

            if (allAdmissionNumbers.size > 0) {
                validationPromises.push(
                    adminSupabase
                        .from('students_master')
                        .select('id, admission_number')
                        .in('admission_number', Array.from(allAdmissionNumbers))
                );
            }

            const validationResults = await Promise.all(validationPromises);
            const [existingParentsResult, ...studentResults] = validationResults;

            // Handle existing parents - separate new parents from existing ones
            const existingParentPhones = existingParentsResult.data ?
                existingParentsResult.data.map(p => p.phone_number) : [];

            const newParents = parents.filter(p => !existingParentPhones.includes(p.phone_number));
            const existingParents = parents.filter(p => existingParentPhones.includes(p.phone_number));

            logger.info(`Found ${existingParents.length} existing parents and ${newParents.length} new parents to create`);

            // Get full details of existing parents for linking
            let existingParentDetails = [];
            if (existingParents.length > 0) {
                const { data: parentDetails, error: parentDetailsError } = await adminSupabase
                    .from('users')
                    .select('id, phone_number, full_name')
                    .in('phone_number', existingParents.map(p => p.phone_number))
                    .eq('role', 'parent');

                if (parentDetailsError) {
                    logger.error('Error fetching existing parent details:', parentDetailsError);
                    throw parentDetailsError;
                }

                existingParentDetails = parentDetails || [];
            }

            // Validate and map students
            const studentMap = new Map(); // Maps admission_number/id -> student record
            if (studentResults.length > 0) {
                studentResults.forEach(result => {
                    if (result.data) {
                        result.data.forEach(student => {
                            studentMap.set(student.id, student);
                            studentMap.set(student.admission_number, student);
                        });
                    }
                });

                // Check if all referenced students exist
                const missingStudents = [];
                parentStudentMappings.forEach(mapping => {
                    const studentKey = mapping.student_id || mapping.admission_number;
                    if (!studentMap.has(studentKey)) {
                        missingStudents.push(studentKey);
                    }
                });

                if (missingStudents.length > 0) {
                    return res.status(400).json({
                        status: 'error',
                        message: `Students not found: ${missingStudents.join(', ')}`
                    });
                }
            }

            // OPTIMIZATION 4: Prepare data for new parents only
            let createdParents = [];
            if (newParents.length > 0) {
                const newParentsData = newParents.map(parent => ({
                    phone_number: parent.phone_number,
                    full_name: parent.full_name,
                    email: parent.email || null,
                    role: 'parent',
                    is_registered: false,
                    password_hash: null,
                    initial_password: parent.initial_password || null,
                    initial_password_set_at: parent.initial_password ? new Date().toISOString() : null
                }));

                // OPTIMIZATION 5: Bulk insert new parents only
                const { data: newCreatedParents, error: parentError } = await adminSupabase
                    .from('users')
                    .insert(newParentsData)
                    .select('id, phone_number, full_name, email');

                if (parentError) {
                    logger.error('Error creating bulk parents:', parentError);
                    throw parentError;
                }

                createdParents = newCreatedParents || [];
            }

            // OPTIMIZATION 6: Create parent-student mappings for both new and existing parents
            let createdMappings = [];
            let linkedToExistingMappings = [];

            if (parentStudentMappings.length > 0) {
                // Separate mappings for new vs existing parents
                const newParentMappings = [];
                const existingParentMappings = [];

                parentStudentMappings.forEach(mapping => {
                    const parentPhone = parents[mapping.parentIndex].phone_number;

                    if (existingParentPhones.includes(parentPhone)) {
                        // This is for an existing parent
                        const existingParent = existingParentDetails.find(p => p.phone_number === parentPhone);
                        if (existingParent) {
                            existingParentMappings.push({
                                ...mapping,
                                parent_id: existingParent.id,
                                parent_phone: parentPhone,
                                parent_name: existingParent.full_name
                            });
                        }
                    } else {
                        // This is for a new parent
                        const newParentIndex = newParents.findIndex(p => p.phone_number === parentPhone);
                        if (newParentIndex >= 0 && createdParents[newParentIndex]) {
                            newParentMappings.push({
                                ...mapping,
                                parent_id: createdParents[newParentIndex].id
                            });
                        }
                    }
                });

                // Prepare all mapping data
                const allMappingsData = [
                    ...newParentMappings.map(mapping => {
                        const studentKey = mapping.student_id || mapping.admission_number;
                        const studentRecord = studentMap.get(studentKey);
                        return {
                            parent_id: mapping.parent_id,
                            student_id: studentRecord.id,
                            relationship: mapping.relationship,
                            is_primary_guardian: mapping.is_primary_guardian,
                            access_level: mapping.access_level
                        };
                    }),
                    ...existingParentMappings.map(mapping => {
                        const studentKey = mapping.student_id || mapping.admission_number;
                        const studentRecord = studentMap.get(studentKey);
                        return {
                            parent_id: mapping.parent_id,
                            student_id: studentRecord.id,
                            relationship: mapping.relationship,
                            is_primary_guardian: mapping.is_primary_guardian,
                            access_level: mapping.access_level
                        };
                    })
                ];

                // Check for existing primary guardians
                const studentsWithPrimaryGuardians = allMappingsData
                    .filter(m => m.is_primary_guardian)
                    .map(m => m.student_id);

                if (studentsWithPrimaryGuardians.length > 0) {
                    const { data: existingPrimary } = await adminSupabase
                        .from('parent_student_mappings')
                        .select('student_id')
                        .in('student_id', studentsWithPrimaryGuardians)
                        .eq('is_primary_guardian', true);

                    if (existingPrimary && existingPrimary.length > 0) {
                        const existingStudentIds = existingPrimary.map(p => p.student_id);
                        // Rollback created parents
                        if (createdParents.length > 0) {
                            await adminSupabase
                                .from('users')
                                .delete()
                                .in('id', createdParents.map(p => p.id));
                        }

                        return res.status(400).json({
                            status: 'error',
                            message: `Students already have primary guardians: ${existingStudentIds.join(', ')}`
                        });
                    }
                }

                // Insert all mappings (new and existing parent linkages)
                if (allMappingsData.length > 0) {
                    const { data: mappings, error: mappingError } = await adminSupabase
                        .from('parent_student_mappings')
                        .insert(allMappingsData)
                        .select('id, parent_id, student_id, relationship, is_primary_guardian');

                    if (mappingError) {
                        logger.error('Error creating parent-student mappings:', mappingError);
                        // Rollback created parents
                        if (createdParents.length > 0) {
                            await adminSupabase
                                .from('users')
                                .delete()
                                .in('id', createdParents.map(p => p.id));
                        }
                        throw mappingError;
                    }

                    createdMappings = mappings.filter(m =>
                        createdParents.some(p => p.id === m.parent_id)
                    );
                    linkedToExistingMappings = mappings.filter(m =>
                        existingParentDetails.some(p => p.id === m.parent_id)
                    );
                }
            }

            // OPTIMIZATION 7: Return comprehensive response including existing parent linkages
            const responseData = {
                new_parents: {
                    created_count: createdParents.length,
                    parents: createdParents,
                    summary: {
                        phone_numbers: createdParents.map(p => p.phone_number),
                        with_initial_password: createdParents.filter(p => p.initial_password).length
                    }
                },
                existing_parents: {
                    found_count: existingParents.length,
                    linked_children_count: linkedToExistingMappings.length,
                    parents: existingParentDetails,
                    phone_numbers: existingParents.map(p => p.phone_number)
                },
                student_links: {
                    new_parent_links: createdMappings.length,
                    existing_parent_links: linkedToExistingMappings.length,
                    total_links: createdMappings.length + linkedToExistingMappings.length,
                    new_mappings: createdMappings,
                    existing_mappings: linkedToExistingMappings
                }
            };

            const totalProcessed = createdParents.length + existingParents.length;
            const totalLinks = createdMappings.length + linkedToExistingMappings.length;

            res.status(201).json({
                status: 'success',
                message: `Successfully processed ${totalProcessed} parents (${createdParents.length} new, ${existingParents.length} existing)${totalLinks > 0 ? ` with ${totalLinks} student linkages` : ''}`,
                data: responseData
            });

        } catch (error) {
            logger.error('Bulk parent creation error:', error);
            next(error);
        }
    }
);

// Register route (enhanced for parent self-registration)
router.post('/register', registerValidation, async (req, res, next) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { phone_number, password, role, full_name } = req.body;

        // Check if user already exists
        const { data: existingUser } = await adminSupabase
            .from('users')
            .select('*')
            .eq('phone_number', phone_number)
            .single();

        if (existingUser) {
            // If parent exists but not registered, allow them to complete registration
            if (existingUser.role === 'parent' && !existingUser.is_registered) {
                // Hash password
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);

                // Update user with password and mark as registered
                const { data: updatedUser, error: updateError } = await adminSupabase
                    .from('users')
                    .update({
                        password_hash: hashedPassword,
                        is_registered: true,
                        full_name: full_name || existingUser.full_name
                    })
                    .eq('id', existingUser.id)
                    .select()
                    .single();

                if (updateError) {
                    logger.error('Error updating parent registration:', updateError);
                    throw updateError;
                }

                // Generate JWT
                const token = jwt.sign(
                    {
                        userId: updatedUser.id,
                        role: updatedUser.role
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: process.env.JWT_EXPIRES_IN }
                );

                return res.status(200).json({
                    status: 'success',
                    data: {
                        user: {
                            id: updatedUser.id,
                            phone_number: updatedUser.phone_number,
                            role: updatedUser.role,
                            full_name: updatedUser.full_name
                        },
                        token,
                        message: 'Parent registration completed successfully'
                    }
                });
            } else {
                return res.status(400).json({
                    status: 'error',
                    message: 'User already exists and is registered'
                });
            }
        }

        // For new users (non-parents or new parent registrations)
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user in Supabase
        const { data: newUser, error } = await adminSupabase
            .from('users')
            .insert([
                {
                    phone_number,
                    password_hash: hashedPassword,
                    role,
                    full_name,
                    is_registered: true
                }
            ])
            .select()
            .single();

        if (error) {
            logger.error('Error creating user:', error);
            throw error;
        }

        // Generate JWT
        const token = jwt.sign(
            {
                userId: newUser.id,
                role: newUser.role
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.status(201).json({
            status: 'success',
            data: {
                user: {
                    id: newUser.id,
                    phone_number: newUser.phone_number,
                    role: newUser.role,
                    full_name: newUser.full_name
                },
                token
            }
        });
    } catch (error) {
        next(error);
    }
});

// Login route - OPTIMIZED for performance
router.post('/login', async (req, res, next) => {
    try {
        const { phone_number, password } = req.body;

        // Validate input
        if (!phone_number || !password) {
            return res.status(400).json({
                status: 'error',
                message: 'Phone number and password are required'
            });
        }

        // OPTIMIZATION: Only select essential fields for login with query optimization
        const { data: user, error: userError } = await monitoredSupabase
            .from('users')
            .select('id, phone_number, password_hash, role, full_name, email, preferred_language, is_registered, initial_password')
            .eq('phone_number', phone_number)
            .single();

        if (userError || !user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid phone number or password'
            });
        }

        // Handle registered vs unregistered users
        if (user.is_registered) {
            // Verify password for registered users
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid phone number or password'
                });
            }
        } else {
            // Auto-complete registration for parents created by admin/principal
            if (user.role === 'parent') {
                // If an initial_password exists, require it to match for first login
                if (user.initial_password && password === user.initial_password) {
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(password, salt);

                    const { data: updatedUser, error: updateError } = await adminSupabase
                        .from('users')
                        .update({
                            password_hash: hashedPassword,
                            is_registered: true,
                            initial_password: null
                        })
                        .eq('id', user.id)
                        .select('id, phone_number, role, full_name, email, preferred_language, is_registered')
                        .single();

                    if (updateError) {
                        console.error('Failed to auto-complete parent registration on login:', updateError);
                        return res.status(500).json({
                            status: 'error',
                            message: 'Internal server error'
                        });
                    }

                    // Overwrite user reference with updated values for token and response
                    Object.assign(user, updatedUser);
                } else {
                    return res.status(401).json({
                        status: 'error',
                        message: 'Invalid phone number or password'
                    });
                }
            } else {
                // Non-parent users must be registered before login
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid phone number or password'
                });
            }
        }

        // OPTIMIZATION: Generate JWT token immediately after password verification
        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // OPTIMIZATION: Update last_login asynchronously (don't block response)
        monitoredSupabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id)
            .then(() => {
                // Successfully updated last_login
            })
            .catch(err => {
                // Log error but don't fail login
                console.error('Failed to update last_login:', err);
            });

        // OPTIMIZATION: Handle teacher staff sync asynchronously (don't block login)
        if (user.role === 'teacher') {
            // Fire and forget - don't block login response
            monitoredSupabase
                .from('staff')
                .select('id')
                .eq('user_id', user.id)
                .single()
                .then(({ data: existingStaff }) => {
                    if (!existingStaff) {
                        const staffData = {
                            user_id: user.id,
                            full_name: user.full_name,
                            phone_number: user.phone_number,
                            email: user.email,
                            role: 'teacher',
                            is_active: true,
                            created_by: user.id
                        };

                        return monitoredSupabase.from('staff').insert(staffData);
                    } else {
                        // Staff record already exists, no need to create
                        return null;
                    }
                })
                .then((result) => {
                    if (result) {
                        console.log(`Staff record created for teacher ${user.id}`);
                    }
                    // No logging if staff record already existed
                })
                .catch(err => {
                    console.error(`Failed to create staff record for teacher ${user.id}:`, err);
                });
        }

        // Return response immediately
        res.json({
            status: 'success',
            data: {
                user: {
                    id: user.id,
                    phone_number: user.phone_number,
                    role: user.role,
                    full_name: user.full_name,
                    email: user.email,
                    preferred_language: user.preferred_language
                },
                token: token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update password endpoint
router.put('/update-password', authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!current_password || !new_password) {
            return res.status(400).json({
                status: 'error',
                message: 'Current password and new password are required'
            });
        }

        // Validate new password strength
        if (new_password.length < 6) {
            return res.status(400).json({
                status: 'error',
                message: 'New password must be at least 6 characters long'
            });
        }

        // Get current user data
        const { data: user, error: userError } = await adminSupabase
            .from('users')
            .select('id, password_hash, is_registered')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Check if user is registered (has password)
        if (!user.is_registered || !user.password_hash) {
            return res.status(400).json({
                status: 'error',
                message: 'User must be registered to change password'
            });
        }

        // Verify current password
        const bcrypt = await import('bcrypt');
        const isValidCurrentPassword = await bcrypt.default.compare(current_password, user.password_hash);

        if (!isValidCurrentPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const salt = await bcrypt.default.genSalt(10);
        const hashedNewPassword = await bcrypt.default.hash(new_password, salt);

        // Update password in database
        const { error: updateError } = await adminSupabase
            .from('users')
            .update({
                password_hash: hashedNewPassword,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            logger.error('Error updating password:', updateError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update password'
            });
        }

        res.json({
            status: 'success',
            message: 'Password updated successfully'
        });

    } catch (error) {
        logger.error('Error in update password:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// OPTIMIZATION: Performance monitoring endpoint for scale testing
router.get('/performance-stats', async (req, res) => {
    try {
        const optimizerStats = queryOptimizer.getStats();

        // Get database performance metrics
        const startTime = Date.now();
        const { data: userCount, error: countError } = await monitoredSupabase
            .from('users')
            .select('id', { count: 'exact' });

        const queryTime = Date.now() - startTime;

        res.json({
            status: 'success',
            data: {
                query_optimizer: optimizerStats,
                database_performance: {
                    total_users: userCount?.length || 0,
                    query_time_ms: queryTime,
                    performance_rating: queryTime < 100 ? 'excellent' :
                        queryTime < 300 ? 'good' :
                            queryTime < 1000 ? 'fair' : 'poor'
                },
                recommendations: [
                    queryTime > 1000 ? 'Consider adding more database indexes' : null,
                    optimizerStats.cacheSize > 100 ? 'Consider increasing cache timeout' : null,
                    'Ensure phone_number index exists on users table'
                ].filter(Boolean)
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Failed to get performance stats',
            error: error.message
        });
    }
});

export default router; 