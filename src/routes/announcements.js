import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import notificationService from '../services/notificationService.js';
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
        body('target_subjects').optional().isArray().withMessage('Target subjects must be an array'),
        body('target_departments').optional().isArray().withMessage('Target departments must be an array'),
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
                target_subjects = [],
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

            // If auto-approved, create recipients and send notifications
            if (initialStatus === 'approved') {
                await createAnnouncementRecipients(announcement.id, target_roles);
                sendAnnouncementNotifications(announcement, target_roles);
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

router.get('/:id([0-9a-fA-F-]{36})',
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

            // Enrich with class division names for target_classes
            let targetClassNames = [];
            let targetClassesDetailed = [];
            try {
                const targetClassIds = Array.isArray(announcement.target_classes) ? announcement.target_classes : [];
                if (targetClassIds.length > 0) {
                    const { data: classesLookup } = await adminSupabase
                        .from('class_divisions')
                        .select('id, division, class_level:class_level_id (name)')
                        .in('id', targetClassIds);

                    if (Array.isArray(classesLookup)) {
                        targetClassesDetailed = classesLookup
                            .filter(cd => cd && cd.id && cd.class_level && cd.class_level.name && cd.division)
                            .map(cd => ({
                                id: cd.id,
                                name: `${cd.class_level.name} ${cd.division}`
                            }));
                        targetClassNames = targetClassesDetailed.map(c => c.name);
                    }
                }
            } catch (_) { }

            res.json({
                status: 'success',
                data: {
                    announcement: {
                        ...announcement,
                        target_class_names: targetClassNames,
                        target_classes_detailed: targetClassesDetailed
                    }
                }
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
        body('target_subjects').optional().isArray().withMessage('Target subjects must be an array'),
        body('target_departments').optional().isArray().withMessage('Target departments must be an array'),
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
            const allowedFields = ['title', 'content', 'announcement_type', 'priority', 'target_roles', 'target_classes', 'target_subjects', 'target_departments', 'publish_at', 'expires_at', 'is_featured'];

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = req.body[field];
                }
            });

            // Reset approval status when editing pending OR approved announcements
            if (existingAnnouncement.status && ['pending', 'approved'].includes(existingAnnouncement.status.toLowerCase())) {
                // Determine new status based on who is editing and who created it
                const editorRole = req.user.role;
                const isOwnAnnouncement = existingAnnouncement.created_by === req.user.id;

                if (['principal', 'admin'].includes(editorRole)) {
                    // Principal/Admin is editing - automatically approve since they have authority
                    updateData.status = 'approved';
                    updateData.is_published = true;
                    updateData.approved_by = req.user.id;
                    updateData.approved_at = new Date().toISOString();
                    updateData.rejected_by = null;
                    updateData.rejected_at = null;
                    updateData.rejection_reason = null;
                } else {
                    // Teacher/Staff is editing
                    if (existingAnnouncement.status === 'pending') {
                        // Teacher editing their own pending announcement - keep it pending
                        updateData.status = 'pending';
                        updateData.is_published = false;
                        // Keep existing pending status
                    } else {
                        // Teacher editing an approved announcement - set to pending for re-approval
                        updateData.status = 'pending';
                        updateData.approved_by = null;
                        updateData.approved_at = null;
                        updateData.rejected_by = null;
                        updateData.rejected_at = null;
                        updateData.rejection_reason = null;
                        updateData.is_published = false;
                    }
                }
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
            let statusChanged = false;
            let requiresReapproval = false;

            if (existingAnnouncement.status && ['pending', 'approved'].includes(existingAnnouncement.status.toLowerCase())) {
                const editorRole = req.user.role;
                const isOwnAnnouncement = existingAnnouncement.created_by === req.user.id;

                if (['principal', 'admin'].includes(editorRole)) {
                    // Principal/Admin editing - automatically approved
                    responseMessage = 'Announcement updated and automatically approved';
                    statusChanged = true;
                    requiresReapproval = false;
                } else {
                    if (existingAnnouncement.status === 'pending') {
                        // Teacher editing their own pending announcement
                        responseMessage = 'Announcement updated successfully (remains pending)';
                        statusChanged = false;
                        requiresReapproval = false;
                    } else {
                        // Teacher editing an approved announcement
                        responseMessage = 'Announcement updated and moved back to pending status for re-approval';
                        statusChanged = true;
                        requiresReapproval = true;
                    }
                }
            }

            res.json({
                status: 'success',
                message: responseMessage,
                data: {
                    announcement: updatedAnnouncement,
                    status_changed: statusChanged,
                    requires_reapproval: requiresReapproval
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

            // Create recipients and send notifications if approved
            if (action === 'approve') {
                await createAnnouncementRecipients(announcement.id, announcement.target_roles);
                sendAnnouncementNotifications(updatedAnnouncement, announcement.target_roles);
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
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false });

            // Role-based class filtering (applied at SQL level for correct pagination)
            let allowedClassIds = [];
            if (userRole === 'parent') {
                const { data: childrenClasses } = await adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        student_academic_records (
                            class_division_id
                        )
                    `)
                    .eq('parent_id', userId);
                allowedClassIds = (childrenClasses || [])
                    .flatMap(mapping => mapping.student_academic_records || [])
                    .map(rec => rec.class_division_id)
                    .filter(Boolean);
            } else if (userRole === 'teacher') {
                const [{ data: teacherAssignments }, { data: classTeacherDivisions }] = await Promise.all([
                    adminSupabase
                        .from('class_teacher_assignments')
                        .select('class_division_id')
                        .eq('teacher_id', userId)
                        .eq('is_active', true),
                    adminSupabase
                        .from('class_divisions')
                        .select('id')
                        .eq('teacher_id', userId)
                ]);

                allowedClassIds = [
                    ...((teacherAssignments || []).map(t => t.class_division_id) || []),
                    ...((classTeacherDivisions || []).map(c => c.id) || [])
                ].filter(Boolean);
            }

            // Build combined OR with role and class conditions to avoid overriding .or
            const roleClause = `target_roles.cs.{${userRole}}`;
            const emptyRoleClause = 'target_roles.eq.{}';
            const classClause = (allowedClassIds.length > 0)
                ? `or(target_classes.ov.{${allowedClassIds.join(',')}},target_classes.eq.{})`
                : 'target_classes.eq.{}';

            if (userRole === 'teacher') {
                // Teachers: only class-targeted (overlap) or school-wide
                query = query.or(`${classClause}`);
            } else {
                // Parents must match role (or empty) AND class (or school-wide)
                query = query.or(`and(${roleClause},${classClause}),and(${emptyRoleClause},${classClause})`);
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

            // Get total count (apply the same role filters for correctness)
            let countQueryBuilder = adminSupabase
                .from('announcements')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .eq('is_published', true);

            const countClassClause = (allowedClassIds.length > 0)
                ? `or(target_classes.ov.{${allowedClassIds.join(',')}},target_classes.eq.{})`
                : 'target_classes.eq.{}';
            if (userRole === 'teacher') {
                // Teachers: only class-targeted (overlap) or school-wide
                countQueryBuilder = countQueryBuilder.or(`${countClassClause}`);
            } else {
                countQueryBuilder = countQueryBuilder.or(`and(${roleClause},${countClassClause}),and(${emptyRoleClause},${countClassClause})`);
            }

            // Apply the same extra filters to count query
            if (announcement_type) countQueryBuilder = countQueryBuilder.eq('announcement_type', announcement_type);
            if (priority) countQueryBuilder = countQueryBuilder.eq('priority', priority);
            if (is_featured !== undefined) countQueryBuilder = countQueryBuilder.eq('is_featured', is_featured === 'true');
            if (start_date) countQueryBuilder = countQueryBuilder.gte('created_at', start_date);
            if (end_date) countQueryBuilder = countQueryBuilder.lte('created_at', end_date);
            if (created_after) countQueryBuilder = countQueryBuilder.gt('created_at', created_after);
            if (created_before) countQueryBuilder = countQueryBuilder.lt('created_at', created_before);
            if (published_after) countQueryBuilder = countQueryBuilder.gt('publish_at', published_after);
            if (published_before) countQueryBuilder = countQueryBuilder.lt('publish_at', published_before);

            const { count: totalCount, error: countError } = await countQueryBuilder;

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
// GET TEACHER ANNOUNCEMENTS (Subject and Class specific)
// ============================================================================

router.get('/teacher/announcements',
    authenticate,
    authorize(['teacher']),
    async (req, res, next) => {
        try {
            const teacherId = req.user.id;
            const {
                page = 1,
                limit = 20,
                unread_only = false,
                subject_filter = true, // Whether to filter by teacher's subjects
                announcement_type,
                priority,
                publish_at_from,
                publish_at_to,
                class_division_id,
                subject_name,
                class_only = 'false'
            } = req.query;

            // Validate and parse parameters
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 20;
            const offset = (pageNum - 1) * limitNum;

            // Validate date formats if provided
            if (publish_at_from && isNaN(Date.parse(publish_at_from))) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid publish_at_from date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
                });
            }

            if (publish_at_to && isNaN(Date.parse(publish_at_to))) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid publish_at_to date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
                });
            }

            // Validate UUID format for class_division_id if provided
            if (class_division_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(class_division_id)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid class_division_id format. Must be a valid UUID'
                });
            }

            const { data: teacherAssignments } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    class_division_id,
                    subject,
                    is_active
                `)
                .eq('teacher_id', teacherId)
                .eq('is_active', true);

            // Get class teacher assignments
            const { data: classTeacherDivisions } = await adminSupabase
                .from('class_divisions')
                .select('id')
                .eq('teacher_id', teacherId);

            // Extract subjects and class divisions
            const teacherSubjects = teacherAssignments?.map(ta => ta.subject).filter(Boolean) || [];
            const teacherClassDivisions = [
                ...(teacherAssignments?.map(ta => ta.class_division_id) || []),
                ...(classTeacherDivisions?.map(ctd => ctd.id) || [])
            ];

            // Build query for announcements
            let query = adminSupabase
                .from('announcements')
                .select(`
                    *,
                    creator:users!announcements_created_by_fkey(
                        id,
                        full_name,
                        role
                    ),
                    attachments:announcement_attachments(
                        id,
                        file_name,
                        file_size,
                        file_type
                    )
                `)
                .eq('status', 'approved')
                .eq('is_published', true);

            // Visibility conditions
            let visibilityConditions;
            if (class_only === 'true') {
                // Restrict strictly to announcements targeted to teacher's classes
                visibilityConditions = [];
                if (teacherClassDivisions.length > 0) {
                    visibilityConditions.push(`target_classes.ov.{${teacherClassDivisions.join(',')}}`);
                    query = query.or(visibilityConditions.join(','));
                } else {
                    // No class assignments → no class-only announcements
                    return res.json({
                        status: 'success',
                        data: {
                            announcements: [],
                            teacher_info: {
                                id: teacherId,
                                subjects: teacherSubjects,
                                class_divisions: teacherClassDivisions,
                                total_subjects: teacherSubjects.length,
                                total_class_divisions: teacherClassDivisions.length
                            },
                            pagination: {
                                page: pageNum,
                                limit: limitNum,
                                total: 0,
                                total_pages: 0,
                                has_next: false,
                                has_prev: pageNum > 1
                            },
                            filters: {
                                subject_filter,
                                announcement_type,
                                priority,
                                unread_only,
                                publish_at_from,
                                publish_at_to,
                                class_division_id,
                                subject_name,
                                class_only
                            }
                        }
                    });
                }
            } else {
                // Default: teachers see teacher-wide, empty roles, class/subject targeted
                visibilityConditions = [
                    'target_roles.cs.{teacher}',
                    'target_roles.eq.{}'
                ];
                if (teacherClassDivisions.length > 0) {
                    visibilityConditions.push(`target_classes.ov.{${teacherClassDivisions.join(',')}}`);
                }
                if (subject_filter === 'true' && teacherSubjects.length > 0) {
                    visibilityConditions.push(`target_subjects.ov.{${teacherSubjects.join(',')}}`);
                }
                query = query.or(visibilityConditions.join(','));
            }

            // Apply additional filters
            if (announcement_type) {
                query = query.eq('announcement_type', announcement_type);
            }
            if (priority) {
                query = query.eq('priority', priority);
            }
            if (publish_at_from) {
                query = query.gte('publish_at', publish_at_from);
            }
            if (publish_at_to) {
                query = query.lte('publish_at', publish_at_to);
            }
            if (class_division_id) {
                query = query.contains('target_classes', [class_division_id]);
            }
            if (subject_name) {
                query = query.contains('target_subjects', [subject_name]);
            }

            // Get total count for pagination (use the same OR visibility conditions)
            let countQuery = adminSupabase
                .from('announcements')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'approved')
                .eq('is_published', true)
                .or(visibilityConditions.join(','));

            // Apply additional filters
            if (announcement_type) {
                countQuery = countQuery.eq('announcement_type', announcement_type);
            }
            if (priority) {
                countQuery = countQuery.eq('priority', priority);
            }

            const { count: totalCount, error: countError } = await countQuery;

            if (countError) {
                logger.error('Error getting teacher announcement count:', countError);
            }

            // Get announcements with pagination
            const { data: announcements, error } = await query
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Process announcements (add read status, etc.)
            const processedAnnouncements = await Promise.all(
                announcements.map(async (announcement) => {
                    // Check if teacher is a recipient
                    const { data: recipient } = await adminSupabase
                        .from('announcement_recipients')
                        .select('delivery_status, read_at')
                        .eq('announcement_id', announcement.id)
                        .eq('user_id', teacherId)
                        .single();

                    // Determine relevance
                    const isSubjectMatch = teacherSubjects.some(subject =>
                        announcement.target_subjects?.includes(subject)
                    );
                    const isClassTeacher = announcement.target_classes?.some(
                        (classId) => teacherClassDivisions.includes(classId)
                    );
                    const isSubjectTeacher = teacherAssignments?.some(ta =>
                        announcement.target_subjects?.includes(ta.subject)
                    );

                    return {
                        ...announcement,
                        is_read: !!recipient?.read_at,
                        read_at: recipient?.read_at,
                        delivery_status: recipient?.delivery_status || 'pending',
                        relevance: {
                            is_subject_match: isSubjectMatch,
                            is_class_teacher: isClassTeacher,
                            is_subject_teacher: isSubjectTeacher,
                            relevance_score: (isSubjectMatch ? 2 : 0) + (isClassTeacher ? 1 : 0) + (isSubjectTeacher ? 1 : 0)
                        }
                    };
                })
            );

            // Sort by relevance score (highest first)
            processedAnnouncements.sort((a, b) => b.relevance.relevance_score - a.relevance.relevance_score);

            // Filter unread announcements if requested
            const filteredAnnouncements = unread_only === 'true'
                ? processedAnnouncements.filter(a => !a.is_read)
                : processedAnnouncements;

            res.json({
                status: 'success',
                data: {
                    announcements: filteredAnnouncements,
                    teacher_info: {
                        id: teacherId,
                        subjects: teacherSubjects,
                        class_divisions: teacherClassDivisions,
                        total_subjects: teacherSubjects.length,
                        total_class_divisions: teacherClassDivisions.length
                    },
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total: totalCount || 0,
                        total_pages: Math.ceil((totalCount || 0) / limitNum),
                        has_next: offset + limitNum < (totalCount || 0),
                        has_prev: pageNum > 1
                    },
                    filters: {
                        subject_filter,
                        announcement_type,
                        priority,
                        unread_only,
                        publish_at_from,
                        publish_at_to,
                        class_division_id,
                        subject_name,
                        class_only
                    }
                }
            });

        } catch (error) {
            logger.error('Error fetching teacher announcements:', error);
            next(error);
        }
    }
);

// ============================================================================
// DEBUG: CHECK TEACHER ASSIGNMENTS FOR DIVISION
// ============================================================================

router.get('/debug/division/:class_division_id/teacher-assignments',
    authenticate,
    authorize(['teacher']),
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const teacherId = req.user.id;

            logger.info('Debug: Checking teacher assignments for division:', {
                teacher_id: teacherId,
                class_division_id: class_division_id
            });

            // Check class_teacher_assignments table (primary table)
            const { data: teacherAssignments, error: teacherError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    teacher_id,
                    class_division_id,
                    assignment_type,
                    subject,
                    is_active,
                    assigned_date
                `)
                .eq('class_division_id', class_division_id)
                .eq('teacher_id', teacherId)
                .eq('is_active', true);

            // Check legacy class_divisions table
            const { data: classTeacherData, error: classTeacherError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    level:class_level_id (
                        name
                    ),
                    teacher_id,
                    teacher:users!class_divisions_teacher_id_fkey (
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('id', class_division_id)
                .single();

            // Check legacy class_teacher_assignments table
            const { data: subjectTeacherData, error: subjectTeacherError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    teacher_id,
                    subject,
                    class_division_id,
                    is_active,
                    teacher:users!class_teacher_assignments_teacher_id_fkey (
                        id,
                        full_name,
                        role
                    )
                `)
                .eq('class_division_id', class_division_id)
                .eq('teacher_id', teacherId)
                .eq('is_active', true);

            res.json({
                status: 'success',
                data: {
                    division_info: {
                        id: class_division_id,
                        class_teacher_data: { data: classTeacherData, error: classTeacherError },
                        subject_teachers: { data: subjectTeacherData, error: subjectTeacherError }
                    },
                    current_teacher: {
                        id: teacherId,
                        teacher_assignments: { data: teacherAssignments, error: teacherError }
                    },
                    access_check: {
                        has_teacher_assignment: teacherAssignments && teacherAssignments.length > 0,
                        is_class_teacher: classTeacherData?.teacher_id === teacherId,
                        is_subject_teacher: subjectTeacherData && subjectTeacherData.length > 0,
                        has_access: (teacherAssignments && teacherAssignments.length > 0) ||
                            (classTeacherData?.teacher_id === teacherId) ||
                            (subjectTeacherData && subjectTeacherData.length > 0)
                    }
                }
            });

        } catch (error) {
            logger.error('Error in debug teacher assignments:', error);
            next(error);
        }
    }
);

// ============================================================================
// GET PARENT ANNOUNCEMENTS GROUPED BY STUDENT
// ============================================================================

router.get('/parent/children',
    authenticate,
    authorize(['parent']),
    async (req, res, next) => {
        try {
            const {
                student_id, // Filter by specific student
                start_date,
                end_date,
                status = 'approved',
                announcement_type,
                priority,
                is_featured,
                page = 1,
                limit = 20
            } = req.query;

            const offset = (page - 1) * limit;
            const parentId = req.user.id;

            // First, get all student IDs for this parent with student details
            const { data: parentMappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    students:students_master (
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .eq('parent_id', parentId);

            if (mappingsError) throw mappingsError;

            // Filter by specific student if provided
            let filteredMappings = parentMappings || [];
            if (student_id) {
                filteredMappings = filteredMappings.filter(mapping => mapping.student_id === student_id);
                if (filteredMappings.length === 0) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Student not found or you do not have access to this student'
                    });
                }
            }

            const studentIds = filteredMappings?.map(mapping => mapping.student_id) || [];

            // Get all class divisions where parent has children enrolled
            let childClasses = [];
            let classDivisionIds = [];

            if (studentIds.length > 0) {
                const { data: childClassesData, error: childClassesError } = await adminSupabase
                    .from('student_academic_records')
                    .select(`
                        student_id,
                        class_division_id,
                        roll_number,
                        class_divisions!inner (
                            id,
                            division,
                            academic_year:academic_year_id (year_name),
                            class_level:class_level_id (name)
                        )
                    `)
                    .in('student_id', studentIds)
                    .eq('status', 'ongoing');

                if (childClassesError) throw childClassesError;

                childClasses = childClassesData || [];
                classDivisionIds = childClasses?.map(record => record.class_division_id) || [];
            }

            // Build query for announcements relevant to parent's children
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
                .eq('is_published', true);

            // Apply status filter
            if (status) {
                query = query.eq('status', status);
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

            // Apply date range filters
            if (start_date) {
                query = query.gte('publish_at', start_date);
            }
            if (end_date) {
                query = query.lte('publish_at', end_date);
            }

            // Build the OR condition for announcements relevant to parent's children
            if (classDivisionIds.length > 0) {
                // Include only school-wide announcements and class-specific announcements for the child's classes
                const conditions = [
                    `target_classes.ov.{${classDivisionIds.join(',')}}`,
                    'target_classes.eq.{}'
                ];

                query = query.or(conditions.join(','));
            } else {
                // If no children, only show school-wide announcements
                query = query.eq('target_classes', '{}');
            }

            // Get total count with same filters
            let countQuery = adminSupabase
                .from('announcements')
                .select('*', { count: 'exact', head: true })
                .eq('is_published', true);

            if (status) countQuery = countQuery.eq('status', status);
            if (announcement_type) countQuery = countQuery.eq('announcement_type', announcement_type);
            if (priority) countQuery = countQuery.eq('priority', priority);
            if (is_featured !== undefined) countQuery = countQuery.eq('is_featured', is_featured === 'true');
            if (start_date) countQuery = countQuery.gte('publish_at', start_date);
            if (end_date) countQuery = countQuery.lte('publish_at', end_date);

            if (classDivisionIds.length > 0) {
                const conditions = [
                    `target_classes.ov.{${classDivisionIds.join(',')}}`,
                    'target_classes.eq.{}'
                ];
                countQuery = countQuery.or(conditions.join(','));
            } else {
                countQuery = countQuery.eq('target_classes', '{}');
            }

            const { count: totalCount, error: countError } = await countQuery;
            if (countError) {
                logger.error('Error getting parent announcements count:', countError);
            }

            // Get announcements with pagination
            const { data: announcements, error: fetchError } = await query
                .order('priority', { ascending: false })
                .order('publish_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (fetchError) {
                logger.error('Error fetching parent announcements:', fetchError);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch announcements'
                });
            }

            // Group announcements by student and add student information
            const announcementsByStudent = [];

            for (const mapping of filteredMappings) {
                const student = mapping.students;
                const studentRecord = childClasses.find(record => record.student_id === mapping.student_id);

                // Find announcements relevant to this student's class
                const studentAnnouncements = (announcements || []).filter(announcement => {
                    // School-wide announcements are relevant to all students
                    if (announcement.target_roles?.includes('parent') || announcement.target_roles?.length === 0) {
                        return true;
                    }

                    // Class-specific announcements
                    if (announcement.target_classes && announcement.target_classes.length > 0) {
                        if (studentRecord?.class_division_id && announcement.target_classes.includes(studentRecord.class_division_id)) {
                            return true;
                        }
                    }

                    return false;
                });

                // Add student information to each announcement
                const announcementsWithStudentInfo = studentAnnouncements.map(announcement => ({
                    ...announcement,
                    student_info: {
                        student_id: mapping.student_id,
                        student_name: student?.full_name || 'Unknown',
                        admission_number: student?.admission_number || 'Unknown',
                        class_division_id: studentRecord?.class_division_id || null,
                        class_name: studentRecord?.class_divisions ?
                            `${studentRecord.class_divisions.class_level.name} ${studentRecord.class_divisions.division}` : 'Unknown',
                        roll_number: studentRecord?.roll_number || null
                    }
                }));

                announcementsByStudent.push({
                    student_id: mapping.student_id,
                    student_name: student?.full_name || 'Unknown',
                    admission_number: student?.admission_number || 'Unknown',
                    class_info: studentRecord ? {
                        class_division_id: studentRecord.class_division_id,
                        class_name: `${studentRecord.class_divisions.class_level.name} ${studentRecord.class_divisions.division}`,
                        division: studentRecord.class_divisions.division,
                        academic_year: studentRecord.class_divisions.academic_year.year_name,
                        class_level: studentRecord.class_divisions.class_level.name,
                        roll_number: studentRecord.roll_number
                    } : null,
                    announcements: announcementsWithStudentInfo,
                    total_announcements: announcementsWithStudentInfo.length
                });
            }

            // Sort students by name
            announcementsByStudent.sort((a, b) => a.student_name.localeCompare(b.student_name));

            // Calculate summary statistics
            const totalAnnouncements = announcementsByStudent.reduce((sum, student) => sum + student.total_announcements, 0);
            const studentsWithAnnouncements = announcementsByStudent.filter(student => student.total_announcements > 0).length;
            const studentsWithoutAnnouncements = announcementsByStudent.filter(student => student.total_announcements === 0).length;

            res.json({
                status: 'success',
                data: {
                    announcements_by_student: announcementsByStudent,
                    summary: {
                        total_students: announcementsByStudent.length,
                        total_announcements: totalAnnouncements,
                        students_with_announcements: studentsWithAnnouncements,
                        students_without_announcements: studentsWithoutAnnouncements,
                        filtered_by_student: !!student_id
                    },
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount || 0,
                        total_pages: Math.ceil((totalCount || 0) / limit),
                        has_next: offset + limit < (totalCount || 0),
                        has_prev: page > 1
                    },
                    filters_applied: {
                        student_id: student_id || null,
                        start_date: start_date || null,
                        end_date: end_date || null,
                        status: status || null,
                        announcement_type: announcement_type || null,
                        priority: priority || null,
                        is_featured: is_featured || null
                    }
                }
            });

        } catch (error) {
            logger.error('Error in get parent announcements by student:', error);
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

/**
 * Send notifications to parents when announcements are created
 */
async function sendAnnouncementNotifications(announcement, targetRoles) {
    try {
        console.log('📢 sendAnnouncementNotifications called for announcement:', announcement.id, 'targetRoles:', targetRoles);

        // Only send notifications to parents
        if (!targetRoles.includes('parent')) {
            console.log('⏭️ Skipping announcement notifications - parents not in target roles');
            return;
        }

        console.log('👨‍👩‍👧‍👦 Processing announcement for parents');
        // Get all parents with their children
        const { data: parentStudents, error } = await adminSupabase
            .from('parent_student_mappings')
            .select(`
                parent_id,
                student_id
            `);

        if (error) {
            console.error('❌ Error fetching parent-student mappings for announcement:', error);
            return;
        }

        console.log(`📊 Found ${parentStudents.length} parent-student mappings for announcement`);

        // Get all student information
        const studentIds = parentStudents.map(mapping => mapping.student_id);
        const { data: students, error: studentsError } = await adminSupabase
            .from('students_master')
            .select('id, full_name, admission_number')
            .in('id', studentIds);

        if (studentsError) {
            console.error('❌ Error fetching students:', studentsError);
            return;
        }

        // Get student academic records to get class_division_id
        const { data: academicRecords, error: academicError } = await adminSupabase
            .from('student_academic_records')
            .select('student_id, class_division_id')
            .in('student_id', studentIds)
            .eq('status', 'ongoing');

        if (academicError) {
            console.error('❌ Error fetching academic records:', academicError);
            return;
        }

        const studentMap = {};
        students.forEach(student => {
            const academicRecord = academicRecords.find(ar => ar.student_id === student.id);
            studentMap[student.id] = {
                ...student,
                class_division_id: academicRecord?.class_division_id
            };
        });

        // Get class division information for all students
        const classDivisionIds = [...new Set(academicRecords.map(ar => ar.class_division_id))];
        const { data: classDivisions, error: classError } = await adminSupabase
            .from('class_divisions')
            .select(`
                id,
                division,
                class_level:class_level_id (
                    name
                )
            `)
            .in('id', classDivisionIds);

        if (classError) {
            console.error('❌ Error fetching class divisions:', classError);
            return;
        }

        const classDivisionMap = {};
        classDivisions.forEach(cd => {
            classDivisionMap[cd.id] = cd;
        });

        // Group by parent to send bulk notifications
        const parentGroups = {};
        parentStudents.forEach(mapping => {
            if (!parentGroups[mapping.parent_id]) {
                parentGroups[mapping.parent_id] = [];
            }
            parentGroups[mapping.parent_id].push(mapping);
        });

        console.log(`📤 Sending announcement notifications to ${Object.keys(parentGroups).length} parents...`);

        // Send notifications to each parent (one per parent, not per student)
        const notificationPromises = Object.entries(parentGroups).map(async ([parentId, mappings]) => {
            console.log(`📨 Sending announcement notification to parent ${parentId} for ${mappings.length} students`);

            // Use the first student for the notification (since it's the same announcement for all)
            const firstMapping = mappings[0];
            const student = studentMap[firstMapping.student_id];
            if (!student) {
                console.error(`❌ Student not found for ID: ${firstMapping.student_id}`);
                return { success: false };
            }

            const classDivision = classDivisionMap[student.class_division_id];
            const className = classDivision ? `${classDivision.class_level.name} ${classDivision.division}` : 'Unknown Class';

            const result = await notificationService.sendParentNotification({
                parentId: firstMapping.parent_id,
                studentId: firstMapping.student_id,
                type: notificationService.notificationTypes.ANNOUNCEMENT,
                title: `New Announcement: ${announcement.title}`,
                message: announcement.content,
                data: {
                    announcement_id: announcement.id,
                    announcement_type: announcement.announcement_type,
                    priority: announcement.priority,
                    is_featured: announcement.is_featured,
                    student_name: student.full_name,
                    student_class: className,
                    affected_students: mappings.length
                },
                priority: announcement.priority,
                relatedId: announcement.id
            });

            console.log(`✅ Announcement notification result for parent ${parentId}:`, result.success ? 'SUCCESS' : 'FAILED');
            return result;
        });

        // Send all notifications in parallel (non-blocking) with a small delay
        setTimeout(() => {
            Promise.all(notificationPromises).then(results => {
                const successCount = results.filter(r => r.success).length;
                console.log(`✅ Sent announcement notifications to ${successCount}/${Object.keys(parentGroups).length} parents`);
            }).catch(error => {
                console.error('❌ Error in announcement notification sending:', error);
            });
        }, 100); // 100ms delay to ensure API response is sent first

    } catch (error) {
        logger.error('Error in sendAnnouncementNotifications:', error);
    }
}

export default router;
