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
        this.heartbeatIntervalMs = 60000; // 60 seconds - less frequent heartbeats
        this.connectionTimeout = 300000; // 5 minutes - much longer timeout
        this.clientHeartbeats = new Map(); // userId -> last heartbeat timestamp
    }

    /**
     * Initialize WebSocket server with path-based routing
     */
    initialize(server) {
        // Prevent multiple initializations
        if (this.wss) {
            logger.warn('WebSocket server already initialized, skipping...');
            return;
        }

        this.wss = new WebSocketServer({
            server,
            // Configure WebSocket server options
            perMessageDeflate: false,
            maxPayload: 16 * 1024, // 16KB max message size
            clientTracking: true,
        });

        // Single WebSocket connection handler with path-based routing
        this.wss.on('connection', (ws, req) => {
            try {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const pathname = url.pathname;

                // Route based on path
                if (pathname === '/notifications/ws') {
                    this.handleNotificationConnection(ws, req);
                } else {
                    this.handleConnection(ws, req);
                }
            } catch (error) {
                logger.error('Error in WebSocket connection handler:', error);
                ws.close(1011, 'Internal server error');
            }
        });

        // Handle WebSocket server errors
        this.wss.on('error', (error) => {
            logger.error('WebSocket server error:', error);
        });

        // Start heartbeat mechanism
        this.startHeartbeat();

        logger.info('WebSocket server initialized with path-based routing');
        logger.info('Available endpoints: / (general chat), /notifications/ws (notifications)');
    }

    /**
     * Initialize Notification WebSocket server (now handled by main server)
     * This method is kept for backward compatibility but does nothing
     */
    initializeNotificationServer(server) {
        // This is now handled by the main initialize() method
        logger.info('Notification WebSocket routing handled by main WebSocket server');
    }

    /**
     * Handle new Notification WebSocket connection
     */
    handleNotificationConnection(ws, req) {
        // Extract token from query parameters
        const token = this.extractToken(req);

        if (!token) {
            ws.close(1008, 'Authentication required');
            return;
        }

        try {
            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;
            const userRole = decoded.role;

            // Check if user is authorized for notifications
            if (!['parent', 'teacher', 'principal', 'admin'].includes(userRole)) {
                ws.close(1008, 'Unauthorized access to notification stream');
                return;
            }

            // Store connection
            this.clients.set(userId, ws);
            this.clientHeartbeats.set(userId, Date.now());

            // Set connection metadata
            ws.userId = userId;
            ws.userRole = userRole;
            ws.connectionType = 'notification';
            ws.isAlive = true;

            // Send connection confirmation
            this.sendMessageToUser(userId, {
                type: 'connection_established',
                data: {
                    user_id: userId,
                    user_role: userRole,
                    connection_type: 'notification_stream',
                    timestamp: new Date().toISOString(),
                    message_types: this.getMessageTypesForRole(userRole)
                }
            });

            // Auto-subscribe to notifications only for parents
            if (userRole === 'parent') {
                this.subscribeToNotifications(userId);
            }

            // Handle incoming messages
            ws.on('message', (message) => {
                this.handleNotificationMessage(ws, message);
            });

            // Handle connection close
            ws.on('close', () => {
                this.handleDisconnect(userId);
            });

            // Handle ping/pong for heartbeat
            ws.on('pong', () => {
                ws.isAlive = true;
                this.clientHeartbeats.set(userId, Date.now());
            });

            // Handle errors
            ws.on('error', (error) => {
                logger.error(`Notification WebSocket error for user ${userId}:`, error);
                // Only disconnect if the connection is actually broken
                if (ws.readyState !== 1) {
                    this.handleDisconnect(userId);
                }
            });

            logger.info(`Notification WebSocket connected: User ${userId} (${userRole})`);

        } catch (error) {
            logger.error('Notification WebSocket authentication error:', error);
            ws.close(1008, 'Invalid token');
        }
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
                // Only disconnect if the connection is actually broken
                if (ws.readyState !== 1) {
                    this.handleDisconnect(userId);
                }
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

                case 'mark_as_read':
                    if (!message.message_id) {
                        this.sendMessageToUser(userId, {
                            type: 'error',
                            message: 'Message ID is required for marking as read'
                        });
                        return;
                    }
                    this.handleMarkAsRead(userId, message.message_id, message.thread_id);
                    break;

                case 'mark_thread_read':
                    if (!message.thread_id) {
                        this.sendMessageToUser(userId, {
                            type: 'error',
                            message: 'Thread ID is required for marking thread as read'
                        });
                        return;
                    }
                    this.handleMarkThreadRead(userId, message.thread_id);
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

                // AUTOMATICALLY mark all messages as read when subscribing to thread
                // This happens when user opens/views the chat
                this.handleMarkThreadRead(userId, threadId);

                this.sendMessageToUser(userId, {
                    type: 'thread_subscribed',
                    thread_id: threadId
                });

                logger.info(`User ${userId} subscribed to thread ${threadId} (auto-marking as read)`);
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
     * Handle notification WebSocket messages
     */
    handleNotificationMessage(ws, message) {
        try {
            const data = JSON.parse(message.toString());

            switch (data.type) {
                case 'ping':
                    // Respond to ping with pong
                    ws.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    }));
                    break;

                case 'heartbeat':
                    // Update heartbeat
                    ws.isAlive = true;
                    this.clientHeartbeats.set(ws.userId, Date.now());
                    break;

                case 'subscribe_notifications':
                    // Subscribe to specific notification types
                    this.handleNotificationSubscription(ws, data);
                    break;

                case 'unsubscribe_notifications':
                    // Unsubscribe from specific notification types
                    this.handleNotificationUnsubscription(ws, data);
                    break;

                default:
                    logger.warn(`Unknown notification message type: ${data.type}`);
            }
        } catch (error) {
            logger.error('Error handling notification message:', error);
        }
    }

    /**
     * Handle notification subscription
     */
    handleNotificationSubscription(ws, data) {
        const userId = ws.userId;
        const notificationTypes = data.notification_types || [];

        // Store subscription preferences
        if (!this.userSubscriptions.has(userId)) {
            this.userSubscriptions.set(userId, new Set());
        }

        notificationTypes.forEach(type => {
            this.userSubscriptions.get(userId).add(type);
        });

        logger.info(`User ${userId} subscribed to notification types: ${notificationTypes.join(', ')}`);
    }

    /**
     * Handle notification unsubscription
     */
    handleNotificationUnsubscription(ws, data) {
        const userId = ws.userId;
        const notificationTypes = data.notification_types || [];

        if (this.userSubscriptions.has(userId)) {
            notificationTypes.forEach(type => {
                this.userSubscriptions.get(userId).delete(type);
            });
        }

        logger.info(`User ${userId} unsubscribed from notification types: ${notificationTypes.join(', ')}`);
    }

    /**
     * Get message types available for different user roles
     */
    getMessageTypesForRole(role) {
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
     * Send notification to user via WebSocket
     */
    sendNotificationToUser(userId, notification) {
        const ws = this.clients.get(userId);
        if (ws && ws.readyState === 1) { // WebSocket is OPEN
            const message = {
                type: 'notification',
                data: {
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
                }
            };

            this.sendMessageToUser(userId, message);
            return true;
        }
        return false;
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
     * Check if message needs approval
     * Teacher -> Parent messages need approval
     * Parent -> Teacher messages do NOT need approval
     */
    async needsApproval(senderId, threadId) {
        try {
            // Get sender's role
            const { data: sender, error: senderError } = await adminSupabase
                .from('users')
                .select('role')
                .eq('id', senderId)
                .single();

            if (senderError || !sender) {
                logger.error('Error fetching sender role:', senderError);
                return false; // Default to no approval needed if error
            }

            // Only check if sender is a teacher
            if (sender.role !== 'teacher') {
                return false; // Non-teachers don't need approval
            }

            // Get all participants in the thread except the sender
            const { data: participants, error: participantsError } = await adminSupabase
                .from('chat_participants')
                .select('user_id, user:users!chat_participants_user_id_fkey(role)')
                .eq('thread_id', threadId)
                .neq('user_id', senderId);

            if (participantsError || !participants) {
                logger.error('Error fetching thread participants:', participantsError);
                return false;
            }

            // Check if any participant is a parent
            const hasParentRecipient = participants.some(p => p.user?.role === 'parent');

            // Teacher -> Parent requires approval
            // Teacher -> Teacher does NOT require approval
            return hasParentRecipient;

        } catch (error) {
            logger.error('Error in needsApproval check:', error);
            return false;
        }
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
                // Get user role to check if they're admin/principal
                const { data: user, error: userError } = await adminSupabase
                    .from('users')
                    .select('role')
                    .eq('id', userId)
                    .single();

                // Admin/Principal can access thread for monitoring without being added as participant
                if (user && ['admin', 'principal'].includes(user.role)) {
                    logger.info(`Admin/Principal ${userId} accessing thread ${thread_id} for monitoring`);
                    // Allow them to continue without adding as participant
                } else {
                    // For regular users, check if thread exists and add them
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

            // Check if message needs approval (Teacher -> Parent)
            const requiresApproval = await this.needsApproval(userId, thread_id);
            const approvalStatus = requiresApproval ? 'pending' : 'approved';

            // Create message in chat_messages table (primary storage for chat)
            const { data: newMessage, error } = await adminSupabase
                .from('chat_messages')
                .insert({
                    thread_id: thread_id,
                    sender_id: userId,
                    content,
                    message_type: message_type,
                    status: 'sent',
                    approval_status: approvalStatus
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
                    approval_status: newMessage.approval_status,
                    created_at: newMessage.created_at,
                    sender: newMessage.sender
                },
                message: requiresApproval
                    ? 'Message sent successfully and is pending approval'
                    : 'Message sent successfully'
            });

            // Only broadcast to other participants if message is approved
            // Pending messages (teacher -> parent) should not be visible until approved
            if (!requiresApproval || approvalStatus === 'approved') {
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
     * Handle marking a message as read
     */
    async handleMarkAsRead(userId, messageId, threadId) {
        try {
            // Get the message to verify access and get thread_id if not provided
            const { data: message, error: fetchError } = await adminSupabase
                .from('chat_messages')
                .select('id, thread_id, sender_id, approval_status')
                .eq('id', messageId)
                .single();

            if (fetchError || !message) {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Message not found'
                });
                return;
            }

            // Use thread_id from message if not provided
            const actualThreadId = threadId || message.thread_id;

            // Verify user is participant in thread
            const { data: participant, error: participantError } = await adminSupabase
                .from('chat_participants')
                .select('*')
                .eq('thread_id', actualThreadId)
                .eq('user_id', userId)
                .single();

            if (participantError || !participant) {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Access denied to this thread'
                });
                return;
            }

            // Don't mark own messages as read
            if (message.sender_id === userId) {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Cannot mark your own message as read'
                });
                return;
            }

            // Only approved messages can be marked as read
            if (message.approval_status !== 'approved') {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Cannot mark pending or rejected messages as read'
                });
                return;
            }

            // Insert read receipt
            const { data: readReceipt, error: insertError } = await adminSupabase
                .from('message_reads')
                .insert({
                    message_id: messageId,
                    user_id: userId,
                    read_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError && insertError.code !== '23505') { // 23505 = unique violation (already read)
                logger.error('Error creating read receipt via WebSocket:', insertError);
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Failed to mark message as read'
                });
                return;
            }

            // Update message status to 'read'
            await adminSupabase
                .from('chat_messages')
                .update({ status: 'read' })
                .eq('id', messageId)
                .neq('status', 'read');

            // Send confirmation to user
            this.sendMessageToUser(userId, {
                type: 'message_read',
                data: {
                    message_id: messageId,
                    thread_id: actualThreadId,
                    user_id: userId,
                    read_at: readReceipt?.read_at || new Date().toISOString()
                }
            });

            // Broadcast read receipt to message sender and other thread participants
            const { data: participants, error: participantsError } = await adminSupabase
                .from('chat_participants')
                .select('user_id')
                .eq('thread_id', actualThreadId);

            if (!participantsError && participants) {
                // Get user info for the read receipt
                const { data: userInfo } = await adminSupabase
                    .from('users')
                    .select('id, full_name, role')
                    .eq('id', userId)
                    .single();

                participants.forEach(participant => {
                    // Broadcast to everyone except the user who marked it as read
                    if (participant.user_id !== userId) {
                        this.sendMessageToUser(participant.user_id, {
                            type: 'message_read_by_other',
                            data: {
                                message_id: messageId,
                                thread_id: actualThreadId,
                                read_by: {
                                    user_id: userId,
                                    user_name: userInfo?.full_name || 'Unknown',
                                    user_role: userInfo?.role || 'Unknown'
                                },
                                read_at: readReceipt?.read_at || new Date().toISOString()
                            }
                        });
                    }
                });
            }

            logger.info(`Message ${messageId} marked as read by user ${userId} via WebSocket`);

        } catch (error) {
            logger.error(`Error handling mark as read via WebSocket:`, error);
            this.sendMessageToUser(userId, {
                type: 'error',
                message: 'Internal server error'
            });
        }
    }

    /**
     * Handle marking all messages in a thread as read
     */
    async handleMarkThreadRead(userId, threadId) {
        try {
            // Verify user is participant in thread
            const { data: participant, error: participantError } = await adminSupabase
                .from('chat_participants')
                .select('*')
                .eq('thread_id', threadId)
                .eq('user_id', userId)
                .single();

            if (participantError || !participant) {
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Access denied to this thread'
                });
                return;
            }

            // Get all unread approved messages in thread (not sent by user)
            const { data: messages, error } = await adminSupabase
                .from('chat_messages')
                .select('id')
                .eq('thread_id', threadId)
                .neq('sender_id', userId)
                .eq('approval_status', 'approved');

            if (error) {
                logger.error('Error getting messages to mark as read:', error);
                this.sendMessageToUser(userId, {
                    type: 'error',
                    message: 'Failed to fetch messages'
                });
                return;
            }

            if (!messages || messages.length === 0) {
                // Update last_read_at anyway
                await adminSupabase
                    .from('chat_participants')
                    .update({ last_read_at: new Date().toISOString() })
                    .eq('thread_id', threadId)
                    .eq('user_id', userId);

                this.sendMessageToUser(userId, {
                    type: 'thread_marked_read',
                    data: {
                        thread_id: threadId,
                        messages_marked: 0,
                        marked_at: new Date().toISOString()
                    }
                });
                return;
            }

            // Get already read messages
            const messageIds = messages.map(m => m.id);
            const { data: existingReads } = await adminSupabase
                .from('message_reads')
                .select('message_id')
                .eq('user_id', userId)
                .in('message_id', messageIds);

            const alreadyReadIds = new Set((existingReads || []).map(r => r.message_id));
            const unreadMessages = messages.filter(m => !alreadyReadIds.has(m.id));

            if (unreadMessages.length > 0) {
                // Insert read receipts for unread messages
                const readReceipts = unreadMessages.map(m => ({
                    message_id: m.id,
                    user_id: userId,
                    read_at: new Date().toISOString()
                }));

                const { error: insertError } = await adminSupabase
                    .from('message_reads')
                    .insert(readReceipts);

                if (insertError) {
                    logger.error('Error inserting read receipts:', insertError);
                    this.sendMessageToUser(userId, {
                        type: 'error',
                        message: 'Failed to mark messages as read'
                    });
                    return;
                }

                // Update message status to 'read'
                await adminSupabase
                    .from('chat_messages')
                    .update({ status: 'read' })
                    .in('id', unreadMessages.map(m => m.id))
                    .neq('status', 'read');
            }

            // Update last_read_at for backward compatibility
            await adminSupabase
                .from('chat_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('thread_id', threadId)
                .eq('user_id', userId);

            // Send confirmation to user
            this.sendMessageToUser(userId, {
                type: 'thread_marked_read',
                data: {
                    thread_id: threadId,
                    messages_marked: unreadMessages.length,
                    marked_at: new Date().toISOString()
                }
            });

            logger.info(`${unreadMessages.length} messages marked as read in thread ${threadId} by user ${userId} via WebSocket`);

        } catch (error) {
            logger.error(`Error handling mark thread as read via WebSocket:`, error);
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
            if (ws.readyState === 1) { // WebSocket is OPEN
                // Send ping to client without forcing disconnection
                try {
                    ws.send(JSON.stringify({
                        type: 'heartbeat',
                        timestamp: now,
                        timeout: this.connectionTimeout
                    }));
                } catch (error) {
                    logger.error(`Error sending heartbeat to user ${userId}:`, error);
                    // Only disconnect if there's an actual error sending
                    disconnectedUsers.push(userId);
                }
            } else {
                // WebSocket is not open, clean up
                disconnectedUsers.push(userId);
            }
        });

        // Clean up only truly disconnected users (not timeout-based)
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