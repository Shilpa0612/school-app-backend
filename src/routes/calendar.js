import express from 'express';
import { body, validationResult } from 'express-validator';
import { supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Create event
router.post('/events',
    authenticate,
    authorize('admin', 'principal'),
    [
        body('title').notEmpty().trim(),
        body('description').notEmpty().trim(),
        body('event_date').isISO8601().toDate()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { title, description, event_date } = req.body;

            const { data, error } = await supabase
                .from('calendar_events')
                .insert([{
                    title,
                    description,
                    event_date,
                    created_by: req.user.id
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { event: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get events
router.get('/events',
    authenticate,
    async (req, res, next) => {
        try {
            let query = supabase
                .from('calendar_events')
                .select(`
                    *,
                    creator:created_by (id, full_name, role)
                `);

            // Apply date range filter if provided
            if (req.query.start_date) {
                query = query.gte('event_date', req.query.start_date);
            }
            if (req.query.end_date) {
                query = query.lte('event_date', req.query.end_date);
            }

            const { data, error } = await query
                .order('event_date', { ascending: true });

            if (error) throw error;

            res.json({
                status: 'success',
                data: { events: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Delete event
router.delete('/events/:id',
    authenticate,
    authorize('admin', 'principal'),
    async (req, res, next) => {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({
                status: 'success',
                message: 'Event deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

export default router; 