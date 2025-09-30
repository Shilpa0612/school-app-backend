import admin from 'firebase-admin';
import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Enhanced Notification Service
 * Handles push notifications with proper background support
 */
class EnhancedNotificationService {
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
            logger.info('Firebase Admin initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Firebase Admin:', error);
            throw error;
        }
    }

    /**
     * Send push notification with proper background support
     */
    async sendPushNotification(deviceToken, notificationData) {
        try {
            const message = {
                token: deviceToken,
                notification: {
                    title: notificationData.title,
                    body: notificationData.body
                },
                data: {
                    type: notificationData.type || 'general',
                    id: notificationData.id || '',
                    timestamp: Date.now().toString(),
                    ...notificationData.data
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
                        color: '#FF6B35',
                        // Important for background notifications
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                        tag: notificationData.id || 'default'
                    },
                    // Data-only message for background processing
                    data: {
                        type: notificationData.type || 'general',
                        id: notificationData.id || '',
                        timestamp: Date.now().toString(),
                        ...notificationData.data
                    }
                },
                // iOS specific configuration
                apns: {
                    payload: {
                        aps: {
                            alert: {
                                title: notificationData.title,
                                body: notificationData.body
                            },
                            sound: 'default',
                            badge: 1,
                            // Critical for background notifications
                            'content-available': 1,
                            'mutable-content': 1
                        }
                    }
                },
                // Web push configuration
                webpush: {
                    notification: {
                        title: notificationData.title,
                        body: notificationData.body,
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
            logger.info('Push notification sent successfully:', {
                messageId: response,
                deviceToken: deviceToken.substring(0, 20) + '...',
                title: notificationData.title
            });

            return {
                success: true,
                messageId: response,
                deviceToken: deviceToken.substring(0, 20) + '...'
            };

        } catch (error) {
            logger.error('Failed to send push notification:', {
                error: error.message,
                code: error.code,
                deviceToken: deviceToken.substring(0, 20) + '...',
                title: notificationData.title
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
     * Send notification to multiple devices
     */
    async sendBulkPushNotification(deviceTokens, notificationData) {
        const results = {
            sent: [],
            failed: []
        };

        // Process in batches to avoid rate limits
        const batchSize = 100;
        for (let i = 0; i < deviceTokens.length; i += batchSize) {
            const batch = deviceTokens.slice(i, i + batchSize);

            const batchPromises = batch.map(async (token) => {
                const result = await this.sendPushNotification(token, notificationData);
                if (result.success) {
                    results.sent.push(result);
                } else {
                    results.failed.push({
                        deviceToken: token.substring(0, 20) + '...',
                        error: result.error,
                        code: result.code
                    });
                }
            });

            await Promise.all(batchPromises);

            // Add delay between batches
            if (i + batchSize < deviceTokens.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        logger.info('Bulk push notification completed:', {
            total: deviceTokens.length,
            sent: results.sent.length,
            failed: results.failed.length
        });

        return results;
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
            logger.info('Data-only message sent successfully:', {
                messageId: response,
                deviceToken: deviceToken.substring(0, 20) + '...'
            });

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
                .from('device_tokens')
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
     * Get device tokens for a user
     */
    async getUserDeviceTokens(userId) {
        try {
            const { data, error } = await adminSupabase
                .from('device_tokens')
                .select('device_token, platform, is_active')
                .eq('user_id', userId)
                .eq('is_active', true);

            if (error) {
                logger.error('Failed to get user device tokens:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            logger.error('Error getting user device tokens:', error);
            return [];
        }
    }

    /**
     * Send notification to user by ID
     */
    async sendNotificationToUser(userId, notificationData) {
        try {
            const deviceTokens = await this.getUserDeviceTokens(userId);

            if (deviceTokens.length === 0) {
                logger.warn('No device tokens found for user:', userId);
                return {
                    success: false,
                    error: 'No device tokens found for user'
                };
            }

            const tokens = deviceTokens.map(token => token.device_token);
            const results = await this.sendBulkPushNotification(tokens, notificationData);

            return {
                success: results.sent.length > 0,
                sent: results.sent.length,
                failed: results.failed.length,
                results: results
            };

        } catch (error) {
            logger.error('Failed to send notification to user:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send notification to multiple users
     */
    async sendNotificationToUsers(userIds, notificationData) {
        const results = {
            totalUsers: userIds.length,
            successfulUsers: 0,
            failedUsers: 0,
            totalNotificationsSent: 0,
            totalNotificationsFailed: 0
        };

        for (const userId of userIds) {
            try {
                const result = await this.sendNotificationToUser(userId, notificationData);

                if (result.success) {
                    results.successfulUsers++;
                    results.totalNotificationsSent += result.sent;
                    results.totalNotificationsFailed += result.failed;
                } else {
                    results.failedUsers++;
                }
            } catch (error) {
                logger.error('Error sending notification to user:', userId, error);
                results.failedUsers++;
            }
        }

        logger.info('Bulk user notification completed:', results);
        return results;
    }

    /**
     * Test notification functionality
     */
    async testNotification(deviceToken) {
        const testData = {
            title: 'Test Notification',
            body: 'This is a test notification to verify your setup',
            type: 'test',
            id: 'test_' + Date.now(),
            data: {
                test: 'true',
                timestamp: Date.now().toString()
            }
        };

        return await this.sendPushNotification(deviceToken, testData);
    }
}

// Export singleton instance
export default new EnhancedNotificationService();
