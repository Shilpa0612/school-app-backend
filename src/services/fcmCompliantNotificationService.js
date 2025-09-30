import admin from 'firebase-admin';
import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * FCM Compliant Notification Service
 * Follows Firebase Cloud Messaging documentation exactly
 */
class FCMCompliantNotificationService {
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
            logger.info('FCM Compliant Notification Service initialized');
        } catch (error) {
            logger.error('Failed to initialize Firebase:', error);
            throw error;
        }
    }

    /**
     * Send notification message (displayed automatically by system)
     * According to FCM documentation: https://firebase.google.com/docs/cloud-messaging?authuser=0
     */
    async sendNotificationMessage(userId, notificationData) {
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

            logger.info(`Sending notification message to ${deviceTokens.length} devices for user ${userId}`);

            // Send to all devices
            const results = await Promise.allSettled(
                deviceTokens.map(device => this.sendNotificationToDevice(device.device_token, notificationData, device.platform))
            );

            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;

            logger.info(`Notification message sent: ${successful} successful, ${failed} failed`);

            return {
                success: successful > 0,
                sent: successful,
                failed: failed,
                results: results
            };

        } catch (error) {
            logger.error('Error sending notification message:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send data message (handled by app code)
     * According to FCM documentation for background processing
     */
    async sendDataMessage(userId, data) {
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

            logger.info(`Sending data message to ${deviceTokens.length} devices for user ${userId}`);

            // Send to all devices
            const results = await Promise.allSettled(
                deviceTokens.map(device => this.sendDataToDevice(device.device_token, data, device.platform))
            );

            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;

            logger.info(`Data message sent: ${successful} successful, ${failed} failed`);

            return {
                success: successful > 0,
                sent: successful,
                failed: failed,
                results: results
            };

        } catch (error) {
            logger.error('Error sending data message:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notification message to device (FCM compliant)
     */
    async sendNotificationToDevice(deviceToken, notificationData, platform = 'android') {
        try {
            const message = {
                token: deviceToken,
                // Notification message - displayed automatically by system
                notification: {
                    title: notificationData.title,
                    body: notificationData.message
                },
                // Data payload for app processing (all values must be strings)
                data: {
                    type: String(notificationData.type || 'notification'),
                    id: String(notificationData.id || ''),
                    priority: String(notificationData.priority || 'normal'),
                    created_at: String(notificationData.created_at || new Date().toISOString()),
                    timestamp: String(Date.now())
                },
                // Android specific configuration (FCM compliant)
                android: {
                    priority: 'high', // Required for background notifications
                    notification: {
                        icon: 'ic_notification',
                        color: this.getPriorityColor(notificationData.priority),
                        sound: 'default',
                        channelId: 'school_notifications',
                        priority: 'high', // Required for background notifications
                        // Critical for background notifications
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                        visibility: 'public',
                        localOnly: false,
                        sticky: true,
                        tag: notificationData.id || 'default'
                    }
                },
                // iOS specific configuration (FCM compliant)
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
            logger.info(`Notification message sent successfully: ${response}`);

            return {
                success: true,
                messageId: response,
                deviceToken: deviceToken.substring(0, 20) + '...'
            };

        } catch (error) {
            logger.error('Failed to send notification message:', {
                error: error.message,
                code: error.code,
                deviceToken: deviceToken.substring(0, 20) + '...'
            });

            // Handle specific error cases
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
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
     * Send data message to device (FCM compliant for background processing)
     */
    async sendDataToDevice(deviceToken, data, platform = 'android') {
        try {
            const message = {
                token: deviceToken,
                // Data-only message for background processing (all values must be strings)
                data: {
                    type: String(data.type || 'data'),
                    timestamp: String(Date.now()),
                    ...Object.fromEntries(
                        Object.entries(data).map(([key, value]) => [key, String(value)])
                    )
                },
                // Android specific configuration for data messages
                android: {
                    priority: 'high',
                    data: {
                        type: String(data.type || 'data'),
                        timestamp: String(Date.now()),
                        ...Object.fromEntries(
                            Object.entries(data).map(([key, value]) => [key, String(value)])
                        )
                    }
                },
                // iOS specific configuration for data messages
                apns: {
                    payload: {
                        aps: {
                            'content-available': 1 // Required for background data processing
                        }
                    }
                }
            };

            const response = await this.messaging.send(message);
            logger.info(`Data message sent successfully: ${response}`);

            return {
                success: true,
                messageId: response,
                deviceToken: deviceToken.substring(0, 20) + '...'
            };

        } catch (error) {
            logger.error('Failed to send data message:', {
                error: error.message,
                code: error.code,
                deviceToken: deviceToken.substring(0, 20) + '...'
            });

            return {
                success: false,
                error: error.message,
                code: error.code
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
     * Test FCM compliant notification
     */
    async testFCMCompliantNotification(userId) {
        const testNotification = {
            id: 'fcm_test_' + Date.now(),
            type: 'test',
            title: 'FCM Compliant Test',
            message: 'This notification follows FCM documentation exactly',
            priority: 'high',
            created_at: new Date().toISOString()
        };

        return await this.sendNotificationMessage(userId, testNotification);
    }
}

// Export singleton instance
export default new FCMCompliantNotificationService();
