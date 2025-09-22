import express from 'express';
import { authenticate } from '../middleware/auth.js';
import websocketService from '../services/websocketService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * @route GET /api/notifications/stream
 * @desc Get WebSocket connection for real-time notifications
 * @access Authenticated users only
 */
router.get('/stream', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Check if user is authorized to receive notifications
        if (!['parent', 'teacher', 'principal', 'admin'].includes(userRole)) {
            return res.status(403).json({
                status: 'error',
                message: 'Unauthorized access to notification stream'
            });
        }

        // Get WebSocket URL with authentication token
        const wsUrl = `${req.protocol === 'https' ? 'wss' : 'ws'}://${req.get('host')}/notifications/ws?token=${req.headers.authorization.split(' ')[1]}`;

        res.json({
            status: 'success',
            data: {
                websocket_url: wsUrl,
                user_id: userId,
                user_role: userRole,
                connection_info: {
                    endpoint: '/notifications/ws',
                    auth_method: 'token',
                    message_types: getMessageTypesForRole(userRole),
                    heartbeat_interval: '30 seconds'
                }
            }
        });

    } catch (error) {
        logger.error('Error in GET /api/notifications/stream:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * Get message types available for different user roles
 */
function getMessageTypesForRole(role) {
    const messageTypes = {
        parent: [
            'notification',
            'announcement',
            'event',
            'homework',
            'classwork',
            'message',
            'attendance',
            'birthday',
            'system'
        ],
        teacher: [
            'notification',
            'announcement',
            'event',
            'homework',
            'classwork',
            'message',
            'system',
            'approval_request'
        ],
        principal: [
            'notification',
            'announcement',
            'event',
            'homework',
            'classwork',
            'message',
            'system',
            'approval_request',
            'admin_alert'
        ],
        admin: [
            'notification',
            'announcement',
            'event',
            'homework',
            'classwork',
            'message',
            'system',
            'approval_request',
            'admin_alert',
            'system_maintenance'
        ]
    };

    return messageTypes[role] || ['notification'];
}

/**
 * @route GET /api/notifications/stream/status
 * @desc Get current WebSocket connection status
 * @access Authenticated users only
 */
router.get('/stream/status', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const isConnected = websocketService.isUserConnected(userId);

        res.json({
            status: 'success',
            data: {
                user_id: userId,
                is_connected: isConnected,
                connection_type: 'notification_stream',
                last_seen: isConnected ? new Date().toISOString() : null,
                available_endpoints: {
                    websocket: '/notifications/ws',
                    rest_api: '/api/notifications',
                    health_check: '/api/notifications/stream/health'
                }
            }
        });

    } catch (error) {
        logger.error('Error in GET /api/notifications/stream/status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

/**
 * @route GET /api/notifications/stream/health
 * @desc Health check for notification streaming service
 * @access Authenticated users only
 */
router.get('/stream/health', authenticate, (req, res) => {
    try {
        const userId = req.user.id;
        const isConnected = websocketService.isUserConnected(userId);
        const totalConnections = websocketService.getConnectionCount();

        res.json({
            status: 'success',
            data: {
                service: 'notification_stream',
                user_connected: isConnected,
                total_connections: totalConnections,
                timestamp: new Date().toISOString(),
                health: 'healthy'
            }
        });

    } catch (error) {
        logger.error('Error in GET /api/notifications/stream/health:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

export default router;
