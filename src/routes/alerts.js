import express from 'express';
import { adminSupabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Create alert (draft)
router.post('/', authenticate, async (req, res) => {
    try {
        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can create alerts'
            });
        }

        const {
            title,
            content,
            alert_type,
            recipient_type,
            class_division_id
        } = req.body;

        // Validate required fields
        if (!title || !content || !alert_type || !recipient_type) {
            return res.status(400).json({
                status: 'error',
                message: 'Title, content, alert_type, and recipient_type are required'
            });
        }

        // Validate alert_type
        const validAlertTypes = ['urgent', 'important', 'general'];
        if (!validAlertTypes.includes(alert_type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid alert_type. Must be one of: urgent, important, general'
            });
        }

        // Validate recipient_type
        const validRecipientTypes = ['all', 'teachers', 'parents', 'students', 'specific_class'];
        if (!validRecipientTypes.includes(recipient_type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid recipient_type. Must be one of: all, teachers, parents, students, specific_class'
            });
        }

        // If recipient_type is 'specific_class', class_division_id is required
        if (recipient_type === 'specific_class' && !class_division_id) {
            return res.status(400).json({
                status: 'error',
                message: 'class_division_id is required when recipient_type is "specific_class"'
            });
        }

        const alertData = {
            title,
            content,
            alert_type,
            status: 'approved', // Auto-approve since only principals/admins can create
            approved_by: req.user.id,
            approved_at: new Date().toISOString(),
            sender_id: req.user.id
        };

        const { data: alert, error } = await adminSupabase
            .from('alerts')
            .insert(alertData)
            .select()
            .single();

        if (error) {
            console.error('Error creating alert:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create alert'
            });
        }

        // Create alert recipient record
        const recipientData = {
            alert_id: alert.id,
            recipient_type,
            class_division_id: recipient_type === 'specific_class' ? class_division_id : null
        };

        const { data: recipient, error: recipientError } = await adminSupabase
            .from('alert_recipients')
            .insert(recipientData)
            .select()
            .single();

        if (recipientError) {
            console.error('Error creating alert recipient:', recipientError);
            // Note: We don't fail here as the alert was created successfully
        }

        res.status(201).json({
            status: 'success',
            data: {
                message: 'Alert created successfully',
                alert: alert
            }
        });

    } catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// List alerts
router.get('/', authenticate, async (req, res) => {
    try {
        const {
            status,
            alert_type,
            priority,
            recipient_type,
            page = 1,
            limit = 10
        } = req.query;

        // Build query
        let query = adminSupabase
            .from('alerts')
            .select('*', { count: 'exact' });

        // Apply filters
        if (status) {
            query = query.eq('status', status);
        }
        if (alert_type) {
            query = query.eq('alert_type', alert_type);
        }
        if (priority) {
            query = query.eq('priority', priority);
        }
        if (recipient_type) {
            query = query.eq('recipient_type', recipient_type);
        }

        // Apply pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        // Order by created_at desc
        query = query.order('created_at', { ascending: false });

        const { data: alerts, error, count } = await query;

        if (error) {
            console.error('Error fetching alerts:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch alerts'
            });
        }

        res.json({
            status: 'success',
            data: {
                alerts: alerts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    total_pages: Math.ceil(count / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});



// Reject alert
router.put('/:id/reject', authenticate, async (req, res) => {
    try {
        // Check if user is principal
        if (req.user.role !== 'principal') {
            return res.status(403).json({
                status: 'error',
                message: 'Only principal can reject alerts'
            });
        }

        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({
                status: 'error',
                message: 'Rejection reason is required'
            });
        }

        // Get alert
        const { data: alert, error: fetchError } = await adminSupabase
            .from('alerts')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !alert) {
            return res.status(404).json({
                status: 'error',
                message: 'Alert not found'
            });
        }

        if (alert.status !== 'draft') {
            return res.status(400).json({
                status: 'error',
                message: 'Only draft alerts can be rejected'
            });
        }

        // Update alert status
        const { data: updatedAlert, error } = await adminSupabase
            .from('alerts')
            .update({
                status: 'rejected',
                rejected_by: req.user.id,
                rejected_at: new Date().toISOString(),
                rejection_reason: reason
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error rejecting alert:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to reject alert'
            });
        }

        res.json({
            status: 'success',
            data: {
                message: 'Alert rejected successfully',
                alert: updatedAlert
            }
        });

    } catch (error) {
        console.error('Error rejecting alert:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Send alert
router.put('/:id/send', authenticate, async (req, res) => {
    try {
        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can send alerts'
            });
        }

        const { id } = req.params;

        // Get alert
        const { data: alert, error: fetchError } = await adminSupabase
            .from('alerts')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !alert) {
            return res.status(404).json({
                status: 'error',
                message: 'Alert not found'
            });
        }

        if (alert.status !== 'approved') {
            return res.status(400).json({
                status: 'error',
                message: 'Only approved alerts can be sent'
            });
        }

        // Update alert status
        const { data: updatedAlert, error } = await adminSupabase
            .from('alerts')
            .update({
                status: 'sent',
                sent_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error sending alert:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to send alert'
            });
        }



        res.json({
            status: 'success',
            data: {
                message: 'Alert sent successfully',
                alert: updatedAlert
            }
        });

    } catch (error) {
        console.error('Error sending alert:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get alert by ID
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: alert, error } = await adminSupabase
            .from('alerts')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !alert) {
            return res.status(404).json({
                status: 'error',
                message: 'Alert not found'
            });
        }

        res.json({
            status: 'success',
            data: {
                alert: alert
            }
        });

    } catch (error) {
        console.error('Error fetching alert:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Delete alert
router.delete('/:id', authenticate, async (req, res) => {
    try {
        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can delete alerts'
            });
        }

        const { id } = req.params;

        // Get alert
        const { data: alert, error: fetchError } = await adminSupabase
            .from('alerts')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !alert) {
            return res.status(404).json({
                status: 'error',
                message: 'Alert not found'
            });
        }

        // Only allow deletion of approved alerts (before sending)
        if (alert.status !== 'approved') {
            return res.status(400).json({
                status: 'error',
                message: 'Only approved alerts can be deleted'
            });
        }

        // Delete alert
        const { error } = await adminSupabase
            .from('alerts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting alert:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to delete alert'
            });
        }

        res.json({
            status: 'success',
            data: {
                message: 'Alert deleted successfully'
            }
        });

    } catch (error) {
        console.error('Error deleting alert:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

export default router;