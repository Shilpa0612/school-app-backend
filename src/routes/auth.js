import bcrypt from 'bcryptjs';
import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Register validation middleware
const registerValidation = [
    body('phone_number').matches(/^[0-9]{10}$/).withMessage('Invalid phone number format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').isIn(['admin', 'principal', 'teacher', 'parent']).withMessage('Invalid role'),
    body('full_name').notEmpty().withMessage('Full name is required')
];

// Register route
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
            .select('id')
            .eq('phone_number', phone_number)
            .single();

        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'User already exists'
            });
        }

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
                    full_name
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

// Login route
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

        // Find user by phone number
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('phone_number', phone_number)
            .single();

        if (userError || !user) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid phone number or password'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid phone number or password'
            });
        }

        // Update last login
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        // Auto-sync teacher to staff table if they don't exist
        if (user.role === 'teacher') {
            const { data: existingStaff } = await supabase
                .from('staff')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (!existingStaff) {
                // Create staff record for teacher
                const staffData = {
                    user_id: user.id,
                    full_name: user.full_name,
                    phone_number: user.phone_number,
                    email: user.email,
                    role: 'teacher',
                    is_active: true,
                    created_by: user.id // Self-created
                };

                await supabase
                    .from('staff')
                    .insert(staffData);
            }
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

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

export default router; 