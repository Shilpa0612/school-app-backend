import express from 'express';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Debug endpoint to check table structure
router.get('/debug/tables', authenticate, async (req, res) => {
    try {
        // Check if chat_threads table exists and has data
        const { data: threads, error: threadsError } = await adminSupabase
            .from('chat_threads')
            .select('*')
            .limit(5);

        // Check if chat_participants table exists and has data
        const { data: participants, error: participantsError } = await adminSupabase
            .from('chat_participants')
            .select('*')
            .limit(5);

        // Check if users table exists
        const { data: users, error: usersError } = await adminSupabase
            .from('users')
            .select('id, full_name, role')
            .limit(5);

        res.json({
            status: 'success',
            data: {
                threads: {
                    data: threads,
                    error: threadsError,
                    count: threads?.length || 0
                },
                participants: {
                    data: participants,
                    error: participantsError,
                    count: participants?.length || 0
                },
                users: {
                    data: users,
                    error: usersError,
                    count: users?.length || 0
                },
                current_user: {
                    id: req.user.id,
                    role: req.user.role
                }
            }
        });

    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Debug failed',
            error: error.message
        });
    }
});

// List chat threads
router.get('/threads', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'active' } = req.query;
        const offset = (page - 1) * limit;

        // Get threads where user is a participant
        const { data: userParticipations, error: participationError } = await adminSupabase
            .from('chat_participants')
            .select('thread_id')
            .eq('user_id', req.user.id);

        if (participationError) {
            logger.error('Error fetching user participations:', participationError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch user participations'
            });
        }

        if (!userParticipations || userParticipations.length === 0) {
            return res.json({
                status: 'success',
                data: {
                    threads: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: 0,
                        total_pages: 0
                    }
                }
            });
        }

        const threadIds = userParticipations.map(p => p.thread_id);

        // Get threads where user is a participant
        const { data: threads, error } = await adminSupabase
            .from('chat_threads')
            .select(`
                *,
                participants:chat_participants(
                    user_id,
                    role,
                    last_read_at,
                    user:users(full_name, role)
                ),
                last_message:chat_messages(
                    content,
                    created_at,
                    sender:users!chat_messages_sender_id_fkey(full_name)
                )
            `)
            .in('id', threadIds)
            .eq('status', status)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Get total count
        const { count, error: countError } = await adminSupabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .in('id', threadIds)
            .eq('status', status);

        if (countError) {
            logger.error('Error getting thread count:', countError);
        }

        res.json({
            status: 'success',
            data: {
                threads: threads || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in list chat threads:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Create test chat thread (for testing)
router.post('/test-thread', authenticate, async (req, res) => {
    try {
        // Create a simple test thread between current user and another user
        const { data: otherUser } = await adminSupabase
            .from('users')
            .select('id')
            .neq('id', req.user.id)
            .limit(1)
            .single();

        if (!otherUser) {
            return res.status(400).json({
                status: 'error',
                message: 'No other users found to create test thread'
            });
        }

        // Create thread
        const { data: thread, error: threadError } = await adminSupabase
            .from('chat_threads')
            .insert({
                thread_type: 'direct',
                title: 'Test Chat',
                created_by: req.user.id,
                status: 'active'
            })
            .select()
            .single();

        if (threadError) {
            console.error('Error creating thread:', threadError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create test thread'
            });
        }

        // Add participants
        const participants = [
            { thread_id: thread.id, user_id: req.user.id, role: 'member' },
            { thread_id: thread.id, user_id: otherUser.id, role: 'member' }
        ];

        const { error: participantError } = await adminSupabase
            .from('chat_participants')
            .insert(participants);

        if (participantError) {
            console.error('Error adding participants:', participantError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to add participants'
            });
        }

        res.json({
            status: 'success',
            data: {
                message: 'Test thread created successfully',
                thread: {
                    id: thread.id,
                    thread_type: thread.thread_type,
                    title: thread.title,
                    participants: participants.length
                }
            }
        });

    } catch (error) {
        console.error('Error creating test thread:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create test thread'
        });
    }
});

// Create chat thread and send first message in one operation
router.post('/start-conversation', authenticate, async (req, res) => {
    try {
        const { participants, message_content, thread_type = 'direct', title = null } = req.body;

        // Validate required fields
        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Participants array and message content are required'
            });
        }

        if (!message_content || message_content.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Message content is required'
            });
        }

        // Validate thread type
        if (!['direct', 'group'].includes(thread_type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Thread type must be direct or group'
            });
        }

        // Add current user to participants if not already included
        const allParticipants = participants.includes(req.user.id)
            ? participants
            : [...participants, req.user.id];

        // For direct chats, ensure only 2 participants
        if (thread_type === 'direct' && allParticipants.length !== 2) {
            return res.status(400).json({
                status: 'error',
                message: 'Direct chats must have exactly 2 participants'
            });
        }

        // Verify all participants exist
        const { data: users, error: usersError } = await adminSupabase
            .from('users')
            .select('id, full_name')
            .in('id', allParticipants);

        if (usersError) {
            logger.error('Error verifying participants:', usersError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to verify participants'
            });
        }

        if (users.length !== allParticipants.length) {
            return res.status(400).json({
                status: 'error',
                message: 'One or more participants not found'
            });
        }

        // Create thread using adminSupabase to bypass RLS
        const { data: thread, error: threadError } = await adminSupabase
            .from('chat_threads')
            .insert({
                thread_type,
                title: title || `${users.find(u => u.id === req.user.id)?.full_name} & ${users.find(u => u.id !== req.user.id)?.full_name}`,
                created_by: req.user.id
            })
            .select()
            .single();

        if (threadError) {
            logger.error('Error creating chat thread:', threadError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create chat thread'
            });
        }

        // Add participants using adminSupabase to bypass RLS
        const participantData = allParticipants.map(userId => ({
            thread_id: thread.id,
            user_id: userId,
            role: userId === req.user.id ? 'admin' : 'member'
        }));

        const { error: participantsError } = await adminSupabase
            .from('chat_participants')
            .insert(participantData);

        if (participantsError) {
            logger.error('Error adding participants:', participantsError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to add participants'
            });
        }

        // Send the first message
        const { data: message, error: messageError } = await adminSupabase
            .from('chat_messages')
            .insert({
                thread_id: thread.id,
                sender_id: req.user.id,
                content: message_content.trim(),
                message_type: 'text'
            })
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role)
            `)
            .single();

        if (messageError) {
            logger.error('Error sending first message:', messageError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to send first message'
            });
        }

        // Update thread's updated_at timestamp
        await adminSupabase
            .from('chat_threads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', thread.id);

        res.status(201).json({
            status: 'success',
            data: {
                thread: {
                    id: thread.id,
                    thread_type: thread.thread_type,
                    title: thread.title,
                    created_by: thread.created_by,
                    created_at: thread.created_at
                },
                message: {
                    id: message.id,
                    content: message.content,
                    sender: message.sender,
                    created_at: message.created_at
                },
                participants: allParticipants.length
            }
        });

    } catch (error) {
        logger.error('Error in start conversation:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Create chat thread (original endpoint - kept for backward compatibility)
router.post('/threads', authenticate, async (req, res) => {
    try {
        const { thread_type, title, participants } = req.body;

        // Validate required fields
        if (!thread_type || !participants || !Array.isArray(participants)) {
            return res.status(400).json({
                status: 'error',
                message: 'Thread type and participants array are required'
            });
        }

        // Validate thread type
        if (!['direct', 'group'].includes(thread_type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Thread type must be direct or group'
            });
        }

        // Validate participants
        if (participants.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'At least one participant is required'
            });
        }

        // Add current user to participants if not already included
        if (!participants.includes(req.user.id)) {
            participants.push(req.user.id);
        }

        // For direct chats, ensure only 2 participants
        if (thread_type === 'direct' && participants.length !== 2) {
            return res.status(400).json({
                status: 'error',
                message: 'Direct chats must have exactly 2 participants'
            });
        }

        // Verify all participants exist
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id')
            .in('id', participants);

        if (usersError) {
            logger.error('Error verifying participants:', usersError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to verify participants'
            });
        }

        if (users.length !== participants.length) {
            return res.status(400).json({
                status: 'error',
                message: 'One or more participants not found'
            });
        }

        // Create thread using adminSupabase to bypass RLS
        const { data: thread, error: threadError } = await adminSupabase
            .from('chat_threads')
            .insert({
                thread_type,
                title: title || null,
                created_by: req.user.id
            })
            .select()
            .single();

        if (threadError) {
            logger.error('Error creating chat thread:', threadError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create chat thread'
            });
        }

        // Add participants using adminSupabase to bypass RLS
        const participantData = participants.map(userId => ({
            thread_id: thread.id,
            user_id: userId,
            role: userId === req.user.id ? 'admin' : 'member'
        }));

        const { error: participantsError } = await adminSupabase
            .from('chat_participants')
            .insert(participantData);

        if (participantsError) {
            logger.error('Error adding participants:', participantsError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to add participants'
            });
        }

        res.status(201).json({
            status: 'success',
            data: thread
        });

    } catch (error) {
        logger.error('Error in create chat thread:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get chat messages
router.get('/messages', authenticate, async (req, res) => {
    try {
        const { thread_id, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        if (!thread_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Thread ID is required'
            });
        }

        // Verify user is participant in thread
        const { data: participant, error: participantError } = await adminSupabase
            .from('chat_participants')
            .select('*')
            .eq('thread_id', thread_id)
            .eq('user_id', req.user.id)
            .single();

        if (participantError || !participant) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied to this thread'
            });
        }

        // Get messages
        const { data: messages, error } = await adminSupabase
            .from('chat_messages')
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role),
                attachments:chat_message_attachments(*)
            `)
            .eq('thread_id', thread_id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching messages:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch messages'
            });
        }

        // Update last read timestamp
        await adminSupabase
            .from('chat_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('thread_id', thread_id)
            .eq('user_id', req.user.id);

        // Get total count
        const { count, error: countError } = await adminSupabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('thread_id', thread_id);

        if (countError) {
            logger.error('Error getting message count:', countError);
        }

        res.json({
            status: 'success',
            data: {
                messages: messages.reverse(), // Show oldest first
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in get messages:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Send message
router.post('/messages', authenticate, async (req, res) => {
    try {
        const { thread_id, content, message_type = 'text' } = req.body;

        // Validate required fields
        if (!thread_id || !content) {
            return res.status(400).json({
                status: 'error',
                message: 'Thread ID and content are required'
            });
        }

        // Validate message type
        if (!['text', 'image', 'file', 'system'].includes(message_type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid message type'
            });
        }

        // Verify user is participant in thread
        const { data: participant, error: participantError } = await adminSupabase
            .from('chat_participants')
            .select('*')
            .eq('thread_id', thread_id)
            .eq('user_id', req.user.id)
            .single();

        if (participantError || !participant) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied to this thread'
            });
        }

        // Check if thread is active
        const { data: thread, error: threadError } = await adminSupabase
            .from('chat_threads')
            .select('status')
            .eq('id', thread_id)
            .single();

        if (threadError || thread.status !== 'active') {
            return res.status(400).json({
                status: 'error',
                message: 'Thread is not active'
            });
        }

        // Create message
        const { data: message, error } = await adminSupabase
            .from('chat_messages')
            .insert({
                thread_id,
                sender_id: req.user.id,
                content,
                message_type
            })
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role)
            `)
            .single();

        if (error) {
            logger.error('Error creating message:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create message'
            });
        }

        // Update thread's updated_at timestamp
        await adminSupabase
            .from('chat_threads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', thread_id);

        res.status(201).json({
            status: 'success',
            data: message
        });

    } catch (error) {
        logger.error('Error in send message:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update message (only sender can update)
router.put('/messages/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                status: 'error',
                message: 'Content is required'
            });
        }

        // Get the message
        const { data: message, error: fetchError } = await adminSupabase
            .from('chat_messages')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Message not found'
                });
            }
            logger.error('Error fetching message:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch message'
            });
        }

        // Check if user is the sender
        if (message.sender_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only update your own messages'
            });
        }

        // Update message
        const { data: updatedMessage, error: updateError } = await adminSupabase
            .from('chat_messages')
            .update({ content })
            .eq('id', id)
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role)
            `)
            .single();

        if (updateError) {
            logger.error('Error updating message:', updateError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update message'
            });
        }

        res.json({
            status: 'success',
            data: updatedMessage
        });

    } catch (error) {
        logger.error('Error in update message:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Delete message (only sender can delete)
router.delete('/messages/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Get the message
        const { data: message, error: fetchError } = await adminSupabase
            .from('chat_messages')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Message not found'
                });
            }
            logger.error('Error fetching message:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch message'
            });
        }

        // Check if user is the sender
        if (message.sender_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only delete your own messages'
            });
        }

        // Delete message (cascade will handle attachments)
        const { error: deleteError } = await adminSupabase
            .from('chat_messages')
            .delete()
            .eq('id', id);

        if (deleteError) {
            logger.error('Error deleting message:', deleteError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to delete message'
            });
        }

        res.json({
            status: 'success',
            message: 'Message deleted successfully'
        });

    } catch (error) {
        logger.error('Error in delete message:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Add participant to thread (admin only)
router.post('/threads/:id/participants', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, participant_ids, role = 'member' } = req.body;

        // Handle both single user_id and array of participant_ids
        let userIds = [];
        if (user_id) {
            userIds = [user_id];
        } else if (participant_ids && Array.isArray(participant_ids)) {
            userIds = participant_ids;
        } else {
            return res.status(400).json({
                status: 'error',
                message: 'User ID or participant_ids array is required'
            });
        }

        if (userIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'At least one user ID is required'
            });
        }

        // Check if user is admin of the thread
        const { data: participant, error: participantError } = await adminSupabase
            .from('chat_participants')
            .select('role')
            .eq('thread_id', id)
            .eq('user_id', req.user.id)
            .single();

        if (participantError || participant.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Only thread admins can add participants'
            });
        }

        // Check if users are already participants
        const { data: existingParticipants, error: existingError } = await adminSupabase
            .from('chat_participants')
            .select('user_id')
            .eq('thread_id', id)
            .in('user_id', userIds);

        if (existingError) {
            logger.error('Error checking existing participants:', existingError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to check existing participants'
            });
        }

        const existingUserIds = existingParticipants.map(p => p.user_id);
        const newUserIds = userIds.filter(id => !existingUserIds.includes(id));

        if (newUserIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'All users are already participants'
            });
        }

        // Add participants
        const participantData = newUserIds.map(userId => ({
            thread_id: id,
            user_id: userId,
            role
        }));

        const { data: newParticipants, error } = await adminSupabase
            .from('chat_participants')
            .insert(participantData)
            .select(`
                *,
                user:users(full_name, role)
            `);

        if (error) {
            logger.error('Error adding participants:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to add participants'
            });
        }

        res.status(201).json({
            status: 'success',
            data: {
                added: newParticipants,
                total_added: newParticipants.length,
                already_participants: existingUserIds
            }
        });

    } catch (error) {
        logger.error('Error in add participant:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Real-time messaging endpoints

// Subscribe to real-time messages
router.post('/subscribe', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Subscribe to real-time messages
        realtimeService.subscribeToMessages(
            userId,
            (message) => {
                // This callback will be called when new messages arrive
                // In a real implementation, you'd send this via WebSocket or SSE
                logger.info(`New message for user ${userId}:`, message);
            },
            (error) => {
                logger.error(`Real-time error for user ${userId}:`, error);
            }
        );

        res.json({
            status: 'success',
            message: 'Subscribed to real-time messages',
            user_id: userId
        });

    } catch (error) {
        logger.error('Error subscribing to real-time messages:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to subscribe to real-time messages'
        });
    }
});

// Get offline messages (messages since last check)
router.get('/offline-messages', authenticate, async (req, res) => {
    try {
        const { last_check_time } = req.query;
        const userId = req.user.id;

        if (!last_check_time) {
            return res.status(400).json({
                status: 'error',
                message: 'Last check time is required'
            });
        }

        const messages = await realtimeService.getOfflineMessages(userId, last_check_time);

        res.json({
            status: 'success',
            data: {
                messages,
                count: messages.length,
                last_check_time: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error getting offline messages:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get offline messages'
        });
    }
});

// Get unread message count
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await realtimeService.getUnreadCount(userId);

        res.json({
            status: 'success',
            data: {
                unread_count: count
            }
        });

    } catch (error) {
        logger.error('Error getting unread count:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get unread count'
        });
    }
});

// Unsubscribe from real-time messages
router.post('/unsubscribe', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        realtimeService.unsubscribeUser(userId);

        res.json({
            status: 'success',
            message: 'Unsubscribed from real-time messages',
            user_id: userId
        });

    } catch (error) {
        logger.error('Error unsubscribing from real-time messages:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to unsubscribe from real-time messages'
        });
    }
});

// Mark messages as read for a thread
router.post('/mark-read/:thread_id', authenticate, async (req, res) => {
    try {
        const { thread_id } = req.params;
        const userId = req.user.id;

        // Verify user is participant in thread
        const { data: participant, error: participantError } = await supabase
            .from('chat_participants')
            .select('*')
            .eq('thread_id', thread_id)
            .eq('user_id', userId)
            .single();

        if (participantError || !participant) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied to this thread'
            });
        }

        // Update last read timestamp
        await realtimeService.updateLastRead(thread_id, userId);

        res.json({
            status: 'success',
            message: 'Messages marked as read',
            thread_id,
            user_id: userId
        });

    } catch (error) {
        logger.error('Error marking messages as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark messages as read'
        });
    }
});

export default router; 