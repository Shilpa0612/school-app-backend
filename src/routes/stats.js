import express from 'express';
import { adminSupabase, supabase } from '../config/supabase.js';
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
        const { data: parentMappings, error: mappingsError } = await adminSupabase
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
        const { data: childrenClasses, error: classesError } = await adminSupabase
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

            const { data: attendanceData, error: attendanceError } = await adminSupabase
                .rpc('get_simplified_attendance_summary', {
                    p_student_id: child.student_id,
                    p_academic_year_id: studentClass.class_divisions.academic_year.id,
                    p_start_date: startDate,
                    end_date: endDate
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
            const { data: homeworkData, error: homeworkError } = await adminSupabase
                .from('homework')
                .select(`
                    id,
                    title,
                    subject,
                    due_date
                `)
                .eq('class_division_id', studentClass.class_division_id)
                .gte('due_date', startDate)
                .lte('due_date', endDate);

            if (!homeworkError && homeworkData) {
                const totalHomework = homeworkData.length;
                // Note: student_homework relationship removed due to schema issues
                const completedHomework = 0; // Will need separate query if needed
                const overdueHomework = homeworkData.filter(hw =>
                    new Date(hw.due_date) < new Date()
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
        const { data: messageStats, error: messageError } = await adminSupabase
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
        const { data: upcomingEvents, error: eventsError } = await adminSupabase
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

        logger.info(`Teacher stats date range: ${startDate} to ${endDate}`);
        logger.info(`Date query params: date_from=${date_from}, date_to=${date_to}`);

        // Get teacher's assigned classes - using comprehensive approach
        let assignedClasses = [];
        let classAssignments = [];
        let teacherAssignments = [];
        let primaryAssignments = [];
        let classDivisionIds = [];

        try {
            // Check class_teacher_assignments table
            const { data: classAssignments, error: classError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    id,
                    teacher_id,
                    class_division_id,
                    assignment_type,
                    subject,
                    is_primary,
                    is_active,
                    assigned_date
                `)
                .eq('teacher_id', req.user.id)
                .eq('is_active', true);

            if (classError) {
                logger.error('Error fetching from class_teacher_assignments:', classError);
            }

            // Note: teacher_class_assignments table might not exist or have different structure
            // We'll focus on the tables we know work
            const teacherAssignments = [];

            // Check class_divisions table for primary teacher assignments
            const { data: primaryAssignments, error: primaryError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    teacher_id,
                    division,
                    academic_year:academic_year_id(year_name),
                    class_level:class_level_id(name, sequence_number)
                `)
                .eq('teacher_id', req.user.id);

            if (primaryError) {
                logger.error('Error fetching from class_divisions:', primaryError);
            }

            // Combine all assignments
            let allAssignments = [];

            if (classAssignments && classAssignments.length > 0) {
                allAssignments.push(...classAssignments.map(ca => ({
                    ...ca,
                    source: 'class_teacher_assignments'
                })));
            }

            if (teacherAssignments && teacherAssignments.length > 0) {
                allAssignments.push(...teacherAssignments.map(ta => ({
                    ...ta,
                    source: 'teacher_class_assignments'
                })));
            }

            if (primaryAssignments && primaryAssignments.length > 0) {
                allAssignments.push(...primaryAssignments.map(pa => ({
                    ...pa,
                    class_division_id: pa.id, // Map id to class_division_id
                    assignment_type: 'class_teacher',
                    is_primary: true,
                    source: 'class_divisions'
                })));
            }

            logger.info(`Found assignments: class_teacher_assignments: ${classAssignments?.length || 0}, class_divisions: ${primaryAssignments?.length || 0}, total: ${allAssignments.length}`);

            if (allAssignments.length > 0) {
                // Process assignments to get class details
                classDivisionIds = [...new Set(allAssignments.map(a => a.class_division_id))];

                const { data: classDetails, error: classDetailsError } = await adminSupabase
                    .from('class_divisions')
                    .select(`
                        id,
                        division,
                        academic_year:academic_year_id(year_name),
                        class_level:class_level_id(name, sequence_number)
                    `)
                    .in('id', classDivisionIds);

                if (classDetailsError) {
                    logger.error('Error fetching class details:', classDetailsError);
                }

                // Map assignments to class details
                const processedAssignments = allAssignments.map(assignment => {
                    const classDetail = classDetails?.find(cd => cd.id === assignment.class_division_id);
                    return {
                        ...assignment,
                        class_name: classDetail ? `${classDetail.class_level.name} ${classDetail.division}` : 'Unknown Class',
                        academic_year: classDetail?.academic_year?.year_name || 'Unknown Year',
                        class_level: classDetail?.class_level?.name || 'Unknown Level'
                    };
                });

                assignedClasses = processedAssignments;
                logger.info(`Successfully processed ${assignedClasses.length} assignments`);
            } else {
                logger.info('No assignments found in any table');
            }

        } catch (error) {
            logger.error('Error in academic approach:', error);
        }

        logger.info(`Final assigned classes count: ${assignedClasses.length}, class IDs: ${classDivisionIds.length > 0 ? classDivisionIds.join(', ') : 'none'}`);

        if (!classDivisionIds || classDivisionIds.length === 0) {
            return res.json({
                status: 'success',
                data: {
                    assigned_classes: 0,
                    date_range: { start_date: startDate, end_date: endDate },
                    attendance: {},
                    homework: {},
                    communication: {},
                    students: {},
                    note: assignedClasses.length > 0 ?
                        `Found ${assignedClasses.length} class assignments` :
                        "No class assignments found. Please contact administrator to assign classes.",
                    debug_info: {
                        teacher_id: req.user.id,
                        checked_tables: ['class_teacher_assignments', 'class_divisions'],
                        assignments_found: {
                            class_teacher_assignments: classAssignments?.length || 0,
                            class_divisions: primaryAssignments?.length || 0,
                            total: assignedClasses.length
                        },
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
            let dailyAttendance = null;
            let attendanceError = null;

            logger.info(`Fetching attendance for class ${assignment.class_division_id} from ${startDate} to ${endDate}`);

            // First, let's check if there's any attendance data for this class at all
            const { data: allAttendance, error: allAttendanceError } = await adminSupabase
                .from('daily_attendance')
                .select('attendance_date, is_holiday')
                .eq('class_division_id', assignment.class_division_id);

            logger.info(`All attendance records for class ${assignment.class_division_id}: ${allAttendance?.length || 0}, error=${allAttendanceError ? 'yes' : 'no'}`);
            if (allAttendance && allAttendance.length > 0) {
                const dateRange = allAttendance.map(a => a.attendance_date).sort();
                logger.info(`Attendance date range for class ${assignment.class_division_id}: ${dateRange[0]} to ${dateRange[dateRange.length - 1]}`);
            }

            try {
                const { data: daData, error: daError } = await adminSupabase
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

                dailyAttendance = daData;
                attendanceError = daError;

                logger.info(`Attendance query for class ${assignment.class_division_id}: data=${dailyAttendance?.length || 0}, error=${attendanceError ? 'yes' : 'no'}`);
                if (attendanceError) {
                    logger.error(`Attendance error for class ${assignment.class_division_id}:`, attendanceError);
                }
            } catch (err) {
                logger.error(`Error fetching attendance for class ${assignment.class_division_id}:`, err);
                continue; // Skip this class if there's an error
            }

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

                const className = assignment.class_name || 'Unknown Class';
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
        let homeworkData = null;
        let homeworkError = null;

        if (classDivisionIds && classDivisionIds.length > 0) {
            logger.info(`Fetching homework for class divisions: ${classDivisionIds.join(', ')} from ${startDate} to ${endDate}`);

            // First, let's check if there's any homework data for these classes at all
            const { data: allHomework, error: allHomeworkError } = await supabase
                .from('homework')
                .select('class_division_id, due_date')
                .in('class_division_id', classDivisionIds);

            logger.info(`All homework for class divisions: ${allHomework?.length || 0}, error=${allHomeworkError ? 'yes' : 'no'}`);
            if (allHomework && allHomework.length > 0) {
                const classCounts = {};
                allHomework.forEach(hw => {
                    classCounts[hw.class_division_id] = (classCounts[hw.class_division_id] || 0) + 1;
                });
                logger.info('Homework per class:', classCounts);
            }

            const { data: hwData, error: hwError } = await adminSupabase
                .from('homework')
                .select(`
                    id,
                    title,
                    subject,
                    due_date,
                    class_division_id
                `)
                .in('class_division_id', classDivisionIds)
                .gte('due_date', startDate)
                .lte('due_date', endDate);

            homeworkData = hwData;
            homeworkError = hwError;

            logger.info(`Homework query result: data=${homeworkData?.length || 0}, error=${homeworkError ? 'yes' : 'no'}`);
            if (homeworkError) {
                logger.error('Homework query error:', homeworkError);
            }
        }

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
                // Note: student_homework relationship removed due to schema issues
                const completed = 0; // Will need separate query if needed
                const overdue = assignments.filter(hw =>
                    new Date(hw.due_date) < new Date()
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
            // Note: student_homework relationship removed due to schema issues
            const totalCompleted = 0; // Will need separate query if needed
            homeworkStats.completion_rates = {
                overall: totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0,
                total: totalAssignments,
                completed: totalCompleted
            };
        }

        // Get communication statistics
        const { data: messageStats, error: messageError } = await adminSupabase
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
        let studentData = null;
        let studentError = null;

        if (classDivisionIds && classDivisionIds.length > 0) {
            logger.info(`Fetching students for class divisions: ${classDivisionIds.join(', ')}`);

            // First, let's check if there are any students in these class divisions at all
            const { data: allStudents, error: allStudentsError } = await adminSupabase
                .from('student_academic_records')
                .select('class_division_id, student_id')
                .in('class_division_id', classDivisionIds);

            logger.info(`All students in class divisions: ${allStudents?.length || 0}, error=${allStudentsError ? 'yes' : 'no'}`);
            if (allStudents && allStudents.length > 0) {
                const classCounts = {};
                allStudents.forEach(s => {
                    classCounts[s.class_division_id] = (classCounts[s.class_division_id] || 0) + 1;
                });
                logger.info('Students per class:', classCounts);
            }

            const { data: stdData, error: stdError } = await adminSupabase
                .from('student_academic_records')
                .select(`
                    student_id,
                    class_division_id,
                    roll_number,
                    students:students_master (
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .in('class_division_id', classDivisionIds)
                .eq('status', 'ongoing');

            studentData = stdData;
            studentError = stdError;

            logger.info(`Student query result: data=${studentData?.length || 0}, error=${studentError ? 'yes' : 'no'}`);
            if (studentError) {
                logger.error('Student query error:', studentError);
            }
        }

        const studentsStats = {
            total_students: studentData?.length || 0,
            by_class: {}
        };

        if (!studentError && studentData) {
            // Group students by class
            for (const assignment of assignedClasses) {
                const classStudents = studentData.filter(s => s.class_division_id === assignment.class_division_id);
                const className = assignment.class_name || 'Unknown Class';

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
                date_range: {
                    start_date: startDate,
                    end_date: endDate,
                    note: "Use ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD to filter data by specific date range"
                },
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
// DEBUG ENDPOINTS
// ============================================================================

// Debug endpoint to check database structure and data
router.get('/debug/teacher-data/:teacher_id', authenticate, async (req, res) => {
    try {
        const { teacher_id } = req.params;

        // Check if user is authorized
        if (req.user.role !== 'admin' && req.user.id !== teacher_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Not authorized to view this data'
            });
        }

        logger.info(`Debug request for teacher: ${teacher_id}`);

        // 1. Check teacher assignments
        const { data: assignments, error: assignmentsError } = await adminSupabase
            .from('class_teacher_assignments')
            .select('*')
            .eq('teacher_id', teacher_id);

        // 2. Check class divisions
        const { data: classDivisions, error: classDivisionsError } = await adminSupabase
            .from('class_divisions')
            .select('*')
            .eq('teacher_id', teacher_id);

        // 3. Check if students exist in assigned classes
        let classIds = [];
        if (assignments && assignments.length > 0) {
            classIds = assignments.map(a => a.class_division_id);
        }
        if (classDivisions && classDivisions.length > 0) {
            classIds = [...classIds, ...classDivisions.map(cd => cd.id)];
        }
        classIds = [...new Set(classIds)];

        let studentsData = null;
        if (classIds.length > 0) {
            const { data: students, error: studentsError } = await adminSupabase
                .from('student_academic_records')
                .select(`
                    student_id,
                    class_division_id,
                    status,
                    students:students_master (
                        id,
                        full_name,
                        admission_number
                    )
                `)
                .in('class_division_id', classIds);

            studentsData = students;
        }

        // 4. Check attendance records
        let attendanceData = null;
        if (classIds.length > 0) {
            const { data: attendance, error: attendanceError } = await adminSupabase
                .from('daily_attendance')
                .select('*')
                .in('class_division_id', classIds);

            attendanceData = attendance;
        }

        // 5. Check homework records
        let homeworkData = null;
        if (classIds.length > 0) {
            const { data: homework, error: homeworkError } = await adminSupabase
                .from('homework')
                .select('*')
                .in('class_division_id', classIds);

            homeworkData = homework;
        }

        // 6. Check database schema for homework table
        const { data: homeworkSchema, error: schemaError } = await adminSupabase
            .from('homework')
            .select('*')
            .limit(1);

        res.json({
            status: 'success',
            data: {
                teacher_id,
                debug_info: {
                    assignments: {
                        data: assignments || [],
                        error: assignmentsError,
                        count: assignments?.length || 0
                    },
                    class_divisions: {
                        data: classDivisions || [],
                        error: classDivisionsError,
                        count: classDivisions?.length || 0
                    },
                    students: {
                        data: studentsData || [],
                        count: studentsData?.length || 0,
                        class_ids_checked: classIds
                    },
                    attendance: {
                        data: attendanceData || [],
                        count: attendanceData?.length || 0
                    },
                    homework: {
                        data: homeworkData || [],
                        count: homeworkData?.length || 0,
                        schema_check: {
                            can_query: !schemaError,
                            error: schemaError
                        }
                    },
                    summary: {
                        total_classes: classIds.length,
                        total_students: studentsData?.length || 0,
                        total_attendance_records: attendanceData?.length || 0,
                        total_homework: homeworkData?.length || 0
                    }
                }
            }
        });

    } catch (error) {
        logger.error('Error in debug endpoint:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get debug data',
            error: error.message
        });
    }
});

// Quick database check endpoint
router.get('/debug/db-check', authenticate, async (req, res) => {
    try {
        // Only allow admins for this endpoint
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins can access this endpoint'
            });
        }

        logger.info('Database check requested');

        // 1. Check class divisions
        const { data: classDivisions, error: cdError } = await adminSupabase
            .from('class_divisions')
            .select('id, division, class_level:class_level_id(name), academic_year:academic_year_id(year_name)')
            .limit(10);

        // 2. Check students master
        const { data: studentsMaster, error: smError } = await adminSupabase
            .from('students_master')
            .select('id, full_name, admission_number, status')
            .limit(10);

        // 3. Check student academic records
        const { data: studentRecords, error: srError } = await adminSupabase
            .from('student_academic_records')
            .select('student_id, class_division_id, status, academic_year:academic_year_id(year_name)')
            .limit(10);

        // 4. Check teacher assignments
        const { data: teacherAssignments, error: taError } = await adminSupabase
            .from('class_teacher_assignments')
            .select('teacher_id, class_division_id, assignment_type, subject')
            .limit(10);

        // 5. Check specific class division
        const { data: specificClass, error: scError } = await adminSupabase
            .from('class_divisions')
            .select(`
                id, 
                division, 
                class_level:class_level_id(name), 
                academic_year:academic_year_id(year_name),
                teacher_id
            `)
            .eq('id', '4ded8472-fe26-4cf3-ad25-23f601960a0b');

        // 6. Check students in specific class
        const { data: classStudents, error: csError } = await adminSupabase
            .from('student_academic_records')
            .select(`
                student_id, 
                class_division_id, 
                status, 
                academic_year:academic_year_id(year_name),
                students:students_master(full_name, admission_number)
            `)
            .eq('class_division_id', '4ded8472-fe26-4cf3-ad25-23f601960a0b');

        res.json({
            status: 'success',
            data: {
                class_divisions: {
                    data: classDivisions || [],
                    error: cdError?.message,
                    count: classDivisions?.length || 0
                },
                students_master: {
                    data: studentsMaster || [],
                    error: smError?.message,
                    count: studentsMaster?.length || 0
                },
                student_academic_records: {
                    data: studentRecords || [],
                    error: srError?.message,
                    count: studentRecords?.length || 0
                },
                teacher_assignments: {
                    data: teacherAssignments || [],
                    error: taError?.message,
                    count: teacherAssignments?.length || 0
                },
                specific_class: {
                    data: specificClass || [],
                    error: scError?.message,
                    count: specificClass?.length || 0
                },
                class_students: {
                    data: classStudents || [],
                    error: csError?.message,
                    count: classStudents?.length || 0
                },
                summary: {
                    total_classes: classDivisions?.length || 0,
                    total_students: studentsMaster?.length || 0,
                    total_enrollments: studentRecords?.length || 0,
                    total_assignments: teacherAssignments?.length || 0,
                    target_class_exists: (specificClass?.length || 0) > 0,
                    target_class_has_students: (classStudents?.length || 0) > 0
                }
            }
        });

    } catch (error) {
        logger.error('Error in database check:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to check database',
            error: error.message
        });
    }
});

// Debug endpoint to check parent-student mappings
router.get('/debug/parent-mappings/:parent_id', authenticate, async (req, res) => {
    try {
        const { parent_id } = req.params;

        // Only allow admins or the parent themselves
        if (req.user.role !== 'admin' && req.user.id !== parent_id) {
            return res.status(403).json({
                status: 'error',
                message: 'Not authorized to view this data'
            });
        }

        logger.info(`Debug request for parent mappings: ${parent_id}`);

        // Check parent user
        const { data: parentUser, error: parentError } = await adminSupabase
            .from('users')
            .select('id, full_name, role, status')
            .eq('id', parent_id)
            .single();

        // Check parent-student mappings
        const { data: parentMappings, error: mappingsError } = await adminSupabase
            .from('parent_student_mappings')
            .select(`
                id,
                parent_id,
                student_id,
                students:students_master (
                    id,
                    full_name,
                    admission_number,
                    status
                )
            `)
            .eq('parent_id', parent_id);

        // Check if parent exists in users table
        const { data: allUsers, error: usersError } = await adminSupabase
            .from('users')
            .select('id, full_name, role, status')
            .eq('role', 'parent')
            .limit(10);

        res.json({
            status: 'success',
            data: {
                parent_id,
                debug_info: {
                    parent_user: {
                        data: parentUser || null,
                        error: parentError?.message
                    },
                    parent_mappings: {
                        data: parentMappings || [],
                        error: mappingsError?.message,
                        count: parentMappings?.length || 0
                    },
                    all_parent_users: {
                        data: allUsers || [],
                        error: usersError?.message,
                        count: allUsers?.length || 0
                    },
                    summary: {
                        parent_exists: !!parentUser,
                        has_mappings: (parentMappings?.length || 0) > 0,
                        total_parents_in_system: allUsers?.length || 0
                    }
                }
            }
        });

    } catch (error) {
        logger.error('Error in parent mappings debug:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get parent mappings debug info',
            error: error.message
        });
    }
});

// Get individual student statistics for parent
router.get('/parent/student/:student_id', authenticate, async (req, res, next) => {
    try {
        const { student_id } = req.params;
        const { date_from, date_to } = req.query;

        // Verify user is a parent
        if (req.user.role !== 'parent') {
            return res.status(403).json({
                status: 'error',
                message: 'This endpoint is only for parents'
            });
        }

        // Set default date range to current month if not provided
        let startDate = date_from;
        let endDate = date_to;

        if (!startDate || !endDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        }

        logger.info(`Parent requesting stats for student ${student_id} from ${startDate} to ${endDate}`);

        // Verify parent has access to this student
        const { data: parentMapping, error: mappingError } = await adminSupabase
            .from('parent_student_mappings')
            .select('student_id')
            .eq('parent_id', req.user.id)
            .eq('student_id', student_id)
            .single();

        logger.info(`Parent access check: parent_id=${req.user.id}, student_id=${student_id}, mapping=${parentMapping}, error=${mappingError}`);

        if (mappingError || !parentMapping) {
            // Let's also check what mappings exist for this parent
            const { data: allMappings, error: allMappingsError } = await adminSupabase
                .from('parent_student_mappings')
                .select('student_id')
                .eq('parent_id', req.user.id);

            logger.info(`All parent mappings: ${allMappings?.length || 0}, error=${allMappingsError}, mappings=${JSON.stringify(allMappings)}`);

            // Also check if the student exists at all
            const { data: studentExists, error: studentExistsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name')
                .eq('id', student_id)
                .single();

            logger.info(`Student existence check: student=${studentExists}, error=${studentExistsError}`);

            return res.status(403).json({
                status: 'error',
                message: 'You do not have access to this student',
                debug_info: {
                    requested_student_id: student_id,
                    parent_id: req.user.id,
                    parent_mappings_count: allMappings?.length || 0,
                    parent_mappings: allMappings || [],
                    mapping_error: mappingError?.message,
                    student_exists: !!studentExists,
                    student_name: studentExists?.full_name || 'Unknown'
                }
            });
        }

        // Get student details
        const { data: student, error: studentError } = await adminSupabase
            .from('students_master')
            .select(`
                id,
                full_name,
                admission_number,
                date_of_birth,
                status
            `)
            .eq('id', student_id)
            .single();

        if (studentError || !student) {
            return res.status(404).json({
                status: 'error',
                message: 'Student not found'
            });
        }

        // Get student's current class information
        const { data: studentClass, error: classError } = await adminSupabase
            .from('student_academic_records')
            .select(`
                id,
                class_division_id,
                roll_number,
                status,
                academic_year:academic_year_id(year_name),
                class_divisions (
                    id,
                    division,
                    class_level:class_level_id(name, sequence_number)
                )
            `)
            .eq('student_id', student_id)
            .eq('status', 'ongoing')
            .single();

        if (classError || !studentClass) {
            return res.status(404).json({
                status: 'error',
                message: 'Student not currently enrolled in any class'
            });
        }

        // Get detailed attendance statistics
        const { data: dailyAttendance, error: attendanceError } = await adminSupabase
            .from('daily_attendance')
            .select(`
                id,
                attendance_date,
                is_holiday,
                student_attendance_records!inner (
                    id,
                    status,
                    remarks
                )
            `)
            .eq('class_division_id', studentClass.class_division_id)
            .gte('attendance_date', startDate)
            .lte('attendance_date', endDate)
            .order('attendance_date', { ascending: true });

        // Process attendance data
        const attendanceStats = {
            total_days: 0,
            present_days: 0,
            absent_days: 0,
            late_days: 0,
            holiday_days: 0,
            attendance_percentage: 0,
            daily_records: []
        };

        if (!attendanceError && dailyAttendance) {
            const workingDays = dailyAttendance.filter(da => !da.is_holiday);
            attendanceStats.total_days = workingDays.length;
            attendanceStats.holiday_days = dailyAttendance.filter(da => da.is_holiday).length;

            // Process each day's attendance
            dailyAttendance.forEach(day => {
                const studentRecord = day.student_attendance_records?.find(sr => sr.id);
                if (studentRecord) {
                    const record = {
                        date: day.attendance_date,
                        status: studentRecord.status,
                        remarks: studentRecord.remarks,
                        is_holiday: day.is_holiday
                    };

                    if (!day.is_holiday) {
                        switch (studentRecord.status?.toLowerCase()) {
                            case 'present':
                                attendanceStats.present_days++;
                                break;
                            case 'absent':
                                attendanceStats.absent_days++;
                                break;
                            case 'late':
                                attendanceStats.late_days++;
                                break;
                        }
                    }

                    attendanceStats.daily_records.push(record);
                }
            });

            // Calculate attendance percentage
            if (attendanceStats.total_days > 0) {
                attendanceStats.attendance_percentage = Math.round(
                    (attendanceStats.present_days / attendanceStats.total_days) * 100
                );
            }
        }

        // Get homework statistics
        const { data: homeworkData, error: homeworkError } = await adminSupabase
            .from('homework')
            .select(`
                id,
                title,
                subject,
                description,
                due_date,
                assigned_date,
                class_division_id
            `)
            .eq('class_division_id', studentClass.class_division_id)
            .gte('due_date', startDate)
            .lte('due_date', endDate)
            .order('due_date', { ascending: true });

        // Process homework data
        const homeworkStats = {
            total_assigned: 0,
            completed: 0,
            pending: 0,
            overdue: 0,
            by_subject: {},
            assignments: []
        };

        if (!homeworkError && homeworkData) {
            homeworkStats.total_assigned = homeworkData.length;

            // Group by subject
            homeworkData.forEach(hw => {
                const subject = hw.subject || 'General';
                if (!homeworkStats.by_subject[subject]) {
                    homeworkStats.by_subject[subject] = {
                        total: 0,
                        completed: 0,
                        pending: 0,
                        overdue: 0
                    };
                }

                homeworkStats.by_subject[subject].total++;

                const isOverdue = new Date(hw.due_date) < new Date();
                if (isOverdue) {
                    homeworkStats.overdue++;
                    homeworkStats.by_subject[subject].overdue++;
                }

                // Note: Completion status would need separate student_homework table query
                // For now, marking as pending
                homeworkStats.pending++;
                homeworkStats.by_subject[subject].pending++;

                homeworkStats.assignments.push({
                    id: hw.id,
                    title: hw.title,
                    subject: hw.subject,
                    description: hw.description,
                    assigned_date: hw.assigned_date,
                    due_date: hw.due_date,
                    is_overdue: isOverdue,
                    status: 'pending' // Will need separate query for actual status
                });
            });
        }

        // Get recent communication (messages involving this student's parent)
        const { data: recentMessages, error: messageError } = await adminSupabase
            .from('messages')
            .select(`
                id,
                title,
                content,
                sender_id,
                recipient_id,
                created_at,
                read_at,
                sender:users!messages_sender_id_fkey(full_name, role),
                recipient:users!messages_recipient_id_fkey(full_name, role)
            `)
            .or(`sender_id.eq.${req.user.id},recipient_id.eq.${req.user.id}`)
            .gte('created_at', `${startDate}T00:00:00Z`)
            .lte('created_at', `${endDate}T23:59:59Z`)
            .order('created_at', { ascending: false })
            .limit(10);

        const communicationStats = {
            total_messages: recentMessages?.length || 0,
            sent_messages: recentMessages?.filter(m => m.sender_id === req.user.id).length || 0,
            received_messages: recentMessages?.filter(m => m.recipient_id === req.user.id).length || 0,
            unread_messages: recentMessages?.filter(m =>
                m.recipient_id === req.user.id && !m.read_at
            ).length || 0,
            recent_messages: recentMessages?.map(m => ({
                id: m.id,
                title: m.title,
                content: m.content,
                sender: m.sender?.full_name || 'Unknown',
                recipient: m.recipient?.full_name || 'Unknown',
                created_at: m.created_at,
                is_read: !!m.read_at,
                direction: m.sender_id === req.user.id ? 'sent' : 'received'
            })) || []
        };

        // Get upcoming events for the student's class
        const { data: upcomingEvents, error: eventsError } = await adminSupabase
            .from('calendar_events')
            .select(`
                id,
                title,
                description,
                event_date,
                event_type,
                event_category,
                start_time,
                end_time
            `)
            .or(`event_type.eq.school_wide,class_division_id.eq.${studentClass.class_division_id}`)
            .gte('event_date', new Date().toISOString())
            .lte('event_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()) // Next 30 days
            .order('event_date', { ascending: true })
            .limit(10);

        const upcomingStats = {
            total_events: upcomingEvents?.length || 0,
            events: upcomingEvents?.map(event => ({
                id: event.id,
                title: event.title,
                description: event.description,
                event_date: event.event_date,
                event_type: event.event_type,
                event_category: event.event_category,
                start_time: event.start_time,
                end_time: event.end_time,
                days_until: Math.ceil((new Date(event.event_date) - new Date()) / (1000 * 60 * 60 * 24))
            })) || []
        };

        res.json({
            status: 'success',
            data: {
                student: {
                    id: student.id,
                    full_name: student.full_name,
                    admission_number: student.admission_number,
                    date_of_birth: student.date_of_birth,
                    status: student.status
                },
                class_info: {
                    class_division_id: studentClass.class_division_id,
                    class_name: `${studentClass.class_divisions.class_level.name} ${studentClass.class_divisions.division}`,
                    roll_number: studentClass.roll_number,
                    academic_year: studentClass.academic_year.year_name
                },
                date_range: {
                    start_date: startDate,
                    end_date: endDate,
                    note: "Use ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD to filter data by specific date range"
                },
                attendance: attendanceStats,
                homework: homeworkStats,
                communication: communicationStats,
                upcoming: upcomingStats,
                summary: {
                    student_name: student.full_name,
                    class_name: `${studentClass.class_divisions.class_level.name} ${studentClass.class_divisions.division}`,
                    attendance_percentage: attendanceStats.attendance_percentage,
                    total_homework: homeworkStats.total_assigned,
                    overdue_homework: homeworkStats.overdue,
                    recent_messages: communicationStats.total_messages,
                    upcoming_events: upcomingStats.total_events
                }
            }
        });

    } catch (error) {
        logger.error('Error getting individual student statistics:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get student statistics',
            error: error.message
        });
    }
});
