import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// List feedback categories
router.get('/categories', authenticate, async (req, res) => {
    try {
        const { data: categories, error } = await supabase
            .from('feedback_categories')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (error) {
            logger.error('Error fetching feedback categories:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch feedback categories'
            });
        }

        res.json({
            status: 'success',
            data: categories
        });

    } catch (error) {
        logger.error('Error in list feedback categories:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// List feedback submissions
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, priority, feedback_type, category_id } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('feedback_submissions')
            .select(`
                *,
                category:feedback_categories(name),
                submitter:users(full_name, role),
                responses:feedback_responses(
                    *,
                    responder:users(full_name, role)
                )
            `)
            .order('created_at', { ascending: false });

        // Apply filters
        if (status) {
            query = query.eq('status', status);
        }

        if (priority) {
            query = query.eq('priority', priority);
        }

        if (feedback_type) {
            query = query.eq('feedback_type', feedback_type);
        }

        if (category_id) {
            query = query.eq('category_id', category_id);
        }

        // Role-based filtering
        if (req.user.role !== 'admin' && req.user.role !== 'principal') {
            // Users can only see their own submissions
            query = query.eq('submitter_id', req.user.id);
        }

        // Get total count
        const { count, error: countError } = await query.count();
        
        if (countError) {
            logger.error('Error getting feedback count:', countError);
        }

        // Get paginated results
        const { data: submissions, error } = await query
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching feedback submissions:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch feedback submissions'
            });
        }

        res.json({
            status: 'success',
            data: {
                submissions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in list feedback:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Create feedback submission
router.post('/', authenticate, async (req, res) => {
    try {
        const { 
            category_id, title, content, feedback_type, priority, 
            is_anonymous, contact_preference 
        } = req.body;

        // Validate required fields
        if (!title || !content || !feedback_type) {
            return res.status(400).json({
                status: 'error',
                message: 'Title, content, and feedback type are required'
            });
        }

        // Validate feedback type
        if (!['suggestion', 'complaint', 'appreciation', 'question'].includes(feedback_type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid feedback type'
            });
        }

        // Validate priority
        if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid priority level'
            });
        }

        // Validate contact preference
        if (contact_preference && !['email', 'phone', 'in_app', 'none'].includes(contact_preference)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid contact preference'
            });
        }

        const { data: submission, error } = await supabase
            .from('feedback_submissions')
            .insert({
                category_id,
                submitter_id: req.user.id,
                title,
                content,
                feedback_type,
                priority: priority || 'medium',
                is_anonymous: is_anonymous || false,
                contact_preference: contact_preference || 'none'
            })
            .select(`
                *,
                category:feedback_categories(name),
                submitter:users(full_name, role)
            `)
            .single();

        if (error) {
            logger.error('Error creating feedback submission:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create feedback submission'
            });
        }

        res.status(201).json({
            status: 'success',
            data: submission
        });

    } catch (error) {
        logger.error('Error in create feedback:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get single feedback submission
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: submission, error } = await supabase
            .from('feedback_submissions')
            .select(`
                *,
                category:feedback_categories(name),
                submitter:users(full_name, role),
                responses:feedback_responses(
                    *,
                    responder:users(full_name, role)
                ),
                attachments:feedback_attachments(*),
                status_history:feedback_status_history(
                    *,
                    changed_by_user:users(full_name, role)
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Feedback submission not found'
                });
            }
            logger.error('Error fetching feedback submission:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch feedback submission'
            });
        }

        // Check permissions
        if (req.user.role !== 'admin' && req.user.role !== 'principal' && submission.submitter_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        res.json({
            status: 'success',
            data: submission
        });

    } catch (error) {
        logger.error('Error in get feedback:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update feedback status (admin/principal only)
router.put('/:id/status', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can update feedback status'
            });
        }

        // Validate status
        if (!['pending', 'under_review', 'in_progress', 'resolved', 'closed'].includes(status)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid status'
            });
        }

        // Get current status
        const { data: currentSubmission, error: fetchError } = await supabase
            .from('feedback_submissions')
            .select('status')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Feedback submission not found'
                });
            }
            logger.error('Error fetching feedback submission:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch feedback submission'
            });
        }

        // Update status
        const { data: updatedSubmission, error: updateError } = await supabase
            .from('feedback_submissions')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            logger.error('Error updating feedback status:', updateError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update feedback status'
            });
        }

        // Create status history record
        const { error: historyError } = await supabase
            .from('feedback_status_history')
            .insert({
                feedback_id: id,
                old_status: currentSubmission.status,
                new_status: status,
                changed_by: req.user.id,
                reason
            });

        if (historyError) {
            logger.error('Error creating status history:', historyError);
            // Don't fail the request, just log the error
        }

        res.json({
            status: 'success',
            data: updatedSubmission
        });

    } catch (error) {
        logger.error('Error in update feedback status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Add response to feedback
router.post('/:id/responses', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { content, is_internal = false } = req.body;

        // Check permissions (only admins and principals can respond)
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can respond to feedback'
            });
        }

        // Validate required fields
        if (!content) {
            return res.status(400).json({
                status: 'error',
                message: 'Response content is required'
            });
        }

        // Check if feedback exists
        const { data: feedback, error: fetchError } = await supabase
            .from('feedback_submissions')
            .select('id')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Feedback submission not found'
                });
            }
            logger.error('Error fetching feedback:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch feedback'
            });
        }

        // Create response
        const { data: response, error } = await supabase
            .from('feedback_responses')
            .insert({
                feedback_id: id,
                responder_id: req.user.id,
                content,
                is_internal
            })
            .select(`
                *,
                responder:users(full_name, role)
            `)
            .single();

        if (error) {
            logger.error('Error creating response:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create response'
            });
        }

        res.status(201).json({
            status: 'success',
            data: response
        });

    } catch (error) {
        logger.error('Error in add response:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update feedback submission (only submitter can update)
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Get the feedback submission
        const { data: submission, error: fetchError } = await supabase
            .from('feedback_submissions')
            .select('submitter_id, status')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Feedback submission not found'
                });
            }
            logger.error('Error fetching feedback:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch feedback'
            });
        }

        // Check permissions
        if (submission.submitter_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only update your own feedback submissions'
            });
        }

        // Check if feedback can be updated (not resolved or closed)
        if (submission.status === 'resolved' || submission.status === 'closed') {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot update resolved or closed feedback'
            });
        }

        // Remove fields that shouldn't be updated
        delete updateData.status;
        delete updateData.submitter_id;
        delete updateData.created_at;

        const { data: updatedSubmission, error } = await supabase
            .from('feedback_submissions')
            .update(updateData)
            .eq('id', id)
            .select(`
                *,
                category:feedback_categories(name),
                submitter:users(full_name, role)
            `)
            .single();

        if (error) {
            logger.error('Error updating feedback:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update feedback'
            });
        }

        res.json({
            status: 'success',
            data: updatedSubmission
        });

    } catch (error) {
        logger.error('Error in update feedback:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Delete feedback submission (only submitter can delete)
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Get the feedback submission
        const { data: submission, error: fetchError } = await supabase
            .from('feedback_submissions')
            .select('submitter_id, status')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Feedback submission not found'
                });
            }
            logger.error('Error fetching feedback:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch feedback'
            });
        }

        // Check permissions
        if (submission.submitter_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only delete your own feedback submissions'
            });
        }

        // Check if feedback can be deleted (not resolved or closed)
        if (submission.status === 'resolved' || submission.status === 'closed') {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot delete resolved or closed feedback'
            });
        }

        const { error } = await supabase
            .from('feedback_submissions')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Error deleting feedback:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to delete feedback'
            });
        }

        res.json({
            status: 'success',
            message: 'Feedback submission deleted successfully'
        });

    } catch (error) {
        logger.error('Error in delete feedback:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

export default router; 