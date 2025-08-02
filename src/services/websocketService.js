import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import realtimeService from './realtimeService.js';

class WebSocketService {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // userId -> WebSocket
        this.userSubscriptions = new Map(); // userId -> Set of subscribed threads
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        logger.info('WebSocket server initialized');
    }

    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, req) {
        // Extract token from query parameters or headers
        const token = this.extractToken(req);

        if (!token) {
            ws.close(1008, 'Authentication required');
            return;
        }

        try {
            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId; // Changed from decoded.id to decoded.userId

            // Store client connection
            this.clients.set(userId, ws);
            this.userSubscriptions.set(userId, new Set());

            // Send connection confirmation
            ws.send(JSON.stringify({
                type: 'connection_established',
                user_id: userId,
                timestamp: new Date().toISOString()
            }));

            // Subscribe to real-time messages
            realtimeService.subscribeToMessages(
                userId,
                (message) => {
                    this.sendMessageToUser(userId, {
                        type: 'new_message',
                        data: message
                    });
                },
                (error) => {
                    logger.error(`Real-time error for user ${userId}:`, error);
                    this.sendMessageToUser(userId, {
                        type: 'error',
                        message: 'Real-time connection error'
                    });
                }
            );

            // Handle incoming messages
            ws.on('message', (data) => {
                this.handleIncomingMessage(userId, data);
            });

            // Handle client disconnect
            ws.on('close', () => {
                this.handleDisconnect(userId);
            });

            // Handle errors
            ws.on('error', (error) => {
                logger.error(`WebSocket error for user ${userId}:`, error);
                this.handleDisconnect(userId);
            });

            logger.info(`User ${userId} connected to WebSocket`);

        } catch (error) {
            logger.error('WebSocket authentication error:', error);
            ws.close(1008, 'Invalid token');
        }
    }

    /**
     * Extract JWT token from request
     */
    extractToken(req) {
        // Try to get token from query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        let token = url.searchParams.get('token');

        // If not in query, try Authorization header
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        return token;
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleIncomingMessage(userId, data) {
        try {
            const message = JSON.parse(data.toString());

            switch (message.type) {
                case 'subscribe_thread':
                    this.subscribeToThread(userId, message.thread_id);
                    break;

                case 'unsubscribe_thread':
                    this.unsubscribeFromThread(userId, message.thread_id);
                    break;

                case 'ping':
                    this.sendMessageToUser(userId, { type: 'pong' });
                    break;

                case 'send_message':
                    this.handleSendMessage(userId, message);
                    break;

                default:
                    logger.warn(`Unknown message type from user ${userId}:`, message.type);
            }
        } catch (error) {
            logger.error(`Error handling message from user ${userId}:`, error);
        }
    }

    /**
     * Subscribe user to a specific thread
     */
    async subscribeToThread(userId, threadId) {
        try {
            // Check if user is participant in thread
            const { data: participant, error: participantError } = await adminSupabase
                .from('chat_participants')
                .select('*')
                .eq('thread_id', threadId)
                .eq('user_id', userId)
                .single();

            if (participantError || !participant) {
                // Check if thread exists
                const { data: thread, error: threadError } = await adminSupabase
                    .from('chat_threads')
                    .select('id, created_by')
                    .eq('id', threadId)
                    .single();

                if (threadError || !thread) {
                    this.sendMessageToUser(userId, {
                        type: 'error',
                        message: 'Thread not found'
                    });
                    return;
                }

                // Try to add user as participant
                try {
                    const { error: addParticipantError } = await adminSupabase
                        .from('chat_participants')
                        .insert({
                            thread_id: threadId,
                            user_id: userId,
                            role: userId === thread.created_by ? 'admin' : 'member'
                        });

                    if (addParticipantError) {
                        logger.error('Error adding user as participant for subscription:', addParticipantError);
                        this.sendMessageToUser(userId, {
                            type: 'error',
                            message: 'Access denied to this thread'
                        });
                        return;
                    }

                    logger.info(`Added user ${userId} as participant to thread ${threadId} for subscription`);
                } catch (error) {
                    logger.error('Error adding participant for subscription:', error);
                    this.sendMessageToUser(userId, {
                        type: 'error',
                        message: 'Access denied to this thread'
                    });
                    return;
                }
            }

            const userSubs = this.userSubscriptions.get(userId);
            if (userSubs) {
                userSubs.add(threadId);

                // Subscribe to real-time updates for this thread
                realtimeService.subscribeToThread(
                    threadId,
                    userId,
                    (message) => {
                        this.sendMessageToUser(userId, {
                            type: 'new_message',
                            data: message
                        });
                    },
                    (error) => {
                        logger.error(`Thread subscription error for user ${userId}:`, error);
                    }
                );

                this.sendMessageToUser(userId, {
                    type: 'thread_subscribed',
                    thread_id: threadId
                });
            }
        } catch (error) {
            logger.error(`Error in subscribeToThread for user ${userId}:`, error);
            this.sendMessageToUser(userId, {
                type: 'error',
                message: 'Failed to subscribe to thread'
            });
        }
    }

    /**
     * Unsubscribe user from a specific thread
     */
    unsubscribeFromThread(userId, threadId) {
        const userSubs = this.userSubscriptions.get(userId);
        if (userSubs) {
            userSubs.delete(threadId);

            this.sendMessageToUser(userId, {
                type: 'thread_unsubscribed',
                thread_id: threadId
            });
        }
    }

    /**
     * Send message to a specific user
     */
    sendMessageToUser(userId, message) {
        const ws = this.clients.get(userId);
        if (ws && ws.readyState === 1) { // 1 = OPEN
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                logger.error(`Error sending message to user ${userId}:`, error);
                this.handleDisconnect(userId);
            }
        }
    }

    /**
     * Send message to all users in a thread
     */
    sendMessageToThread(threadId, message, excludeUserId = null) {
        // This would need to be implemented based on your thread participants
        // For now, we'll use the realtime service to handle this
        logger.info(`Sending message to thread ${threadId}:`, message);
    }

    /**
     * Handle client disconnect
     */
    handleDisconnect(userId) {
        // Remove client connection
        this.clients.delete(userId);

        // Clean up subscriptions
        this.userSubscriptions.delete(userId);

        // Unsubscribe from real-time messages
        realtimeService.unsubscribeUser(userId);

        logger.info(`User ${userId} disconnected from WebSocket`);
    }

    /**
     * Get connected users count
     */
    getConnectedUsersCount() {
        return this.clients.size;
    }

    /**
     * Get all connected user IDs
     */
    getConnectedUsers() {
        return Array.from(this.clients.keys());
    }

    /**
     * Check if user is connected
     */
    isUserConnected(userId) {
        const ws = this.clients.get(userId);
        return ws && ws.readyState === 1;
    }

    /**
     * Handle sending message through WebSocket
     */
    async handleSendMessage(userId, message) {
        try {
            const { thread_id, content, message_type = 'text' } = message;

            // Validate required fields
            if (!thread_id || !content) {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Thread ID and content are required'
                });
                return;
            }

            // Validate message type
            if (!['text', 'image', 'file', 'system'].includes(message_type)) {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Invalid message type'
                });
                return;
            }

            // Verify user is participant in thread
            const { data: participant, error: participantError } = await adminSupabase
                .from('chat_participants')
                .select('*')
                .eq('thread_id', thread_id)
                .eq('user_id', userId)
                .single();

            if (participantError || !participant) {
                // Check if thread exists
                const { data: thread, error: threadError } = await adminSupabase
                    .from('chat_threads')
                    .select('id, created_by')
                    .eq('id', thread_id)
                    .single();

                if (threadError || !thread) {
                    this.sendMessageToUser(userId, {
                        type: 'error',
                        message: 'Thread not found'
                    });
                    return;
                }

                // Try to add user as participant (for direct chats or if user is thread creator)
                try {
                    const { error: addParticipantError } = await adminSupabase
                        .from('chat_participants')
                        .insert({
                            thread_id: thread_id,
                            user_id: userId,
                            role: userId === thread.created_by ? 'admin' : 'member'
                        });

                    if (addParticipantError) {
                        logger.error('Error adding user as participant:', addParticipantError);
                        this.sendMessageToUser(userId, {
                            type: 'error',
                            message: 'Access denied to this thread'
                        });
                        return;
                    }

                    logger.info(`Added user ${userId} as participant to thread ${thread_id}`);
                } catch (error) {
                    logger.error('Error adding participant:', error);
                    this.sendMessageToUser(userId, {
                        type: 'error',
                        message: 'Access denied to this thread'
                    });
                    return;
                }
            }

            // Check if thread is active
            const { data: thread, error: threadError } = await adminSupabase
                .from('chat_threads')
                .select('status')
                .eq('id', thread_id)
                .single();

            if (threadError || thread.status !== 'active') {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Thread is not active'
                });
                return;
            }

            // Create message
            const { data: newMessage, error } = await adminSupabase
                .from('chat_messages')
                .insert({
                    thread_id,
                    sender_id: userId,
                    content,
                    message_type
                })
                .select(`
                    *,
                    sender:users!chat_messages_sender_id_fkey(full_name, role)
                `)
                .single();

            if (error) {
                logger.error('Error creating message via WebSocket:', error);
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Failed to send message'
                });
                return;
            }

            // Update thread's updated_at timestamp
            await adminSupabase
                .from('chat_threads')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', thread_id);

            // Send success confirmation to sender
            this.sendMessageToUser(userId, {
                type: 'message_sent',
                data: {
                    id: newMessage.id,
                    thread_id: newMessage.thread_id,
                    content: newMessage.content,
                    message_type: newMessage.message_type,
                    created_at: newMessage.created_at,
                    sender: newMessage.sender
                }
            });

            // Broadcast to all participants in the thread
            const { data: participants } = await adminSupabase
                .from('chat_participants')
                .select('user_id')
                .eq('thread_id', thread_id);

            if (participants) {
                participants.forEach(participant => {
                    if (participant.user_id !== userId) {
                        this.sendMessageToUser(participant.user_id, {
                            type: 'new_message',
                            data: newMessage
                        });
                    }
                });
            }

            logger.info(`Message sent via WebSocket by user ${userId} in thread ${thread_id}`);

        } catch (error) {
            logger.error(`Error handling WebSocket message from user ${userId}:`, error);
            this.sendMessageToUser(userId, {
                type: 'error',
                message: 'Internal server error'
            });
        }
    }

    /**
     * Broadcast message to all connected users
     */
    broadcast(message, filter = null) {
        this.clients.forEach((ws, userId) => {
            if (ws.readyState === 1) {
                if (!filter || filter(userId)) {
                    try {
                        ws.send(JSON.stringify(message));
                    } catch (error) {
                        logger.error(`Error broadcasting to user ${userId}:`, error);
                    }
                }
            }
        });
    }
}

export default new WebSocketService(); 