import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ============================================================================
// PARENT STATISTICS
// ============================================================================

// Get comprehensive statistics for parent dashboard
router.get('/parent', authenticate, async (req, res, next) => {
    try {
        // Verify user is a parent
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'This endpoint is only for parents'
            });
        }

        const { date_from, date_to } = req.query;

        // Set default date range to current month if not provided
        let startDate = date_from;
        let endDate = date_to;

        if (!startDate || !endDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        // Get all children for this parent
        const { data: parentMappings, error: mappingsError } = await supabase
            .from('parent_student_mappings')
            .select(`
                student_id,
                students:students_master (
                    id,
                    full_name,
                    admission_number,
                    date_of_birth
                )
            `)
            .eq('parent_id', req.user.id);

        if (mappingsError) throw mappingsError;

        const children = parentMappings || [];
        const studentIds = children.map(mapping => mapping.student_id);

        if (studentIds.length === 0) {
            return res.json({
                status: 'success',
                data: {
                    children_count: 0,
                    date_range: { start_date: startDate, end_date: endDate },
                    attendance: {},
                    homework: {},
                    communication: {},
                    upcoming: {}
                }
            });
        }

        // Get children's class information
        const { data: childrenClasses, error: classesError } = await supabase
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

        if (classesError) throw classesError;

        // Get attendance statistics for each child
        const attendanceStats = {};
        for (const child of children) {
            const studentClass = childrenClasses?.find(c => c.student_id === child.student_id);
            if (!studentClass) continue;

            const { data: attendanceData, error: attendanceError } = await supabase
                .rpc('get_simplified_attendance_summary', {
                    p_student_id: child.student_id,
                    p_academic_year_id: studentClass.class_divisions.academic_year.id,
                    p_start_date: startDate,
                    p_end_date: endDate
                });

            if (!attendanceError && attendanceData && attendanceData.length > 0) {
                const stats = attendanceData[0];
                attendanceStats[child.student_id] = {
                    student_name: child.students.full_name,
                    class_name: `${studentClass.class_divisions.class_level.name} ${studentClass.class_divisions.division}`,
                    total_days: stats.total_days || 0,
                    present_days: stats.present_days || 0,
                    absent_days: stats.absent_days || 0,
                    attendance_percentage: stats.attendance_percentage || 0
                };
            }
        }

        // Get homework statistics for each child
        const homeworkStats = {};
        for (const child of children) {
            const studentClass = childrenClasses?.find(c => c.student_id === child.student_id);
            if (!studentClass) continue;

            // Get homework assigned to child's class
            const { data: homeworkData, error: homeworkError } = await supabase
                .from('homework')
                .select(`
                    id,
                    title,
                    subject,
                    due_date,
                    student_homework!inner (
                        id,
                        submitted_at,
                        grade
                    )
                `)
                .eq('class_division_id', studentClass.class_division_id)
                .gte('due_date', startDate)
                .lte('due_date', endDate);

            if (!homeworkError && homeworkData) {
                const totalHomework = homeworkData.length;
                const completedHomework = homeworkData.filter(hw =>
                    hw.student_homework.some(sh => sh.submitted_at)
                ).length;
                const overdueHomework = homeworkData.filter(hw =>
                    new Date(hw.due_date) < new Date() &&
                    !hw.student_homework.some(sh => sh.submitted_at)
                ).length;

                homeworkStats[child.student_id] = {
                    student_name: child.students.full_name,
                    total_assigned: totalHomework,
                    completed: completedHomework,
                    pending: totalHomework - completedHomework,
                    overdue: overdueHomework,
                    completion_rate: totalHomework > 0 ? Math.round((completedHomework / totalHomework) * 100) : 0
                };
            }
        }

        // Get communication statistics
        const { data: messageStats, error: messageError } = await supabase
            .from('messages')
            .select('id, sender_id, recipient_id, created_at, read_at')
            .or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`)
            .gte('created_at', `${startDate}T00:00:00Z`)
            .lte('created_at', `${endDate}T23:59:59Z`);

        const communicationStats = {
            total_messages: messageStats?.length || 0,
            sent_messages: messageStats?.filter(m => m.sender_id === req.user.id).length || 0,
            received_messages: messageStats?.filter(m => m.recipient_id === req.user.id).length || 0,
            unread_messages: messageStats?.filter(m =>
                m.recipient_id === req.user.id && !m.read_at
            ).length || 0
        };

        // Get upcoming events and homework
        const { data: upcomingEvents, error: eventsError } = await supabase
            .from('calendar_events')
            .select('id, title, event_date, event_type, class_division_id')
            .gte('event_date', new Date().toISOString())
            .lte('event_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
            .or(`event_type.eq.school_wide,class_division_id.in.(${childrenClasses?.map(c => c.class_division_id).join(',')})`);

        const upcoming = {
            events: upcomingEvents?.length || 0,
            homework_due_soon: Object.values(homeworkStats).reduce((sum, stats) =>
                sum + stats.overdue, 0
            )
        };

        res.json({
            status: 'success',
            data: {
                children_count: children.length,
                date_range: { start_date: startDate, end_date: endDate },
                attendance: attendanceStats,
                homework: homeworkStats,
                communication: communicationStats,
                upcoming: upcoming,
                summary: {
                    total_children: children.length,
                    average_attendance: Object.values(attendanceStats).length > 0 ?
                        Math.round(Object.values(attendanceStats).reduce((sum, stats) =>
                            sum + stats.attendance_percentage, 0
                        ) / Object.values(attendanceStats).length) : 0,
                    total_homework: Object.values(homeworkStats).reduce((sum, stats) =>
                        sum + stats.total_assigned, 0
                    ),
                    completed_homework: Object.values(homeworkStats).reduce((sum, stats) =>
                        sum + stats.completed, 0
                    )
                }
            }
        });

    } catch (error) {
        logger.error('Error getting parent statistics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get parent statistics'
        });
    }
});

// ============================================================================
// TEACHER STATISTICS
// ============================================================================

// Get comprehensive statistics for teacher dashboard
router.get('/teacher', authenticate, async (req, res, next) => {
    try {
        // Verify user is a teacher
        if (req.user.role !== 'teacher') {
            return res.status(403).json({
                status: 'error',
                message: 'This endpoint is only for teachers'
            });
        }

        const { date_from, date_to } = req.query;

        // Set default date range to current month if not provided
        let startDate = date_from;
        let endDate = date_to;

        if (!startDate || !endDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        // Get teacher's assigned classes - using the working approach from academic endpoint
        let assignedClasses = [];
        let classDivisionIds = [];

        try {
            // First try to get assignments using the working academic endpoint approach
            const { data: academicAssignments, error: academicError } = await supabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    class_division_id,
                    assignment_type,
                    subject,
                    is_primary,
                    assigned_date,
                    class_divisions (
                        id,
                        division,
                        academic_year:academic_year_id (year_name),
                        class_level:class_level_id (name)
                    )
                `)
                .eq('teacher_id', req.user.id)
                .eq('is_active', true);

            if (!academicError && academicAssignments && academicAssignments.length > 0) {
                assignedClasses = academicAssignments;
                classDivisionIds = assignedClasses.map(assignment => assignment.class_division_id);
                logger.info(`Found ${assignedClasses.length} assignments using academic approach`);
            } else {
                logger.info(`No assignments found using academic approach, error:`, academicError);

                // Test with adminSupabase to see if it's a permission issue
                const { data: adminAssignments, error: adminError } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('*')
                    .eq('teacher_id', req.user.id);

                logger.info(`Admin query result:`, adminAssignments);
                logger.info(`Admin query error:`, adminError);

                // Fallback: Try to get assignments from the working endpoint data structure
                // This mimics what the working academic endpoint does
                const { data: fallbackAssignments, error: fallbackError } = await supabase
                    .from('class_teacher_assignments')
                    .select('*')
                    .eq('teacher_id', req.user.id);

                if (!fallbackError && fallbackAssignments && fallbackAssignments.length > 0) {
                    logger.info(`Found ${fallbackAssignments.length} assignments in fallback query`);

                    // Convert to the expected format
                    assignedClasses = fallbackAssignments.map(assignment => ({
                        id: assignment.id,
                        class_division_id: assignment.class_division_id,
                        assignment_type: assignment.assignment_type || 'class_teacher',
                        subject: assignment.subject || 'General',
                        is_primary: assignment.is_primary || false,
                        assigned_date: assignment.assigned_date,
                        class_divisions: null // We'll fetch this separately
                    }));

                    // Fetch class division details for each assignment
                    for (const assignment of assignedClasses) {
                        if (assignment.class_division_id) {
                            const { data: classDivision, error: classError } = await supabase
                                .from('class_divisions')
                                .select(`
                                    id,
                                    division,
                                    academic_year:academic_year_id (year_name),
                                    class_level:class_level_id (name)
                                `)
                                .eq('id', assignment.class_division_id)
                                .single();

                            if (!classError && classDivision) {
                                assignment.class_divisions = classDivision;
                            }
                        }
                    }

                    classDivisionIds = assignedClasses.map(assignment => assignment.class_division_id);
                }
            }
        } catch (error) {
            logger.error('Error in academic approach:', error);
        }

        logger.info(`Final assigned classes count: ${assignedClasses.length}, class IDs: ${classDivisionIds.join(', ')}`);

        if (classDivisionIds.length === 0) {
            return res.json({
                status: 'success',
                data: {
                    assigned_classes: 0,
                    date_range: { start_date: startDate, end_date: endDate },
                    attendance: {},
                    homework: {},
                    communication: {},
                    students: {},
                    note: "No class assignments found. Please contact administrator to assign classes.",
                    debug_info: {
                        teacher_id: req.user.id,
                        checked_tables: ['class_teacher_assignments'],
                        new_table_count: assignedClasses.length,
                        suggestion: "Try using /api/academic/my-teacher-id to verify assignments exist"
                    }
                }
            });
        }

        // Get attendance statistics for each class
        const attendanceStats = {};
        let totalStudents = 0;
        let totalPresent = 0;
        let totalAbsent = 0;

        for (const assignment of assignedClasses) {
            const { data: dailyAttendance, error: attendanceError } = await supabase
                .from('daily_attendance')
                .select(`
                    id,
                    attendance_date,
                    is_holiday,
                    student_attendance_records (
                        id,
                        status
                    )
                `)
                .eq('class_division_id', assignment.class_division_id)
                .gte('attendance_date', startDate)
                .lte('attendance_date', endDate);

            if (!attendanceError && dailyAttendance) {
                const workingDays = dailyAttendance.filter(da => !da.is_holiday);
                let classTotalStudents = 0;
                let classTotalPresent = 0;
                let classTotalAbsent = 0;

                for (const day of workingDays) {
                    if (day.student_attendance_records) {
                        const dayTotal = day.student_attendance_records.length;
                        const dayPresent = day.student_attendance_records.filter(r => r.status === 'present').length;
                        const dayAbsent = day.student_attendance_records.filter(r => r.status === 'absent').length;

                        classTotalStudents = Math.max(classTotalStudents, dayTotal);
                        classTotalPresent += dayPresent;
                        classTotalAbsent += dayAbsent;
                    }
                }

                const className = `${assignment.class_divisions.class_level.name} ${assignment.class_divisions.division}`;
                const totalDays = workingDays.length;
                const avgAttendance = totalDays > 0 ? Math.round((classTotalPresent / (classTotalPresent + classTotalAbsent)) * 100) : 0;

                attendanceStats[assignment.class_division_id] = {
                    class_name: className,
                    subject: assignment.subject,
                    total_days: totalDays,
                    total_students: classTotalStudents,
                    present_count: classTotalPresent,
                    absent_count: classTotalAbsent,
                    attendance_percentage: avgAttendance
                };

                totalStudents += classTotalStudents;
                totalPresent += classTotalPresent;
                totalAbsent += classTotalAbsent;
            }
        }

        // Get homework statistics
        const { data: homeworkData, error: homeworkError } = await supabase
            .from('homework')
            .select(`
                id,
                title,
                subject,
                due_date,
                class_division_id,
                student_homework (
                    id,
                    submitted_at,
                    grade
                )
            `)
            .in('class_division_id', classDivisionIds)
            .gte('due_date', startDate)
            .lte('due_date', endDate);

        const homeworkStats = {
            total_assigned: homeworkData?.length || 0,
            by_subject: {},
            completion_rates: {}
        };

        if (!homeworkError && homeworkData) {
            // Group by subject
            const subjectGroups = {};
            homeworkData.forEach(hw => {
                if (!subjectGroups[hw.subject]) {
                    subjectGroups[hw.subject] = [];
                }
                subjectGroups[hw.subject].push(hw);
            });

            for (const [subject, assignments] of Object.entries(subjectGroups)) {
                const total = assignments.length;
                const completed = assignments.filter(hw =>
                    hw.student_homework.some(sh => sh.submitted_at)
                ).length;
                const overdue = assignments.filter(hw =>
                    new Date(hw.due_date) < new Date() &&
                    !hw.student_homework.some(sh => sh.submitted_at)
                ).length;

                homeworkStats.by_subject[subject] = {
                    total: total,
                    completed: completed,
                    pending: total - completed,
                    overdue: overdue,
                    completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0
                };
            }

            // Overall completion rate
            const totalAssignments = homeworkData.length;
            const totalCompleted = homeworkData.filter(hw =>
                hw.student_homework.some(sh => sh.submitted_at)
            ).length;
            homeworkStats.completion_rates = {
                overall: totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0,
                total: totalAssignments,
                completed: totalCompleted
            };
        }

        // Get communication statistics
        const { data: messageStats, error: messageError } = await supabase
            .from('messages')
            .select('id, sender_id, recipient_id, created_at, read_at')
            .or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`)
            .gte('created_at', `${startDate}T00:00:00Z`)
            .lte('created_at', `${endDate}T23:59:59Z`);

        const communicationStats = {
            total_messages: messageStats?.length || 0,
            sent_messages: messageStats?.filter(m => m.sender_id === req.user.id).length || 0,
            received_messages: messageStats?.filter(m => m.recipient_id === req.user.id).length || 0,
            unread_messages: messageStats?.filter(m =>
                m.recipient_id === req.user.id && !m.read_at
            ).length || 0
        };

        // Get student count and details
        const { data: studentData, error: studentError } = await supabase
            .from('student_academic_records')
            .select(`
                student_id,
                roll_number,
                students:students_master (
                    id,
                    full_name,
                    admission_number
                )
            `)
            .in('class_division_id', classDivisionIds)
            .eq('status', 'ongoing');

        const studentsStats = {
            total_students: studentData?.length || 0,
            by_class: {}
        };

        if (!studentError && studentData) {
            // Group students by class
            for (const assignment of assignedClasses) {
                const classStudents = studentData.filter(s => s.class_division_id === assignment.class_division_id);
                const className = `${assignment.class_divisions.class_level.name} ${assignment.class_divisions.division}`;

                studentsStats.by_class[assignment.class_division_id] = {
                    class_name: className,
                    student_count: classStudents.length,
                    students: classStudents.map(s => ({
                        id: s.student_id,
                        name: s.students.full_name,
                        admission_number: s.students.admission_number,
                        roll_number: s.roll_number
                    }))
                };
            }
        }

        res.json({
            status: 'success',
            data: {
                assigned_classes: assignedClasses.length,
                date_range: { start_date: startDate, end_date: endDate },
                attendance: {
                    classes: attendanceStats,
                    summary: {
                        total_students: totalStudents,
                        total_present: totalPresent,
                        total_absent: totalAbsent,
                        overall_percentage: totalStudents > 0 ?
                            Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0
                    }
                },
                homework: homeworkStats,
                communication: communicationStats,
                students: studentsStats,
                summary: {
                    total_classes: assignedClasses.length,
                    total_students: totalStudents,
                    total_homework: homeworkStats.total_assigned,
                    completed_homework: homeworkStats.completion_rates.completed || 0,
                    messages_sent: communicationStats.sent_messages
                }
            }
        });

    } catch (error) {
        logger.error('Error getting teacher statistics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get teacher statistics'
        });
    }
});

// ============================================================================
// PRINCIPAL STATISTICS
// ============================================================================

// Get comprehensive statistics for principal dashboard
router.get('/principal', authenticate, async (req, res, next) => {
    try {
        // Verify user is principal or admin
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only principals and admins can view principal statistics'
            });
        }

        const { date_from, date_to } = req.query;

        // Set default date range to current month if not provided
        let startDate = date_from;
        let endDate = date_to;

        if (!startDate || !endDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        // Get school-wide user counts
        const { count: totalStudents, error: studentsError } = await supabase
            .from('students_master')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        const { count: totalTeachers, error: teachersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'teacher')
            .eq('status', 'active');

        const { count: totalParents, error: parentsError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'parent')
            .eq('status', 'active');

        if (studentsError || teachersError || parentsError) {
            logger.error('Error getting user counts:', { studentsError, teachersError, parentsError });
        }

        // Get class and academic structure
        const { data: classDivisions, error: classesError } = await supabase
            .from('class_divisions')
            .select(`
                id,
                division,
                academic_year:academic_year_id (year_name),
                class_level:class_level_id (name, sequence_number)
            `)
            .eq('academic_year:academic_year_id.is_active', true);

        if (classesError) throw classesError;

        // Get attendance statistics across all classes
        const { data: attendanceData, error: attendanceError } = await supabase
            .from('daily_attendance')
            .select(`
                id,
                class_division_id,
                attendance_date,
                is_holiday,
                student_attendance_records (
                    id,
                    status
                )
            `)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate);

        const attendanceStats = {
            total_days: 0,
            holiday_days: 0,
            working_days: 0,
            classes: {},
            overall: {
                total_students: 0,
                total_present: 0,
                total_absent: 0,
                average_percentage: 0
            }
        };

        if (!attendanceError && attendanceData) {
            const workingDays = attendanceData.filter(da => !da.is_holiday);
            const holidayDays = attendanceData.filter(da => da.is_holiday);

            attendanceStats.total_days = attendanceData.length;
            attendanceStats.holiday_days = holidayDays.length;
            attendanceStats.working_days = workingDays.length;

            // Process attendance by class
            const classAttendance = {};
            let grandTotalStudents = 0;
            let grandTotalPresent = 0;
            let grandTotalAbsent = 0;

            for (const record of workingDays) {
                if (!classAttendance[record.class_division_id]) {
                    classAttendance[record.class_division_id] = {
                        total_days: 0,
                        total_students: 0,
                        total_present: 0,
                        total_absent: 0
                    };
                }

                if (record.student_attendance_records) {
                    const dayTotal = record.student_attendance_records.length;
                    const dayPresent = record.student_attendance_records.filter(r => r.status === 'present').length;
                    const dayAbsent = record.student_attendance_records.filter(r => r.status === 'absent').length;

                    classAttendance[record.class_division_id].total_days += 1;
                    classAttendance[record.class_division_id].total_students = Math.max(
                        classAttendance[record.class_division_id].total_students,
                        dayTotal
                    );
                    classAttendance[record.class_division_id].total_present += dayPresent;
                    classAttendance[record.class_division_id].total_absent += dayAbsent;

                    grandTotalStudents = Math.max(grandTotalStudents, dayTotal);
                    grandTotalPresent += dayPresent;
                    grandTotalAbsent += dayAbsent;
                }
            }

            // Calculate percentages and add class names
            for (const [classId, stats] of Object.entries(classAttendance)) {
                const classInfo = classDivisions?.find(cd => cd.id === classId);
                if (classInfo) {
                    const className = `${classInfo.class_level.name} ${classInfo.division}`;
                    const percentage = stats.total_students > 0 ?
                        Math.round((stats.total_present / (stats.total_present + stats.total_absent)) * 100) : 0;

                    attendanceStats.classes[classId] = {
                        class_name: className,
                        ...stats,
                        attendance_percentage: percentage
                    };
                }
            }

            // Overall statistics
            attendanceStats.overall = {
                total_students: grandTotalStudents,
                total_present: grandTotalPresent,
                total_absent: grandTotalAbsent,
                average_percentage: grandTotalStudents > 0 ?
                    Math.round((grandTotalPresent / (grandTotalPresent + grandTotalAbsent)) * 100) : 0
            };
        }

        // Get homework statistics across school
        const { data: homeworkData, error: homeworkError } = await supabase
            .from('homework')
            .select(`
                id,
                title,
                subject,
                due_date,
                class_division_id,
                assigned_by,
                student_homework (
                    id,
                    submitted_at
                )
            `)
            .gte('due_date', startDate)
            .lte('due_date', endDate);

        const homeworkStats = {
            total_assigned: homeworkData?.length || 0,
            by_subject: {},
            by_teacher: {},
            completion_summary: {
                total: 0,
                completed: 0,
                pending: 0,
                overdue: 0
            }
        };

        if (!homeworkError && homeworkData) {
            // Group by subject
            const subjectGroups = {};
            const teacherGroups = {};

            homeworkData.forEach(hw => {
                // Subject grouping
                if (!subjectGroups[hw.subject]) {
                    subjectGroups[hw.subject] = [];
                }
                subjectGroups[hw.subject].push(hw);

                // Teacher grouping
                if (!teacherGroups[hw.assigned_by]) {
                    teacherGroups[hw.assigned_by] = [];
                }
                teacherGroups[hw.assigned_by].push(hw);
            });

            // Process subject statistics
            for (const [subject, assignments] of Object.entries(subjectGroups)) {
                const total = assignments.length;
                const completed = assignments.filter(hw =>
                    hw.student_homework.some(sh => sh.submitted_at)
                ).length;
                const overdue = assignments.filter(hw =>
                    new Date(hw.due_date) < new Date() &&
                    !hw.student_homework.some(sh => sh.submitted_at)
                ).length;

                homeworkStats.by_subject[subject] = {
                    total: total,
                    completed: completed,
                    pending: total - completed,
                    overdue: overdue,
                    completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0
                };
            }

            // Process teacher statistics
            for (const [teacherId, assignments] of Object.entries(teacherGroups)) {
                const total = assignments.length;
                const completed = assignments.filter(hw =>
                    hw.student_homework.some(sh => sh.submitted_at)
                ).length;

                homeworkStats.by_teacher[teacherId] = {
                    total_assigned: total,
                    completed: completed,
                    pending: total - completed,
                    completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0
                };
            }

            // Overall completion summary
            const totalAssignments = homeworkData.length;
            const totalCompleted = homeworkData.filter(hw =>
                hw.student_homework.some(sh => sh.submitted_at)
            ).length;
            const totalOverdue = homeworkData.filter(hw =>
                new Date(hw.due_date) < new Date() &&
                !hw.student_homework.some(sh => sh.submitted_at)
            ).length;

            homeworkStats.completion_summary = {
                total: totalAssignments,
                completed: totalCompleted,
                pending: totalAssignments - totalCompleted,
                overdue: totalOverdue
            };
        }

        // Get communication statistics
        const { data: messageStats, error: messageError } = await supabase
            .from('messages')
            .select('id, sender_id, recipient_id, created_at, read_at')
            .gte('created_at', `${startDate}T00:00:00Z`)
            .lte('created_at', `${endDate}T23:59:59Z`);

        const communicationStats = {
            total_messages: messageStats?.length || 0,
            by_role: {
                teacher: 0,
                parent: 0,
                admin: 0,
                principal: 0
            },
            engagement: {
                sent: 0,
                received: 0,
                read: 0,
                unread: 0
            }
        };

        if (!messageError && messageStats) {
            // Count messages by sender role
            for (const message of messageStats) {
                // Get sender role
                const { data: sender } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', message.sender_id)
                    .single();

                if (sender) {
                    if (sender.role === 'teacher') communicationStats.by_role.teacher++;
                    else if (sender.role === 'parent') communicationStats.by_role.parent++;
                    else if (sender.role === 'admin') communicationStats.by_role.admin++;
                    else if (sender.role === 'principal') communicationStats.by_role.principal++;
                }

                // Count read/unread
                if (message.read_at) {
                    communicationStats.engagement.read++;
                } else {
                    communicationStats.engagement.unread++;
                }
            }

            communicationStats.engagement.sent = messageStats.length;
            communicationStats.engagement.received = messageStats.length;
        }

        // Get calendar and event statistics
        const { data: calendarData, error: calendarError } = await supabase
            .from('calendar_events')
            .select('id, title, event_type, event_category, event_date, status, created_by')
            .gte('event_date', startDate)
            .lte('event_date', endDate);

        const calendarStats = {
            total_events: calendarData?.length || 0,
            by_type: {},
            by_category: {},
            by_status: {
                pending: 0,
                approved: 0,
                rejected: 0
            }
        };

        if (!calendarError && calendarData) {
            // Group by event type
            const typeGroups = {};
            const categoryGroups = {};

            calendarData.forEach(event => {
                // Type grouping
                if (!typeGroups[event.event_type]) {
                    typeGroups[event.event_type] = 0;
                }
                typeGroups[event.event_type]++;

                // Category grouping
                if (!categoryGroups[event.event_category]) {
                    categoryGroups[event.event_category] = 0;
                }
                categoryGroups[event.event_category]++;

                // Status grouping
                if (event.status === 'pending') calendarStats.by_status.pending++;
                else if (event.status === 'approved') calendarStats.by_status.approved++;
                else if (event.status === 'rejected') calendarStats.by_status.rejected++;
            });

            calendarStats.by_type = typeGroups;
            calendarStats.by_category = categoryGroups;
        }

        res.json({
            status: 'success',
            data: {
                date_range: { start_date: startDate, end_date: endDate },
                school_overview: {
                    total_students: totalStudents || 0,
                    total_teachers: totalTeachers || 0,
                    total_parents: totalParents || 0,
                    total_classes: classDivisions?.length || 0
                },
                attendance: attendanceStats,
                homework: homeworkStats,
                communication: communicationStats,
                calendar: calendarStats,
                summary: {
                    overall_attendance: attendanceStats.overall.average_percentage,
                    homework_completion: homeworkStats.completion_summary.total > 0 ?
                        Math.round((homeworkStats.completion_summary.completed / homeworkStats.completion_summary.total) * 100) : 0,
                    total_events: calendarStats.total_events,
                    pending_approvals: calendarStats.by_status.pending,
                    message_volume: communicationStats.total_messages
                }
            }
        });

    } catch (error) {
        logger.error('Error getting principal statistics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get principal statistics'
        });
    }
});

export default router;

// ============================================================================
// DEBUG ENDPOINTS (Remove in production)
// ============================================================================

// Debug endpoint to check teacher assignments
router.get('/debug/teacher-assignments/:teacher_id', authenticate, async (req, res) => {
    try {
        // Only allow admins, principals, or the teacher themselves
        if (!['admin', 'principal'].includes(req.user.role) && req.user.id !== req.params.teacher_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        const teacherId = req.params.teacher_id;

        // Check new table
        const { data: newAssignments, error: newError } = await supabase
            .from('class_teacher_assignments')
            .select('*')
            .eq('teacher_id', teacherId);

        // Check old table
        const { data: oldAssignments, error: oldError } = await supabase
            .from('teacher_class_assignments')
            .select('*')
            .eq('teacher_id', teacherId);

        // Check direct assignments
        const { data: directClasses, error: directError } = await supabase
            .from('class_divisions')
            .select('*')
            .eq('teacher_id', teacherId);

        // Check if teacher exists
        const { data: teacher, error: teacherError } = await supabase
            .from('users')
            .select('id, full_name, role, status')
            .eq('id', teacherId)
            .single();

        res.json({
            status: 'success',
            data: {
                teacher: teacher || { error: teacherError?.message },
                new_table_assignments: {
                    data: newAssignments || [],
                    error: newError?.message,
                    count: newAssignments?.length || 0
                },
                old_table_assignments: {
                    data: oldAssignments || [],
                    error: oldError?.message,
                    count: oldAssignments?.length || 0
                },
                direct_class_assignments: {
                    data: directClasses || [],
                    error: directError?.message,
                    count: directClasses?.length || 0
                },
                summary: {
                    total_assignments: (newAssignments?.length || 0) + (oldAssignments?.length || 0) + (directClasses?.length || 0),
                    has_new_table_data: (newAssignments?.length || 0) > 0,
                    has_old_table_data: (oldAssignments?.length || 0) > 0,
                    has_direct_assignments: (directClasses?.length || 0) > 0
                }
            }
        });

    } catch (error) {
        logger.error('Error in debug endpoint:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get debug information'
        });
    }
});
