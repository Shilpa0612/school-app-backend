import admin from 'firebase-admin';
import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Enhanced Background Notification Service
 * Optimized for notifications that work when app is closed
 */
class BackgroundNotificationService {
    constructor() {
        this.messaging = null;
        this.initializeFirebase();
    }

    initializeFirebase() {
        try {
            if (!admin.apps.length) {
                const serviceAccount = {
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                };

                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID,
                });
            }

            this.messaging = admin.messaging();
            logger.info('Background Notification Service initialized');
        } catch (error) {
            logger.error('Failed to initialize Firebase:', error);
            throw error;
        }
    }

    /**
     * Send background notification with optimized payload
     */
    async sendBackgroundNotification(userId, notificationData) {
        try {
            // Get user's device tokens
            const { data: deviceTokens, error } = await adminSupabase
                .from('user_device_tokens')
                .select('device_token, platform')
                .eq('user_id', userId)
                .eq('is_active', true);

            if (error) {
                logger.error('Error fetching device tokens:', error);
                return { success: false, error: error.message };
            }

            if (!deviceTokens || deviceTokens.length === 0) {
                logger.warn(`No device tokens found for user ${userId}`);
                return { success: false, error: 'No device tokens found' };
            }

            logger.info(`Sending background notification to ${deviceTokens.length} devices for user ${userId}`);

            // Send to all devices
            const results = await Promise.allSettled(
                deviceTokens.map(device => this.sendToDevice(device.device_token, notificationData, device.platform))
            );

            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;

            logger.info(`Background notification sent: ${successful} successful, ${failed} failed`);

            return {
                success: successful > 0,
                sent: successful,
                failed: failed,
                results: results
            };

        } catch (error) {
            logger.error('Error sending background notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notification to a specific device with background-optimized payload
     */
    async sendToDevice(deviceToken, notificationData, platform = 'android') {
        try {
            const message = {
                token: deviceToken,
                notification: {
                    title: notificationData.title,
                    body: notificationData.message
                },
                data: {
                    type: notificationData.type || 'general',
                    id: notificationData.id || '',
                    priority: notificationData.priority || 'normal',
                    created_at: notificationData.created_at || new Date().toISOString(),
                    // Add background processing flags
                    background: 'true',
                    timestamp: Date.now().toString()
                },
                // Android specific configuration for background notifications
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'school_notifications',
                        priority: 'high',
                        defaultSound: true,
                        defaultVibrateTimings: true,
                        icon: 'ic_notification',
                        color: this.getPriorityColor(notificationData.priority),
                        // Critical for background notifications
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                        tag: notificationData.id || 'default',
                        visibility: 'public',
                        localOnly: false,
                        // Ensure notification shows even when app is closed
                        sticky: true,
                        ongoing: false
                    },
                    // Data-only message for background processing
                    data: {
                        type: notificationData.type || 'general',
                        id: notificationData.id || '',
                        priority: notificationData.priority || 'normal',
                        created_at: notificationData.created_at || new Date().toISOString(),
                        background: 'true',
                        timestamp: Date.now().toString()
                    }
                },
                // iOS specific configuration
                apns: {
                    payload: {
                        aps: {
                            alert: {
                                title: notificationData.title,
                                body: notificationData.message
                            },
                            sound: 'default',
                            badge: 1,
                            // Critical for background notifications
                            'content-available': 1,
                            'mutable-content': 1,
                            // Ensure notification shows
                            'alert-type': 'banner',
                            'interruption-level': 'active'
                        }
                    }
                },
                // Web push configuration
                webpush: {
                    notification: {
                        title: notificationData.title,
                        body: notificationData.message,
                        icon: '/icon-192x192.png',
                        badge: '/badge-72x72.png',
                        requireInteraction: true,
                        actions: [
                            {
                                action: 'view',
                                title: 'View'
                            },
                            {
                                action: 'dismiss',
                                title: 'Dismiss'
                            }
                        ]
                    }
                }
            };

            const response = await this.messaging.send(message);
            logger.info(`Background notification sent successfully: ${response}`);
            
            return {
                success: true,
                messageId: response,
                deviceToken: deviceToken.substring(0, 20) + '...'
            };

        } catch (error) {
            logger.error('Failed to send background notification:', {
                error: error.message,
                code: error.code,
                deviceToken: deviceToken.substring(0, 20) + '...'
            });

            // Handle specific error cases
            if (error.code === 'messaging/invalid-registration-token' || 
                error.code === 'messaging/registration-token-not-registered') {
                // Remove invalid token from database
                await this.removeInvalidToken(deviceToken);
                return {
                    success: false,
                    error: 'Invalid token - removed from database',
                    code: error.code
                };
            }

            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Send data-only message for background processing
     */
    async sendDataOnlyMessage(deviceToken, data) {
        try {
            const message = {
                token: deviceToken,
                data: {
                    type: data.type || 'data_only',
                    timestamp: Date.now().toString(),
                    ...data
                },
                android: {
                    priority: 'high',
                    data: {
                        type: data.type || 'data_only',
                        timestamp: Date.now().toString(),
                        ...data
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            'content-available': 1
                        }
                    }
                }
            };

            const response = await this.messaging.send(message);
            logger.info(`Data-only message sent successfully: ${response}`);
            
            return {
                success: true,
                messageId: response
            };

        } catch (error) {
            logger.error('Failed to send data-only message:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Remove invalid device token from database
     */
    async removeInvalidToken(deviceToken) {
        try {
            const { error } = await adminSupabase
                .from('user_device_tokens')
                .delete()
                .eq('device_token', deviceToken);

            if (error) {
                logger.error('Failed to remove invalid token:', error);
            } else {
                logger.info('Invalid token removed from database:', deviceToken.substring(0, 20) + '...');
            }
        } catch (error) {
            logger.error('Error removing invalid token:', error);
        }
    }

    /**
     * Get priority color for Android notifications
     */
    getPriorityColor(priority) {
        const colors = {
            'urgent': '#FF0000',    // Red
            'high': '#FF6B35',      // Orange
            'normal': '#0080FF',    // Blue
            'low': '#808080'        // Gray
        };
        return colors[priority] || colors['normal'];
    }

    /**
     * Test background notification with user's actual device tokens
     */
    async testBackgroundNotification(userId) {
        const testNotification = {
            id: 'background_test_' + Date.now(),
            type: 'test',
            title: 'Background Test Notification',
            message: 'This notification should appear even when the app is closed',
            priority: 'high',
            created_at: new Date().toISOString()
        };

        return await this.sendBackgroundNotification(userId, testNotification);
    }
}

// Export singleton instance
export default new BackgroundNotificationService();
