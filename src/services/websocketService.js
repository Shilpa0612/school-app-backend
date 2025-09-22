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
        this.heartbeatInterval = null;
        this.heartbeatIntervalMs = 30000; // 30 seconds
        this.connectionTimeout = 60000; // 60 seconds
        this.clientHeartbeats = new Map(); // userId -> last heartbeat timestamp
    }

    /**
     * Initialize WebSocket server
     */
    initialize(server) {
        this.wss = new WebSocketServer({
            server,
            // Configure WebSocket server options
            perMessageDeflate: false,
            maxPayload: 16 * 1024, // 16KB max message size
            clientTracking: true,
        });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        // Start heartbeat mechanism
        this.startHeartbeat();

        logger.info('WebSocket server initialized with heartbeat mechanism');
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
            this.clientHeartbeats.set(userId, Date.now());

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

            // Subscribe to notifications for parents
            if (decoded.role === 'parent') {
                this.subscribeToNotifications(userId);
            }

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
            // Clean the data string to remove control characters
            const cleanData = data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
            const message = JSON.parse(cleanData);

            // Validate required fields
            if (!message.type) {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Message type is required'
                });
                return;
            }

            switch (message.type) {
                case 'subscribe_thread':
                    if (!message.thread_id) {
                        this.sendMessageToUser(userId, {
                            type: 'error',
                            message: 'Thread ID is required for subscription'
                        });
                        return;
                    }
                    this.subscribeToThread(userId, message.thread_id);
                    break;

                case 'unsubscribe_thread':
                    if (!message.thread_id) {
                        this.sendMessageToUser(userId, {
                            type: 'error',
                            message: 'Thread ID is required for unsubscription'
                        });
                        return;
                    }
                    this.unsubscribeFromThread(userId, message.thread_id);
                    break;

                case 'ping':
                    // Update heartbeat timestamp
                    this.clientHeartbeats.set(userId, Date.now());
                    this.sendMessageToUser(userId, { type: 'pong' });
                    break;

                case 'heartbeat_response':
                    // Client responded to server heartbeat
                    this.clientHeartbeats.set(userId, Date.now());
                    break;

                case 'send_message':
                    if (!message.thread_id || !message.content) {
                        this.sendMessageToUser(userId, {
                            type: 'error',
                            message: 'Thread ID and content are required for sending messages'
                        });
                        return;
                    }
                    this.handleSendMessage(userId, message);
                    break;

                default:
                    logger.warn(`Unknown message type from user ${userId}:`, message.type);
                    this.sendMessageToUser(userId, {
                        type: 'error',
                        message: `Unknown message type: ${message.type}`
                    });
            }
        } catch (error) {
            logger.error(`Error handling message from user ${userId}:`, error);
            this.sendMessageToUser(userId, {
                type: 'error',
                message: 'Invalid JSON format. Please check your message structure.'
            });
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
    sendMessageToThread(threadId, message, _excludeUserId = null) {
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

        // Clean up heartbeat tracking
        this.clientHeartbeats.delete(userId);

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

            // Create message in chat_messages table (primary storage for chat)
            const { data: newMessage, error } = await adminSupabase
                .from('chat_messages')
                .insert({
                    thread_id: thread_id,
                    sender_id: userId,
                    content,
                    message_type: message_type,
                    status: 'sent'
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
                    status: newMessage.status,
                    created_at: newMessage.created_at,
                    sender: newMessage.sender
                }
            });

            // Broadcast to all participants in the thread
            const { data: participants, error: participantsError } = await adminSupabase
                .from('chat_participants')
                .select('user_id')
                .eq('thread_id', thread_id);

            if (participantsError) {
                logger.error('Error fetching participants for broadcasting:', participantsError);
            } else if (participants && participants.length > 0) {
                logger.info(`Broadcasting message to ${participants.length} participants in thread ${thread_id}`);

                participants.forEach(participant => {
                    if (participant.user_id !== userId) {
                        logger.info(`Sending message to participant: ${participant.user_id}`);
                        this.sendMessageToUser(participant.user_id, {
                            type: 'new_message',
                            data: newMessage
                        });
                    }
                });
            } else {
                logger.warn(`No participants found for thread ${thread_id}`);
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

    /**
     * Start heartbeat mechanism to keep connections alive
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.performHeartbeatCheck();
        }, this.heartbeatIntervalMs);

        logger.info(`Heartbeat mechanism started (interval: ${this.heartbeatIntervalMs}ms)`);
    }

    /**
     * Stop heartbeat mechanism
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            logger.info('Heartbeat mechanism stopped');
        }
    }

    /**
     * Perform heartbeat check on all connected clients
     */
    performHeartbeatCheck() {
        const now = Date.now();
        const disconnectedUsers = [];

        this.clients.forEach((ws, userId) => {
            const lastHeartbeat = this.clientHeartbeats.get(userId) || 0;
            const timeSinceLastHeartbeat = now - lastHeartbeat;

            if (ws.readyState === 1) { // WebSocket is OPEN
                if (timeSinceLastHeartbeat > this.connectionTimeout) {
                    // Client hasn't responded to heartbeat, consider it disconnected
                    logger.warn(`Client ${userId} heartbeat timeout (${timeSinceLastHeartbeat}ms). Disconnecting...`);
                    disconnectedUsers.push(userId);
                    ws.terminate(); // Force close the connection
                } else {
                    // Send ping to client
                    try {
                        ws.send(JSON.stringify({
                            type: 'heartbeat',
                            timestamp: now,
                            timeout: this.connectionTimeout
                        }));
                    } catch (error) {
                        logger.error(`Error sending heartbeat to user ${userId}:`, error);
                        disconnectedUsers.push(userId);
                    }
                }
            } else {
                // WebSocket is not open, clean up
                disconnectedUsers.push(userId);
            }
        });

        // Clean up disconnected users
        disconnectedUsers.forEach(userId => {
            this.handleDisconnect(userId);
        });

        if (disconnectedUsers.length > 0) {
            logger.info(`Cleaned up ${disconnectedUsers.length} disconnected clients`);
        }
    }

    /**
     * Subscribe user to notifications
     */
    async subscribeToNotifications(userId) {
        try {
            // Subscribe to real-time notifications for this parent
            realtimeService.subscribeToNotifications(
                userId,
                (notification) => {
                    this.sendMessageToUser(userId, {
                        type: 'notification',
                        data: notification
                    });
                },
                (error) => {
                    logger.error(`Notification subscription error for user ${userId}:`, error);
                }
            );

            logger.info(`User ${userId} subscribed to notifications`);
        } catch (error) {
            logger.error(`Error subscribing user ${userId} to notifications:`, error);
        }
    }

    /**
     * Send notification to parent
     */
    async sendNotificationToParent(parentId, notification) {
        try {
            if (this.isUserConnected(parentId)) {
                this.sendMessageToUser(parentId, {
                    type: 'notification',
                    data: notification
                });
                logger.info(`Notification sent to parent ${parentId}`);
            } else {
                logger.info(`Parent ${parentId} not connected, notification will be delivered when they connect`);
            }
        } catch (error) {
            logger.error(`Error sending notification to parent ${parentId}:`, error);
        }
    }

    /**
     * Graceful shutdown
     */
    shutdown() {
        logger.info('Shutting down WebSocket service...');

        // Stop heartbeat
        this.stopHeartbeat();

        // Close all client connections
        this.clients.forEach((ws, userId) => {
            try {
                ws.send(JSON.stringify({
                    type: 'server_shutdown',
                    message: 'Server is shutting down'
                }));
                ws.close(1001, 'Server shutdown');
            } catch (error) {
                logger.error(`Error closing connection for user ${userId}:`, error);
            }
        });

        // Close WebSocket server
        if (this.wss) {
            this.wss.close(() => {
                logger.info('WebSocket server closed');
            });
        }

        // Clear all data structures
        this.clients.clear();
        this.userSubscriptions.clear();
        this.clientHeartbeats.clear();
    }
}

export default new WebSocketService(); 