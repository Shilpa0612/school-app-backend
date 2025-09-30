import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import parentTopicService from '../services/parentTopicService.js';
import pushNotificationService from '../services/pushNotificationService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @route POST /api/device-tokens/register
 * @desc Register device token for push notifications
 * @access Authenticated users only
 */
router.post('/register',
    authenticate,
    [
        body('device_token').notEmpty().withMessage('Device token is required'),
        body('platform').isIn(['android', 'ios', 'web']).withMessage('Platform must be android, ios, or web'),
        body('device_info').optional().isObject().withMessage('Device info must be an object')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { device_token, platform, device_info = {} } = req.body;

            const result = await pushNotificationService.registerDeviceToken(
                req.user.id,
                device_token,
                platform,
                device_info
            );

            if (!result.success) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to register device token',
                    error: result.error
                });
            }

            // Auto-subscribe parents to relevant topics
            let topicSubscriptionResult = null;
            if (req.user.role === 'parent') {
                try {
                    if (parentTopicService?.autoSubscribeParentDevice) {
                        topicSubscriptionResult = await parentTopicService.autoSubscribeParentDevice(
                            req.user.id,
                            device_token
                        );
                        logger.info(`Auto-subscribed parent ${req.user.id} to topics:`, {
                            success: topicSubscriptionResult?.success === true,
                            subscribedTopics: topicSubscriptionResult?.subscribedTopics?.length || 0
                        });
                    } else {
                        logger.info('parentTopicService missing autoSubscribeParentDevice; skipping');
                    }
                } catch (error) {
                    // Downgrade to warn and do not include verbose error to avoid noisy logs
                    logger.warn('Parent topic auto-subscribe skipped due to configuration/data issue:', {
                        message: error?.message,
                        code: error?.code
                    });
                    // Do NOT fail registration; continue gracefully
                }
            }

            const responseData = {
                device_id: result.deviceId
            };
            if (topicSubscriptionResult?.success) {
                responseData.topic_subscription = {
                    subscribed_topics: topicSubscriptionResult.subscribedTopics?.length || 0,
                    total_topics: topicSubscriptionResult.totalTopics || 0,
                    successful_subscriptions: topicSubscriptionResult.successfulSubscriptions || 0,
                    failed_subscriptions: topicSubscriptionResult.failedSubscriptions || 0
                };
            }

            res.json({
                status: 'success',
                message: 'Device token registered successfully',
                data: responseData
            });

        } catch (error) {
            logger.error('Error in POST /api/device-tokens/register:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route DELETE /api/device-tokens/unregister
 * @desc Unregister device token
 * @access Authenticated users only
 */
router.delete('/unregister',
    authenticate,
    [
        body('device_token').notEmpty().withMessage('Device token is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { device_token } = req.body;

            const result = await pushNotificationService.unregisterDeviceToken(
                req.user.id,
                device_token
            );

            if (!result.success) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to unregister device token',
                    error: result.error
                });
            }

            res.json({
                status: 'success',
                message: 'Device token unregistered successfully'
            });

        } catch (error) {
            logger.error('Error in DELETE /api/device-tokens/unregister:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route GET /api/device-tokens/my-tokens
 * @desc Get user's registered device tokens
 * @access Authenticated users only
 */
/**
 * @route GET /api/device-tokens/available-topics
 * @desc Get available topics for the authenticated user
 * @access Authenticated users only
 */
router.get('/available-topics', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'Only parents can view available topics'
            });
        }

        const result = await parentTopicService.getAvailableTopics(req.user.id);

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get available topics',
                error: result.error
            });
        }

        res.json({
            status: 'success',
            data: {
                all_topics: result.allTopics,
                categorized_topics: result.categorizedTopics,
                total_topics: result.totalTopics,
                topic_categories: {
                    school_wide: 'School-wide announcements and events',
                    class_specific: 'Class-specific notifications (homework, classwork, messages)',
                    student_specific: 'Student-specific notifications (attendance, birthday, personal messages)'
                }
            }
        });

    } catch (error) {
        logger.error('Error in GET /api/device-tokens/available-topics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

router.get('/my-tokens', authenticate, async (req, res) => {
    try {
        const { adminSupabase } = await import('../config/supabase.js');

        const { data: tokens, error } = await adminSupabase
            .from('user_device_tokens')
            .select('id, device_token, platform, device_info, is_active, last_used, created_at')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Error fetching device tokens:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch device tokens',
                error: error.message
            });
        }

        res.json({
            status: 'success',
            data: tokens
        });

    } catch (error) {
        logger.error('Error in GET /api/device-tokens/my-tokens:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * @route POST /api/device-tokens/subscribe-topic
 * @desc Subscribe device to a topic
 * @access Authenticated users only
 */
router.post('/subscribe-topic',
    authenticate,
    [
        body('device_token').notEmpty().withMessage('Device token is required'),
        body('topic').notEmpty().withMessage('Topic is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { device_token, topic } = req.body;

            const result = await pushNotificationService.subscribeToTopic(device_token, topic);

            if (!result.success) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to subscribe to topic',
                    error: result.error
                });
            }

            res.json({
                status: 'success',
                message: `Successfully subscribed to topic: ${topic}`
            });

        } catch (error) {
            logger.error('Error in POST /api/device-tokens/subscribe-topic:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route POST /api/device-tokens/unsubscribe-topic
 * @desc Unsubscribe device from a topic
 * @access Authenticated users only
 */
router.post('/unsubscribe-topic',
    authenticate,
    [
        body('device_token').notEmpty().withMessage('Device token is required'),
        body('topic').notEmpty().withMessage('Topic is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { device_token, topic } = req.body;

            const result = await pushNotificationService.unsubscribeFromTopic(device_token, topic);

            if (!result.success) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to unsubscribe from topic',
                    error: result.error
                });
            }

            res.json({
                status: 'success',
                message: `Successfully unsubscribed from topic: ${topic}`
            });

        } catch (error) {
            logger.error('Error in POST /api/device-tokens/unsubscribe-topic:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route POST /api/device-tokens/test
 * @desc Send test push notification
 * @access Authenticated users only
 */
router.post('/test',
    authenticate,
    [
        body('title').notEmpty().withMessage('Title is required'),
        body('message').notEmpty().withMessage('Message is required')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { title, message } = req.body;

            const testNotification = {
                id: 'test-' + Date.now(),
                type: 'system',
                title,
                message,
                priority: 'normal',
                created_at: new Date().toISOString()
            };

            const result = await pushNotificationService.sendToUser(
                req.user.id,
                testNotification
            );

            if (!result.success) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to send test notification',
                    error: result.error
                });
            }

            res.json({
                status: 'success',
                message: 'Test notification sent successfully',
                data: {
                    sent: result.sent,
                    failed: result.failed
                }
            });

        } catch (error) {
            logger.error('Error in POST /api/device-tokens/test:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

export default router;
