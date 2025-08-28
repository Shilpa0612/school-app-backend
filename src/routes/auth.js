import bcrypt from 'bcryptjs';
import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { adminSupabase, monitoredSupabase } from '../config/supabase.js';
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
    body('email').optional().isEmail().withMessage('Invalid email format'),
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
        const { data: existingParent } = await supabase
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
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            details: error.message
        });
    }
});

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
        const { data: existingUser } = await supabase
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
                const { data: updatedUser, error: updateError } = await supabase
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
        const { data: newUser, error } = await supabase
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
            .select('id, phone_number, password_hash, role, full_name, email, preferred_language')
            .eq('phone_number', phone_number)
            .eq('is_registered', true) // Only allow registered users
            .single();

        if (userError || !user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid phone number or password'
            });
        }

        // OPTIMIZATION: Verify password first before any database operations
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid phone number or password'
            });
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