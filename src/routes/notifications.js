import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import notificationService from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @route GET /api/notifications
 * @desc Get notifications for the authenticated parent
 * @access Parent only
 */
router.get('/', authenticate, authorize(['parent']), async (req, res) => {
    try {
        const {
            student_id,
            type,
            is_read,
            priority,
            limit = 50,
            offset = 0
        } = req.query;

        const result = await notificationService.getParentNotifications({
            parentId: req.user.id,
            studentId: student_id || null,
            type: type || null,
            isRead: is_read !== undefined ? is_read === 'true' : null,
            priority: priority || null,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch notifications',
                error: result.error
            });
        }

        res.json({
            status: 'success',
            data: result.notifications,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                count: result.notifications.length
            }
        });

    } catch (error) {
        logger.error('Error in GET /api/notifications:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * @route GET /api/notifications/unread-count
 * @desc Get unread notification count for the authenticated parent
 * @access Parent only
 */
router.get('/unread-count', authenticate, authorize(['parent']), async (req, res) => {
    try {
        const { student_id } = req.query;

        const result = await notificationService.getUnreadCount(
            req.user.id,
            student_id || null
        );

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get unread count',
                error: result.error
            });
        }

        res.json({
            status: 'success',
            data: {
                unread_count: result.count
            }
        });

    } catch (error) {
        logger.error('Error in GET /api/notifications/unread-count:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark a specific notification as read
 * @access Parent only
 */
router.put('/:id/read', authenticate, authorize(['parent']), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await notificationService.markNotificationAsRead(id, req.user.id);

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to mark notification as read',
                error: result.error
            });
        }

        res.json({
            status: 'success',
            message: 'Notification marked as read',
            data: result.notification
        });

    } catch (error) {
        logger.error('Error in PUT /api/notifications/:id/read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * @route PUT /api/notifications/mark-all-read
 * @desc Mark all notifications as read for the authenticated parent
 * @access Parent only
 */
router.put('/mark-all-read', authenticate, authorize(['parent']), async (req, res) => {
    try {
        const { student_id } = req.body;

        const result = await notificationService.markAllNotificationsAsRead(
            req.user.id,
            student_id || null
        );

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to mark all notifications as read',
                error: result.error
            });
        }

        res.json({
            status: 'success',
            message: 'All notifications marked as read',
            data: {
                updated_count: result.updatedCount
            }
        });

    } catch (error) {
        logger.error('Error in PUT /api/notifications/mark-all-read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * @route GET /api/notifications/stats
 * @desc Get notification statistics for the authenticated parent
 * @access Parent only
 */
router.get('/stats', authenticate, authorize(['parent']), async (req, res) => {
    try {
        const result = await notificationService.getNotificationStats(req.user.id);

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get notification statistics',
                error: result.error
            });
        }

        res.json({
            status: 'success',
            data: result.stats
        });

    } catch (error) {
        logger.error('Error in GET /api/notifications/stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete a specific notification
 * @access Parent only
 */
router.delete('/:id', authenticate, authorize(['parent']), async (req, res) => {
    try {
        const { id } = req.params;

        // Import adminSupabase for direct deletion
        const { adminSupabase } = await import('../config/supabase.js');

        const { error } = await adminSupabase
            .from('parent_notifications')
            .delete()
            .eq('id', id)
            .eq('parent_id', req.user.userId);

        if (error) {
            logger.error('Error deleting notification:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to delete notification',
                error: error.message
            });
        }

        res.json({
            status: 'success',
            message: 'Notification deleted successfully'
        });

    } catch (error) {
        logger.error('Error in DELETE /api/notifications/:id:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * @route GET /api/notifications/types
 * @desc Get available notification types
 * @access Public
 */
router.get('/types', (req, res) => {
    res.json({
        status: 'success',
        data: {
            types: Object.values(notificationService.notificationTypes),
            priorities: Object.values(notificationService.priorityLevels)
        }
    });
});

export default router;
