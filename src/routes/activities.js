import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// List activities
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, activity_type, date_from, date_to, class_division_id } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('activities')
            .select(`
                *,
                teacher:users(full_name, role),
                class_division:class_divisions(name),
                items:activity_items(*),
                participants:activity_participants(
                    *,
                    student:students_master(full_name)
                )
            `)
            .order('activity_date', { ascending: false });

        // Apply filters
        if (status) {
            query = query.eq('status', status);
        }

        if (activity_type) {
            query = query.eq('activity_type', activity_type);
        }

        if (date_from) {
            query = query.gte('activity_date', date_from);
        }

        if (date_to) {
            query = query.lte('activity_date', date_to);
        }

        if (class_division_id) {
            query = query.eq('class_division_id', class_division_id);
        }

        // Role-based filtering
        if (req.user.role === 'teacher') {
            // Teachers see their own activities and activities for their assigned classes
            query = query.or(`teacher_id.eq.${req.user.id},class_division_id.in.(select class_division_id from class_teacher_assignments where teacher_id = ${req.user.id} and is_active = true)`);
        } else if (req.user.role === 'parent') {
            // Parents see activities for their children's classes
            query = query.in('class_division_id',
                `(select sar.class_division_id from parent_student_mappings psm 
                 join student_academic_records sar on sar.student_id = psm.student_id 
                 where psm.parent_id = ${req.user.id})`
            );
        }

        // Get total count
        const { count, error: countError } = await query.count();

        if (countError) {
            logger.error('Error getting activities count:', countError);
        }

        // Get paginated results
        const { data: activities, error } = await query
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching activities:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch activities'
            });
        }

        res.json({
            status: 'success',
            data: {
                activities,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in list activities:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Create activity
router.post('/', authenticate, async (req, res) => {
    try {
        const {
            title, description, activity_date, activity_type, class_division_id,
            dress_code, venue, start_time, end_time, max_participants, notes,
            items
        } = req.body;

        // Check permissions (only teachers can create activities)
        if (req.user.role !== 'teacher') {
            return res.status(403).json({
                status: 'error',
                message: 'Only teachers can create activities'
            });
        }

        // Validate required fields
        if (!title || !activity_date || !activity_type) {
            return res.status(400).json({
                status: 'error',
                message: 'Title, activity date, and activity type are required'
            });
        }

        // Validate activity type
        if (!['field_trip', 'sports', 'cultural', 'academic', 'other'].includes(activity_type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid activity type'
            });
        }

        // Create activity
        const { data: activity, error: activityError } = await supabase
            .from('activities')
            .insert({
                title,
                description,
                activity_date,
                activity_type,
                class_division_id,
                teacher_id: req.user.id,
                dress_code,
                venue,
                start_time,
                end_time,
                max_participants: max_participants ? parseInt(max_participants) : null,
                notes
            })
            .select()
            .single();

        if (activityError) {
            logger.error('Error creating activity:', activityError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create activity'
            });
        }

        // Create activity items if provided
        if (items && Array.isArray(items) && items.length > 0) {
            const itemData = items.map(item => ({
                activity_id: activity.id,
                item_name: item.item_name,
                description: item.description,
                is_required: item.is_required !== undefined ? item.is_required : true,
                item_type: item.item_type || 'other',
                quantity: item.quantity ? parseInt(item.quantity) : 1,
                notes: item.notes
            }));

            const { error: itemsError } = await supabase
                .from('activity_items')
                .insert(itemData);

            if (itemsError) {
                logger.error('Error creating activity items:', itemsError);
                // Don't fail the request, just log the error
            }
        }

        res.status(201).json({
            status: 'success',
            data: activity
        });

    } catch (error) {
        logger.error('Error in create activity:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get single activity
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: activity, error } = await supabase
            .from('activities')
            .select(`
                *,
                teacher:users(full_name, role),
                class_division:class_divisions(name),
                items:activity_items(*),
                participants:activity_participants(
                    *,
                    student:students_master(full_name),
                    consent_giver:users(full_name)
                ),
                reminders:activity_reminders(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Activity not found'
                });
            }
            logger.error('Error fetching activity:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch activity'
            });
        }

        // Check permissions
        if (req.user.role === 'teacher' && activity.teacher_id !== req.user.id) {
            // Check if teacher is assigned to this class
            const { data: assignment } = await supabase
                .from('class_teacher_assignments')
                .select('*')
                .eq('teacher_id', req.user.id)
                .eq('class_division_id', activity.class_division_id)
                .eq('is_active', true)
                .single();

            if (!assignment) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access denied'
                });
            }
        }

        res.json({
            status: 'success',
            data: activity
        });

    } catch (error) {
        logger.error('Error in get activity:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update activity
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Check permissions
        if (req.user.role !== 'teacher') {
            return res.status(403).json({
                status: 'error',
                message: 'Only teachers can update activities'
            });
        }

        // Get the activity to check ownership
        const { data: activity, error: fetchError } = await supabase
            .from('activities')
            .select('teacher_id')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Activity not found'
                });
            }
            logger.error('Error fetching activity:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch activity'
            });
        }

        if (activity.teacher_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only update your own activities'
            });
        }

        // Validate activity type if provided
        if (updateData.activity_type && !['field_trip', 'sports', 'cultural', 'academic', 'other'].includes(updateData.activity_type)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid activity type'
            });
        }

        const { data: updatedActivity, error } = await supabase
            .from('activities')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Error updating activity:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update activity'
            });
        }

        res.json({
            status: 'success',
            data: updatedActivity
        });

    } catch (error) {
        logger.error('Error in update activity:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Delete activity
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Check permissions
        if (req.user.role !== 'teacher') {
            return res.status(403).json({
                status: 'error',
                message: 'Only teachers can delete activities'
            });
        }

        // Get the activity to check ownership
        const { data: activity, error: fetchError } = await supabase
            .from('activities')
            .select('teacher_id, status')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Activity not found'
                });
            }
            logger.error('Error fetching activity:', fetchError);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch activity'
            });
        }

        if (activity.teacher_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only delete your own activities'
            });
        }

        // Check if activity can be deleted (not completed or in progress)
        if (activity.status === 'completed' || activity.status === 'in_progress') {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot delete completed or in-progress activities'
            });
        }

        const { error } = await supabase
            .from('activities')
            .delete()
            .eq('id', id);

        if (error) {
            logger.error('Error deleting activity:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to delete activity'
            });
        }

        res.json({
            status: 'success',
            message: 'Activity deleted successfully'
        });

    } catch (error) {
        logger.error('Error in delete activity:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Add participant to activity
router.post('/:id/participants', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { student_id, parent_consent } = req.body;

        // Check permissions
        if (req.user.role !== 'teacher') {
            return res.status(403).json({
                status: 'error',
                message: 'Only teachers can add participants'
            });
        }

        // Validate required fields
        if (!student_id) {
            return res.status(400).json({
                status: 'error',
                message: 'Student ID is required'
            });
        }

        // Check if activity exists and teacher owns it
        const { data: activity, error: activityError } = await supabase
            .from('activities')
            .select('teacher_id, class_division_id')
            .eq('id', id)
            .single();

        if (activityError || activity.teacher_id !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Check if student is in the same class
        const { data: student, error: studentError } = await supabase
            .from('student_academic_records')
            .select('*')
            .eq('student_id', student_id)
            .eq('class_division_id', activity.class_division_id)
            .single();

        if (studentError || !student) {
            return res.status(400).json({
                status: 'error',
                message: 'Student not found in this class'
            });
        }

        // Add participant
        const { data: participant, error } = await supabase
            .from('activity_participants')
            .insert({
                activity_id: id,
                student_id,
                parent_consent: parent_consent || false
            })
            .select(`
                *,
                student:students_master(full_name)
            `)
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).json({
                    status: 'error',
                    message: 'Student is already registered for this activity'
                });
            }
            logger.error('Error adding participant:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to add participant'
            });
        }

        res.status(201).json({
            status: 'success',
            data: participant
        });

    } catch (error) {
        logger.error('Error in add participant:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Update participant consent (for parents)
router.put('/:id/participants/:student_id/consent', authenticate, async (req, res) => {
    try {
        const { id, student_id } = req.params;
        const { consent } = req.body;

        // Check permissions (only parents can update consent)
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'Only parents can update consent'
            });
        }

        // Check if parent has this child
        const { data: mapping, error: mappingError } = await supabase
            .from('parent_student_mappings')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', student_id)
            .single();

        if (mappingError || !mapping) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Update consent
        const { data: participant, error } = await supabase
            .from('activity_participants')
            .update({
                parent_consent: consent,
                consent_given_at: consent ? new Date().toISOString() : null,
                consent_given_by: consent ? req.user.id : null
            })
            .eq('activity_id', id)
            .eq('student_id', student_id)
            .select(`
                *,
                student:students_master(full_name)
            `)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Participant not found'
                });
            }
            logger.error('Error updating consent:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update consent'
            });
        }

        res.json({
            status: 'success',
            data: participant
        });

    } catch (error) {
        logger.error('Error in update consent:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

export default router; 