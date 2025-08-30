import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ============================================================================
// CREATE ANNOUNCEMENT
// ============================================================================

router.post('/',
    authenticate,
    [
        body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
        body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Content must be between 1 and 5000 characters'),
        body('announcement_type').isIn(['circular', 'general', 'urgent', 'academic', 'administrative']).withMessage('Invalid announcement type'),
        body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority level'),
        body('target_roles').optional().isArray().withMessage('Target roles must be an array'),
        body('target_classes').optional().isArray().withMessage('Target classes must be an array'),
        body('publish_at').optional().isISO8601().toDate().withMessage('Invalid publish date'),
        body('expires_at').optional().isISO8601().toDate().withMessage('Invalid expiry date'),
        body('is_featured').optional().isBoolean().withMessage('is_featured must be a boolean')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const {
                title,
                content,
                announcement_type,
                priority = 'normal',
                target_roles = [],
                target_classes = [],
                target_departments = [],
                publish_at,
                expires_at,
                is_featured = false
            } = req.body;

            // Determine initial status based on user role
            const userRole = req.user.role;
            const initialStatus = ['principal', 'admin'].includes(userRole) ? 'approved' : 'pending';

            // Create announcement
            const { data: announcement, error: createError } = await adminSupabase
                .from('announcements')
                .insert({
                    title: title.trim(),
                    content: content.trim(),
                    announcement_type,
                    status: initialStatus,
                    priority,
                    created_by: req.user.id,
                    target_roles,
                    target_classes,
                    target_departments,
                    publish_at,
                    expires_at,
                    is_featured,
                    is_published: initialStatus === 'approved'
                })
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    )
                `)
                .single();

            if (createError) {
                logger.error('Error creating announcement:', createError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to create announcement'
                });
            }

            // If auto-approved, create recipients
            if (initialStatus === 'approved') {
                await createAnnouncementRecipients(announcement.id, target_roles);
            }

            res.status(201).json({
                status: 'success',
                message: initialStatus === 'approved' ? 'Announcement created and published successfully' : 'Announcement created and pending approval',
                data: {
                    announcement,
                    auto_approved: initialStatus === 'approved'
                }
            });

        } catch (error) {
            logger.error('Error in create announcement:', error);
            next(error);
        }
    }
);

// ============================================================================
// GET ANNOUNCEMENTS (with filtering)
// ============================================================================

router.get('/',
    authenticate,
    async (req, res, next) => {
        try {
            const {
                status = 'approved',
                announcement_type,
                priority,
                page = 1,
                limit = 20,
                is_featured,
                created_by,
                approved_by,
                start_date,
                end_date,
                created_after,
                created_before,
                published_after,
                published_before
            } = req.query;

            const offset = (page - 1) * limit;
            const userRole = req.user.role;

            // Build base query
            let query = adminSupabase
                .from('announcements')
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    approver:users!announcements_approved_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    attachments:announcement_attachments(
                        id,
                        file_name,
                        file_size,
                        file_type,
                        mime_type
                    )
                `)
                .order('created_at', { ascending: false });

            // Apply filters based on user role
            if (['principal', 'admin'].includes(userRole)) {
                // Principals and admins can see all announcements
                if (status !== 'all') {
                    query = query.eq('status', status);
                }
            } else {
                // Other users can only see published announcements or their own
                query = query.or(`status.eq.approved,created_by.eq.${req.user.id}`);
            }

            // Apply additional filters
            if (announcement_type) {
                query = query.eq('announcement_type', announcement_type);
            }
            if (priority) {
                query = query.eq('priority', priority);
            }
            if (is_featured !== undefined) {
                query = query.eq('is_featured', is_featured === 'true');
            }
            if (created_by) {
                query = query.eq('created_by', created_by);
            }
            if (approved_by) {
                query = query.eq('approved_by', approved_by);
            }

            // Apply date range filters
            if (start_date) {
                query = query.gte('created_at', start_date);
            }
            if (end_date) {
                query = query.lte('created_at', end_date);
            }
            if (created_after) {
                query = query.gt('created_at', created_after);
            }
            if (created_before) {
                query = query.lt('created_at', created_before);
            }
            if (published_after) {
                query = query.gt('publish_at', published_after);
            }
            if (published_before) {
                query = query.lt('publish_at', published_before);
            }

            // Get total count
            const { count: totalCount, error: countError } = await adminSupabase
                .from('announcements')
                .select('*', { count: 'exact', head: true });

            if (countError) {
                logger.error('Error getting announcement count:', countError);
            }

            // Get announcements with pagination
            const { data: announcements, error: fetchError } = await query
                .range(offset, offset + limit - 1);

            if (fetchError) {
                logger.error('Error fetching announcements:', fetchError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch announcements'
                });
            }

            // Add view tracking for published announcements
            if (announcements && announcements.length > 0) {
                await Promise.all(
                    announcements
                        .filter(a => a.status === 'approved' && a.is_published)
                        .map(async (announcement) => {
                            try {
                                await adminSupabase
                                    .from('announcement_views')
                                    .upsert({
                                        announcement_id: announcement.id,
                                        user_id: req.user.id
                                    }, { onConflict: 'announcement_id,user_id' });
                            } catch (error) {
                                logger.error('Error tracking view:', error);
                            }
                        })
                );
            }

            res.json({
                status: 'success',
                data: {
                    announcements: announcements || [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount || 0,
                        total_pages: Math.ceil((totalCount || 0) / limit),
                        has_next: offset + limit < (totalCount || 0),
                        has_prev: page > 1
                    },
                    filters: {
                        status,
                        announcement_type,
                        priority,
                        is_featured,
                        created_by,
                        approved_by,
                        start_date,
                        end_date,
                        created_after,
                        created_before,
                        published_after,
                        published_before
                    }
                }
            });

        } catch (error) {
            logger.error('Error in get announcements:', error);
            next(error);
        }
    }
);

// ============================================================================
// GET SINGLE ANNOUNCEMENT
// ============================================================================

router.get('/:id',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const userRole = req.user.role;

            // Build query based on user role
            let query = adminSupabase
                .from('announcements')
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    approver:users!announcements_approved_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    rejector:users!announcements_rejected_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    attachments:announcement_attachments(
                        id,
                        file_name,
                        file_size,
                        file_type,
                        mime_type
                    )
                `)
                .eq('id', id);

            // Apply access control
            if (!['principal', 'admin'].includes(userRole)) {
                query = query.or(`status.eq.approved,created_by.eq.${req.user.id}`);
            }

            const { data: announcement, error } = await query.single();

            if (error || !announcement) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Announcement not found'
                });
            }

            // Track view for published announcements
            if (announcement.status === 'approved' && announcement.is_published) {
                try {
                    await adminSupabase
                        .from('announcement_views')
                        .upsert({
                            announcement_id: announcement.id,
                            user_id: req.user.id
                        }, { onConflict: 'announcement_id,user_id' });
                } catch (viewError) {
                    logger.error('Error tracking view:', viewError);
                }
            }

            res.json({
                status: 'success',
                data: { announcement }
            });

        } catch (error) {
            logger.error('Error in get announcement:', error);
            next(error);
        }
    }
);

// ============================================================================
// UPDATE ANNOUNCEMENT
// ============================================================================

router.put('/:id',
    authenticate,
    [
        body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
        body('content').optional().trim().isLength({ min: 1, max: 5000 }).withMessage('Content must be between 1 and 5000 characters'),
        body('announcement_type').optional().isIn(['circular', 'general', 'urgent', 'academic', 'administrative']).withMessage('Invalid announcement type'),
        body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']).withMessage('Invalid priority level'),
        body('target_roles').optional().isArray().withMessage('Target roles must be an array'),
        body('target_classes').optional().isArray().withMessage('Target classes must be an array'),
        body('publish_at').optional().isISO8601().toDate().withMessage('Invalid publish date'),
        body('expires_at').optional().isISO8601().toDate().withMessage('Invalid expiry date'),
        body('is_featured').optional().isBoolean().withMessage('is_featured must be a boolean')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const userRole = req.user.role;

            // Check if announcement exists and user has permission to edit
            const { data: existingAnnouncement, error: fetchError } = await adminSupabase
                .from('announcements')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !existingAnnouncement) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Announcement not found'
                });
            }

            // Check permissions - allow editing pending AND approved announcements by creators
            const canEdit = ['principal', 'admin'].includes(userRole) ||
                (existingAnnouncement.created_by === req.user.id &&
                    existingAnnouncement.status &&
                    ['pending', 'approved'].includes(existingAnnouncement.status.toLowerCase()));

            // Log permission check details for debugging
            logger.info('Announcement edit permission check:', {
                announcement_id: id,
                user_id: req.user.id,
                user_role: userRole,
                announcement_status: existingAnnouncement.status,
                announcement_status_type: typeof existingAnnouncement.status,
                announcement_creator: existingAnnouncement.created_by,
                can_edit: canEdit,
                is_admin_principal: ['principal', 'admin'].includes(userRole),
                is_creator: existingAnnouncement.created_by === req.user.id,
                is_editable: existingAnnouncement.status && ['pending', 'approved'].includes(existingAnnouncement.status.toLowerCase())
            });

            if (!canEdit) {
                return res.status(403).json({
                    status: 'error',
                    message: `You can only edit announcements that are pending or approved. Current status: ${existingAnnouncement.status}`
                });
            }

            // Prepare update data
            const updateData = {};
            const allowedFields = ['title', 'content', 'announcement_type', 'priority', 'target_roles', 'target_classes', 'target_departments', 'publish_at', 'expires_at', 'is_featured'];

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            // Reset approval status when editing pending OR approved announcements
            if (existingAnnouncement.status && ['pending', 'approved'].includes(existingAnnouncement.status.toLowerCase())) {
                updateData.status = 'pending';
                updateData.approved_by = null;
                updateData.approved_at = null;
                updateData.rejected_by = null;
                updateData.rejected_at = null;
                updateData.rejection_reason = null;
                updateData.is_published = false;
            }

            // Update announcement
            const { data: updatedAnnouncement, error: updateError } = await adminSupabase
                .from('announcements')
                .update(updateData)
                .eq('id', id)
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    )
                `)
                .single();

            if (updateError) {
                logger.error('Error updating announcement:', updateError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to update announcement'
                });
            }

            // Determine response message based on status change
            let responseMessage = 'Announcement updated successfully';
            if (existingAnnouncement.status && ['pending', 'approved'].includes(existingAnnouncement.status.toLowerCase())) {
                responseMessage = 'Announcement updated and moved back to pending status for re-approval';
            }

            res.json({
                status: 'success',
                message: responseMessage,
                data: {
                    announcement: updatedAnnouncement,
                    status_changed: existingAnnouncement.status && ['pending', 'approved'].includes(existingAnnouncement.status.toLowerCase()),
                    requires_reapproval: existingAnnouncement.status && ['pending', 'approved'].includes(existingAnnouncement.status.toLowerCase())
                }
            });

        } catch (error) {
            logger.error('Error in update announcement:', error);
            next(error);
        }
    }
);

// ============================================================================
// APPROVE/REJECT ANNOUNCEMENT (Principal/Admin only)
// ============================================================================

router.patch('/:id/approval',
    authenticate,
    authorize(['principal', 'admin']),
    [
        body('action').isIn(['approve', 'reject']).withMessage('Action must be either approve or reject'),
        body('rejection_reason').optional().trim().isLength({ min: 1, max: 500 }).withMessage('Rejection reason must be between 1 and 500 characters')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { id } = req.params;
            const { action, rejection_reason } = req.body;

            // Check if announcement exists
            const { data: announcement, error: fetchError } = await adminSupabase
                .from('announcements')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !announcement) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Announcement not found'
                });
            }

            // Check if announcement is pending approval
            if (announcement.status !== 'pending') {
                return res.status(400).json({
                    status: 'error',
                    message: 'Announcement is not pending approval'
                });
            }

            // Prepare update data
            const updateData = {};
            if (action === 'approve') {
                updateData.status = 'approved';
                updateData.approved_by = req.user.id;
                updateData.approved_at = new Date().toISOString();
                updateData.is_published = true;
                updateData.rejected_by = null;
                updateData.rejected_at = null;
                updateData.rejection_reason = null;
            } else {
                updateData.status = 'rejected';
                updateData.rejected_by = req.user.id;
                updateData.rejected_at = new Date().toISOString();
                updateData.rejection_reason = rejection_reason;
                updateData.approved_by = null;
                updateData.approved_at = null;
                updateData.is_published = false;
            }

            // Update announcement
            const { data: updatedAnnouncement, error: updateError } = await adminSupabase
                .from('announcements')
                .update(updateData)
                .eq('id', id)
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    approver:users!announcements_approved_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    rejector:users!announcements_rejected_by_fkey(
                        id,
                        full_name,
                        role
                    )
                `)
                .single();

            if (updateError) {
                logger.error('Error updating announcement approval:', updateError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to update announcement approval'
                });
            }

            // Create recipients if approved
            if (action === 'approve') {
                await createAnnouncementRecipients(announcement.id, announcement.target_roles);
            }

            res.json({
                status: 'success',
                message: `Announcement ${action}d successfully`,
                data: { announcement: updatedAnnouncement }
            });

        } catch (error) {
            logger.error('Error in announcement approval:', error);
            next(error);
        }
    }
);

// ============================================================================
// DELETE ANNOUNCEMENT
// ============================================================================

router.delete('/:id',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const userRole = req.user.role;

            // Check if announcement exists and user has permission to delete
            const { data: announcement, error: fetchError } = await adminSupabase
                .from('announcements')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !announcement) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Announcement not found'
                });
            }

            // Check permissions - only allow deleting pending announcements
            const canDelete = ['principal', 'admin'].includes(userRole) ||
                (announcement.created_by === req.user.id && announcement.status === 'pending');

            if (!canDelete) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only delete announcements that are pending approval'
                });
            }

            // Delete announcement
            const { error: deleteError } = await adminSupabase
                .from('announcements')
                .delete()
                .eq('id', id);

            if (deleteError) {
                logger.error('Error deleting announcement:', deleteError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to delete announcement'
                });
            }

            res.json({
                status: 'success',
                message: 'Announcement deleted successfully'
            });

        } catch (error) {
            logger.error('Error in delete announcement:', error);
            next(error);
        }
    }
);

// ============================================================================
// GET TARGETED ANNOUNCEMENTS (Parent/Teacher specific)
// ============================================================================

router.get('/my-announcements',
    authenticate,
    authorize(['parent', 'teacher']),
    async (req, res, next) => {
        try {
            const {
                announcement_type,
                priority,
                page = 1,
                limit = 20,
                is_featured,
                unread_only = false,
                start_date,
                end_date,
                created_after,
                created_before,
                published_after,
                published_before
            } = req.query;

            const offset = (page - 1) * limit;
            const userRole = req.user.role;
            const userId = req.user.id;

            // Build query for targeted announcements
            let query = adminSupabase
                .from('announcements')
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    approver:users!announcements_approved_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    attachments:announcement_attachments(
                        id,
                        file_name,
                        file_size,
                        file_type,
                        mime_type
                    )
                `)
                .eq('status', 'approved')
                .eq('is_published', true)
                .or(`target_roles.cs.{${userRole}},target_roles.eq.{}`)
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false });

            // Apply additional filters
            if (announcement_type) {
                query = query.eq('announcement_type', announcement_type);
            }
            if (priority) {
                query = query.eq('priority', priority);
            }
            if (is_featured !== undefined) {
                query = query.eq('is_featured', is_featured === 'true');
            }

            // Apply date range filters
            if (start_date) {
                query = query.gte('created_at', start_date);
            }
            if (end_date) {
                query = query.lte('created_at', end_date);
            }
            if (created_after) {
                query = query.gt('created_at', created_after);
            }
            if (created_before) {
                query = query.lt('created_at', created_before);
            }
            if (published_after) {
                query = query.gt('publish_at', published_after);
            }
            if (published_before) {
                query = query.lt('publish_at', published_before);
            }

            // Get total count
            const { count: totalCount, error: countError } = await adminSupabase
                .from('announcements')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .eq('is_published', true)
                .or(`target_roles.cs.{${userRole}},target_roles.eq.{}`);

            if (countError) {
                logger.error('Error getting targeted announcement count:', countError);
            }

            // Get announcements with pagination
            const { data: announcements, error: fetchError } = await query
                .range(offset, offset + limit - 1);

            if (fetchError) {
                logger.error('Error fetching targeted announcements:', fetchError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch announcements'
                });
            }

            // Process announcements to add read status and track views
            const processedAnnouncements = await Promise.all(
                (announcements || []).map(async (announcement) => {
                    // Track view if not already viewed
                    try {
                        await adminSupabase
                            .from('announcement_views')
                            .upsert({
                                announcement_id: announcement.id,
                                user_id: userId
                            }, { onConflict: 'announcement_id,user_id' });
                    } catch (error) {
                        logger.error('Error tracking view:', error);
                    }

                    // Check if user is a recipient
                    const { data: recipient } = await adminSupabase
                        .from('announcement_recipients')
                        .select('delivery_status, read_at')
                        .eq('announcement_id', announcement.id)
                        .eq('user_id', userId)
                        .single();

                    return {
                        ...announcement,
                        is_read: !!recipient?.read_at,
                        read_at: recipient?.read_at,
                        delivery_status: recipient?.delivery_status || 'pending'
                    };
                })
            );

            // Filter unread announcements if requested
            const filteredAnnouncements = unread_only === 'true'
                ? processedAnnouncements.filter(a => !a.is_read)
                : processedAnnouncements;

            // Get summary statistics
            const { data: summaryData } = await adminSupabase
                .from('announcement_recipients')
                .select('announcement_id, read_at')
                .eq('user_id', userId);

            const totalTargeted = summaryData?.length || 0;
            const readCount = summaryData?.filter(r => r.read_at).length || 0;
            const unreadCount = totalTargeted - readCount;

            res.json({
                status: 'success',
                data: {
                    announcements: filteredAnnouncements,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount || 0,
                        total_pages: Math.ceil((totalCount || 0) / limit),
                        has_next: offset + limit < (totalCount || 0),
                        has_prev: page > 1
                    },
                    summary: {
                        total_targeted: totalTargeted,
                        read_count: readCount,
                        unread_count: unreadCount,
                        user_role: userRole
                    },
                    filters: {
                        announcement_type,
                        priority,
                        is_featured,
                        unread_only,
                        start_date,
                        end_date,
                        created_after,
                        created_before,
                        published_after,
                        published_before
                    }
                }
            });

        } catch (error) {
            logger.error('Error in get targeted announcements:', error);
            next(error);
        }
    }
);

// ============================================================================
// MARK ANNOUNCEMENT AS READ
// ============================================================================

router.patch('/:id/read',
    authenticate,
    authorize(['parent', 'teacher']),
    async (req, res, next) => {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Check if announcement exists and is targeted to user
            const { data: announcement, error: fetchError } = await adminSupabase
                .from('announcements')
                .select('*')
                .eq('id', id)
                .eq('status', 'approved')
                .eq('is_published', true)
                .single();

            if (fetchError || !announcement) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Announcement not found or not accessible'
                });
            }

            // Update recipient status to read
            const { error: updateError } = await adminSupabase
                .from('announcement_recipients')
                .update({
                    delivery_status: 'read',
                    read_at: new Date().toISOString()
                })
                .eq('announcement_id', id)
                .eq('user_id', userId);

            if (updateError) {
                logger.error('Error marking announcement as read:', updateError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to mark announcement as read'
                });
            }

            res.json({
                status: 'success',
                message: 'Announcement marked as read'
            });

        } catch (error) {
            logger.error('Error in mark announcement as read:', error);
            next(error);
        }
    }
);

// ============================================================================
// GET PENDING APPROVALS (Principal/Admin only)
// ============================================================================

router.get('/pending/approvals',
    authenticate,
    authorize(['principal', 'admin']),
    async (req, res, next) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            // Get pending announcements
            const { data: pendingAnnouncements, error: fetchError } = await adminSupabase
                .from('announcements')
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (fetchError) {
                logger.error('Error fetching pending announcements:', fetchError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch pending announcements'
                });
            }

            // Get total count
            const { count: totalCount, error: countError } = await adminSupabase
                .from('announcements')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (countError) {
                logger.error('Error getting pending count:', countError);
            }

            res.json({
                status: 'success',
                data: {
                    pending_announcements: pendingAnnouncements || [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount || 0,
                        total_pages: Math.ceil((totalCount || 0) / limit),
                        has_next: offset + limit < (totalCount || 0),
                        has_prev: page > 1
                    }
                }
            });

        } catch (error) {
            logger.error('Error in get pending approvals:', error);
            next(error);
        }
    }
);

// ============================================================================
// GET MY PENDING ANNOUNCEMENTS (For creators to edit/delete)
// ============================================================================

router.get('/my-pending',
    authenticate,
    async (req, res, next) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;
            const userId = req.user.id;

            // Get pending announcements created by the current user
            const { data: pendingAnnouncements, error: fetchError } = await adminSupabase
                .from('announcements')
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('status', 'pending')
                .eq('created_by', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (fetchError) {
                logger.error('Error fetching my pending announcements:', fetchError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch pending announcements'
                });
            }

            // Get total count
            const { count: totalCount, error: countError } = await adminSupabase
                .from('announcements')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending')
                .eq('created_by', userId);

            if (countError) {
                logger.error('Error getting my pending count:', countError);
            }

            res.json({
                status: 'success',
                data: {
                    pending_announcements: pendingAnnouncements || [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount || 0,
                        total_pages: Math.ceil((totalCount || 0) / limit),
                        has_next: offset + limit < (totalCount || 0),
                        has_prev: page > 1
                    },
                    message: 'These are your pending announcements that you can edit or delete'
                }
            });

        } catch (error) {
            logger.error('Error in get my pending announcements:', error);
            next(error);
        }
    }
);

// ============================================================================
// BULK ACTIONS FOR PENDING ANNOUNCEMENTS
// ============================================================================

router.post('/bulk-actions',
    authenticate,
    [
        body('action').isIn(['delete', 'resubmit']).withMessage('Action must be either delete or resubmit'),
        body('announcement_ids').isArray({ min: 1 }).withMessage('Announcement IDs must be an array with at least one item'),
        body('announcement_ids.*').isUUID().withMessage('Each announcement ID must be a valid UUID')
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { action, announcement_ids } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;

            // Verify all announcements exist and are pending
            const { data: announcements, error: fetchError } = await adminSupabase
                .from('announcements')
                .select('id, status, created_by')
                .in('id', announcement_ids)
                .eq('status', 'pending');

            if (fetchError) {
                logger.error('Error fetching announcements for bulk action:', fetchError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch announcements'
                });
            }

            if (!announcements || announcements.length === 0) {
                return res.status(404).json({
                    status: 'error',
                    message: 'No pending announcements found'
                });
            }

            // Check permissions for each announcement
            const unauthorizedAnnouncements = announcements.filter(
                announcement => !['principal', 'admin'].includes(userRole) &&
                    announcement.created_by !== userId
            );

            if (unauthorizedAnnouncements.length > 0) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You do not have permission to modify some of these announcements',
                    unauthorized_ids: unauthorizedAnnouncements.map(a => a.id)
                });
            }

            let result;
            if (action === 'delete') {
                // Delete announcements
                const { error: deleteError } = await adminSupabase
                    .from('announcements')
                    .delete()
                    .in('id', announcement_ids);

                if (deleteError) {
                    logger.error('Error deleting announcements:', deleteError);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Failed to delete announcements'
                    });
                }

                result = {
                    message: `Successfully deleted ${announcements.length} pending announcement(s)`,
                    deleted_count: announcements.length
                };
            } else if (action === 'resubmit') {
                // Resubmit announcements (reset to pending status)
                const { error: updateError } = await adminSupabase
                    .from('announcements')
                    .update({
                        status: 'pending',
                        approved_by: null,
                        approved_at: null,
                        rejected_by: null,
                        rejected_at: null,
                        rejection_reason: null,
                        is_published: false,
                        updated_at: new Date().toISOString()
                    })
                    .in('id', announcement_ids);

                if (updateError) {
                    logger.error('Error resubmitting announcements:', updateError);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Failed to resubmit announcements'
                    });
                }

                result = {
                    message: `Successfully resubmitted ${announcements.length} announcement(s)`,
                    resubmitted_count: announcements.length
                };
            }

            res.json({
                status: 'success',
                data: result
            });

        } catch (error) {
            logger.error('Error in bulk actions:', error);
            next(error);
        }
    }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createAnnouncementRecipients(announcementId, targetRoles) {
    try {
        // Get users based on target roles
        let query = adminSupabase
            .from('users')
            .select('id')
            .eq('is_registered', true);

        if (targetRoles && targetRoles.length > 0) {
            query = query.in('role', targetRoles);
        }

        const { data: users, error } = await query;

        if (error) {
            logger.error('Error fetching users for recipients:', error);
            return;
        }

        if (users && users.length > 0) {
            // Create recipients
            const recipients = users.map(user => ({
                announcement_id: announcementId,
                user_id: user.id,
                delivery_status: 'pending'
            }));

            const { error: insertError } = await adminSupabase
                .from('announcement_recipients')
                .insert(recipients);

            if (insertError) {
                logger.error('Error creating recipients:', insertError);
            }
        }
    } catch (error) {
        logger.error('Error in createAnnouncementRecipients:', error);
    }
}

export default router;
