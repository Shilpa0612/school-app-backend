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
     * Ensures only one active token per user per platform
     */
    async registerDeviceToken(userId, deviceToken, platform = 'android', deviceInfo = {}) {
        try {
            await this.initialize();

            // First, deactivate all existing tokens for this user and platform
            const { error: deactivateError } = await adminSupabase
                .from('user_device_tokens')
                .update({ 
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('platform', platform)
                .eq('is_active', true);

            if (deactivateError) {
                logger.error('Error deactivating existing tokens:', deactivateError);
                return { success: false, error: deactivateError };
            }

            // Check if this exact token already exists for this user
            const { data: existingToken, error: checkError } = await adminSupabase
                .from('user_device_tokens')
                .select('id, is_active')
                .eq('user_id', userId)
                .eq('device_token', deviceToken)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
                logger.error('Error checking existing token:', checkError);
                return { success: false, error: checkError };
            }

            let deviceId;
            if (existingToken) {
                // Token exists, reactivate it
                const { error: reactivateError } = await adminSupabase
                    .from('user_device_tokens')
                    .update({
                        is_active: true,
                        last_used: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        device_info: deviceInfo
                    })
                    .eq('id', existingToken.id);

                if (reactivateError) {
                    logger.error('Error reactivating token:', reactivateError);
                    return { success: false, error: reactivateError };
                }

                deviceId = existingToken.id;
                logger.info(`Reactivated existing device token for user ${userId}`);
            } else {
                // Token doesn't exist, create new one
                const { data: newToken, error: insertError } = await adminSupabase
                    .from('user_device_tokens')
                    .insert({
                        user_id: userId,
                        device_token: deviceToken,
                        platform: platform,
                        device_info: deviceInfo,
                        is_active: true,
                        last_used: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select('id')
                    .single();

                if (insertError) {
                    logger.error('Error inserting new token:', insertError);
                    return { success: false, error: insertError };
                }

                deviceId = newToken.id;
                logger.info(`Created new device token for user ${userId}`);
            }

            return { success: true, deviceId };

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
                    type: String(notification.type || 'notification'),
                    id: String(notification.id || ''),
                    student_id: String(notification.student_id || ''),
                    priority: String(notification.priority || 'normal'),
                    related_id: String(notification.related_id || ''),
                    created_at: String(notification.created_at || new Date().toISOString())
                },
                android: {
                    priority: 'high', // Required for background notifications
                    notification: {
                        icon: 'ic_notification',
                        color: this.getPriorityColor(notification.priority),
                        sound: 'default',
                        channelId: 'school_notifications',
                        priority: 'high', // Required for background notifications
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                        visibility: 'public',
                        localOnly: false,
                        sticky: true,
                        tag: String(notification.id || 'default')
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
                            category: 'SCHOOL_NOTIFICATION',
                            // Critical for background notifications
                            'content-available': 1,
                            'mutable-content': 1,
                            'alert-type': 'banner',
                            'interruption-level': 'active'
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

    /**
     * Clean up duplicate tokens for a user (keep only the most recent active token per platform)
     */
    async cleanupDuplicateTokens(userId = null) {
        try {
            let query = adminSupabase
                .from('user_device_tokens')
                .select('*')
                .eq('is_active', true)
                .order('last_used', { ascending: false });

            if (userId) {
                query = query.eq('user_id', userId);
            }

            const { data: activeTokens, error: fetchError } = await query;

            if (fetchError) {
                logger.error('Error fetching active tokens:', fetchError);
                return { success: false, error: fetchError };
            }

            if (!activeTokens || activeTokens.length === 0) {
                return { success: true, cleaned: 0 };
            }

            // Group by user_id and platform, keep only the most recent token
            const tokensToKeep = new Map();
            const tokensToDeactivate = [];

            for (const token of activeTokens) {
                const key = `${token.user_id}_${token.platform}`;
                if (!tokensToKeep.has(key)) {
                    tokensToKeep.set(key, token);
                } else {
                    tokensToDeactivate.push(token.id);
                }
            }

            if (tokensToDeactivate.length === 0) {
                logger.info('No duplicate tokens found');
                return { success: true, cleaned: 0 };
            }

            // Deactivate duplicate tokens
            const { error: deactivateError } = await adminSupabase
                .from('user_device_tokens')
                .update({ 
                    is_active: false,
                    updated_at: new Date().toISOString()
                })
                .in('id', tokensToDeactivate);

            if (deactivateError) {
                logger.error('Error deactivating duplicate tokens:', deactivateError);
                return { success: false, error: deactivateError };
            }

            logger.info(`Cleaned up ${tokensToDeactivate.length} duplicate tokens`);
            return { success: true, cleaned: tokensToDeactivate.length };

        } catch (error) {
            logger.error('Error in cleanupDuplicateTokens:', error);
            return { success: false, error };
        }
    }

    /**
     * Get token statistics for a user
     */
    async getTokenStats(userId) {
        try {
            const { data: tokens, error } = await adminSupabase
                .from('user_device_tokens')
                .select('platform, is_active, last_used, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                logger.error('Error fetching token stats:', error);
                return { success: false, error };
            }

            const stats = {
                total: tokens.length,
                active: tokens.filter(t => t.is_active).length,
                inactive: tokens.filter(t => !t.is_active).length,
                byPlatform: {}
            };

            // Group by platform
            tokens.forEach(token => {
                if (!stats.byPlatform[token.platform]) {
                    stats.byPlatform[token.platform] = {
                        total: 0,
                        active: 0,
                        inactive: 0
                    };
                }
                stats.byPlatform[token.platform].total++;
                if (token.is_active) {
                    stats.byPlatform[token.platform].active++;
                } else {
                    stats.byPlatform[token.platform].inactive++;
                }
            });

            return { success: true, stats };

        } catch (error) {
            logger.error('Error in getTokenStats:', error);
            return { success: false, error };
        }
    }
}

export default new PushNotificationService();
