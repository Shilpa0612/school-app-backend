import express from 'express';
import { body, validationResult } from 'express-validator';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Send message
router.post('/',
    authenticate,
    [
        body('content').notEmpty().trim(),
        body('type').isIn(['individual', 'group', 'announcement']),
        body('class_division_id').optional().isUUID(),
        body('recipient_id').optional().isUUID()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { content, type, class_division_id, recipient_id } = req.body;

            // Check if user has permission to send this type of message
            if (type === 'announcement' && !['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Unauthorized to send announcements'
                });
            }

            const messageData = {
                sender_id: req.user.id,
                content,
                type,
                status: ['admin', 'principal'].includes(req.user.role) ? 'approved' : 'pending'
            };

            if (class_division_id) messageData.class_division_id = class_division_id;
            if (recipient_id) messageData.recipient_id = recipient_id;

            const { data, error } = await supabase
                .from('messages')
                .insert([messageData])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                status: 'success',
                data: { message: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get messages
router.get('/',
    authenticate,
    async (req, res, next) => {
        try {
            let query = supabase
                .from('messages')
                .select(`
                    *,
                    sender:sender_id (id, full_name, role),
                    recipient:recipient_id (id, full_name, role)
                `);

            // Filter based on user role and query params
            if (req.user.role === 'teacher') {
                // Teachers can see messages for their classes and messages sent to them
                const teacherConditions = [];

                // Add class_division_id filter if provided
                if (req.query.class_division_id) {
                    teacherConditions.push(`class_division_id.eq.${req.query.class_division_id}`);
                }

                // Always allow teachers to see messages sent to them
                teacherConditions.push(`recipient_id.eq.${req.user.id}`);

                // Allow teachers to see messages they sent
                teacherConditions.push(`sender_id.eq.${req.user.id}`);

                if (teacherConditions.length > 0) {
                    query = query.or(teacherConditions.join(','));
                }
            } else if (req.user.role === 'parent') {
                // Parents can see:
                // 1. Messages sent to them directly
                // 2. Common messages (no class_division_id) - shown to all
                // 3. Class-specific messages (with class_division_id) - shown to students in that class
                // 4. Individual messages - shown to specific recipient
                const parentConditions = [];

                // Direct messages sent to this parent
                parentConditions.push(`recipient_id.eq.${req.user.id}`);

                // Common messages (no class_division_id) - shown to everyone
                parentConditions.push(`and(status.eq.approved,class_division_id.is.null)`);

                if (parentConditions.length > 0) {
                    query = query.or(parentConditions.join(','));
                }
            } else if (req.user.role === 'admin' || req.user.role === 'principal') {
                // Admin and Principal can see all messages
                // No additional filtering needed
            }

            if (req.query.status) {
                query = query.eq('status', req.query.status);
            }

            let { data, error } = await query
                .order('created_at', { ascending: false });

            if (error) throw error;

            // For parents, also fetch messages for their children's classes
            if (req.user.role === 'parent') {
                // Check if filtering by specific child
                const childId = req.query.child_id;
                const studentId = req.query.student_id;

                if (childId || studentId) {
                    const targetStudentId = childId || studentId;

                    // First get the parent-student mapping
                    const { data: parentMapping, error: mappingError } = await adminSupabase
                        .from('parent_student_mappings')
                        .select('student_id')
                        .eq('parent_id', req.user.id)
                        .eq('student_id', targetStudentId)
                        .single();

                    console.log('Parent mapping query result:', { parentMapping, mappingError });

                    if (mappingError || !parentMapping) {
                        console.log('Parent-student mapping not found:', mappingError);
                        data = [];
                    } else {
                        // Then get the student's academic record
                        console.log('Looking for academic record for student:', parentMapping.student_id);

                        const { data: childClass, error: childClassError } = await adminSupabase
                            .from('student_academic_records')
                            .select(`
                                class_division_id,
                                status,
                                roll_number,
                                student:student_id (
                                    id,
                                    full_name
                                )
                            `)
                            .eq('student_id', parentMapping.student_id)
                            .single();

                        console.log('Academic record query result:', { childClass, childClassError });

                        if (!childClassError && childClass) {
                            console.log('Found child class:', childClass);

                            // Get class-specific messages for this child
                            const { data: childMessages, error: childMessagesError } = await supabase
                                .from('messages')
                                .select(`
                                    *,
                                    sender:sender_id (id, full_name, role),
                                    recipient:recipient_id (id, full_name, role)
                                `)
                                .eq('class_division_id', childClass.class_division_id)
                                .eq('status', 'approved')
                                .order('created_at', { ascending: false });

                            // Get common messages (no class_division_id)
                            const { data: commonMessages, error: commonError } = await supabase
                                .from('messages')
                                .select(`
                                    *,
                                    sender:sender_id (id, full_name, role),
                                    recipient:recipient_id (id, full_name, role)
                                `)
                                .eq('status', 'approved')
                                .is('class_division_id', null)
                                .order('created_at', { ascending: false });

                            // Combine messages
                            const allChildMessages = [...(childMessages || []), ...(commonMessages || [])];
                            console.log('All child messages:', allChildMessages);

                            // Get class information for class-specific messages
                            const classSpecificMessages = allChildMessages.filter(msg => msg.class_division_id);
                            const classIds = [...new Set(classSpecificMessages.map(msg => msg.class_division_id))];

                            let classInfo = [];
                            if (classIds.length > 0) {
                                const { data: classData, error: classError } = await supabase
                                    .from('class_divisions')
                                    .select(`
                                        id,
                                        division,
                                        academic_year:academic_year_id (year_name),
                                        class_level:class_level_id (name, sequence_number)
                                    `)
                                    .in('id', classIds);
                                classInfo = classData || [];
                            }

                            // Process messages
                            const messagesWithChildInfo = allChildMessages.map(message => {
                                if (message.class_division_id) {
                                    // Class-specific message
                                    const classData = classInfo.find(c => c.id === message.class_division_id);
                                    return {
                                        ...message,
                                        class: classData || null,
                                        children_affected: [{
                                            student_id: childClass.student.id,
                                            student_name: childClass.student.full_name,
                                            roll_number: childClass.roll_number
                                        }],
                                        class_students_count: 1
                                    };
                                } else {
                                    // Common message
                                    return {
                                        ...message,
                                        class: null,
                                        children_affected: [{
                                            student_id: childClass.student.id,
                                            student_name: childClass.student.full_name,
                                            roll_number: childClass.roll_number
                                        }],
                                        class_students_count: 1
                                    };
                                }
                            });

                            const uniqueMessages = messagesWithChildInfo.filter((message, index, self) =>
                                index === self.findIndex(m => m.id === message.id)
                            );
                            data = uniqueMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                        } else {
                            console.log('Child class not found. Error:', childClassError);
                            data = [];
                        }
                    }
                } else {
                    console.log('No specific student filter, fetching all children messages');

                    // First get all parent-student mappings
                    const { data: parentMappings, error: mappingsError } = await adminSupabase
                        .from('parent_student_mappings')
                        .select('student_id')
                        .eq('parent_id', req.user.id);

                    console.log('Parent mappings query result:', { parentMappings, mappingsError });

                    if (mappingsError || !parentMappings || parentMappings.length === 0) {
                        console.log('No parent-student mappings found:', mappingsError);
                        data = [];
                    } else {
                        // Then get academic records for all children
                        const studentIds = parentMappings.map(mapping => mapping.student_id);
                        console.log('Looking for academic records for students:', studentIds);

                        const { data: childrenClasses, error: childrenError } = await adminSupabase
                            .from('student_academic_records')
                            .select(`
                                class_division_id,
                                status,
                                roll_number,
                                student:student_id (
                                    id,
                                    full_name
                                )
                            `)
                            .in('student_id', studentIds);

                        console.log('Children classes query result:', { childrenClasses, childrenError });

                        if (!childrenError && childrenClasses) {
                            console.log('Found children classes:', childrenClasses);
                            const classDivisionIds = childrenClasses
                                .map(item => item.class_division_id)
                                .filter(id => id);

                            // Get common messages (no class_division_id)
                            const { data: commonMessages, error: commonError } = await supabase
                                .from('messages')
                                .select(`
                                    *,
                                    sender:sender_id (id, full_name, role),
                                    recipient:recipient_id (id, full_name, role)
                                `)
                                .eq('status', 'approved')
                                .is('class_division_id', null)
                                .order('created_at', { ascending: false });

                            // Get class-specific messages
                            const { data: classMessages, error: classMessagesError } = await supabase
                                .from('messages')
                                .select(`
                                    *,
                                    sender:sender_id (id, full_name, role),
                                    recipient:recipient_id (id, full_name, role)
                                `)
                                .eq('status', 'approved')
                                .in('class_division_id', classDivisionIds)
                                .order('created_at', { ascending: false });

                            // Combine messages
                            const additionalMessages = [...(commonMessages || []), ...(classMessages || [])];
                            const additionalMessagesError = commonError || classMessagesError;

                            if (!additionalMessagesError && additionalMessages) {
                                console.log('Found additional messages:', additionalMessages);

                                // Get class information for class-specific messages
                                const classSpecificMessages = additionalMessages.filter(msg => msg.class_division_id);
                                const classIds = [...new Set(classSpecificMessages.map(msg => msg.class_division_id))];

                                let classInfo = [];
                                if (classIds.length > 0) {
                                    const { data: classData, error: classError } = await supabase
                                        .from('class_divisions')
                                        .select(`
                                            id,
                                            division,
                                            academic_year:academic_year_id (year_name),
                                            class_level:class_level_id (name, sequence_number)
                                        `)
                                        .in('id', classIds);
                                    classInfo = classData || [];
                                }

                                // Process messages
                                const processedMessages = additionalMessages.map(message => {
                                    if (message.class_division_id) {
                                        // Class-specific message
                                        const childrenInClass = childrenClasses.filter(item =>
                                            item.class_division_id === message.class_division_id
                                        );

                                        const classData = classInfo.find(c => c.id === message.class_division_id);

                                        return {
                                            ...message,
                                            class: classData || null,
                                            children_affected: childrenInClass.map(item => ({
                                                student_id: item.student.id,
                                                student_name: item.student.full_name,
                                                roll_number: item.roll_number
                                            })),
                                            class_students_count: childrenInClass.length
                                        };
                                    } else {
                                        // Common message - affects all children
                                        return {
                                            ...message,
                                            class: null,
                                            children_affected: childrenClasses.map(item => ({
                                                student_id: item.student.id,
                                                student_name: item.student.full_name,
                                                roll_number: item.roll_number
                                            })),
                                            class_students_count: childrenClasses.length
                                        };
                                    }
                                });

                                // Merge and deduplicate messages
                                const allMessages = [...data, ...processedMessages];
                                const uniqueMessages = allMessages.filter((message, index, self) =>
                                    index === self.findIndex(m => m.id === message.id)
                                );
                                data = uniqueMessages.sort((a, b) =>
                                    new Date(b.created_at) - new Date(a.created_at)
                                );
                            }
                        } else {
                            console.log('No children found or error:', childrenError);
                            console.log('Parent ID:', req.user.id);
                        }
                    }
                }
            }

            res.json({
                status: 'success',
                data: { messages: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Approve message
router.put('/:id/approve',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Check if user has permission to approve
            if (!['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only admin and principal can approve messages'
                });
            }

            // Get the message first to check if it exists
            const { data: message, error: fetchError } = await supabase
                .from('messages')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !message) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Message not found'
                });
            }

            // Update the message status
            const { data, error } = await supabase
                .from('messages')
                .update({
                    status: 'approved',
                    approved_by: req.user.id
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating message:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to approve message'
                });
            }

            res.json({
                status: 'success',
                data: { message: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Reject message
router.put('/:id/reject',
    authenticate,
    async (req, res, next) => {
        try {
            const { id } = req.params;

            // Check if user has permission to reject
            if (!['admin', 'principal'].includes(req.user.role)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Only admin and principal can reject messages'
                });
            }

            // Get the message first to check if it exists
            const { data: message, error: fetchError } = await supabase
                .from('messages')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !message) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Message not found'
                });
            }

            // Update the message status
            const { data, error } = await supabase
                .from('messages')
                .update({
                    status: 'rejected',
                    approved_by: req.user.id
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error updating message:', error);
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to reject message'
                });
            }

            res.json({
                status: 'success',
                data: { message: data }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Debug endpoint to check user role
router.get('/debug/user', authenticate, (req, res) => {
    res.json({
        status: 'success',
        data: {
            user_id: req.user.id,
            role: req.user.role,
            full_name: req.user.full_name
        }
    });
});

// Simple test endpoint to check parent-student mapping
router.get('/debug/test-mapping', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'Only parents can access this endpoint'
            });
        }

        // Check if parent-student mapping exists
        const { data: mapping, error } = await supabase
            .from('parent_student_mappings')
            .select('*')
            .eq('parent_id', req.user.id)
            .limit(1);

        res.json({
            status: 'success',
            data: {
                parent_id: req.user.id,
                mapping_exists: mapping && mapping.length > 0,
                mapping: mapping,
                error: error
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Endpoint to check database state
router.get('/debug/db-state', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'Only parents can access this endpoint'
            });
        }

        // Check academic years
        const { data: academicYears, error: yearsError } = await adminSupabase
            .from('academic_years')
            .select('*');

        // Check class divisions
        const { data: classDivisions, error: divisionsError } = await adminSupabase
            .from('class_divisions')
            .select('*');

        // Check students
        const { data: students, error: studentsError } = await adminSupabase
            .from('students_master')
            .select('*');

        // Check academic records
        const { data: academicRecords, error: recordsError } = await adminSupabase
            .from('student_academic_records')
            .select('*');

        res.json({
            status: 'success',
            data: {
                academic_years: academicYears || [],
                class_divisions: classDivisions || [],
                students: students || [],
                academic_records: academicRecords || [],
                errors: {
                    years: yearsError,
                    divisions: divisionsError,
                    students: studentsError,
                    records: recordsError
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Endpoint to fix academic records (add missing academic_year_id)
router.post('/debug/fix-academic-records', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'Only parents can access this endpoint'
            });
        }

        // Get the active academic year
        const { data: activeYear, error: yearError } = await adminSupabase
            .from('academic_years')
            .select('id')
            .eq('is_active', true)
            .single();

        if (yearError || !activeYear) {
            return res.status(500).json({
                status: 'error',
                message: 'No active academic year found',
                error: yearError
            });
        }

        // Update all academic records that have null academic_year_id
        const { data: updatedRecords, error: updateError } = await adminSupabase
            .from('student_academic_records')
            .update({ academic_year_id: activeYear.id })
            .is('academic_year_id', null)
            .select();

        if (updateError) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update academic records',
                error: updateError
            });
        }

        res.json({
            status: 'success',
            data: {
                message: 'Academic records updated successfully',
                active_year_id: activeYear.id,
                updated_records: updatedRecords
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Endpoint to create missing student and academic record
router.post('/debug/create-student', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'Only parents can access this endpoint'
            });
        }

        const studentId = 'd2e4585e-830c-40ba-b29c-cc62ff146607';
        const classDivisionId = '4ded8472-fe26-4cf3-ad25-23f601960a0b';

        // First, check if student already exists
        const { data: existingStudent, error: studentCheckError } = await adminSupabase
            .from('students_master')
            .select('*')
            .eq('id', studentId)
            .single();

        if (existingStudent) {
            return res.status(400).json({
                status: 'error',
                message: 'Student already exists',
                data: { student: existingStudent }
            });
        }

        // Create the student
        const { data: student, error: studentError } = await adminSupabase
            .from('students_master')
            .insert([{
                id: studentId,
                admission_number: '2025001',
                full_name: 'Student 1',
                date_of_birth: '2018-05-15',
                admission_date: '2025-06-01',
                status: 'active'
            }])
            .select()
            .single();

        if (studentError) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create student',
                error: studentError
            });
        }

        // Get the active academic year
        const { data: activeYear, error: yearError } = await adminSupabase
            .from('academic_years')
            .select('id')
            .eq('is_active', true)
            .single();

        if (yearError || !activeYear) {
            return res.status(500).json({
                status: 'error',
                message: 'No active academic year found',
                error: yearError
            });
        }

        // Create the academic record
        const { data: academicRecord, error: academicError } = await adminSupabase
            .from('student_academic_records')
            .insert([{
                student_id: studentId,
                academic_year_id: activeYear.id,
                class_division_id: classDivisionId,
                roll_number: '01',
                status: 'ongoing'
            }])
            .select()
            .single();

        if (academicError) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create academic record',
                error: academicError
            });
        }

        res.json({
            status: 'success',
            data: {
                message: 'Student and academic record created successfully',
                student: student,
                academic_record: academicRecord
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Debug endpoint to check parent-student mapping
router.get('/debug/parent-students', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'Only parents can access this endpoint'
            });
        }

        // First, let's check all parent-student mappings
        const { data: allMappings, error: allError } = await adminSupabase
            .from('parent_student_mappings')
            .select(`
                *,
                student:student_id (
                    id,
                    full_name
                )
            `)
            .eq('parent_id', req.user.id);

        // Then check academic records
        const { data: academicRecords, error: academicError } = await supabase
            .from('student_academic_records')
            .select(`
                *,
                student:student_id (
                    id,
                    full_name
                ),
                class_division:class_division_id (
                    id,
                    division,
                    academic_year:academic_year_id (year_name),
                    class_level:class_level_id (name, sequence_number)
                )
            `);

        // Check messages
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('status', 'approved');

        // Test the specific student query
        const targetStudentId = 'd2e4585e-830c-40ba-b29c-cc62ff146607';
        const { data: parentMapping, error: mappingError } = await adminSupabase
            .from('parent_student_mappings')
            .select('student_id')
            .eq('parent_id', req.user.id)
            .eq('student_id', targetStudentId)
            .single();

        let childClass = null;
        let childClassError = null;
        if (!mappingError && parentMapping) {
            const { data: academicRecord, error: academicRecordError } = await supabase
                .from('student_academic_records')
                .select(`
                    class_division_id,
                    status,
                    roll_number,
                    student:student_id (
                        id,
                        full_name
                    )
                `)
                .eq('student_id', parentMapping.student_id)
                .single();

            childClass = academicRecord;
            childClassError = academicRecordError;
        }

        // Check if student exists in students_master
        const { data: student, error: studentError } = await supabase
            .from('students_master')
            .select('*')
            .eq('id', targetStudentId)
            .single();

        // Check all academic records for this student
        const { data: allStudentRecords, error: allStudentRecordsError } = await supabase
            .from('student_academic_records')
            .select('*')
            .eq('student_id', targetStudentId);

        // Check what students actually exist
        const { data: allStudents, error: allStudentsError } = await supabase
            .from('students_master')
            .select('*')
            .limit(5);

        // Check what academic records exist
        const { data: allAcademicRecords, error: allAcademicRecordsError } = await supabase
            .from('student_academic_records')
            .select('*')
            .limit(5);

        res.json({
            status: 'success',
            data: {
                parent_id: req.user.id,
                all_mappings: allMappings || [],
                academic_records: academicRecords || [],
                messages: messages || [],
                test_student: {
                    target_student_id: targetStudentId,
                    parent_mapping: parentMapping,
                    mapping_error: mappingError,
                    child_class: childClass,
                    child_class_error: childClassError,
                    student_exists: student,
                    student_error: studentError,
                    all_student_records: allStudentRecords || [],
                    all_student_records_error: allStudentRecordsError,
                    all_students: allStudents || [],
                    all_students_error: allStudentsError,
                    all_academic_records: allAcademicRecords || [],
                    all_academic_records_error: allAcademicRecordsError
                },
                errors: {
                    all_mappings: allError,
                    academic_records: academicError,
                    messages: messagesError
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
});

export default router; 