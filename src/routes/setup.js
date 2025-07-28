import bcrypt from 'bcryptjs';
import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Check if setup is completed
const checkSetupStatus = async () => {
    const { data: schoolData, error: schoolError } = await supabase
        .from('school_details')
        .select('id')
        .single();

    if (schoolError && schoolError.code !== 'PGRST116') {
        throw schoolError;
    }

    const { data: adminData, error: adminError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .single();

    if (adminError && adminError.code !== 'PGRST116') {
        throw adminError;
    }

    return !!schoolData || !!adminData;
};

// Initial setup route
router.post('/initial-setup', [
    // Admin validation
    body('admin.phone_number').matches(/^[0-9]{10}$/).withMessage('Phone number must be 10 digits'),
    body('admin.password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('admin.full_name').trim().notEmpty().withMessage('Admin name is required'),
    body('admin.email').isEmail().withMessage('Valid email is required'),

    // School validation
    body('school.name').trim().notEmpty().withMessage('School name is required'),
    body('school.address').trim().notEmpty().withMessage('School address is required'),
    body('school.contact_number').matches(/^[0-9]{10}$/).withMessage('Contact number must be 10 digits'),
    body('school.email').isEmail().withMessage('Valid school email is required'),
    body('school.board').trim().notEmpty().withMessage('School board is required')
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

        // Check if setup is already completed
        const isSetupCompleted = await checkSetupStatus();
        if (isSetupCompleted) {
            return res.status(403).json({
                status: 'error',
                message: 'Setup has already been completed'
            });
        }

        const { admin, school } = req.body;

        // Start a Supabase transaction
        const { data: setupData, error: setupError } = await supabase.rpc('setup_school', {
            admin_data: {
                phone_number: admin.phone_number,
                password_hash: await bcrypt.hash(admin.password, 10),
                full_name: admin.full_name,
                email: admin.email,
                role: 'admin'
            },
            school_data: {
                name: school.name,
                address: school.address,
                contact_number: school.contact_number,
                email: school.email,
                board: school.board
            }
        });

        if (setupError) {
            logger.error('Setup error:', setupError);
            throw setupError;
        }

        res.status(201).json({
            status: 'success',
            message: 'School setup completed successfully',
            data: {
                school: {
                    name: school.name,
                    email: school.email
                },
                admin: {
                    phone_number: admin.phone_number,
                    email: admin.email
                }
            }
        });

    } catch (error) {
        next(error);
    }
});

// Get setup status
router.get('/status', async (req, res, next) => {
    try {
        const isSetupCompleted = await checkSetupStatus();
        res.json({
            status: 'success',
            data: {
                isSetupCompleted
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router; 