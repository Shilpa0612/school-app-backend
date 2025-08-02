import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

class RealtimeService {
    constructor() {
        this.subscriptions = new Map();
        this.lastMessageTimestamps = new Map();
    }

    /**
     * Subscribe to real-time messages for a user
     * @param {string} userId - User ID
     * @param {Function} onMessage - Callback for new messages
     * @param {Function} onError - Error callback
     */
    subscribeToMessages(userId, onMessage, onError) {
        try {
            // Get user's threads
            this.getUserThreads(userId).then(threads => {
                threads.forEach(thread => {
                    this.subscribeToThread(thread.thread_id, userId, onMessage, onError);
                });
            });

            // Subscribe to new thread participants (for new threads)
            const participantSubscription = supabase
                .channel('chat_participants')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_participants',
                    filter: `user_id=eq.${userId}`
                }, (payload) => {
                    // New thread added for user
                    this.subscribeToThread(payload.new.thread_id, userId, onMessage, onError);
                })
                .subscribe();

            this.subscriptions.set(`participants_${userId}`, participantSubscription);

        } catch (error) {
            logger.error('Error subscribing to messages:', error);
            if (onError) onError(error);
        }
    }

    /**
     * Subscribe to a specific thread
     */
    subscribeToThread(threadId, userId, onMessage, onError) {
        try {
            const subscription = supabase
                .channel(`thread_${threadId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `thread_id=eq.${threadId}`
                }, async (payload) => {
                    const message = payload.new;

                    // Don't notify if message is from current user
                    if (message.sender_id === userId) return;

                    // Get full message with sender info
                    const { data: fullMessage, error } = await supabase
                        .from('chat_messages')
                        .select(`
                            *,
                            sender:users(full_name, role)
                        `)
                        .eq('id', message.id)
                        .single();

                    if (error) {
                        logger.error('Error fetching message details:', error);
                        return;
                    }

                    // Update last read timestamp
                    await this.updateLastRead(threadId, userId);

                    // Call the callback
                    if (onMessage) onMessage(fullMessage);
                })
                .subscribe();

            this.subscriptions.set(`thread_${threadId}_${userId}`, subscription);

        } catch (error) {
            logger.error('Error subscribing to thread:', error);
            if (onError) onError(error);
        }
    }

    /**
     * Get offline messages (messages since last check)
     */
    async getOfflineMessages(userId, lastCheckTime) {
        try {
            // Get user's threads
            const { data: threads, error: threadsError } = await supabase
                .from('chat_participants')
                .select('thread_id')
                .eq('user_id', userId);

            if (threadsError) {
                logger.error('Error getting user threads:', threadsError);
                return [];
            }

            const threadIds = threads.map(t => t.thread_id);

            if (threadIds.length === 0) return [];

            // Get messages since last check
            const { data: messages, error } = await supabase
                .from('chat_messages')
                .select(`
                    *,
                    sender:users(full_name, role)
                `)
                .in('thread_id', threadIds)
                .gt('created_at', lastCheckTime)
                .neq('sender_id', userId) // Exclude user's own messages
                .order('created_at', { ascending: true });

            if (error) {
                logger.error('Error getting offline messages:', error);
                return [];
            }

            return messages || [];

        } catch (error) {
            logger.error('Error in getOfflineMessages:', error);
            return [];
        }
    }

    /**
     * Get user's threads
     */
    async getUserThreads(userId) {
        try {
            const { data: threads, error } = await supabase
                .from('chat_participants')
                .select('thread_id')
                .eq('user_id', userId);

            if (error) {
                logger.error('Error getting user threads:', error);
                return [];
            }

            return threads || [];
        } catch (error) {
            logger.error('Error in getUserThreads:', error);
            return [];
        }
    }

    /**
     * Update last read timestamp
     */
    async updateLastRead(threadId, userId) {
        try {
            await supabase
                .from('chat_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('thread_id', threadId)
                .eq('user_id', userId);
        } catch (error) {
            logger.error('Error updating last read:', error);
        }
    }

    /**
     * Unsubscribe from all channels for a user
     */
    unsubscribeUser(userId) {
        try {
            // Unsubscribe from thread channels
            for (const [key, subscription] of this.subscriptions) {
                if (key.includes(`_${userId}`) || key === `participants_${userId}`) {
                    subscription.unsubscribe();
                    this.subscriptions.delete(key);
                }
            }
        } catch (error) {
            logger.error('Error unsubscribing user:', error);
        }
    }

    /**
     * Get unread message count for a user
     */
    async getUnreadCount(userId) {
        try {
            const { data: participants, error } = await supabase
                .from('chat_participants')
                .select(`
                    thread_id,
                    last_read_at,
                    thread:chat_threads(
                        messages:chat_messages(
                            id,
                            created_at
                        )
                    )
                `)
                .eq('user_id', userId);

            if (error) {
                logger.error('Error getting unread count:', error);
                return 0;
            }

            let totalUnread = 0;

            participants.forEach(participant => {
                if (!participant.thread?.messages) return;

                const unreadInThread = participant.thread.messages.filter(message => {
                    const messageTime = new Date(message.created_at);
                    const lastReadTime = participant.last_read_at ?
                        new Date(participant.last_read_at) : new Date(0);

                    return messageTime > lastReadTime;
                }).length;

                totalUnread += unreadInThread;
            });

            return totalUnread;

        } catch (error) {
            logger.error('Error in getUnreadCount:', error);
            return 0;
        }
    }
}

export default new RealtimeService(); 