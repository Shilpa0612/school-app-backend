import bcrypt from 'bcryptjs';
import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Check if system admin exists
const checkSystemAdminExists = async () => {
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is the "no rows returned" error
        logger.error('Error checking system admin:', error);
        throw error;
    }

    return !!data;
};

// Register first system admin
router.post('/register-first-admin', [
    body('phone_number')
        .matches(/^[0-9]{10}$/)
        .withMessage('Phone number must be 10 digits'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('full_name')
        .trim()
        .notEmpty()
        .withMessage('Full name is required'),
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
], async (req, res, next) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                status: 'error',
                errors: errors.array()
            });
        }

        // Check if system admin already exists
        const adminExists = await checkSystemAdminExists();
        if (adminExists) {
            return res.status(403).json({
                status: 'error',
                message: 'System admin already exists. Please use the regular login.'
            });
        }

        const { phone_number, password, full_name, email } = req.body;

        // Check if phone number already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('phone_number', phone_number)
            .single();

        if (existingUser) {
            return res.status(400).json({
                status: 'error',
                message: 'Phone number already registered'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create system admin
        const { data: newAdmin, error } = await supabase
            .from('users')
            .insert([{
                phone_number,
                password_hash: hashedPassword,
                role: 'admin',
                full_name,
                email,
                preferred_language: 'english'
            }])
            .select()
            .single();

        if (error) {
            logger.error('Error creating system admin:', error);
            throw error;
        }

        // Log the successful creation
        logger.info('System admin created successfully', {
            admin_id: newAdmin.id,
            phone_number: newAdmin.phone_number
        });

        res.status(201).json({
            status: 'success',
            message: 'System admin created successfully. You can now log in.',
            data: {
                id: newAdmin.id,
                phone_number: newAdmin.phone_number,
                full_name: newAdmin.full_name,
                email: newAdmin.email,
                role: newAdmin.role
            }
        });

    } catch (error) {
        next(error);
    }
});

export default router; 