import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import notificationService from './notificationService.js';

class AttendanceNotificationService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
    }

    /**
     * Start the end-of-day attendance notification scheduler
     * Runs at 2:00 PM every day
     */
    startEODAttendanceNotifications() {
        if (this.isRunning) {
            logger.warn('EOD attendance notification scheduler is already running');
            return;
        }

        // Calculate time until next 2:00 PM
        const now = new Date();
        const next2PM = new Date();
        next2PM.setHours(14, 0, 0, 0); // 2:00 PM

        // If it's already past 2:00 PM today, schedule for tomorrow
        if (now >= next2PM) {
            next2PM.setDate(next2PM.getDate() + 1);
        }

        const timeUntilNext = next2PM.getTime() - now.getTime();

        logger.info(`EOD attendance notification scheduler started. Next run at: ${next2PM.toISOString()}`);

        // Set timeout for the first run
        setTimeout(() => {
            this.sendEODAttendanceNotifications();
            this.scheduleDaily();
        }, timeUntilNext);

        this.isRunning = true;
    }

    /**
     * Schedule daily EOD attendance notifications at 2:00 PM
     */
    scheduleDaily() {
        // Run every 24 hours
        this.intervalId = setInterval(() => {
            this.sendEODAttendanceNotifications();
        }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
    }

    /**
     * Stop the EOD attendance notification scheduler
     */
    stopEODAttendanceNotifications() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('EOD attendance notification scheduler stopped');
    }

    /**
     * Send end-of-day attendance notifications to parents
     */
    async sendEODAttendanceNotifications() {
        try {
            console.log('📅 Starting end-of-day attendance notifications...');

            const today = new Date();
            const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format

            console.log(`📊 Processing attendance for date: ${todayStr}`);

            // Get all students with their attendance for today
            const { data: attendanceData, error: attendanceError } = await adminSupabase
                .from('attendance')
                .select(`
                    student_id,
                    status,
                    student:students_master!attendance_student_id_fkey(
                        full_name,
                        admission_number,
                        class_division_id
                    )
                `)
                .eq('date', todayStr);

            if (attendanceError) {
                console.error('❌ Error fetching attendance data:', attendanceError);
                return;
            }

            console.log(`📊 Found ${attendanceData.length} attendance records for today`);

            // Get all parent-student mappings
            const { data: parentMappings, error: mappingError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    parent_id,
                    student_id
                `);

            if (mappingError) {
                console.error('❌ Error fetching parent-student mappings:', mappingError);
                return;
            }

            console.log(`👨‍👩‍👧‍👦 Found ${parentMappings.length} parent-student mappings`);

            // Create a map of student_id to attendance status
            const attendanceMap = {};
            attendanceData.forEach(record => {
                attendanceMap[record.student_id] = record.status;
            });

            // Get all student information
            const studentIds = parentMappings.map(m => m.student_id);
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .in('id', studentIds);

            if (studentsError) {
                console.error('❌ Error fetching students for EOD attendance:', studentsError);
                return;
            }

            // Get student academic records to get class_division_id
            const { data: academicRecords, error: academicError } = await adminSupabase
                .from('student_academic_records')
                .select('student_id, class_division_id')
                .in('student_id', studentIds)
                .eq('status', 'ongoing');

            if (academicError) {
                console.error('❌ Error fetching academic records for EOD attendance:', academicError);
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
                console.error('❌ Error fetching class divisions for EOD attendance:', classError);
                return;
            }

            const classDivisionMap = {};
            classDivisions.forEach(cd => {
                classDivisionMap[cd.id] = cd;
            });

            // Group by parent and send notifications
            const parentGroups = {};
            let notificationsSent = 0;

            for (const mapping of parentMappings) {
                const studentId = mapping.student_id;
                const attendanceStatus = attendanceMap[studentId];
                const student = studentMap[studentId];

                if (!student) {
                    console.error(`❌ Student not found for ID: ${studentId}`);
                    continue;
                }

                if (!parentGroups[mapping.parent_id]) {
                    parentGroups[mapping.parent_id] = [];
                }

                const classDivision = classDivisionMap[student.class_division_id];
                const className = classDivision ? `${classDivision.class_level.name} ${classDivision.division}` : 'Unknown Class';

                parentGroups[mapping.parent_id].push({
                    student: {
                        ...student,
                        class_name: className
                    },
                    attendanceStatus: attendanceStatus || 'absent' // Default to absent if no record
                });
            }

            console.log(`📤 Sending EOD attendance notifications to ${Object.keys(parentGroups).length} parents...`);

            // Send notifications to each parent
            for (const [parentId, studentData] of Object.entries(parentGroups)) {
                console.log(`📨 Sending EOD attendance notification to parent ${parentId} for ${studentData.length} students`);

                const result = await this.sendParentEODAttendanceNotification(parentId, studentData, todayStr);
                if (result.success) {
                    notificationsSent++;
                }
            }

            console.log(`✅ EOD attendance notifications completed. Sent to ${notificationsSent} parents`);

        } catch (error) {
            console.error('❌ Error in sendEODAttendanceNotifications:', error);
            logger.error('Error in sendEODAttendanceNotifications:', error);
        }
    }

    /**
     * Send EOD attendance notification to a specific parent
     */
    async sendParentEODAttendanceNotification(parentId, studentData, date) {
        try {
            // Create summary of attendance
            const presentCount = studentData.filter(s => s.attendanceStatus === 'present').length;
            const absentCount = studentData.filter(s => s.attendanceStatus === 'absent').length;
            const totalStudents = studentData.length;

            let title = 'Daily Attendance Summary';
            let message = `Date: ${new Date(date).toLocaleDateString()}\n\n`;

            if (presentCount === totalStudents) {
                title = '✅ All Children Present Today';
                message += 'Great news! All your children were present today.';
            } else if (absentCount === totalStudents) {
                title = '⚠️ All Children Absent Today';
                message += 'All your children were absent today.';
            } else {
                title = '📊 Mixed Attendance Today';
                message += `Present: ${presentCount}/${totalStudents}\nAbsent: ${absentCount}/${totalStudents}`;
            }

            message += '\n\nStudent Details:\n';
            studentData.forEach(student => {
                const status = student.attendanceStatus === 'present' ? '✅ Present' : '❌ Absent';
                message += `• ${student.student.full_name}: ${status}\n`;
            });

            // Send notification for each student
            for (const student of studentData) {
                const result = await notificationService.sendParentNotification({
                    parentId: parentId,
                    studentId: student.student.id,
                    type: notificationService.notificationTypes.ATTENDANCE,
                    title: title,
                    message: message,
                    data: {
                        date: date,
                        attendance_status: student.attendanceStatus,
                        student_name: student.student.full_name,
                        student_admission_number: student.student.admission_number,
                        summary: {
                            present: presentCount,
                            absent: absentCount,
                            total: totalStudents
                        }
                    },
                    priority: absentCount > 0 ? notificationService.priorityLevels.HIGH : notificationService.priorityLevels.NORMAL,
                    relatedId: null
                });

                console.log(`✅ EOD attendance notification result for parent ${parentId}, student ${student.student.id}:`, result.success ? 'SUCCESS' : 'FAILED');
            }

            return { success: true };

        } catch (error) {
            console.error(`❌ Error sending EOD attendance notification to parent ${parentId}:`, error);
            return { success: false, error };
        }
    }

    /**
     * Send real-time attendance notification when attendance is marked
     */
    async sendRealtimeAttendanceNotification(studentId, attendanceStatus, date, teacherName) {
        try {
            console.log(`📱 Sending real-time attendance notification for student ${studentId}, status: ${attendanceStatus}`);

            // Get parent mappings for this student
            const { data: parentMappings, error } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    parent_id,
                    student_id
                `)
                .eq('student_id', studentId);

            if (error) {
                console.error('❌ Error fetching parent mappings for real-time attendance:', error);
                return;
            }

            console.log(`📊 Found ${parentMappings.length} parents for student ${studentId}`);

            // Get student information
            const { data: student, error: studentError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .eq('id', studentId)
                .single();

            if (studentError) {
                console.error('❌ Error fetching student for real-time attendance:', studentError);
                return;
            }

            // Get student academic record to get class_division_id
            const { data: academicRecord, error: academicError } = await adminSupabase
                .from('student_academic_records')
                .select('student_id, class_division_id')
                .eq('student_id', studentId)
                .eq('status', 'ongoing')
                .single();

            if (academicError) {
                console.error('❌ Error fetching academic record for real-time attendance:', academicError);
                return;
            }

            // Get class division information for this student
            const { data: classDivision, error: classError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    class_level:class_level_id (
                        name
                    )
                `)
                .eq('id', academicRecord.class_division_id)
                .single();

            if (classError) {
                console.error('❌ Error fetching class division for real-time attendance:', classError);
                return;
            }

            const className = classDivision ? `${classDivision.class_level.name} ${classDivision.division}` : 'Unknown Class';

            // Send notification to each parent
            for (const mapping of parentMappings) {
                const statusText = attendanceStatus === 'present' ? 'Present' : 'Absent';
                const emoji = attendanceStatus === 'present' ? '✅' : '❌';

                const result = await notificationService.sendParentNotification({
                    parentId: mapping.parent_id,
                    studentId: studentId,
                    type: notificationService.notificationTypes.ATTENDANCE,
                    title: `${emoji} Attendance Update: ${statusText}`,
                    message: `${student.full_name} was marked ${statusText.toLowerCase()} today.\n\nDate: ${new Date(date).toLocaleDateString()}\nMarked by: ${teacherName}`,
                    data: {
                        date: date,
                        attendance_status: attendanceStatus,
                        student_name: student.full_name,
                        student_admission_number: student.admission_number,
                        student_class: className,
                        marked_by: teacherName,
                        timestamp: new Date().toISOString()
                    },
                    priority: notificationService.priorityLevels.HIGH,
                    relatedId: null
                });

                console.log(`✅ Real-time attendance notification result for parent ${mapping.parent_id}:`, result.success ? 'SUCCESS' : 'FAILED');
            }

        } catch (error) {
            console.error('❌ Error in sendRealtimeAttendanceNotification:', error);
        }
    }
}

export default new AttendanceNotificationService();
