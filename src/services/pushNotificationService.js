import admin from 'firebase-admin';
import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

class PushNotificationService {
    constructor() {
        this.isInitialized = false;
        this.fcmApp = null;
    }

    /**
     * Initialize Firebase Admin SDK
     */
    async initialize() {
        try {
            // Check if Firebase is already initialized
            if (this.isInitialized) {
                return;
            }

            // Initialize Firebase Admin SDK
            if (!admin.apps.length) {
                const serviceAccount = {
                    type: "service_account",
                    project_id: process.env.FIREBASE_PROJECT_ID,
                    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    client_email: process.env.FIREBASE_CLIENT_EMAIL,
                    client_id: process.env.FIREBASE_CLIENT_ID,
                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                    token_uri: "https://oauth2.googleapis.com/token",
                    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
                };

                this.fcmApp = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID
                });
            } else {
                this.fcmApp = admin.app();
            }

            this.isInitialized = true;
            logger.info('Firebase Admin SDK initialized successfully');

        } catch (error) {
            logger.error('Failed to initialize Firebase Admin SDK:', error);
            throw error;
        }
    }

    /**
     * Register device token for push notifications
     */
    async registerDeviceToken(userId, deviceToken, platform = 'android') {
        try {
            await this.initialize();

            const { error } = await adminSupabase
                .from('user_device_tokens')
                .upsert({
                    user_id: userId,
                    device_token: deviceToken,
                    platform: platform,
                    is_active: true,
                    last_used: new Date().toISOString(),
                    created_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,device_token'
                });

            if (error) {
                logger.error('Error registering device token:', error);
                return { success: false, error };
            }

            logger.info(`Device token registered for user ${userId}`);
            return { success: true };

        } catch (error) {
            logger.error('Error in registerDeviceToken:', error);
            return { success: false, error };
        }
    }

    /**
     * Unregister device token
     */
    async unregisterDeviceToken(userId, deviceToken) {
        try {
            const { error } = await adminSupabase
                .from('user_device_tokens')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('device_token', deviceToken);

            if (error) {
                logger.error('Error unregistering device token:', error);
                return { success: false, error };
            }

            logger.info(`Device token unregistered for user ${userId}`);
            return { success: true };

        } catch (error) {
            logger.error('Error in unregisterDeviceToken:', error);
            return { success: false, error };
        }
    }

    /**
     * Send push notification to a single user
     */
    async sendToUser(userId, notification) {
        try {
            await this.initialize();

            // Get user's device tokens
            const { data: deviceTokens, error } = await adminSupabase
                .from('user_device_tokens')
                .select('device_token, platform')
                .eq('user_id', userId)
                .eq('is_active', true);

            if (error) {
                logger.error('Error fetching device tokens:', error);
                return { success: false, error };
            }

            if (!deviceTokens || deviceTokens.length === 0) {
                logger.info(`No device tokens found for user ${userId}`);
                return { success: true, sent: 0 };
            }

            // Send to all user's devices
            const results = await Promise.allSettled(
                deviceTokens.map(device => this.sendToDevice(device.device_token, notification, device.platform))
            );

            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;

            logger.info(`Push notification sent to user ${userId}: ${successful} successful, ${failed} failed`);
            return { success: true, sent: successful, failed };

        } catch (error) {
            logger.error('Error in sendToUser:', error);
            return { success: false, error };
        }
    }

    /**
     * Send push notification to multiple users
     */
    async sendToUsers(userIds, notification) {
        try {
            const results = await Promise.allSettled(
                userIds.map(userId => this.sendToUser(userId, notification))
            );

            const successful = results.filter(result => result.status === 'fulfilled').length;
            const failed = results.filter(result => result.status === 'rejected').length;

            logger.info(`Bulk push notification sent: ${successful} successful, ${failed} failed`);
            return { success: true, sent: successful, failed };

        } catch (error) {
            logger.error('Error in sendToUsers:', error);
            return { success: false, error };
        }
    }

    /**
     * Send push notification to a specific device
     */
    async sendToDevice(deviceToken, notification, platform = 'android') {
        try {
            await this.initialize();

            const message = {
                token: deviceToken,
                notification: {
                    title: notification.title,
                    body: notification.message
                },
                data: {
                    type: notification.type,
                    id: notification.id,
                    student_id: notification.student_id,
                    priority: notification.priority,
                    related_id: notification.related_id || '',
                    created_at: notification.created_at
                },
                android: {
                    notification: {
                        icon: 'ic_notification',
                        color: this.getPriorityColor(notification.priority),
                        sound: 'default',
                        channelId: 'school_notifications',
                        priority: this.getAndroidPriority(notification.priority)
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            alert: {
                                title: notification.title,
                                body: notification.message
                            },
                            sound: 'default',
                            badge: 1,
                            category: 'SCHOOL_NOTIFICATION'
                        }
                    }
                }
            };

            const response = await admin.messaging().send(message);
            logger.info(`Push notification sent successfully: ${response}`);
            return { success: true, messageId: response };

        } catch (error) {
            logger.error('Error sending push notification:', error);
            return { success: false, error };
        }
    }

    /**
     * Send push notification to topic (for school-wide announcements)
     */
    async sendToTopic(topic, notification) {
        try {
            await this.initialize();

            const message = {
                topic: topic,
                notification: {
                    title: notification.title,
                    body: notification.message
                },
                data: {
                    type: notification.type,
                    id: notification.id,
                    priority: notification.priority,
                    related_id: notification.related_id || '',
                    created_at: notification.created_at
                },
                android: {
                    notification: {
                        icon: 'ic_notification',
                        color: this.getPriorityColor(notification.priority),
                        sound: 'default',
                        channelId: 'school_notifications'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            alert: {
                                title: notification.title,
                                body: notification.message
                            },
                            sound: 'default',
                            badge: 1
                        }
                    }
                }
            };

            const response = await admin.messaging().send(message);
            logger.info(`Push notification sent to topic ${topic}: ${response}`);
            return { success: true, messageId: response };

        } catch (error) {
            logger.error('Error sending push notification to topic:', error);
            return { success: false, error };
        }
    }

    /**
     * Subscribe user to topic
     */
    async subscribeToTopic(deviceToken, topic) {
        try {
            await this.initialize();

            const response = await admin.messaging().subscribeToTopic([deviceToken], topic);
            logger.info(`Device subscribed to topic ${topic}:`, response);
            return { success: true, response };

        } catch (error) {
            logger.error('Error subscribing to topic:', error);
            return { success: false, error };
        }
    }

    /**
     * Unsubscribe user from topic
     */
    async unsubscribeFromTopic(deviceToken, topic) {
        try {
            await this.initialize();

            const response = await admin.messaging().unsubscribeFromTopic([deviceToken], topic);
            logger.info(`Device unsubscribed from topic ${topic}:`, response);
            return { success: true, response };

        } catch (error) {
            logger.error('Error unsubscribing from topic:', error);
            return { success: false, error };
        }
    }

    /**
     * Get priority color for Android notifications
     */
    getPriorityColor(priority) {
        const colors = {
            'urgent': '#FF0000',    // Red
            'high': '#FF8C00',      // Orange
            'normal': '#0080FF',    // Blue
            'low': '#808080'        // Gray
        };
        return colors[priority] || colors['normal'];
    }

    /**
     * Get Android priority level
     */
    getAndroidPriority(priority) {
        const priorities = {
            'urgent': 'high',
            'high': 'high',
            'normal': 'default',
            'low': 'low'
        };
        return priorities[priority] || 'default';
    }

    /**
     * Clean up inactive device tokens
     */
    async cleanupInactiveTokens() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { error } = await adminSupabase
                .from('user_device_tokens')
                .update({ is_active: false })
                .lt('last_used', thirtyDaysAgo.toISOString());

            if (error) {
                logger.error('Error cleaning up inactive tokens:', error);
                return { success: false, error };
            }

            logger.info('Inactive device tokens cleaned up');
            return { success: true };

        } catch (error) {
            logger.error('Error in cleanupInactiveTokens:', error);
            return { success: false, error };
        }
    }
}

export default new PushNotificationService();
