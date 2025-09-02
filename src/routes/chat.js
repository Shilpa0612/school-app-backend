import express from 'express';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Helper function to check for existing threads between participants
async function findExistingThread(participantIds, threadType) {
    try {
        // For direct chats, find exact match of 2 participants
        if (threadType === 'direct') {
            const { data: existingThreads, error } = await adminSupabase
                .from('chat_threads')
                .select(`
                    id,
                    title,
                    thread_type,
                    created_at,
                    updated_at,
                    participants:chat_participants(user_id)
                `)
                .eq('thread_type', 'direct');

            if (error) {
                logger.error('Error checking for existing threads:', error);
                return null;
            }

            // Find thread with exact participant match
            for (const thread of existingThreads || []) {
                const threadParticipantIds = thread.participants.map(p => p.user_id).sort();
                const requestedParticipantIds = [...participantIds].sort();

                if (JSON.stringify(threadParticipantIds) === JSON.stringify(requestedParticipantIds)) {
                    return thread;
                }
            }
        } else {
            // For group chats, check if exact same participant set exists
            const { data: existingThreads, error } = await adminSupabase
                .from('chat_threads')
                .select(`
                    id,
                    title,
                    thread_type,
                    created_at,
                    updated_at,
                    participants:chat_participants(user_id)
                `)
                .eq('thread_type', 'group');

            if (error) {
                logger.error('Error checking for existing group threads:', error);
                return null;
            }

            // Find thread with exact participant match
            for (const thread of existingThreads || []) {
                const threadParticipantIds = thread.participants.map(p => p.user_id).sort();
                const requestedParticipantIds = [...participantIds].sort();

                if (JSON.stringify(threadParticipantIds) === JSON.stringify(requestedParticipantIds)) {
                    return thread;
                }
            }
        }

        return null;
    } catch (error) {
        logger.error('Error in findExistingThread:', error);
        return null;
    }
}

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
        const { page = 1, limit = 20, status } = req.query; // Made status optional
        const offset = (page - 1) * limit;

        logger.info(`Fetching threads for user ${req.user.id} (${req.user.role}) with filters:`, {
            page, limit, status, user_id: req.user.id, user_role: req.user.role
        });

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

        logger.info(`Found ${userParticipations?.length || 0} participations for user`);

        if (!userParticipations || userParticipations.length === 0) {
            logger.info('No participations found, returning empty result');
            return res.json({
                status: 'success',
                data: {
                    threads: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: 0,
                        total_pages: 0
                    },
                    debug_info: {
                        user_id: req.user.id,
                        user_role: req.user.role,
                        participations_found: 0,
                        message: 'No chat participations found for this user'
                    }
                }
            });
        }

        const threadIds = userParticipations.map(p => p.thread_id);
        logger.info(`Thread IDs where user is participant:`, threadIds);

        // Build query for threads
        let query = adminSupabase
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
            .order('updated_at', { ascending: false });

        // Apply status filter only if provided
        if (status) {
            query = query.eq('status', status);
            logger.info(`Applied status filter: ${status}`);
        }

        // Get threads with pagination
        const { data: threads, error } = await query.range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching threads:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch threads'
            });
        }

        // Get total count
        let countQuery = adminSupabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .in('id', threadIds);

        if (status) {
            countQuery = countQuery.eq('status', status);
        }

        const { count, error: countError } = await countQuery;

        if (countError) {
            logger.error('Error getting thread count:', countError);
        }

        logger.info(`Returning ${threads?.length || 0} threads out of ${count || 0} total`);

        res.json({
            status: 'success',
            data: {
                threads: threads || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                },
                debug_info: {
                    user_id: req.user.id,
                    user_role: req.user.role,
                    participations_found: userParticipations.length,
                    thread_ids_filtered: threadIds,
                    status_filter: status || 'none',
                    threads_returned: threads?.length || 0,
                    total_threads: count || 0
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

        // Check for existing thread
        const existingThread = await findExistingThread(allParticipants, thread_type);

        if (existingThread) {
            logger.info('Found existing thread, reusing it:', existingThread);
            // If thread exists, add current user as participant
            const { error: participantError } = await adminSupabase
                .from('chat_participants')
                .insert({ thread_id: existingThread.id, user_id: req.user.id, role: 'member' });

            if (participantError) {
                logger.error('Error adding participant to existing thread:', participantError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to add participant to existing thread'
                });
            }

            // Send the first message
            const { data: message, error: messageError } = await adminSupabase
                .from('chat_messages')
                .insert({
                    thread_id: existingThread.id,
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
                .eq('id', existingThread.id);

            res.status(201).json({
                status: 'success',
                data: {
                    thread: {
                        id: existingThread.id,
                        thread_type: existingThread.thread_type,
                        title: existingThread.title,
                        created_by: existingThread.created_by,
                        created_at: existingThread.created_at
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
        } else {
            // Create new thread
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
        }

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

        // Check for existing thread
        const existingThread = await findExistingThread(participants, thread_type);

        if (existingThread) {
            logger.info('Found existing thread, reusing it:', existingThread);
            // If thread exists, add current user as participant
            const { error: participantError } = await adminSupabase
                .from('chat_participants')
                .insert({ thread_id: existingThread.id, user_id: req.user.id, role: 'member' });

            if (participantError) {
                logger.error('Error adding participant to existing thread:', participantError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to add participant to existing thread'
                });
            }

            res.status(201).json({
                status: 'success',
                data: existingThread
            });
        } else {
            // Create new thread
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
        }

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

        // Get messages from chat_messages table (primary storage for chat)
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

        // Get total count from chat_messages table
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

        // Create message in messages table (main storage)
        const { data: message, error } = await adminSupabase
            .from('messages')
            .insert({
                sender_id: req.user.id,
                content,
                type: 'individual', // Chat messages are individual conversations
                status: 'approved', // Real-time messages are auto-approved
                thread_id: thread_id, // Store thread reference
                message_type: message_type
            })
            .select(`
                *,
                sender:users!messages_sender_id_fkey(full_name, role)
            `)
            .single();

        if (error) {
            logger.error('Error creating message:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create message'
            });
        }

        // Also create a reference in chat_messages for real-time functionality
        const { error: chatMessageError } = await adminSupabase
            .from('chat_messages')
            .insert({
                thread_id,
                sender_id: req.user.id,
                content,
                message_type,
                message_id: message.id // Reference to main message
            });

        if (chatMessageError) {
            logger.error('Error creating chat message reference:', chatMessageError);
            // Don't fail the request, just log the error
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

// Expand existing group chat by adding new participants
router.post('/threads/:id/expand', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { new_participants, message_content = null } = req.body;

        if (!new_participants || !Array.isArray(new_participants) || new_participants.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'New participants array is required'
            });
        }

        // Verify user is admin of the thread
        const { data: participant, error: participantError } = await adminSupabase
            .from('chat_participants')
            .select('role')
            .eq('thread_id', id)
            .eq('user_id', req.user.id)
            .single();

        if (participantError || participant.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Only thread admins can expand group chats'
            });
        }

        // Check if thread is a group chat
        const { data: thread, error: threadError } = await adminSupabase
            .from('chat_threads')
            .select('thread_type, title')
            .eq('id', id)
            .single();

        if (threadError || !thread) {
            return res.status(404).json({
                status: 'error',
                message: 'Thread not found'
            });
        }

        if (thread.thread_type !== 'group') {
            return res.status(400).json({
                status: 'error',
                message: 'Can only expand group chats'
            });
        }

        // Verify new participants exist
        const { data: users, error: usersError } = await adminSupabase
            .from('users')
            .select('id, full_name')
            .in('id', new_participants);

        if (usersError) {
            logger.error('Error verifying new participants:', usersError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to verify new participants'
            });
        }

        if (users.length !== new_participants.length) {
            return res.status(400).json({
                status: 'error',
                message: 'One or more new participants not found'
            });
        }

        // Check if any new participants are already in the thread
        const { data: existingParticipants, error: existingError } = await adminSupabase
            .from('chat_participants')
            .select('user_id')
            .eq('thread_id', id)
            .in('user_id', new_participants);

        if (existingError) {
            logger.error('Error checking existing participants:', existingError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to check existing participants'
            });
        }

        const existingUserIds = existingParticipants.map(p => p.user_id);
        const actuallyNewUserIds = new_participants.filter(id => !existingUserIds.includes(id));

        if (actuallyNewUserIds.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'All new participants are already in the group'
            });
        }

        // Add new participants
        const participantData = actuallyNewUserIds.map(userId => ({
            thread_id: id,
            user_id: userId,
            role: 'member'
        }));

        const { data: newParticipants, error: addError } = await adminSupabase
            .from('chat_participants')
            .insert(participantData)
            .select(`
                *,
                user:users(full_name, role)
            `);

        if (addError) {
            logger.error('Error adding new participants:', addError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to add new participants'
            });
        }

        // Update thread title to reflect new participant count
        const { data: allParticipants, error: countError } = await adminSupabase
            .from('chat_participants')
            .select('user_id')
            .eq('thread_id', id);

        if (!countError && allParticipants) {
            const newTitle = `Group Chat (${allParticipants.length} participants)`;
            await adminSupabase
                .from('chat_threads')
                .update({
                    title: newTitle,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
        }

        // Send welcome message if provided
        let welcomeMessage = null;
        if (message_content && message_content.trim()) {
            const { data: message, error: messageError } = await adminSupabase
                .from('chat_messages')
                .insert({
                    thread_id: id,
                    sender_id: req.user.id,
                    content: message_content.trim(),
                    message_type: 'text',
                    status: 'sent'
                })
                .select(`
                    *,
                    sender:users!chat_messages_sender_id_fkey(full_name, role)
                `)
                .single();

            if (!messageError) {
                welcomeMessage = message;
            }
        }

        res.status(200).json({
            status: 'success',
            data: {
                thread_id: id,
                added_participants: newParticipants,
                total_added: newParticipants.length,
                already_participants: existingUserIds,
                new_title: `Group Chat (${(allParticipants?.length || 0)} participants)`,
                welcome_message: welcomeMessage
            }
        });

    } catch (error) {
        logger.error('Error expanding group chat:', error);
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

// Get my threads (alias for /threads - makes it clearer)
router.get('/my-threads', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        logger.info(`Fetching MY threads for user ${req.user.id} (${req.user.role})`);

        // Get threads where user is a participant
        const { data: userParticipations, error: participationError } = await adminSupabase
            .from('chat_participants')
            .select('thread_id')
            .eq('user_id', req.user.id);

        if (participationError) {
            logger.error('Error fetching user participations:', participationError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch your chat participations'
            });
        }

        if (!userParticipations || userParticipations.length === 0) {
            return res.json({
                status: 'success',
                message: 'You have no chat threads yet',
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

        // Build query for threads
        let query = adminSupabase
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
            .order('updated_at', { ascending: false });

        // Apply status filter only if provided
        if (status) {
            query = query.eq('status', status);
        }

        // Get threads with pagination
        const { data: threads, error } = await query.range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching threads:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch your threads'
            });
        }

        // Get total count
        let countQuery = adminSupabase
            .from('chat_threads')
            .select('*', { count: 'exact', head: true })
            .in('id', threadIds);

        if (status) {
            countQuery = countQuery.eq('status', status);
        }

        const { count, error: countError } = await countQuery;

        if (countError) {
            logger.error('Error getting thread count:', countError);
        }

        res.json({
            status: 'success',
            message: `Found ${threads?.length || 0} of your chat threads`,
            data: {
                threads: threads || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                },
                summary: {
                    total_my_threads: count || 0,
                    threads_shown: threads?.length || 0,
                    user_id: req.user.id,
                    user_role: req.user.role
                }
            }
        });

    } catch (error) {
        logger.error('Error in get my threads:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Check if thread exists between participants
router.post('/check-existing-thread', authenticate, async (req, res) => {
    try {
        const { participants, thread_type = 'direct' } = req.body;

        if (!participants || !Array.isArray(participants) || participants.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Participants array is required'
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

        // Check for existing thread
        const existingThread = await findExistingThread(allParticipants, thread_type);

        if (existingThread) {
            // Get participant details
            const { data: participantDetails, error: participantError } = await adminSupabase
                .from('chat_participants')
                .select(`
                    user_id,
                    role,
                    last_read_at,
                    user:users(full_name, role)
                `)
                .eq('thread_id', existingThread.id);

            if (participantError) {
                logger.error('Error fetching participant details:', participantError);
            }

            // Get message count
            const { count: messageCount, error: countError } = await adminSupabase
                .from('chat_messages')
                .select('*', { count: 'exact', head: true })
                .eq('thread_id', existingThread.id);

            if (countError) {
                logger.error('Error getting message count:', countError);
            }

            return res.json({
                status: 'success',
                data: {
                    exists: true,
                    thread: {
                        ...existingThread,
                        participants: participantDetails || [],
                        message_count: messageCount || 0
                    }
                }
            });
        } else {
            return res.json({
                status: 'success',
                data: {
                    exists: false,
                    thread: null
                }
            });
        }

    } catch (error) {
        logger.error('Error checking existing thread:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

export default router; 