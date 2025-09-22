import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import pushNotificationService from './pushNotificationService.js';
import websocketService from './websocketService.js';

class NotificationService {
    constructor() {
        this.notificationTypes = {
            ANNOUNCEMENT: 'announcement',
            EVENT: 'event',
            HOMEWORK: 'homework',
            CLASSWORK: 'classwork',
            MESSAGE: 'message',
            ATTENDANCE: 'attendance',
            BIRTHDAY: 'birthday',
            SYSTEM: 'system'
        };

        this.priorityLevels = {
            LOW: 'low',
            NORMAL: 'normal',
            HIGH: 'high',
            URGENT: 'urgent'
        };
    }

    /**
     * Send notification to parent about their child
     */
    async sendParentNotification({
        parentId,
        studentId,
        type,
        title,
        message,
        data = {},
        priority = this.priorityLevels.NORMAL,
        relatedId = null
    }) {
        try {
            // Create notification record
            const { data: notification, error } = await adminSupabase
                .from('parent_notifications')
                .insert({
                    parent_id: parentId,
                    student_id: studentId,
                    type,
                    title,
                    message,
                    data: JSON.stringify(data),
                    priority,
                    related_id: relatedId,
                    is_read: false,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                logger.error('Error creating notification:', error);
                return { success: false, error };
            }

            // Send real-time notification via WebSocket
            await this.sendRealtimeNotification(parentId, notification);

            logger.info(`Notification sent to parent ${parentId} for student ${studentId}: ${type}`);
            return { success: true, notification };

        } catch (error) {
            logger.error('Error in sendParentNotification:', error);
            return { success: false, error };
        }
    }

    /**
     * Send notification to topics (for broadcast notifications)
     */
    async sendTopicNotification(notificationData) {
        try {
            const { type, title, message, data, priority, targetRoles, classDivisionId, studentId } = notificationData;

            // Send to relevant topics
            const topicResult = await parentTopicService.sendNotificationToTopics({
                type,
                title,
                message,
                data,
                priority,
                targetRoles,
                classDivisionId,
                studentId
            });

            if (topicResult.success) {
                logger.info(`Topic notifications sent successfully:`, topicResult.topicsNotified);
            } else {
                logger.error('Failed to send topic notifications:', topicResult.error);
            }

            return topicResult;

        } catch (error) {
            logger.error('Error sending topic notification:', error);
            return { success: false, error };
        }
    }

    /**
     * Send real-time notification via WebSocket and Push Notification
     */
    async sendRealtimeNotification(parentId, notification) {
        try {
            const notificationData = {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                message: notification.message,
                priority: notification.priority,
                data: JSON.parse(notification.data || '{}'),
                related_id: notification.related_id,
                student_id: notification.student_id,
                created_at: notification.created_at,
                is_read: notification.is_read
            };

            // Send WebSocket notification if user is connected
            if (websocketService.isUserConnected(parentId)) {
                websocketService.sendMessageToUser(parentId, {
                    type: 'notification',
                    data: notificationData
                });
                logger.info(`Real-time WebSocket notification sent to parent ${parentId}`);
            } else {
                logger.info(`Parent ${parentId} not connected via WebSocket, will try push notification`);
            }

            // Always send push notification as backup/for offline users
            try {
                const pushResult = await pushNotificationService.sendToUser(parentId, notificationData);
                if (pushResult.success) {
                    logger.info(`Push notification sent to parent ${parentId}: ${pushResult.sent} successful`);
                } else {
                    logger.warn(`Push notification failed for parent ${parentId}:`, pushResult.error);
                }
            } catch (pushError) {
                logger.error(`Error sending push notification to parent ${parentId}:`, pushError);
            }

        } catch (error) {
            logger.error('Error sending real-time notification:', error);
        }
    }

    /**
     * Send notification to multiple parents (for class-wide announcements)
     */
    async sendBulkParentNotification({
        parentIds,
        studentId,
        type,
        title,
        message,
        data = {},
        priority = this.priorityLevels.NORMAL,
        relatedId = null
    }) {
        try {
            const notifications = parentIds.map(parentId => ({
                parent_id: parentId,
                student_id: studentId,
                type,
                title,
                message,
                data: JSON.stringify(data),
                priority,
                related_id: relatedId,
                is_read: false,
                created_at: new Date().toISOString()
            }));

            const { data: createdNotifications, error } = await adminSupabase
                .from('parent_notifications')
                .insert(notifications)
                .select();

            if (error) {
                logger.error('Error creating bulk notifications:', error);
                return { success: false, error };
            }

            // Send real-time notifications to connected parents
            for (const notification of createdNotifications) {
                await this.sendRealtimeNotification(notification.parent_id, notification);
            }

            logger.info(`Bulk notifications sent to ${parentIds.length} parents for student ${studentId}: ${type}`);
            return { success: true, notifications: createdNotifications };

        } catch (error) {
            logger.error('Error in sendBulkParentNotification:', error);
            return { success: false, error };
        }
    }

    /**
     * Get notifications for a parent
     */
    async getParentNotifications({
        parentId,
        studentId = null,
        type = null,
        isRead = null,
        priority = null,
        limit = 50,
        offset = 0
    }) {
        try {
            let query = adminSupabase
                .from('parent_notifications')
                .select(`
                    *,
                    student:students!parent_notifications_student_id_fkey(
                        full_name,
                        admission_number,
                        class_division:class_divisions!students_class_division_id_fkey(
                            class_name,
                            division_name
                        )
                    )
                `)
                .eq('parent_id', parentId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (studentId) {
                query = query.eq('student_id', studentId);
            }

            if (type) {
                query = query.eq('type', type);
            }

            if (isRead !== null) {
                query = query.eq('is_read', isRead);
            }

            if (priority) {
                query = query.eq('priority', priority);
            }

            const { data: notifications, error } = await query;

            if (error) {
                logger.error('Error fetching parent notifications:', error);
                return { success: false, error };
            }

            return { success: true, notifications };

        } catch (error) {
            logger.error('Error in getParentNotifications:', error);
            return { success: false, error };
        }
    }

    /**
     * Mark notification as read
     */
    async markNotificationAsRead(notificationId, parentId) {
        try {
            const { data, error } = await adminSupabase
                .from('parent_notifications')
                .update({
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('id', notificationId)
                .eq('parent_id', parentId)
                .select()
                .single();

            if (error) {
                logger.error('Error marking notification as read:', error);
                return { success: false, error };
            }

            return { success: true, notification: data };

        } catch (error) {
            logger.error('Error in markNotificationAsRead:', error);
            return { success: false, error };
        }
    }

    /**
     * Mark all notifications as read for a parent
     */
    async markAllNotificationsAsRead(parentId, studentId = null) {
        try {
            let query = adminSupabase
                .from('parent_notifications')
                .update({
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('parent_id', parentId)
                .eq('is_read', false);

            if (studentId) {
                query = query.eq('student_id', studentId);
            }

            const { data, error } = await query.select();

            if (error) {
                logger.error('Error marking all notifications as read:', error);
                return { success: false, error };
            }

            return { success: true, updatedCount: data.length };

        } catch (error) {
            logger.error('Error in markAllNotificationsAsRead:', error);
            return { success: false, error };
        }
    }

    /**
     * Get unread notification count for a parent
     */
    async getUnreadCount(parentId, studentId = null) {
        try {
            let query = adminSupabase
                .from('parent_notifications')
                .select('id', { count: 'exact' })
                .eq('parent_id', parentId)
                .eq('is_read', false);

            if (studentId) {
                query = query.eq('student_id', studentId);
            }

            const { count, error } = await query;

            if (error) {
                logger.error('Error getting unread count:', error);
                return { success: false, error };
            }

            return { success: true, count: count || 0 };

        } catch (error) {
            logger.error('Error in getUnreadCount:', error);
            return { success: false, error };
        }
    }

    /**
     * Delete old notifications (cleanup)
     */
    async deleteOldNotifications(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const { data, error } = await adminSupabase
                .from('parent_notifications')
                .delete()
                .lt('created_at', cutoffDate.toISOString())
                .select();

            if (error) {
                logger.error('Error deleting old notifications:', error);
                return { success: false, error };
            }

            logger.info(`Deleted ${data.length} old notifications`);
            return { success: true, deletedCount: data.length };

        } catch (error) {
            logger.error('Error in deleteOldNotifications:', error);
            return { success: false, error };
        }
    }

    /**
     * Get notification statistics for a parent
     */
    async getNotificationStats(parentId) {
        try {
            const { data: stats, error } = await adminSupabase
                .from('parent_notifications')
                .select('type, priority, is_read')
                .eq('parent_id', parentId);

            if (error) {
                logger.error('Error getting notification stats:', error);
                return { success: false, error };
            }

            const statsData = {
                total: stats.length,
                unread: stats.filter(n => !n.is_read).length,
                byType: {},
                byPriority: {}
            };

            // Count by type
            stats.forEach(notification => {
                statsData.byType[notification.type] = (statsData.byType[notification.type] || 0) + 1;
                statsData.byPriority[notification.priority] = (statsData.byPriority[notification.priority] || 0) + 1;
            });

            return { success: true, stats: statsData };

        } catch (error) {
            logger.error('Error in getNotificationStats:', error);
            return { success: false, error };
        }
    }
}

export default new NotificationService();
