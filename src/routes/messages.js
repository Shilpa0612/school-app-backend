import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Send message
router.post('/',
    authenticate,
    [
        body('content').notEmpty().trim(),
        body('type').isIn(['individual', 'group', 'announcement']),
        body('class_id').optional().isUUID(),
        body('recipient_id').optional().isUUID()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { content, type, class_id, recipient_id } = req.body;

            // Check if user has permission to send this type of message
            if (type === 'announcement' && !['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Unauthorized to send announcements'
                });
            }

            const messageData = {
                sender_id: req.user.id,
                content,
                type,
                status: ['admin', 'principal'].includes(req.user.role) ? 'approved' : 'pending'
            };

            if (class_id) messageData.class_id = class_id;
            if (recipient_id) messageData.recipient_id = recipient_id;

            const { data, error } = await supabase
                .from('messages')
                .insert([messageData])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { message: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get messages
router.get('/',
    authenticate,
    async (req, res, next) => {
        try {
            let query = supabase
                .from('messages')
                .select(`
                    *,
                    sender:sender_id (id, full_name, role),
                    recipient:recipient_id (id, full_name, role),
                    class:class_id (id, name, section)
                `);

            // Filter based on user role and query params
            if (req.user.role === 'teacher') {
                query = query.or(`class_id.eq.${req.query.class_id},recipient_id.eq.${req.user.id}`);
            } else if (req.user.role === 'parent') {
                query = query.or(`recipient_id.eq.${req.user.id},type.eq.announcement`);
            }

            if (req.query.status) {
                query = query.eq('status', req.query.status);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false });

            if (error) throw error;

            res.json({
                status: 'success',
                data: { messages: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Approve message
router.put('/:id/approve',
    authenticate,
    authorize('admin', 'principal'),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            const { data, error } = await supabase
                .from('messages')
                .update({
                    status: 'approved',
                    approved_by: req.user.id
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { message: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Reject message
router.put('/:id/reject',
    authenticate,
    authorize('admin', 'principal'),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            const { data, error } = await supabase
                .from('messages')
                .update({
                    status: 'rejected',
                    approved_by: req.user.id
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { message: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router; 