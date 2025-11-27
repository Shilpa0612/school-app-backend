import express from 'express';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import notificationService from '../services/notificationService.js';
import websocketService from '../services/websocketService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Helper function to check if message needs approval
// Teacher -> Parent messages need approval
// Parent -> Teacher messages do NOT need approval
async function needsApproval(senderId, threadId) {
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

// ========== NOTIFICATION HELPER FUNCTIONS ==========

/**
 * Send notifications to parent when a message is approved
 */
async function sendChatMessageApprovalNotifications(approvedMessage, threadParticipants) {
    try {
        console.log('💬 sendChatMessageApprovalNotifications called for message:', approvedMessage.id);

        // Get parent participants from the thread
        const parentParticipants = threadParticipants.filter(p => p.user?.role === 'parent');

        if (parentParticipants.length === 0) {
            console.log('⏭️ No parent participants found, skipping notifications');
            return;
        }

        console.log(`📊 Found ${parentParticipants.length} parent participants for message approval notification`);

        // Send notifications to each parent
        const notificationPromises = parentParticipants.map(async (participant) => {
            const parentId = participant.user_id;
            const parentName = participant.user?.full_name || 'Parent';

            console.log(`📨 Sending message approval notification to parent ${parentId}`);

            // Get student information for this parent
            const { data: parentStudents, error: parentError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    student:students_master!parent_student_mappings_student_id_fkey(
                        full_name,
                        admission_number
                    )
                `)
                .eq('parent_id', parentId)
                .limit(1); // Get first student for notification

            if (parentError || !parentStudents || parentStudents.length === 0) {
                console.error(`❌ Error fetching student for parent ${parentId}:`, parentError);
                return { success: false, error: parentError };
            }

            const student = parentStudents[0].student;
            const studentId = parentStudents[0].student_id;

            const result = await notificationService.sendParentNotification({
                parentId: parentId,
                studentId: studentId,
                type: notificationService.notificationTypes.MESSAGE,
                title: `New Message from ${approvedMessage.sender.full_name}`,
                message: approvedMessage.content,
                data: {
                    message_id: approvedMessage.id,
                    thread_id: approvedMessage.thread_id,
                    sender_name: approvedMessage.sender.full_name,
                    sender_role: approvedMessage.sender.role,
                    message_type: approvedMessage.message_type,
                    approved_by: approvedMessage.approver?.full_name || 'Principal',
                    approved_at: approvedMessage.approved_at,
                    student_name: student.full_name,
                    student_admission_number: student.admission_number
                },
                priority: notificationService.priorityLevels.HIGH,
                relatedId: approvedMessage.id
            });

            console.log(`✅ Message approval notification result for parent ${parentId}:`, result.success ? 'SUCCESS' : 'FAILED');
            return result;
        });

        // Send all notifications in parallel (non-blocking)
        setTimeout(() => {
            Promise.all(notificationPromises).then(results => {
                const successCount = results.filter(r => r.success).length;
                console.log(`✅ Sent message approval notifications to ${successCount}/${parentParticipants.length} parents`);
            }).catch(error => {
                console.error('❌ Error in message approval notification sending:', error);
            });
        }, 100); // Small delay to ensure message is fully processed

    } catch (error) {
        console.error('Error in sendChatMessageApprovalNotifications:', error);
    }
}

/**
 * Send notification to teacher when their message is rejected
 */
async function sendChatMessageRejectionNotification(rejectedMessage) {
    try {
        console.log('💬 sendChatMessageRejectionNotification called for message:', rejectedMessage.id);

        const teacherId = rejectedMessage.sender_id;
        const teacherName = rejectedMessage.sender?.full_name || 'Teacher';

        console.log(`📨 Sending message rejection notification to teacher ${teacherId}`);

        // Send notification to teacher via WebSocket if connected
        const isConnected = websocketService.isUserConnected(teacherId);

        if (isConnected) {
            websocketService.sendMessageToUser(teacherId, {
                type: 'message_rejected',
                data: {
                    message: rejectedMessage,
                    rejection_reason: rejectedMessage.rejection_reason,
                    rejected_by: rejectedMessage.approver?.full_name || 'Principal',
                    rejected_at: rejectedMessage.approved_at
                }
            });
            console.log(`📤 Sent rejection notification to teacher ${teacherId} via WebSocket`);
        } else {
            console.log(`⏭️ Teacher ${teacherId} not connected, skipping WebSocket notification`);
        }

        // Also create a notification record for the teacher
        try {
            // Get a student ID for the teacher (for notification record)
            const { data: teacherStudents, error: studentError } = await adminSupabase
                .from('parent_student_mappings')
                .select('student_id')
                .eq('parent_id', teacherId)
                .limit(1);

            const studentId = teacherStudents && teacherStudents.length > 0 ? teacherStudents[0].student_id : null;

            if (studentId) {
                const { data: notification, error } = await adminSupabase
                    .from('parent_notifications')
                    .insert({
                        parent_id: teacherId, // Using teacher as recipient
                        student_id: studentId, // Use first student for teacher notifications
                        type: 'system',
                        title: 'Message Rejected',
                        message: `Your message was rejected: ${rejectedMessage.rejection_reason}`,
                        data: JSON.stringify({
                            message_id: rejectedMessage.id,
                            thread_id: rejectedMessage.thread_id,
                            rejection_reason: rejectedMessage.rejection_reason,
                            rejected_by: rejectedMessage.approver?.full_name || 'Principal',
                            rejected_at: rejectedMessage.approved_at
                        }),
                        priority: 'high',
                        related_id: rejectedMessage.id,
                        is_read: false,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('❌ Error creating rejection notification record:', error);
                } else {
                    console.log(`✅ Created rejection notification record for teacher ${teacherId}`);
                }
            } else {
                console.log(`⚠️ No student mapping found for teacher ${teacherId}, skipping notification record`);
            }
        } catch (notificationError) {
            console.error('❌ Error creating rejection notification:', notificationError);
        }

    } catch (error) {
        console.error('Error in sendChatMessageRejectionNotification:', error);
    }
}

/**
 * Broadcast approved message to thread participants via WebSocket
 */
async function broadcastApprovedMessage(approvedMessage, threadId) {
    try {
        console.log('📡 Broadcasting approved message to thread participants:', threadId);

        // Get all participants in the thread
        const { data: participants, error: participantsError } = await adminSupabase
            .from('chat_participants')
            .select(`
                user_id,
                user:users!chat_participants_user_id_fkey(id, full_name, role)
            `)
            .eq('thread_id', threadId);

        if (participantsError || !participants) {
            console.error('❌ Error fetching thread participants for broadcast:', participantsError);
            return;
        }

        console.log(`📊 Found ${participants.length} participants to broadcast to`);

        // Broadcast to all participants
        participants.forEach(participant => {
            const userId = participant.user_id;
            const isConnected = websocketService.isUserConnected(userId);

            if (isConnected) {
                websocketService.sendMessageToUser(userId, {
                    type: 'message_approved',
                    data: {
                        message: approvedMessage,
                        thread_id: threadId,
                        approved_at: approvedMessage.approved_at,
                        approver: approvedMessage.approver
                    }
                });
                console.log(`📤 Broadcasted approved message to user ${userId}`);
            } else {
                console.log(`⏭️ User ${userId} not connected, skipping broadcast`);
            }
        });

    } catch (error) {
        console.error('Error broadcasting approved message:', error);
    }
}

// ========== READ RECEIPT HELPER FUNCTIONS ==========

// Helper function to mark a message as read
async function markMessageAsRead(messageId, userId) {
    try {
        // Insert read receipt (ON CONFLICT DO NOTHING handles duplicates)
        const { data, error } = await adminSupabase
            .from('message_reads')
            .insert({
                message_id: messageId,
                user_id: userId,
                read_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error && error.code !== '23505') { // 23505 = unique violation (already read)
            logger.error('Error marking message as read:', error);
            return { success: false, error };
        }

        // Update message status to 'read' if not already
        await adminSupabase
            .from('chat_messages')
            .update({ status: 'read' })
            .eq('id', messageId)
            .neq('status', 'read');

        return { success: true, data };
    } catch (error) {
        logger.error('Error in markMessageAsRead:', error);
        return { success: false, error };
    }
}

// Helper function to get read-by list for a message
async function getMessageReadBy(messageId) {
    try {
        const { data, error } = await adminSupabase
            .from('message_reads')
            .select(`
                id,
                user_id,
                read_at,
                user:users!message_reads_user_id_fkey(
                    id,
                    full_name,
                    role
                )
            `)
            .eq('message_id', messageId)
            .order('read_at', { ascending: true });

        if (error) {
            logger.error('Error getting message read-by list:', error);
            return { success: false, error };
        }

        return { success: true, data: data || [] };
    } catch (error) {
        logger.error('Error in getMessageReadBy:', error);
        return { success: false, error };
    }
}

// Helper function to get unread count for a thread
async function getUnreadCountForThread(threadId, userId) {
    try {
        const { data: messages, error } = await adminSupabase
            .from('chat_messages')
            .select('id')
            .eq('thread_id', threadId)
            .neq('sender_id', userId)
            .eq('approval_status', 'approved');

        if (error) {
            logger.error('Error getting messages for unread count:', error);
            return 0;
        }

        if (!messages || messages.length === 0) return 0;

        const messageIds = messages.map(m => m.id);

        const { data: reads, error: readsError } = await adminSupabase
            .from('message_reads')
            .select('message_id')
            .eq('user_id', userId)
            .in('message_id', messageIds);

        if (readsError) {
            logger.error('Error getting read receipts:', readsError);
            return 0;
        }

        const readMessageIds = new Set((reads || []).map(r => r.message_id));
        return messages.filter(m => !readMessageIds.has(m.id)).length;

    } catch (error) {
        logger.error('Error in getUnreadCountForThread:', error);
        return 0;
    }
}

// Helper function to mark all messages in thread as read
async function markThreadAsRead(threadId, userId) {
    try {
        // First, verify that the user is actually a participant
        // This prevents principals/admins from being added as participants when viewing threads for approval
        const { data: participant, error: participantError } = await adminSupabase
            .from('chat_participants')
            .select('user_id')
            .eq('thread_id', threadId)
            .eq('user_id', userId)
            .single();

        // If user is not a participant, don't mark anything as read
        // This prevents principals/admins from being added when viewing for approval
        if (participantError || !participant) {
            return { success: false, count: 0 };
        }

        // Get all unread messages in thread (approved only, not sent by user)
        const { data: messages, error } = await adminSupabase
            .from('chat_messages')
            .select('id')
            .eq('thread_id', threadId)
            .neq('sender_id', userId)
            .eq('approval_status', 'approved');

        if (error) {
            logger.error('Error getting messages to mark as read:', error);
            return { success: false, count: 0 };
        }

        if (!messages || messages.length === 0) {
            // Update last_read_at anyway (user is confirmed to be a participant)
            await adminSupabase
                .from('chat_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('thread_id', threadId)
                .eq('user_id', userId);

            return { success: true, count: 0 };
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
                return { success: false, count: 0 };
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

        return { success: true, count: unreadMessages.length };

    } catch (error) {
        logger.error('Error in markThreadAsRead:', error);
        return { success: false, count: 0 };
    }
}

// Helper function to resolve existing duplicate threads
async function resolveDuplicateThreads(participantIds, threadType) {
    try {
        logger.info('Resolving duplicate threads for participants:', {
            participantIds,
            threadType
        });

        // Find ALL threads with these participants (including duplicates)
        const { data: allThreads, error } = await adminSupabase
            .from('chat_threads')
            .select(`
                id,
                title,
                thread_type,
                created_at,
                updated_at,
                created_by,
                status,
                participants:chat_participants(user_id)
            `)
            .eq('thread_type', threadType);

        if (error) {
            logger.error('Error finding threads for duplicate resolution:', error);
            return null;
        }

        // Find threads with exact participant match
        const matchingThreads = [];
        for (const thread of allThreads || []) {
            const threadParticipantIds = thread.participants.map(p => p.user_id).sort();
            const requestedParticipantIds = [...participantIds].sort();

            if (JSON.stringify(threadParticipantIds) === JSON.stringify(requestedParticipantIds)) {
                matchingThreads.push(thread);
            }
        }

        if (matchingThreads.length === 0) {
            return null; // No threads found
        }

        if (matchingThreads.length === 1) {
            return matchingThreads[0]; // Single thread, no duplicates
        }

        // Multiple threads found - need to resolve duplicates
        logger.warn(`Found ${matchingThreads.length} duplicate threads for participants:`, {
            participantIds,
            threadIds: matchingThreads.map(t => t.id)
        });

        // Sort threads by activity (most recent first)
        const sortedThreads = matchingThreads.sort((a, b) =>
            new Date(b.updated_at) - new Date(a.updated_at)
        );

        const primaryThread = sortedThreads[0]; // Most active thread
        const duplicateThreads = sortedThreads.slice(1);

        logger.info('Resolving duplicates:', {
            primaryThreadId: primaryThread.id,
            duplicateThreadIds: duplicateThreads.map(t => t.id)
        });

        // Merge duplicate threads into primary thread
        await mergeDuplicateThreads(primaryThread, duplicateThreads);

        return primaryThread;
    } catch (error) {
        logger.error('Error resolving duplicate threads:', error);
        return null;
    }
}

// Helper function to merge duplicate threads
async function mergeDuplicateThreads(primaryThread, duplicateThreads) {
    try {
        logger.info('Starting thread merge process:', {
            primaryThreadId: primaryThread.id,
            duplicateCount: duplicateThreads.length
        });

        for (const duplicateThread of duplicateThreads) {
            try {
                // 1. Move all messages from duplicate to primary thread
                const { data: messages, error: messagesError } = await adminSupabase
                    .from('chat_messages')
                    .select('*')
                    .eq('thread_id', duplicateThread.id);

                if (messagesError) {
                    logger.error('Error fetching messages from duplicate thread:', messagesError);
                    continue;
                }

                if (messages && messages.length > 0) {
                    // Update message thread_id to primary thread
                    const { error: updateError } = await adminSupabase
                        .from('chat_messages')
                        .update({ thread_id: primaryThread.id })
                        .eq('thread_id', duplicateThread.id);

                    if (updateError) {
                        logger.error('Error moving messages:', updateError);
                        continue;
                    }

                    logger.info(`Moved ${messages.length} messages from thread ${duplicateThread.id} to ${primaryThread.id}`);
                }

                // 2. Move participants from duplicate to primary thread
                const { data: participants, error: participantsError } = await adminSupabase
                    .from('chat_participants')
                    .select('*')
                    .eq('thread_id', duplicateThread.id);

                if (participantsError) {
                    logger.error('Error fetching participants from duplicate thread:', participantsError);
                    continue;
                }

                if (participants && participants.length > 0) {
                    // Insert participants into primary thread (ignore conflicts)
                    const participantData = participants.map(p => ({
                        thread_id: primaryThread.id,
                        user_id: p.user_id,
                        role: p.role,
                        joined_at: p.joined_at,
                        last_read_at: p.last_read_at
                    }));

                    const { error: insertError } = await adminSupabase
                        .from('chat_participants')
                        .upsert(participantData, {
                            onConflict: 'thread_id,user_id',
                            ignoreDuplicates: true
                        });

                    if (insertError) {
                        logger.error('Error moving participants:', insertError);
                        continue;
                    }

                    logger.info(`Moved ${participants.length} participants from thread ${duplicateThread.id} to ${primaryThread.id}`);
                }

                // 3. Update primary thread's updated_at to most recent
                const mostRecentUpdate = Math.max(
                    new Date(primaryThread.updated_at),
                    new Date(duplicateThread.updated_at)
                );

                await adminSupabase
                    .from('chat_threads')
                    .update({
                        updated_at: mostRecentUpdate.toISOString(),
                        title: primaryThread.title || duplicateThread.title || primaryThread.title
                    })
                    .eq('id', primaryThread.id);

                // 4. Mark duplicate thread as inactive (don't delete immediately)
                await adminSupabase
                    .from('chat_threads')
                    .update({
                        status: 'merged',
                        title: `MERGED_${duplicateThread.title || 'Thread'}_${new Date().toISOString()}`
                    })
                    .eq('id', duplicateThread.id);

                logger.info(`Successfully merged thread ${duplicateThread.id} into ${primaryThread.id}`);

            } catch (mergeError) {
                logger.error(`Error merging thread ${duplicateThread.id}:`, mergeError);
                // Continue with other threads even if one fails
            }
        }

        logger.info('Thread merge process completed successfully');
    } catch (error) {
        logger.error('Error in thread merge process:', error);
        throw error;
    }
}

// Enhanced function to check for existing threads (now handles duplicates)
async function findExistingThread(participantIds, threadType) {
    try {
        // First try to resolve any existing duplicates
        const resolvedThread = await resolveDuplicateThreads(participantIds, threadType);

        if (resolvedThread) {
            logger.info('Found resolved thread:', {
                threadId: resolvedThread.id,
                participantCount: resolvedThread.participants?.length || 0
            });
            return resolvedThread;
        }

        // If no threads found, return null (allow creation of new thread)
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
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;
        const startTime = Date.now();

        logger.info(`Fetching threads for user ${req.user.id} (${req.user.role}) with filters:`, {
            page, limit, status, user_id: req.user.id, user_role: req.user.role
        });

        // SECURITY: Only get threads where user is a participant (regardless of role)
        // This ensures principals/admins only see their own threads, not all system threads
        const { data: userParticipations, error: participationError } = await adminSupabase
            .from('chat_participants')
            .select('thread_id, role, last_read_at')
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
                    },
                    performance: {
                        query_time_ms: Date.now() - startTime
                    }
                }
            });
        }

        const threadIds = userParticipations.map(p => p.thread_id);
        logger.info(`Found ${userParticipations?.length || 0} participations for user ${req.user.id} (${req.user.role}). Thread IDs:`, threadIds);

        // SECURITY: Only fetch threads where user is actually a participant
        if (threadIds.length === 0) {
            logger.info(`No thread participations found for user ${req.user.id} (${req.user.role}) - returning empty result`);
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
                    performance: {
                        query_time_ms: Date.now() - startTime
                    }
                }
            });
        }

        // OPTIMIZATION 2: Get threads with participants in one query
        const { data: threads, error: threadError } = await adminSupabase
            .from('chat_threads')
            .select(`
                *,
                participants:chat_participants(
                    user_id,
                    role,
                    last_read_at,
                    user:users(id, full_name, role)
                )
            `)
            .in('id', threadIds)
            .order('updated_at', { ascending: false });

        if (threadError) {
            logger.error('Error fetching thread data:', threadError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch thread data'
            });
        }

        if (!threads || threads.length === 0) {
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
                    performance: {
                        query_time_ms: Date.now() - startTime
                    }
                }
            });
        }

        // Apply status filter if provided
        let filteredThreads = threads;
        if (status) {
            filteredThreads = threads.filter(t => t.status === status);
        }

        // Apply pagination
        const paginatedThreads = filteredThreads.slice(offset, offset + limit);

        // OPTIMIZATION 3: Bulk fetch last messages for all threads
        const paginatedThreadIds = paginatedThreads.map(t => t.id);

        // Get last messages for all threads in one query using window function
        const { data: lastMessages, error: messagesError } = await adminSupabase
            .from('chat_messages')
            .select(`
                thread_id,
                        content,
                        created_at,
                        sender:users!chat_messages_sender_id_fkey(full_name)
                    `)
            .in('thread_id', paginatedThreadIds)
            .order('thread_id, created_at', { ascending: false });

        // Process to get only the latest message per thread
        const lastMessagesMap = new Map();
        if (lastMessages && !messagesError) {
            const processedMessages = {};
            lastMessages.forEach(msg => {
                if (!processedMessages[msg.thread_id]) {
                    processedMessages[msg.thread_id] = msg;
                }
            });

            Object.values(processedMessages).forEach(msg => {
                lastMessagesMap.set(msg.thread_id, {
                    content: msg.content,
                    created_at: msg.created_at,
                    sender: { full_name: msg.sender?.full_name }
                });
            });
        }

        // OPTIMIZATION 4: Skip unread counts for now (major performance boost)
        // TODO: Implement efficient bulk unread count query later
        const unreadCountsMap = new Map();
        paginatedThreadIds.forEach(threadId => {
            unreadCountsMap.set(threadId, 0); // Set all to 0 for now
        });

        // OPTIMIZATION 5: Process threads with pre-fetched data
        const processedThreads = paginatedThreads.map(thread => {
            const lastMessage = lastMessagesMap.get(thread.id);
            const unreadCount = unreadCountsMap.get(thread.id) || 0;

            return {
                ...thread,
                last_message: lastMessage ? [lastMessage] : [],
                unread_count: unreadCount,
                participants: thread.participants || []
            };
        });

        // OPTIMIZATION 4: Response with performance metrics

        const totalTime = Date.now() - startTime;
        logger.info(`Threads fetched in ${totalTime}ms for user ${req.user.id} (${req.user.role})`);
        logger.info(`Returning ${processedThreads.length} threads for user ${req.user.id}:`,
            processedThreads.map(t => ({ id: t.id, title: t.title, participants: t.participants.length })));

        // SECURITY: Verify that all returned threads actually contain the user as a participant
        const userId = req.user.id;
        const invalidThreads = processedThreads.filter(thread =>
            !thread.participants.some(p => p.user_id === userId)
        );

        if (invalidThreads.length > 0) {
            logger.error(`SECURITY ISSUE: Found ${invalidThreads.length} threads where user ${userId} is not a participant:`,
                invalidThreads.map(t => ({ id: t.id, title: t.title })));
        }

        res.json({
            status: 'success',
            data: {
                threads: processedThreads,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: filteredThreads.length,
                    total_pages: Math.ceil(filteredThreads.length / limit)
                },
                performance: {
                    query_time_ms: totalTime,
                    threads_processed: processedThreads.length,
                    optimization: 'bulk_queries_optimized'
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

        // Debug: Log user role and ID
        console.log(`🔍 User accessing thread: ${req.user.full_name} (${req.user.role}) - ID: ${req.user.id}`);

        // Verify user is participant in thread (or admin/principal)
        if (!['admin', 'principal'].includes(req.user.role)) {
            console.log(`🔍 User ${req.user.full_name} is not admin/principal, checking participant status`);
            const { data: participant, error: participantError } = await adminSupabase
                .from('chat_participants')
                .select('*')
                .eq('thread_id', thread_id)
                .eq('user_id', req.user.id)
                .single();

            if (participantError || !participant) {
                console.log(`❌ Access denied for user ${req.user.full_name} - not a participant`);
                return res.status(403).json({
                    status: 'error',
                    message: 'Access denied to this thread'
                });
            }
            console.log(`✅ User ${req.user.full_name} is a participant in thread`);
        } else {
            // For admin/principal, log the access for monitoring
            console.log(`✅ Admin/Principal ${req.user.full_name} accessing thread ${thread_id} for monitoring`);
        }

        // Get participants list with role and id
        const { data: participants, error: participantsError } = await adminSupabase
            .from('chat_participants')
            .select(`
                user_id,
                role,
                user:users!chat_participants_user_id_fkey(id, full_name, role)
            `)
            .eq('thread_id', thread_id);

        if (participantsError) {
            logger.error('Error fetching participants:', participantsError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch participants'
            });
        }

        // Get messages from chat_messages table (primary storage for chat)
        // Filter logic:
        // - Admin/Principal: see all messages
        // - Teachers/Parents: see approved messages + their own pending messages
        let messagesQuery = adminSupabase
            .from('chat_messages')
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role),
                attachments:chat_message_attachments(*),
                approver:users!chat_messages_approved_by_fkey(full_name, role)
            `)
            .eq('thread_id', thread_id);

        // Apply approval filter based on user role
        if (!['admin', 'principal'].includes(req.user.role)) {
            // For non-admin/principal users, use OR filter to show:
            // 1. All approved messages
            // 2. Their own messages (regardless of approval status)
            messagesQuery = messagesQuery.or(`approval_status.eq.approved,sender_id.eq.${req.user.id}`);
        }

        const { data: messages, error } = await messagesQuery
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching messages:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch messages'
            });
        }

        // Fetch read receipts for all messages
        let messagesWithReceipts = [];
        if (messages && messages.length > 0) {
            const messageIds = messages.map(m => m.id);

            // Get read receipts for all messages
            const { data: allReads } = await adminSupabase
                .from('message_reads')
                .select(`
                    message_id,
                    user_id,
                    read_at,
                    user:users!message_reads_user_id_fkey(id, full_name, role)
                `)
                .in('message_id', messageIds);

            // Group reads by message_id
            const readsByMessage = {};
            (allReads || []).forEach(read => {
                if (!readsByMessage[read.message_id]) {
                    readsByMessage[read.message_id] = [];
                }
                readsByMessage[read.message_id].push({
                    user_id: read.user_id,
                    user_name: read.user?.full_name || 'Unknown',
                    user_role: read.user?.role || 'Unknown',
                    read_at: read.read_at
                });
            });

            // Attach read receipts to each message
            messagesWithReceipts = messages.map(msg => {
                const readBy = readsByMessage[msg.id] || [];
                const isReadByCurrentUser = readBy.some(r => r.user_id === req.user.id);

                return {
                    ...msg,
                    read_by: readBy,
                    read_count: readBy.length,
                    is_read: isReadByCurrentUser || msg.sender_id === req.user.id // Own messages are always "read"
                };
            });
        }

        // Check if user is actually a participant (not for principals/admins viewing for approval)
        // Regular users (teachers/parents) must be participants to access, so they'll always be in the list
        // Principals/admins can view without being participants, so check if they're actually in the list
        const userIsParticipant = participants.some(p => p.user_id === req.user.id);

        // Mark messages as read automatically when fetching
        // This happens in the background and shouldn't block the response
        // Only mark as read if user is actually a participant
        if (userIsParticipant) {
            markThreadAsRead(thread_id, req.user.id).catch(err => {
                logger.error('Error auto-marking messages as read:', err);
            });
        }

        // Update last read timestamp for backward compatibility
        // Only update if user is actually a participant
        if (userIsParticipant) {
            await adminSupabase
                .from('chat_participants')
                .update({ last_read_at: new Date().toISOString() })
                .eq('thread_id', thread_id)
                .eq('user_id', req.user.id);
        }

        // Get total count from chat_messages table with same filter
        let countQuery = adminSupabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('thread_id', thread_id);

        if (!['admin', 'principal'].includes(req.user.role)) {
            countQuery = countQuery.or(`approval_status.eq.approved,sender_id.eq.${req.user.id}`);
        }

        const { count, error: countError } = await countQuery;

        if (countError) {
            logger.error('Error getting message count:', countError);
        }

        // Format participants data
        const formattedParticipants = participants.map(p => ({
            id: p.user.id,
            role: p.user.role,
            full_name: p.user.full_name,
            participant_role: p.role
        }));

        res.json({
            status: 'success',
            data: {
                participants: formattedParticipants,
                messages: messagesWithReceipts.reverse(), // Show oldest first
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

        // Check if message needs approval (Teacher -> Parent)
        const requiresApproval = await needsApproval(req.user.id, thread_id);
        const approvalStatus = requiresApproval ? 'pending' : 'approved';

        // Create message directly in chat_messages (authoritative storage for chat)
        const { data: chatMessage, error: chatInsertError } = await adminSupabase
            .from('chat_messages')
            .insert({
                thread_id,
                sender_id: req.user.id,
                content,
                message_type,
                approval_status: approvalStatus
            })
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role)
            `)
            .single();

        if (chatInsertError) {
            logger.error('Error creating chat message:', chatInsertError);
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
            data: chatMessage,
            message: requiresApproval
                ? 'Message sent successfully and is pending approval'
                : 'Message sent successfully'
        });

    } catch (error) {
        logger.error('Error in send message:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update message (only sender can update, and only if rejected)
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

        // Check if message can be updated (only rejected messages can be edited)
        if (message.approval_status === 'approved') {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot edit approved messages'
            });
        }

        // Prepare update data
        const updateData = { content };

        // If message was rejected, reset approval status to pending for re-approval
        if (message.approval_status === 'rejected') {
            updateData.approval_status = 'pending';
            updateData.approved_by = null;
            updateData.approved_at = null;
            updateData.rejection_reason = null;
            console.log(`🔄 Message ${id} edited and reset to pending for re-approval`);
        }

        // Update message
        const { data: updatedMessage, error: updateError } = await adminSupabase
            .from('chat_messages')
            .update(updateData)
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

        const myThreadIds = userParticipations.map(p => p.thread_id);

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
            .in('id', myThreadIds)
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
            .in('id', myThreadIds);

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

// Get messages from a specific thread with pagination
router.get('/threads/:thread_id/messages', authenticate, async (req, res) => {
    try {
        const { thread_id } = req.params;
        const { page = 1, limit = 50, before_date, after_date } = req.query;
        const offset = (page - 1) * limit;

        logger.info('Fetching messages for thread:', {
            thread_id,
            page,
            limit,
            before_date,
            after_date,
            user_id: req.user.id,
            user_role: req.user.role
        });

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
                message: 'Access denied to this thread',
                error_details: {
                    message: 'User is not a participant in this thread',
                    code: 'ACCESS_DENIED'
                },
                debug_info: {
                    thread_id,
                    user_id: req.user.id,
                    user_role: req.user.role,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Build query for messages
        let query = adminSupabase
            .from('chat_messages')
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(
                    id,
                    full_name,
                    role
                ),
                attachments:chat_message_attachments(*)
            `)
            .eq('thread_id', thread_id)
            .order('created_at', { ascending: false }); // Most recent first

        // Apply date filters if provided
        if (before_date) {
            query = query.lt('created_at', before_date);
        }
        if (after_date) {
            query = query.gt('created_at', after_date);
        }

        // Get total count for pagination
        const { count, error: countError } = await query.count();

        if (countError) {
            logger.error('Error getting message count:', countError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get message count',
                error_details: {
                    message: countError.message,
                    code: countError.code || 'UNKNOWN_ERROR'
                }
            });
        }

        // Get paginated messages
        const { data: messages, error: messagesError } = await query
            .range(offset, offset + limit - 1);

        if (messagesError) {
            logger.error('Error fetching messages:', messagesError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch messages',
                error_details: {
                    message: messagesError.message,
                    code: messagesError.code || 'UNKNOWN_ERROR'
                },
                debug_info: {
                    thread_id,
                    user_id: req.user.id,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Update last read timestamp for current user
        // Only update if user is actually a participant (not for principals/admins viewing for approval)
        try {
            // Check if user is a participant before updating
            const { data: participantCheck } = await adminSupabase
                .from('chat_participants')
                .select('user_id')
                .eq('thread_id', thread_id)
                .eq('user_id', req.user.id)
                .single();

            // Only update if user is actually a participant
            if (participantCheck) {
                await adminSupabase
                    .from('chat_participants')
                    .update({ last_read_at: new Date().toISOString() })
                    .eq('thread_id', thread_id)
                    .eq('user_id', req.user.id);
            }
        } catch (updateError) {
            logger.warn('Failed to update last read timestamp:', updateError.message);
            // Don't fail the request for this
        }

        // Get thread details for context
        const { data: thread, error: threadError } = await adminSupabase
            .from('chat_threads')
            .select(`
                id,
                title,
                thread_type,
                created_at,
                updated_at,
                created_by
            `)
            .eq('id', thread_id)
            .single();

        if (threadError) {
            logger.warn('Error fetching thread details:', threadError.message);
        }

        res.json({
            status: 'success',
            data: {
                thread: thread || null,
                messages: messages || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit),
                    has_next: (offset + limit) < (count || 0),
                    has_prev: page > 1
                },
                summary: {
                    total_messages: count || 0,
                    current_page_messages: messages?.length || 0,
                    thread_type: thread?.thread_type || 'unknown'
                }
            }
        });

    } catch (error) {
        logger.error('Error fetching thread messages:', error);

        const errorResponse = {
            status: 'error',
            message: 'Internal server error occurred while fetching thread messages',
            error_details: {
                message: error.message,
                name: error.name,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            debug_info: {
                thread_id: req.params.thread_id,
                user_id: req.user?.id || 'unknown',
                user_role: req.user?.role || 'unknown',
                timestamp: new Date().toISOString(),
                endpoint: '/api/chat/threads/:thread_id/messages'
            }
        };

        res.status(500).json(errorResponse);
    }
});

// Admin endpoint to resolve existing duplicate threads
router.post('/admin/resolve-duplicates', authenticate, async (req, res) => {
    try {
        // Only admins and principals can access this
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can resolve duplicate threads',
                user_role: req.user.role,
                required_roles: ['admin', 'principal']
            });
        }

        const { thread_type = 'direct', force_resolve = false } = req.body;

        logger.info('Starting duplicate thread resolution:', {
            thread_type,
            force_resolve,
            admin_user: req.user.id
        });

        // Find all threads of the specified type
        const { data: allThreads, error: threadsError } = await adminSupabase
            .from('chat_threads')
            .select(`
                id,
                title,
                thread_type,
                created_at,
                updated_at,
                status,
                participants:chat_participants(user_id)
            `)
            .eq('thread_type', thread_type)
            .neq('status', 'merged'); // Exclude already merged threads

        if (threadsError) {
            logger.error('Error fetching threads for duplicate resolution:', threadsError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch threads for duplicate resolution'
            });
        }

        // Group threads by participant sets
        const participantGroups = new Map();

        for (const thread of allThreads || []) {
            if (!thread.participants || thread.participants.length === 0) {
                continue; // Skip threads without participants
            }

            const participantKey = thread.participants
                .map(p => p.user_id)
                .sort()
                .join(',');

            if (!participantGroups.has(participantKey)) {
                participantGroups.set(participantKey, []);
            }
            participantGroups.get(participantKey).push(thread);
        }

        // Find groups with multiple threads (duplicates)
        const duplicateGroups = [];
        for (const [participantKey, threads] of participantGroups) {
            if (threads.length > 1) {
                duplicateGroups.push({
                    participantKey,
                    threads,
                    participantIds: participantKey.split(',')
                });
            }
        }

        logger.info('Found duplicate thread groups:', {
            total_groups: participantGroups.size,
            duplicate_groups: duplicateGroups.length,
            total_threads: allThreads?.length || 0
        });

        if (duplicateGroups.length === 0) {
            return res.json({
                status: 'success',
                message: 'No duplicate threads found',
                data: {
                    total_threads: allThreads?.length || 0,
                    duplicate_groups: 0,
                    resolved_groups: 0
                }
            });
        }

        // Resolve duplicates
        let resolvedGroups = 0;
        const resolutionResults = [];

        for (const group of duplicateGroups) {
            try {
                // Sort threads by activity (most recent first)
                const sortedThreads = group.threads.sort((a, b) =>
                    new Date(b.updated_at) - new Date(a.updated_at)
                );

                const primaryThread = sortedThreads[0];
                const duplicateThreads = sortedThreads.slice(1);

                logger.info(`Resolving duplicate group with ${group.threads.length} threads:`, {
                    participantIds: group.participantIds,
                    primaryThreadId: primaryThread.id,
                    duplicateThreadIds: duplicateThreads.map(t => t.id)
                });

                // Merge duplicate threads
                await mergeDuplicateThreads(primaryThread, duplicateThreads);

                resolvedGroups++;
                resolutionResults.push({
                    participantIds: group.participantIds,
                    primaryThreadId: primaryThread.id,
                    duplicateThreadIds: duplicateThreads.map(t => t.id),
                    status: 'resolved'
                });

            } catch (groupError) {
                logger.error(`Error resolving duplicate group:`, groupError);
                resolutionResults.push({
                    participantIds: group.participantIds,
                    status: 'failed',
                    error: groupError.message
                });
            }
        }

        // Get updated thread count
        const { data: updatedThreads, error: countError } = await adminSupabase
            .from('chat_threads')
            .select('id', { count: 'exact', head: true })
            .eq('thread_type', thread_type)
            .neq('status', 'merged');

        if (countError) {
            logger.warn('Could not get updated thread count:', countError);
        }

        res.json({
            status: 'success',
            message: `Successfully resolved ${resolvedGroups} duplicate thread groups`,
            data: {
                total_threads_before: allThreads?.length || 0,
                total_threads_after: updatedThreads?.length || 0,
                duplicate_groups_found: duplicateGroups.length,
                resolved_groups: resolvedGroups,
                resolution_results: resolutionResults
            }
        });

    } catch (error) {
        logger.error('Error in duplicate thread resolution:', error);

        const errorResponse = {
            status: 'error',
            message: 'Internal server error occurred during duplicate resolution',
            error_details: {
                message: error.message,
                name: error.name
            },
            debug_info: {
                admin_user: req.user?.id || 'unknown',
                timestamp: new Date().toISOString(),
                endpoint: '/api/chat/admin/resolve-duplicates'
            }
        };

        res.status(500).json(errorResponse);
    }
});

// Delete chat thread
router.delete('/threads/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        logger.info(`Removing user ${req.user.id} (${req.user.role}) from thread ${id}`);

        // Verify thread exists and user is a participant
        const { data: thread, error: threadError } = await adminSupabase
            .from('chat_threads')
            .select(`
                id,
                title,
                thread_type,
                created_by,
                status,
                participants:chat_participants(user_id, role)
            `)
            .eq('id', id)
            .single();

        if (threadError) {
            if (threadError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Thread not found'
                });
            }
            logger.error('Error fetching thread:', threadError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch thread'
            });
        }

        // Check if user is a participant in the thread
        const isParticipant = thread.participants.some(p => p.user_id === req.user.id);
        if (!isParticipant) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only leave threads you participate in'
            });
        }

        // Check if thread is already deleted or merged
        if (thread.status === 'deleted' || thread.status === 'merged') {
            return res.status(400).json({
                status: 'error',
                message: 'Thread is already deleted or merged'
            });
        }

        // For group threads, only the creator can leave (effectively delete for them)
        if (thread.thread_type === 'group' && thread.created_by !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'Only the thread creator can leave group threads'
            });
        }

        // For direct threads, either participant can leave
        // (This allows both participants to remove the conversation from their view)

        // Remove user from participants (hard delete approach)
        // This removes the user from the thread completely
        const { error: participantError } = await adminSupabase
            .from('chat_participants')
            .delete()
            .eq('thread_id', id)
            .eq('user_id', req.user.id);

        if (participantError) {
            logger.error('Error removing user from thread:', participantError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to remove user from thread'
            });
        }

        // Notify other participants via WebSocket
        try {
            const otherParticipants = thread.participants
                .filter(p => p.user_id !== req.user.id)
                .map(p => p.user_id);

            if (otherParticipants.length > 0) {
                // Send notification to other participants
                const notification = {
                    type: 'thread_deleted',
                    thread_id: id,
                    thread_title: thread.title,
                    deleted_by: {
                        id: req.user.id,
                        name: req.user.full_name || 'Unknown User',
                        role: req.user.role
                    },
                    timestamp: new Date().toISOString()
                };

                // Import websocket service dynamically to avoid circular dependency
                const { notifyUsers } = await import('../services/websocketService.js');
                await notifyUsers(otherParticipants, notification);
            }
        } catch (wsError) {
            logger.warn('Error sending WebSocket notification:', wsError);
            // Don't fail the request if WebSocket notification fails
        }

        logger.info(`Successfully removed user ${req.user.id} from thread ${id}`);

        res.json({
            status: 'success',
            message: 'Left thread successfully',
            data: {
                thread_id: id,
                left_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error in delete thread:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// ========== MESSAGE APPROVAL ENDPOINTS (Admin/Principal Only) ==========

// Get pending messages for approval
router.get('/messages/pending', authenticate, async (req, res) => {
    try {
        // Only admin and principal can view pending messages
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Only admins and principals can view pending messages.'
            });
        }

        const { page = 1, limit = 50, thread_id } = req.query;
        const offset = (page - 1) * limit;

        // Build query for pending messages
        let query = adminSupabase
            .from('chat_messages')
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(id, full_name, role, email),
                thread:chat_threads!chat_messages_thread_id_fkey(
                    id,
                    title,
                    thread_type,
                    participants:chat_participants(
                        user_id,
                        user:users!chat_participants_user_id_fkey(id, full_name, role)
                    )
                )
            `)
            .eq('approval_status', 'pending')
            .order('created_at', { ascending: false });

        // Optionally filter by specific thread
        if (thread_id) {
            query = query.eq('thread_id', thread_id);
        }

        const { data: messages, error } = await query
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching pending messages:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch pending messages'
            });
        }

        // Get total count
        let countQuery = adminSupabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'pending');

        if (thread_id) {
            countQuery = countQuery.eq('thread_id', thread_id);
        }

        const { count, error: countError } = await countQuery;

        if (countError) {
            logger.error('Error getting pending messages count:', countError);
        }

        res.json({
            status: 'success',
            data: {
                messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in get pending messages:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Approve a message
router.post('/messages/:message_id/approve', authenticate, async (req, res) => {
    try {
        // Only admin and principal can approve messages
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Only admins and principals can approve messages.'
            });
        }

        const { message_id } = req.params;

        // Get the message
        const { data: message, error: fetchError } = await adminSupabase
            .from('chat_messages')
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role),
                thread:chat_threads!chat_messages_thread_id_fkey(
                    id,
                    title,
                    participants:chat_participants(user_id)
                )
            `)
            .eq('id', message_id)
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

        // Check if message is already approved or rejected
        if (message.approval_status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: `Message is already ${message.approval_status}`
            });
        }

        // Approve the message
        const { data: approvedMessage, error: approveError } = await adminSupabase
            .from('chat_messages')
            .update({
                approval_status: 'approved',
                approved_by: req.user.id,
                approved_at: new Date().toISOString()
            })
            .eq('id', message_id)
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role),
                approver:users!chat_messages_approved_by_fkey(full_name, role)
            `)
            .single();

        if (approveError) {
            logger.error('Error approving message:', approveError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to approve message'
            });
        }

        logger.info(`Message ${message_id} approved by ${req.user.full_name} (${req.user.role})`);

        // CRITICAL: Remove approver from participants if they were incorrectly added
        // This prevents principals/admins from being in participants when they only approved
        try {
            const { data: approverParticipant, error: checkError } = await adminSupabase
                .from('chat_participants')
                .select('user_id')
                .eq('thread_id', approvedMessage.thread_id)
                .eq('user_id', req.user.id)
                .single();

            if (!checkError && approverParticipant) {
                logger.warn(`⚠️ Approver ${req.user.full_name} (${req.user.role}) found in participants - removing them`);
                
                const { error: deleteError } = await adminSupabase
                    .from('chat_participants')
                    .delete()
                    .eq('thread_id', approvedMessage.thread_id)
                    .eq('user_id', req.user.id);

                if (deleteError) {
                    logger.error(`❌ Failed to remove approver from participants:`, deleteError);
                } else {
                    logger.info(`✅ Removed approver ${req.user.full_name} from participants list`);
                }
            }
        } catch (checkError) {
            // If approver is not in participants (expected), this is fine
            logger.info(`✅ Approver ${req.user.full_name} (${req.user.role}) is correctly NOT a participant`);
        }

        // Send notifications to parent and broadcast to participants
        try {
            logger.info('🔔 Starting notification process for approved message...');

            // Get thread participants for notifications (exclude the approver)
            const { data: threadParticipants, error: participantsError } = await adminSupabase
                .from('chat_participants')
                .select(`
                    user_id,
                    user:users!chat_participants_user_id_fkey(id, full_name, role)
                `)
                .eq('thread_id', approvedMessage.thread_id)
                .neq('user_id', req.user.id); // Explicitly exclude the approver

            if (participantsError) {
                logger.error('❌ Error fetching thread participants:', participantsError);
            } else if (threadParticipants && threadParticipants.length > 0) {
                logger.info(`📊 Found ${threadParticipants.length} thread participants (approver excluded)`);

                // Send notifications to parents (only to actual participants, not approver)
                logger.info('📨 Calling sendChatMessageApprovalNotifications...');
                await sendChatMessageApprovalNotifications(approvedMessage, threadParticipants);

                // Broadcast approved message to all participants
                logger.info('📡 Calling broadcastApprovedMessage...');
                await broadcastApprovedMessage(approvedMessage, approvedMessage.thread_id);

                logger.info('✅ Notification process completed');
            } else {
                logger.warn('⚠️ No thread participants found');
            }
        } catch (notificationError) {
            logger.error('❌ Error sending approval notifications:', notificationError);
            logger.error('Notification error details:', notificationError.stack);
            // Don't fail the approval if notifications fail
        }

        res.json({
            status: 'success',
            message: 'Message approved successfully',
            data: approvedMessage
        });

    } catch (error) {
        logger.error('Error in approve message:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Reject a message
router.post('/messages/:message_id/reject', authenticate, async (req, res) => {
    try {
        // Only admin and principal can reject messages
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Only admins and principals can reject messages.'
            });
        }

        const { message_id } = req.params;
        const { rejection_reason } = req.body;

        if (!rejection_reason || rejection_reason.trim() === '') {
            return res.status(400).json({
                status: 'error',
                message: 'Rejection reason is required'
            });
        }

        // Get the message
        const { data: message, error: fetchError } = await adminSupabase
            .from('chat_messages')
            .select('*')
            .eq('id', message_id)
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

        // Check if message is already approved or rejected
        if (message.approval_status !== 'pending') {
            return res.status(400).json({
                status: 'error',
                message: `Message is already ${message.approval_status}`
            });
        }

        // Reject the message
        const { data: rejectedMessage, error: rejectError } = await adminSupabase
            .from('chat_messages')
            .update({
                approval_status: 'rejected',
                approved_by: req.user.id,
                approved_at: new Date().toISOString(),
                rejection_reason: rejection_reason.trim()
            })
            .eq('id', message_id)
            .select(`
                *,
                sender:users!chat_messages_sender_id_fkey(full_name, role),
                approver:users!chat_messages_approved_by_fkey(full_name, role)
            `)
            .single();

        if (rejectError) {
            logger.error('Error rejecting message:', rejectError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to reject message'
            });
        }

        logger.info(`Message ${message_id} rejected by ${req.user.full_name} (${req.user.role}). Reason: ${rejection_reason}`);

        // Send notification to teacher about rejection
        try {
            sendChatMessageRejectionNotification(rejectedMessage);
        } catch (notificationError) {
            logger.error('Error sending rejection notification:', notificationError);
            // Don't fail the rejection if notifications fail
        }

        res.json({
            status: 'success',
            message: 'Message rejected successfully',
            data: rejectedMessage
        });

    } catch (error) {
        logger.error('Error in reject message:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get approval statistics (for dashboard)
router.get('/messages/approval-stats', authenticate, async (req, res) => {
    try {
        // Only admin and principal can view stats
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied. Only admins and principals can view approval statistics.'
            });
        }

        // Get counts for each status
        const { data: pendingCount } = await adminSupabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'pending');

        const { data: approvedCount } = await adminSupabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'approved');

        const { data: rejectedCount } = await adminSupabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'rejected');

        // Get pending messages grouped by sender
        const { data: pendingBySender, error: senderError } = await adminSupabase
            .from('chat_messages')
            .select(`
                sender_id,
                sender:users!chat_messages_sender_id_fkey(full_name, role)
            `)
            .eq('approval_status', 'pending');

        if (senderError) {
            logger.error('Error fetching pending by sender:', senderError);
        }

        // Count messages per sender
        const senderStats = {};
        (pendingBySender || []).forEach(msg => {
            const senderId = msg.sender_id;
            if (!senderStats[senderId]) {
                senderStats[senderId] = {
                    sender_id: senderId,
                    sender_name: msg.sender?.full_name || 'Unknown',
                    sender_role: msg.sender?.role || 'Unknown',
                    pending_count: 0
                };
            }
            senderStats[senderId].pending_count++;
        });

        res.json({
            status: 'success',
            data: {
                total_pending: pendingCount?.length || 0,
                total_approved: approvedCount?.length || 0,
                total_rejected: rejectedCount?.length || 0,
                pending_by_sender: Object.values(senderStats)
            }
        });

    } catch (error) {
        logger.error('Error in get approval stats:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// ========== READ RECEIPT ENDPOINTS ==========

// Mark a specific message as read
router.post('/messages/:message_id/read', authenticate, async (req, res) => {
    try {
        const { message_id } = req.params;
        const userId = req.user.id;

        // Get the message to verify it exists and user has access
        const { data: message, error: fetchError } = await adminSupabase
            .from('chat_messages')
            .select(`
                id,
                thread_id,
                sender_id,
                content,
                approval_status
            `)
            .eq('id', message_id)
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

        // Only approved messages can be marked as read
        if (message.approval_status !== 'approved') {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot mark pending or rejected messages as read'
            });
        }

        // Verify user is a participant in the thread
        const { data: participant, error: participantError } = await adminSupabase
            .from('chat_participants')
            .select('*')
            .eq('thread_id', message.thread_id)
            .eq('user_id', userId)
            .single();

        if (participantError || !participant) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied to this message'
            });
        }

        // Don't mark own messages as read
        if (message.sender_id === userId) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot mark your own message as read'
            });
        }

        // Mark the message as read
        const result = await markMessageAsRead(message_id, userId);

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to mark message as read'
            });
        }

        logger.info(`Message ${message_id} marked as read by user ${userId}`);

        res.json({
            status: 'success',
            message: 'Message marked as read',
            data: {
                message_id,
                user_id: userId,
                read_at: result.data?.read_at || new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error in mark message as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get read-by list for a message
router.get('/messages/:message_id/read-by', authenticate, async (req, res) => {
    try {
        const { message_id } = req.params;
        const userId = req.user.id;

        // Get the message to verify access
        const { data: message, error: fetchError } = await adminSupabase
            .from('chat_messages')
            .select(`
                id,
                thread_id,
                sender_id
            `)
            .eq('id', message_id)
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

        // Verify user is participant in thread or is the sender
        const { data: participant, error: participantError } = await adminSupabase
            .from('chat_participants')
            .select('*')
            .eq('thread_id', message.thread_id)
            .eq('user_id', userId)
            .single();

        if (participantError || !participant) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied to this message'
            });
        }

        // Get read-by list
        const result = await getMessageReadBy(message_id);

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get read-by list'
            });
        }

        // Format the response
        const readBy = result.data.map(read => ({
            user_id: read.user_id,
            user_name: read.user?.full_name || 'Unknown',
            user_role: read.user?.role || 'Unknown',
            read_at: read.read_at
        }));

        res.json({
            status: 'success',
            data: {
                message_id,
                read_count: readBy.length,
                read_by: readBy
            }
        });

    } catch (error) {
        logger.error('Error in get read-by list:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Mark all messages in a thread as read (bulk operation)
router.post('/threads/:thread_id/mark-all-read', authenticate, async (req, res) => {
    try {
        const { thread_id } = req.params;
        const userId = req.user.id;

        // Verify user is participant in thread
        const { data: participant, error: participantError } = await adminSupabase
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

        // Mark all messages as read
        const result = await markThreadAsRead(thread_id, userId);

        if (!result.success) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to mark messages as read'
            });
        }

        logger.info(`${result.count} messages marked as read in thread ${thread_id} by user ${userId}`);

        res.json({
            status: 'success',
            message: `${result.count} message(s) marked as read`,
            data: {
                thread_id,
                user_id: userId,
                messages_marked: result.count,
                marked_at: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error('Error in mark thread as read:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get unread count for a specific thread
router.get('/threads/:thread_id/unread-count', authenticate, async (req, res) => {
    try {
        const { thread_id } = req.params;
        const userId = req.user.id;

        // Verify user is participant in thread
        const { data: participant, error: participantError } = await adminSupabase
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

        // Get unread count
        const unreadCount = await getUnreadCountForThread(thread_id, userId);

        res.json({
            status: 'success',
            data: {
                thread_id,
                unread_count: unreadCount
            }
        });

    } catch (error) {
        logger.error('Error in get unread count:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get total unread count across all threads for user
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all threads user is part of
        const { data: participations, error: participationsError } = await adminSupabase
            .from('chat_participants')
            .select('thread_id')
            .eq('user_id', userId);

        if (participationsError) {
            logger.error('Error getting user threads:', participationsError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get threads'
            });
        }

        if (!participations || participations.length === 0) {
            return res.json({
                status: 'success',
                data: {
                    total_unread: 0,
                    threads: []
                }
            });
        }

        // Get unread count for each thread
        const threadCounts = await Promise.all(
            participations.map(async (p) => {
                const count = await getUnreadCountForThread(p.thread_id, userId);
                return {
                    thread_id: p.thread_id,
                    unread_count: count
                };
            })
        );

        const totalUnread = threadCounts.reduce((sum, tc) => sum + tc.unread_count, 0);

        res.json({
            status: 'success',
            data: {
                total_unread: totalUnread,
                threads: threadCounts.filter(tc => tc.unread_count > 0)
            }
        });

    } catch (error) {
        logger.error('Error in get total unread count:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

export default router; 