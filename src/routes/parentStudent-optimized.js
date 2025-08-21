import express from 'express';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// OPTIMIZED: Get parent-student mappings
router.get('/mappings',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            // OPTIMIZATION 1: Single optimized query with all related data
            const { data, error } = await supabase
                .from('parent_student_mappings')
                .select(`
                    id,
                    relationship,
                    is_primary_guardian,
                    student:student_id (
                        id,
                        full_name,
                        admission_number,
                        profile_photo_path,
                        student_academic_records!inner (
                            id,
                            roll_number,
                            status,
                            class_division:class_division_id (
                                id,
                                division,
                                academic_year:academic_year_id (year_name),
                                class_level:class_level_id (name, sequence_number),
                                teacher:teacher_id (id, full_name)
                            )
                        )
                    )
                `)
                .eq('parent_id', req.user.id)
                .eq('student.student_academic_records.status', 'ongoing');

            if (error) throw error;

            // OPTIMIZATION 2: Generate profile photo URLs in batch
            const mappingsWithPhotos = data.map((mapping) => {
                let profile_photo_url = null;
                if (mapping.student.profile_photo_path) {
                    const path = mapping.student.profile_photo_path.replace('profile-pictures/', '');
                    const { data: publicData } = adminSupabase.storage.from('profile-pictures').getPublicUrl(path);
                    profile_photo_url = publicData?.publicUrl || null;
                }
                return {
                    ...mapping,
                    student: { ...mapping.student, profile_photo_url }
                };
            });

            res.json({
                status: 'success',
                data: { mappings: mappingsWithPhotos }
            });
        } catch (error) {
            next(error);
        }
    }
);

// OPTIMIZED: Get specific child details (Parents only)
router.get('/child/:student_id',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            const { student_id } = req.params;

            // OPTIMIZATION 1: Single query to verify access and get student data
            const { data: mapping, error: mappingError } = await supabase
                .from('parent_student_mappings')
                .select(`
                    id,
                    relationship,
                    is_primary_guardian,
                    student:student_id (
                        id,
                        full_name,
                        admission_number,
                        date_of_birth,
                        admission_date,
                        status,
                        profile_photo_path,
                        student_academic_records!inner (
                            id,
                            roll_number,
                            status,
                            class_division:class_division_id (
                                id,
                                division,
                                academic_year:academic_year_id (year_name),
                                class_level:class_level_id (name, sequence_number),
                                teacher:teacher_id (id, full_name)
                            )
                        )
                    )
                `)
                .eq('parent_id', req.user.id)
                .eq('student_id', student_id)
                .eq('student.student_academic_records.status', 'ongoing')
                .single();

            if (mappingError || !mapping) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You do not have permission to view this child'
                });
            }

            // OPTIMIZATION 2: Generate profile photo URL efficiently
            let profile_photo_url = null;
            if (mapping.student.profile_photo_path) {
                const path = mapping.student.profile_photo_path.replace('profile-pictures/', '');
                const { data: publicData } = adminSupabase.storage.from('profile-pictures').getPublicUrl(path);
                profile_photo_url = publicData?.publicUrl || null;
            }

            res.json({
                status: 'success',
                data: {
                    student: { ...mapping.student, profile_photo_url },
                    relationship: mapping.relationship,
                    is_primary_guardian: mapping.is_primary_guardian
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// OPTIMIZED: Get all parents (Admin/Principal only)
router.get('/parents',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const {
                page = 1,
                limit = 20,
                class_id,
                class_division_id,
                student_id,
                search
            } = req.query;

            const offset = (page - 1) * limit;

            // OPTIMIZATION 1: Build efficient query with database-level pagination
            let query = supabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    phone_number,
                    email,
                    role,
                    created_at,
                    is_registered
                `, { count: 'exact' })
                .eq('role', 'parent')
                .order('full_name', { ascending: true });

            // Apply search filter
            if (search) {
                query = query.or(`full_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
            }

            // OPTIMIZATION 2: Apply filters efficiently
            let filteredParentIds = null;

            if (class_id || class_division_id || student_id) {
                let filterQuery = adminSupabase
                    .from('parent_student_mappings')
                    .select(`
                        parent_id,
                        student:student_id (
                            student_academic_records!inner (
                                class_division:class_division_id (
                                    id,
                                    level:class_level_id (id)
                                )
                            )
                        )
                    `);

                // Apply filters
                if (student_id) {
                    filterQuery = filterQuery.eq('student_id', student_id);
                }
                if (class_division_id) {
                    filterQuery = filterQuery.eq('student.student_academic_records.class_division_id', class_division_id);
                }
                if (class_id) {
                    filterQuery = filterQuery.eq('student.student_academic_records.class_division.level.id', class_id);
                }

                const { data: filteredMappings, error: filterError } = await filterQuery;

                if (filterError) {
                    logger.error('Error applying filters:', filterError);
                    return res.status(500).json({
                        status: 'error',
                        message: 'Failed to apply filters',
                        details: filterError.message
                    });
                }

                filteredParentIds = [...new Set(filteredMappings.map(m => m.parent_id))];

                if (filteredParentIds.length === 0) {
                    return res.json({
                        status: 'success',
                        data: {
                            parents: [],
                            filters: {
                                class_id: class_id || null,
                                class_division_id: class_division_id || null,
                                student_id: student_id || null,
                                search: search || null
                            },
                            summary: {
                                total_parents: 0,
                                total_children: 0,
                                total_primary_guardians: 0,
                                total_secondary_guardians: 0,
                                parents_with_children: 0,
                                parents_without_children: 0,
                                average_children_per_parent: 0
                            },
                            pagination: {
                                page: parseInt(page),
                                limit: parseInt(limit),
                                total: 0,
                                total_pages: 0
                            }
                        }
                    });
                }

                query = query.in('id', filteredParentIds);
            }

            // Get total count
            const { count, error: countError } = await query.count();
            if (countError) {
                logger.error('Error getting parents count:', countError);
            }

            // Get paginated results
            const { data: parents, error } = await query
                .range(offset, offset + limit - 1);

            if (error) {
                logger.error('Error fetching parents:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to fetch parents',
                    details: error.message
                });
            }

            // OPTIMIZATION 3: Batch fetch parent-student mappings
            const parentIds = parents.map(p => p.id);
            const { data: mappings, error: mappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    parent_id,
                    relationship,
                    is_primary_guardian,
                    student:student_id(
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .in('parent_id', parentIds);

            if (mappingsError) {
                logger.error('Error fetching parent mappings:', mappingsError);
            }

            // OPTIMIZATION 4: Process data efficiently in memory
            const mappingsByParent = {};
            if (mappings) {
                mappings.forEach(mapping => {
                    if (!mappingsByParent[mapping.parent_id]) {
                        mappingsByParent[mapping.parent_id] = [];
                    }
                    mappingsByParent[mapping.parent_id].push({
                        id: mapping.student.id,
                        full_name: mapping.student.full_name,
                        admission_number: mapping.student.admission_number,
                        relationship: mapping.relationship,
                        is_primary_guardian: mapping.is_primary_guardian
                    });
                });
            }

            // Format response
            const formattedParents = parents.map(parent => {
                const parentChildren = mappingsByParent[parent.id] || [];
                return {
                    id: parent.id,
                    full_name: parent.full_name,
                    phone_number: parent.phone_number,
                    email: parent.email,
                    role: parent.role,
                    is_registered: parent.is_registered,
                    created_at: parent.created_at,
                    children: parentChildren,
                    children_count: parentChildren.length,
                    primary_guardian_count: parentChildren.filter(child => child.is_primary_guardian).length,
                    secondary_guardian_count: parentChildren.filter(child => !child.is_primary_guardian).length
                };
            });

            // Calculate summary statistics
            const totalChildren = formattedParents.reduce((sum, parent) => sum + parent.children_count, 0);
            const totalPrimaryGuardians = formattedParents.reduce((sum, parent) => sum + parent.primary_guardian_count, 0);
            const totalSecondaryGuardians = formattedParents.reduce((sum, parent) => sum + parent.secondary_guardian_count, 0);
            const parentsWithChildren = formattedParents.filter(parent => parent.children_count > 0).length;
            const parentsWithoutChildren = formattedParents.filter(parent => parent.children_count === 0).length;

            res.json({
                status: 'success',
                data: {
                    parents: formattedParents,
                    filters: {
                        class_id: class_id || null,
                        class_division_id: class_division_id || null,
                        student_id: student_id || null,
                        search: search || null
                    },
                    summary: {
                        total_parents: formattedParents.length,
                        total_children: totalChildren,
                        total_primary_guardians: totalPrimaryGuardians,
                        total_secondary_guardians: totalSecondaryGuardians,
                        parents_with_children: parentsWithChildren,
                        parents_without_children: parentsWithoutChildren,
                        average_children_per_parent: formattedParents.length > 0 ? (totalChildren / formattedParents.length).toFixed(2) : 0
                    },
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: count || 0,
                        total_pages: Math.ceil((count || 0) / limit)
                    }
                }
            });

        } catch (error) {
            logger.error('Unexpected error in parents endpoint:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error',
                details: error.message
            });
        }
    }
);

// OPTIMIZED: Get specific parent details (Admin/Principal only)
router.get('/parents/:parent_id',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { parent_id } = req.params;

            // OPTIMIZATION: Single optimized query with all related data
            const { data: parent, error } = await adminSupabase
                .from('users')
                .select(`
                    id,
                    full_name,
                    phone_number,
                    email,
                    role,
                    created_at,
                    parent_student_mappings(
                        id,
                        relationship,
                        is_primary_guardian,
                        student:student_id(
                            id,
                            full_name,
                            admission_number,
                            date_of_birth,
                            gender
                        )
                    )
                `)
                .eq('id', parent_id)
                .eq('role', 'parent')
                .single();

            if (error || !parent) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Parent not found'
                });
            }

            // Format the response
            const formattedParent = {
                id: parent.id,
                full_name: parent.full_name,
                phone_number: parent.phone_number,
                email: parent.email,
                role: parent.role,
                created_at: parent.created_at,
                children: parent.parent_student_mappings.map(mapping => ({
                    id: mapping.student.id,
                    full_name: mapping.student.full_name,
                    admission_number: mapping.student.admission_number,
                    date_of_birth: mapping.student.date_of_birth,
                    gender: mapping.student.gender,
                    relationship: mapping.relationship,
                    is_primary_guardian: mapping.is_primary_guardian
                }))
            };

            res.json({
                status: 'success',
                data: { parent: formattedParent }
            });

        } catch (error) {
            logger.error('Error in get parent details:', error);
            res.status(500).json({
                status: 'error',
                message: 'Internal server error'
            });
        }
    }
);

export default router;
