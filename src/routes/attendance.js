import express from 'express';
import { adminSupabase, supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Helper function to check if user is teacher for a specific class
async function isTeacherForClass(teacherId, classDivisionId) {
    try {
        // Check both legacy teacher_id and new class_teacher_assignments
        const { data: legacyCheck, error: legacyError } = await adminSupabase
            .from('class_divisions')
            .select('id')
            .eq('id', classDivisionId)
            .eq('teacher_id', teacherId)
            .single();

        if (legacyCheck) return true;

        const { data: assignmentCheck, error: assignmentError } = await adminSupabase
            .from('class_teacher_assignments')
            .select('id')
            .eq('class_division_id', classDivisionId)
            .eq('teacher_id', teacherId)
            .eq('is_active', true);

        // Return true if there's at least one assignment (handles multiple assignments)
        return !!(assignmentCheck && assignmentCheck.length > 0);
    } catch (error) {
        logger.error('Error checking teacher class assignment:', error);
        return false;
    }
}

// Helper function to check if user is parent of a specific student
async function isParentOfStudent(parentId, studentId) {
    try {
        const { data, error } = await adminSupabase
            .from('parent_student_mappings')
            .select('id')
            .eq('parent_id', parentId)
            .eq('student_id', studentId)
            .single();

        if (error) return false;
        return !!data;
    } catch (error) {
        logger.error('Error checking parent-student relationship:', error);
        return false;
    }
}

// Helper function to get active academic year
async function getActiveAcademicYear() {
    try {
        const { data, error } = await adminSupabase
            .from('academic_years')
            .select('id, year_name')
            .eq('is_active', true)
            .single();

        if (error) {
            // If no active academic year found, try to get the most recent one
            logger.warn('No active academic year found, trying to get most recent academic year');
            const { data: recentYear, error: recentError } = await adminSupabase
                .from('academic_years')
                .select('id, year_name')
                .order('year_name', { ascending: false })
                .limit(1)
                .single();

            if (recentError) {
                logger.error('No academic years found in database');
                throw new Error('No academic years configured. Please set up an academic year first.');
            }

            logger.info(`Using most recent academic year: ${recentYear.year_name}`);
            return recentYear;
        }

        return data;
    } catch (error) {
        logger.error('Error getting active academic year:', error);
        throw error;
    }
}

// Helper function to check if date is a holiday (from attendance_holidays table)
async function isAttendanceHoliday(date, classDivisionId = null) {
    try {
        // Get the current academic year
        const academicYear = await getActiveAcademicYear();

        let query = adminSupabase
            .from('attendance_holidays')
            .select('*')
            .eq('holiday_date', date)
            .eq('academic_year_id', academicYear.id);

        const { data: holidays, error } = await query;

        if (error) throw error;

        // If any holiday exists for this date and academic year, it's a holiday
        if (holidays && holidays.length > 0) {
            const holiday = holidays[0]; // Take the first holiday found
            return {
                isHoliday: true,
                holiday: holiday,
                type: 'holiday',
                reason: holiday.holiday_reason || holiday.holiday_name
            };
        }

        return { isHoliday: false, holiday: null, type: null };
    } catch (error) {
        logger.error('Error checking attendance holiday:', error);
        return { isHoliday: false, holiday: null, type: null };
    }
}

// Helper function to check if date is a holiday from calendar events
async function isCalendarEventHoliday(date, classDivisionId = null) {
    try {
        // Check for events that are holidays or exams (no regular classes)
        let query = supabase
            .from('calendar_events')
            .select('*')
            .eq('event_date::date', date)
            .in('event_category', ['holiday', 'exam']);

        const { data: events, error } = await query;

        if (error) throw error;

        // Check for school-wide holiday/exam events
        const schoolWideEvent = events.find(e =>
            e.event_type === 'school_wide' &&
            ['holiday', 'exam'].includes(e.event_category)
        );

        if (schoolWideEvent) {
            return {
                isHoliday: true,
                event: schoolWideEvent,
                type: 'school_wide',
                reason: schoolWideEvent.event_category === 'exam' ? 'Exam Day' : 'Holiday'
            };
        }

        // Check for class-specific holiday/exam events
        if (classDivisionId) {
            // Check single class events
            const classSpecificEvent = events.find(e =>
                e.event_type === 'class_specific' &&
                e.class_division_id === classDivisionId &&
                ['holiday', 'exam'].includes(e.event_category)
            );

            if (classSpecificEvent) {
                return {
                    isHoliday: true,
                    event: classSpecificEvent,
                    type: 'class_specific',
                    reason: classSpecificEvent.event_category === 'exam' ? 'Exam Day' : 'Holiday'
                };
            }

            // Check multi-class events
            const multiClassEvent = events.find(e =>
                e.event_type === 'multi_class_specific' &&
                e.class_divisions &&
                e.class_divisions.includes(classDivisionId) &&
                ['holiday', 'exam'].includes(e.event_category)
            );

            if (multiClassEvent) {
                return {
                    isHoliday: true,
                    event: multiClassEvent,
                    type: 'multi_class_specific',
                    reason: multiClassEvent.event_category === 'exam' ? 'Exam Day' : 'Holiday'
                };
            }
        }

        return { isHoliday: false, event: null, type: null, reason: null };
    } catch (error) {
        logger.error('Error checking calendar event holiday:', error);
        return { isHoliday: false, event: null, type: null, reason: null };
    }
}

// Helper function to create or get daily attendance record (simplified - no periods)
async function createOrGetDailyAttendance(classDivisionId, date, teacherId = null) {
    try {
        let academicYear;
        try {
            academicYear = await getActiveAcademicYear();
        } catch (error) {
            // Fallback: get academic year from class division
            logger.warn('Falling back to get academic year from class division');
            const { data: classDivision, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('academic_year:academic_year_id(id, year_name)')
                .eq('id', classDivisionId)
                .single();

            if (classError || !classDivision?.academic_year) {
                throw new Error('Unable to determine academic year for attendance');
            }

            academicYear = classDivision.academic_year;
            logger.info(`Using academic year from class division: ${academicYear.year_name}`);
        }

        // Check if attendance already exists
        const { data: existingAttendance, error: checkError } = await adminSupabase
            .from('daily_attendance')
            .select('id')
            .eq('class_division_id', classDivisionId)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date)
            .single();

        if (existingAttendance) {
            return existingAttendance;
        }

        // Check for holidays
        const attendanceHoliday = await isAttendanceHoliday(date, classDivisionId);
        const calendarHoliday = await isCalendarEventHoliday(date, classDivisionId);

        // If it's a holiday, mark as holiday and return
        if (attendanceHoliday.isHoliday || calendarHoliday.isHoliday) {
            const holiday = attendanceHoliday.holiday || calendarHoliday.event;
            const reason = calendarHoliday.reason ||
                (holiday ? holiday.holiday_name || holiday.title : 'Holiday');

            const { data: holidayAttendance, error: holidayError } = await adminSupabase
                .from('daily_attendance')
                .insert([{
                    class_division_id: classDivisionId,
                    academic_year_id: academicYear.id,
                    attendance_date: date,
                    marked_by: null, // System-generated
                    is_holiday: true,
                    holiday_reason: reason
                }])
                .select()
                .single();

            if (holidayError) throw holidayError;
            return holidayAttendance;
        }

        // Create new daily attendance record
        const { data: dailyAttendance, error: createError } = await adminSupabase
            .from('daily_attendance')
            .insert([{
                class_division_id: classDivisionId,
                academic_year_id: academicYear.id,
                attendance_date: date,
                marked_by: null // Will be updated when teacher marks attendance
            }])
            .select()
            .single();

        if (createError) throw createError;

        // Get all students in the class
        const { data: students, error: studentsError } = await adminSupabase
            .from('student_academic_records')
            .select('student_id')
            .eq('class_division_id', classDivisionId)
            .eq('academic_year_id', academicYear.id)
            .eq('status', 'ongoing');

        if (studentsError) throw studentsError;

        // Create default absent records for all students (only if they don't already exist)
        if (students && students.length > 0) {
            // Only create default records if we have a teacher ID
            if (teacherId) {
                // Check if attendance records already exist for this daily attendance
                const { data: existingRecords, error: checkError } = await adminSupabase
                    .from('student_attendance_records')
                    .select('student_id')
                    .eq('daily_attendance_id', dailyAttendance.id);

                if (checkError) throw checkError;

                // Only create records for students who don't already have attendance records
                const existingStudentIds = existingRecords ? existingRecords.map(r => r.student_id) : [];
                const studentsNeedingRecords = students.filter(student =>
                    !existingStudentIds.includes(student.student_id)
                );

                if (studentsNeedingRecords.length > 0) {
                    const defaultRecords = studentsNeedingRecords.map(student => ({
                        daily_attendance_id: dailyAttendance.id,
                        student_id: student.student_id,
                        status: 'absent',
                        remarks: 'Not marked by teacher - default status',
                        marked_by: teacherId
                    }));

                    const { error: recordsError } = await adminSupabase
                        .from('student_attendance_records')
                        .insert(defaultRecords);

                    if (recordsError) throw recordsError;
                }
            } else {
                logger.warn('No teacher ID provided, skipping default student attendance records creation');
            }
        }

        return dailyAttendance;
    } catch (error) {
        logger.error('Error creating/getting daily attendance:', error);
        throw error;
    }
}

// ============================================================================
// ATTENDANCE PERIODS (Admin/Principal Only)
// ============================================================================

// Get all attendance periods
router.get('/periods', authenticate, async (req, res) => {
    try {
        const { data: periods, error } = await adminSupabase
            .from('attendance_periods')
            .select('*')
            .eq('is_active', true)
            .order('start_time');

        if (error) throw error;

        res.json({
            status: 'success',
            data: { periods }
        });
    } catch (error) {
        logger.error('Error fetching attendance periods:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch attendance periods'
        });
    }
});

// Create new attendance period (Admin/Principal only)
router.post('/periods', authenticate, async (req, res) => {
    try {
        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can create attendance periods'
            });
        }

        const { name, start_time, end_time } = req.body;

        if (!name || !start_time || !end_time) {
            return res.status(400).json({
                status: 'error',
                message: 'Name, start_time, and end_time are required'
            });
        }

        const { data: period, error } = await adminSupabase
            .from('attendance_periods')
            .insert([{ name, start_time, end_time }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            status: 'success',
            data: { period }
        });
    } catch (error) {
        logger.error('Error creating attendance period:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create attendance period'
        });
    }
});

// ============================================================================
// DAILY ATTENDANCE (Teachers, Admin, Principal)
// ============================================================================

// Mark daily attendance for a class (Automated - Teachers only mark present students)
router.post('/daily', authenticate, async (req, res) => {
    try {
        const { class_division_id, attendance_date, present_students } = req.body;

        // Debug logging
        logger.info('Attendance request received:', {
            class_division_id,
            attendance_date,
            present_students_count: present_students?.length || 0,
            user_id: req.user.id,
            user_role: req.user.role
        });

        if (!class_division_id || !attendance_date || !present_students) {
            logger.error('Missing required fields:', {
                class_division_id: !!class_division_id,
                attendance_date: !!attendance_date,
                present_students: !!present_students
            });
            return res.status(400).json({
                status: 'error',
                message: 'class_division_id, attendance_date, and present_students are required'
            });
        }

        // Check if user is teacher for this class
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only mark attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only teachers, admin, and principal can mark attendance'
            });
        }

        // Create or get daily attendance record (automatically handles holidays)
        const dailyAttendance = await createOrGetDailyAttendance(class_division_id, attendance_date, req.user.id);

        // If it's a holiday, return holiday status
        if (dailyAttendance.is_holiday) {
            return res.json({
                status: 'success',
                data: {
                    daily_attendance: dailyAttendance,
                    message: `Holiday: ${dailyAttendance.holiday_reason}`
                }
            });
        }

        // Update marked_by to current user
        await adminSupabase
            .from('daily_attendance')
            .update({ marked_by: req.user.id })
            .eq('id', dailyAttendance.id);

        // If present_students provided, update their status to present
        if (present_students && Array.isArray(present_students) && present_students.length > 0) {
            const updatePromises = present_students.map(async (studentId) => {
                const { error } = await adminSupabase
                    .from('student_attendance_records')
                    .update({
                        status: 'present',
                        remarks: 'Marked present by teacher',
                        marked_by: req.user.id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('daily_attendance_id', dailyAttendance.id)
                    .eq('student_id', studentId);

                if (error) throw error;
            });

            await Promise.all(updatePromises);
        }

        // Get student attendance records
        const { data: studentRecords, error: studentError } = await adminSupabase
            .from('student_attendance_records')
            .select('*')
            .eq('daily_attendance_id', dailyAttendance.id);

        if (studentError) throw studentError;

        // Get student details separately
        let studentDetails = [];
        if (studentRecords && studentRecords.length > 0) {
            const studentIds = studentRecords.map(record => record.student_id);
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .in('id', studentIds);

            if (!studentsError && students) {
                studentDetails = students;
            }
        }

        // Combine student records with student details
        const studentRecordsWithDetails = studentRecords.map(record => {
            const studentDetail = studentDetails.find(student => student.id === record.student_id);
            return {
                ...record,
                student: studentDetail || null
            };
        });

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecordsWithDetails || []
            },
            message: 'Attendance marked successfully'
        });
    } catch (error) {
        logger.error('Error marking daily attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark attendance'
        });
    }
});

// Simplified attendance marking (no periods)
router.post('/simple', authenticate, async (req, res) => {
    try {
        const { class_division_id, attendance_date, student_attendance } = req.body;

        if (!class_division_id || !attendance_date || !student_attendance) {
            return res.status(400).json({
                status: 'error',
                message: 'class_division_id, attendance_date, and student_attendance are required'
            });
        }

        // Validate student_attendance format
        if (!Array.isArray(student_attendance)) {
            return res.status(400).json({
                status: 'error',
                message: 'student_attendance must be an array'
            });
        }

        // Validate status values
        const validStatuses = ['present', 'absent'];
        for (const record of student_attendance) {
            if (!record.student_id || !record.status) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Each record must have student_id and status'
                });
            }
            if (!validStatuses.includes(record.status)) {
                return res.status(400).json({
                    status: 'error',
                    message: `Status must be one of: ${validStatuses.join(', ')}`
                });
            }
        }

        // Check if user is teacher for this class
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only mark attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only teachers, admin, and principal can mark attendance'
            });
        }

        // Create or get daily attendance record (no period)
        const dailyAttendance = await createOrGetDailyAttendance(class_division_id, attendance_date, req.user.id);

        // If it's a holiday, return holiday status
        if (dailyAttendance.is_holiday) {
            return res.json({
                status: 'success',
                data: {
                    daily_attendance: dailyAttendance,
                    message: `Holiday: ${dailyAttendance.holiday_reason}`
                }
            });
        }

        // Update marked_by to current user
        await adminSupabase
            .from('daily_attendance')
            .update({ marked_by: req.user.id })
            .eq('id', dailyAttendance.id);

        // Update student attendance records
        const updatePromises = student_attendance.map(async (record) => {
            const { error } = await adminSupabase
                .from('student_attendance_records')
                .update({
                    status: record.status,
                    remarks: record.remarks || `Marked ${record.status} by teacher`,
                    marked_by: req.user.id,
                    updated_at: new Date().toISOString()
                })
                .eq('daily_attendance_id', dailyAttendance.id)
                .eq('student_id', record.student_id);

            if (error) throw error;
        });

        await Promise.all(updatePromises);

        // Get all student records for this day
        const { data: studentRecords, error: studentError } = await adminSupabase
            .from('student_attendance_records')
            .select('*')
            .eq('daily_attendance_id', dailyAttendance.id);

        if (studentError) throw studentError;

        // Get student details separately
        let studentDetails = [];
        if (studentRecords && studentRecords.length > 0) {
            const studentIds = studentRecords.map(record => record.student_id);
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .in('id', studentIds);

            if (!studentsError && students) {
                studentDetails = students;
            }
        }

        // Combine student records with student details
        const studentRecordsWithDetails = studentRecords.map(record => {
            const studentDetail = studentDetails.find(student => student.id === record.student_id);
            return {
                ...record,
                student: studentDetail || null
            };
        });

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecordsWithDetails || []
            },
            message: 'Attendance marked successfully'
        });
    } catch (error) {
        logger.error('Error marking simplified attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to mark attendance'
        });
    }
});

// Get daily attendance for a class (single date)
router.get('/daily/class/:class_division_id', authenticate, async (req, res) => {
    try {
        const { class_division_id } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                status: 'error',
                message: 'Date parameter is required'
            });
        }

        // Check access permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Build query for daily attendance (simplified - no periods)
        let query = adminSupabase
            .from('daily_attendance')
            .select(`
                *,
                marked_by_user:users!daily_attendance_marked_by_fkey(full_name, role)
            `)
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date);

        // Simplified: No period filtering - just get the attendance for the date
        // All attendance is now "Full Day" by default

        const { data: dailyAttendance, error: dailyError } = await query.single();

        // Debug logging
        logger.info('Fetch attendance query result:', {
            class_division_id,
            date,
            academic_year_id: academicYear.id,
            found_record: !!dailyAttendance,
            error: dailyError?.message
        });

        if (dailyError && dailyError.code !== 'PGRST116') {
            throw dailyError;
        }

        if (!dailyAttendance) {
            return res.json({
                status: 'success',
                data: {
                    daily_attendance: null,
                    student_records: [],
                    message: 'No attendance marked for this date'
                }
            });
        }

        // Get student attendance records
        const { data: studentRecords, error: studentError } = await adminSupabase
            .from('student_attendance_records')
            .select('*')
            .eq('daily_attendance_id', dailyAttendance.id);

        if (studentError) throw studentError;

        // Get student details separately
        let studentDetails = [];
        if (studentRecords && studentRecords.length > 0) {
            const studentIds = studentRecords.map(record => record.student_id);
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .in('id', studentIds);

            if (!studentsError && students) {
                studentDetails = students;
            }
        }

        // Combine student records with student details
        const studentRecordsWithDetails = studentRecords.map(record => {
            const studentDetail = studentDetails.find(student => student.id === record.student_id);
            return {
                ...record,
                student: studentDetail || null
            };
        });

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecordsWithDetails || []
            }
        });
    } catch (error) {
        logger.error('Error fetching daily attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch attendance'
        });
    }
});

// Get daily attendance for a class with date range
router.get('/daily/class/:class_division_id/range', authenticate, async (req, res) => {
    try {
        const { class_division_id } = req.params;
        const { start_date, end_date, period_id } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({
                status: 'error',
                message: 'start_date and end_date parameters are required'
            });
        }

        // Check access permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Build query for daily attendance records
        let query = adminSupabase
            .from('daily_attendance')
            .select(`
                id,
                class_division_id,
                attendance_date,
                is_holiday,
                holiday_reason,
                marked_by,
                created_at,
                updated_at
            `)
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .gte('attendance_date', start_date)
            .lte('attendance_date', end_date)
            .order('attendance_date', { ascending: false });

        if (period_id) {
            query = query.eq('period_id', period_id);
        }

        const { data: dailyAttendanceRecords, error: dailyError } = await query;

        if (dailyError) throw dailyError;

        // Get attendance records for all dates
        const attendanceData = [];
        for (const dailyRecord of dailyAttendanceRecords || []) {
            const { data: studentRecords, error: studentError } = await adminSupabase
                .from('student_attendance_records')
                .select('*')
                .eq('daily_attendance_id', dailyRecord.id);

            if (studentError) throw studentError;

            // Get student details for this day
            let studentDetails = [];
            if (studentRecords && studentRecords.length > 0) {
                const studentIds = studentRecords.map(record => record.student_id);
                const { data: students, error: studentsError } = await adminSupabase
                    .from('students_master')
                    .select('id, full_name, admission_number')
                    .in('id', studentIds);

                if (!studentsError && students) {
                    studentDetails = students;
                }
            }

            // Combine student records with student details
            const studentRecordsWithDetails = studentRecords.map(record => {
                const studentDetail = studentDetails.find(student => student.id === record.student_id);
                return {
                    ...record,
                    student: studentDetail || null
                };
            });

            attendanceData.push({
                daily_attendance: dailyRecord,
                student_records: studentRecordsWithDetails || []
            });
        }

        res.json({
            status: 'success',
            data: {
                class_division_id,
                date_range: { start_date, end_date },
                period_id: period_id || null,
                total_days: attendanceData.length,
                attendance_records: attendanceData
            }
        });
    } catch (error) {
        logger.error('Error getting attendance with date range:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get attendance data'
        });
    }
});

// Simplified attendance fetch (no periods)
router.get('/simple/class/:class_division_id', authenticate, async (req, res) => {
    try {
        const { class_division_id } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                status: 'error',
                message: 'Date parameter is required'
            });
        }

        // Check access permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Get daily attendance (no period filtering)
        const { data: dailyAttendance, error: dailyError } = await adminSupabase
            .from('daily_attendance')
            .select('*')
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date)
            .single();

        if (dailyError && dailyError.code !== 'PGRST116') {
            throw dailyError;
        }

        if (!dailyAttendance) {
            return res.json({
                status: 'success',
                data: {
                    daily_attendance: null,
                    student_records: [],
                    message: 'No attendance marked for this date'
                }
            });
        }

        // Get student attendance records
        const { data: studentRecords, error: studentError } = await adminSupabase
            .from('student_attendance_records')
            .select('*')
            .eq('daily_attendance_id', dailyAttendance.id);

        if (studentError) throw studentError;

        // Get student details separately
        let studentDetails = [];
        if (studentRecords && studentRecords.length > 0) {
            const studentIds = studentRecords.map(record => record.student_id);
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .in('id', studentIds);

            if (!studentsError && students) {
                studentDetails = students;
            }
        }

        // Combine student records with student details
        const studentRecordsWithDetails = studentRecords.map(record => {
            const studentDetail = studentDetails.find(student => student.id === record.student_id);
            return {
                ...record,
                student: studentDetail || null
            };
        });

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecordsWithDetails || []
            }
        });
    } catch (error) {
        logger.error('Error fetching simplified attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch attendance'
        });
    }
});

// Update daily attendance
router.put('/daily/:daily_attendance_id', authenticate, async (req, res) => {
    try {
        const { daily_attendance_id } = req.params;
        const { student_attendance } = req.body;

        if (!student_attendance || !Array.isArray(student_attendance)) {
            return res.status(400).json({
                status: 'error',
                message: 'student_attendance array is required'
            });
        }

        // Get daily attendance to check permissions
        const { data: dailyAttendance, error: fetchError } = await adminSupabase
            .from('daily_attendance')
            .select('class_division_id, marked_by')
            .eq('id', daily_attendance_id)
            .single();

        if (fetchError) throw fetchError;

        // Check permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, dailyAttendance.class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only update attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Update student attendance records
        const updatePromises = student_attendance.map(async (record) => {
            const { error } = await adminSupabase
                .from('student_attendance_records')
                .update({
                    status: record.status,
                    remarks: record.remarks || null,
                    marked_by: req.user.id,
                    updated_at: new Date().toISOString()
                })
                .eq('daily_attendance_id', daily_attendance_id)
                .eq('student_id', record.student_id);

            if (error) throw error;
        });

        await Promise.all(updatePromises);

        // Get updated records
        const { data: updatedRecords, error: getError } = await adminSupabase
            .from('student_attendance_records')
            .select(`
                *,
                student:student_id(full_name, admission_number)
            `)
            .eq('daily_attendance_id', daily_attendance_id)
            .order('student->admission_number');

        if (getError) throw getError;

        res.json({
            status: 'success',
            data: {
                student_records: updatedRecords
            },
            message: 'Attendance updated successfully'
        });
    } catch (error) {
        logger.error('Error updating daily attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update attendance'
        });
    }
});

// Edit individual student attendance record
router.put('/student-record/:record_id', authenticate, async (req, res) => {
    try {
        const { record_id } = req.params;
        const { status, remarks } = req.body;

        if (!status) {
            return res.status(400).json({
                status: 'error',
                message: 'Status is required'
            });
        }

        // Get the attendance record to check permissions
        const { data: record, error: fetchError } = await adminSupabase
            .from('student_attendance_records')
            .select(`
                *,
                daily_attendance!inner(
                    class_division_id,
                    attendance_date
                )
            `)
            .eq('id', record_id)
            .single();

        if (fetchError) throw fetchError;

        // Check permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, record.daily_attendance.class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only edit attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Update the record
        const { data: updatedRecord, error: updateError } = await adminSupabase
            .from('student_attendance_records')
            .update({
                status,
                remarks: remarks || null,
                marked_by: req.user.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', record_id)
            .select(`
                *,
                student:student_id(full_name, admission_number),
                daily_attendance(
                    attendance_date,
                    period:attendance_periods(name)
                )
            `)
            .single();

        if (updateError) throw updateError;

        res.json({
            status: 'success',
            data: {
                record: updatedRecord
            },
            message: 'Attendance record updated successfully'
        });
    } catch (error) {
        logger.error('Error updating student attendance record:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update attendance record'
        });
    }
});

// Edit attendance period (Admin/Principal only)
router.put('/periods/:period_id', authenticate, async (req, res) => {
    try {
        const { period_id } = req.params;
        const { name, start_time, end_time, is_active } = req.body;

        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can edit attendance periods'
            });
        }

        // Update the period
        const { data: period, error } = await adminSupabase
            .from('attendance_periods')
            .update({
                name,
                start_time,
                end_time,
                is_active,
                updated_at: new Date().toISOString()
            })
            .eq('id', period_id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            status: 'success',
            data: { period },
            message: 'Attendance period updated successfully'
        });
    } catch (error) {
        logger.error('Error updating attendance period:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update attendance period'
        });
    }
});

// Edit attendance holiday (Admin/Principal only)
router.put('/holidays/:holiday_id', authenticate, async (req, res) => {
    try {
        const { holiday_id } = req.params;
        const { holiday_date, holiday_name, holiday_type, description, is_attendance_holiday } = req.body;

        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can edit holidays'
            });
        }

        // Update the holiday
        const { data: holiday, error } = await adminSupabase
            .from('attendance_holidays')
            .update({
                holiday_date,
                holiday_name,
                holiday_type,
                description,
                is_attendance_holiday
            })
            .eq('id', holiday_id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            status: 'success',
            data: { holiday },
            message: 'Holiday updated successfully'
        });
    } catch (error) {
        logger.error('Error updating holiday:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to update holiday'
        });
    }
});

// ============================================================================
// DELETE ENDPOINTS
// ============================================================================

// Delete attendance period (Admin/Principal only)
router.delete('/periods/:period_id', authenticate, async (req, res) => {
    try {
        const { period_id } = req.params;

        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can delete attendance periods'
            });
        }

        // Check if period is being used in any attendance records
        const { data: usageCheck, error: checkError } = await adminSupabase
            .from('daily_attendance')
            .select('id')
            .eq('period_id', period_id)
            .limit(1);

        if (checkError) throw checkError;

        if (usageCheck && usageCheck.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot delete period that is being used in attendance records'
            });
        }

        // Delete the period
        const { error } = await adminSupabase
            .from('attendance_periods')
            .delete()
            .eq('id', period_id);

        if (error) throw error;

        res.json({
            status: 'success',
            message: 'Attendance period deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting attendance period:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete attendance period'
        });
    }
});

// Delete attendance holiday (Admin/Principal only)
router.delete('/holidays/:holiday_id', authenticate, async (req, res) => {
    try {
        const { holiday_id } = req.params;

        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can delete holidays'
            });
        }

        // Delete the holiday
        const { error } = await adminSupabase
            .from('attendance_holidays')
            .delete()
            .eq('id', holiday_id);

        if (error) throw error;

        res.json({
            status: 'success',
            message: 'Holiday deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting holiday:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete holiday'
        });
    }
});

// Delete daily attendance (Teachers, Admin, Principal)
router.delete('/daily/:daily_attendance_id', authenticate, async (req, res) => {
    try {
        const { daily_attendance_id } = req.params;

        // Get daily attendance to check permissions
        const { data: dailyAttendance, error: fetchError } = await adminSupabase
            .from('daily_attendance')
            .select('class_division_id, attendance_date')
            .eq('id', daily_attendance_id)
            .single();

        if (fetchError) throw fetchError;

        // Check permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, dailyAttendance.class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only delete attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Delete the daily attendance (cascades to student records)
        const { error } = await adminSupabase
            .from('daily_attendance')
            .delete()
            .eq('id', daily_attendance_id);

        if (error) throw error;

        res.json({
            status: 'success',
            message: 'Daily attendance deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting daily attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to delete daily attendance'
        });
    }
});

// ============================================================================
// STUDENT ATTENDANCE RECORDS (Parents, Teachers, Admin, Principal)
// ============================================================================

// Get student attendance summary
router.get('/student/:student_id/summary', authenticate, async (req, res) => {
    try {
        const { student_id } = req.params;
        const { academic_year_id, start_date, end_date } = req.query;

        // Check permissions
        if (req.user.role === 'parent') {
            const isParent = await isParentOfStudent(req.user.id, student_id);
            if (!isParent) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for your own children'
                });
            }
        } else if (req.user.role === 'teacher') {
            // Teachers can view attendance for students in their classes
            const { data: studentClass, error: classError } = await adminSupabase
                .from('student_academic_records')
                .select('class_division_id')
                .eq('student_id', student_id)
                .eq('status', 'ongoing')
                .single();

            if (classError || !studentClass) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found in any active class'
                });
            }

            const isTeacher = await isTeacherForClass(req.user.id, studentClass.class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for students in your classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get academic year (use active if not specified)
        let academicYearId = academic_year_id;
        if (!academicYearId) {
            const activeYear = await getActiveAcademicYear();
            academicYearId = activeYear.id;
        }

        // Get student details
        const { data: student, error: studentError } = await adminSupabase
            .from('students_master')
            .select('full_name, admission_number')
            .eq('id', student_id)
            .single();

        if (studentError) throw studentError;

        // Get student's class division
        const { data: studentClass, error: classError } = await adminSupabase
            .from('student_academic_records')
            .select('class_division_id')
            .eq('student_id', student_id)
            .eq('status', 'ongoing')
            .single();

        if (classError || !studentClass) {
            return res.status(404).json({
                status: 'error',
                message: 'Student not found in any active class'
            });
        }

        // Build query for daily attendance records
        let query = adminSupabase
            .from('daily_attendance')
            .select(`
                id,
                attendance_date,
                is_holiday,
                holiday_reason
            `)
            .eq('class_division_id', studentClass.class_division_id)
            .eq('academic_year_id', academicYearId);

        if (start_date) {
            query = query.gte('attendance_date', start_date);
        }
        if (end_date) {
            query = query.lte('attendance_date', end_date);
        }

        const { data: dailyAttendance, error: attendanceError } = await query;

        if (attendanceError) throw attendanceError;

        // Get student attendance records
        const attendanceIds = dailyAttendance.map(da => da.id);
        const { data: studentRecords, error: recordsError } = await adminSupabase
            .from('student_attendance_records')
            .select('daily_attendance_id, status')
            .eq('student_id', student_id)
            .in('daily_attendance_id', attendanceIds);

        if (recordsError) throw recordsError;

        // Calculate summary
        const totalDays = dailyAttendance.filter(da => !da.is_holiday).length;
        const presentDays = studentRecords.filter(r => r.status === 'present').length;
        const absentDays = studentRecords.filter(r => r.status === 'absent').length;
        const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

        res.json({
            status: 'success',
            data: {
                student,
                academic_year_id: academicYearId,
                class_division_id: studentClass.class_division_id,
                date_range: {
                    start_date: start_date || 'Not specified',
                    end_date: end_date || 'Not specified'
                },
                summary: {
                    total_days: totalDays,
                    present_days: presentDays,
                    absent_days: absentDays,
                    attendance_percentage: attendancePercentage,
                    holiday_days: dailyAttendance.filter(da => da.is_holiday).length
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching student attendance summary:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch attendance summary'
        });
    }
});

// Get student attendance details (daily records)
router.get('/student/:student_id/details', authenticate, async (req, res) => {
    try {
        const { student_id } = req.params;
        const { academic_year_id, start_date, end_date, page = 1, limit = 30 } = req.query;

        // Check permissions (same as summary endpoint)
        if (req.user.role === 'parent') {
            const isParent = await isParentOfStudent(req.user.id, student_id);
            if (!isParent) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for your own children'
                });
            }
        } else if (req.user.role === 'teacher') {
            const { data: studentClass, error: classError } = await adminSupabase
                .from('student_academic_records')
                .select('class_division_id')
                .eq('student_id', student_id)
                .eq('status', 'ongoing')
                .single();

            if (classError || !studentClass) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Student not found in any active class'
                });
            }

            const isTeacher = await isTeacherForClass(req.user.id, studentClass.class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for students in your classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get academic year
        let academicYearId = academic_year_id;
        if (!academicYearId) {
            const activeYear = await getActiveAcademicYear();
            academicYearId = activeYear.id;
        }

        // Build query
        let query = adminSupabase
            .from('student_attendance_records')
            .select(`
                *,
                daily_attendance!inner(
                    attendance_date,
                    is_holiday,
                    holiday_reason,
                    class_division:class_divisions(
                        division,
                        level:class_levels(name, sequence_number)
                    )
                )
            `)
            .eq('student_id', student_id)
            .eq('daily_attendance.academic_year_id', academicYearId);

        // Add date filters
        if (start_date) {
            query = query.gte('daily_attendance.attendance_date', start_date);
        }
        if (end_date) {
            query = query.lte('daily_attendance.attendance_date', end_date);
        }

        // Add pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        const { data: records, error, count } = await query;

        if (error) throw error;

        // Sort records by date in descending order (newest first)
        const sortedRecords = records ? records.sort((a, b) =>
            new Date(b.daily_attendance.attendance_date) - new Date(a.daily_attendance.attendance_date)
        ) : [];

        // Get student details
        const { data: student, error: studentError } = await adminSupabase
            .from('students_master')
            .select('full_name, admission_number')
            .eq('id', student_id)
            .single();

        if (studentError) throw studentError;

        // Format the response to match the class attendance range format
        const formattedRecords = sortedRecords.map(record => ({
            date: record.daily_attendance.attendance_date,
            status: record.status,
            remarks: record.remarks,
            marked_by: record.marked_by,
            is_holiday: record.daily_attendance.is_holiday,
            holiday_reason: record.daily_attendance.holiday_reason,
            class_name: `${record.daily_attendance.class_division.level.name} ${record.daily_attendance.class_division.division}`,
            created_at: record.created_at,
            updated_at: record.updated_at
        }));

        res.json({
            status: 'success',
            data: {
                student: {
                    id: student_id,
                    full_name: student.full_name,
                    admission_number: student.admission_number
                },
                academic_year_id: academicYearId,
                date_range: {
                    start_date: start_date || 'Not specified',
                    end_date: end_date || 'Not specified'
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                },
                attendance_records: formattedRecords
            }
        });
    } catch (error) {
        logger.error('Error fetching student attendance details:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch attendance details'
        });
    }
});

// ============================================================================
// ATTENDANCE HOLIDAYS (Admin, Principal Only)
// ============================================================================

// Get attendance holidays
router.get('/holidays', authenticate, async (req, res) => {
    try {
        const { year, month, holiday_type } = req.query;

        let query = supabase
            .from('attendance_holidays')
            .select('*')
            .order('holiday_date');

        if (year) {
            query = query.eq('EXTRACT(YEAR FROM holiday_date)', year);
        }
        if (month) {
            query = query.eq('EXTRACT(MONTH FROM holiday_date)', month);
        }
        if (holiday_type) {
            query = query.eq('holiday_type', holiday_type);
        }

        const { data: holidays, error } = await query;

        if (error) throw error;

        res.json({
            status: 'success',
            data: { holidays: holidays || [] }
        });
    } catch (error) {
        logger.error('Error fetching attendance holidays:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch holidays'
        });
    }
});

// Create attendance holiday
router.post('/holidays', authenticate, async (req, res) => {
    try {
        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can create holidays'
            });
        }

        const { holiday_date, holiday_name, holiday_type, description, is_attendance_holiday = true } = req.body;

        if (!holiday_date || !holiday_name || !holiday_type) {
            return res.status(400).json({
                status: 'error',
                message: 'holiday_date, holiday_name, and holiday_type are required'
            });
        }

        const { data: holiday, error } = await adminSupabase
            .from('attendance_holidays')
            .insert([{
                holiday_date,
                holiday_name,
                holiday_type,
                description,
                is_attendance_holiday,
                created_by: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            status: 'success',
            data: { holiday }
        });
    } catch (error) {
        logger.error('Error creating holiday:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create holiday'
        });
    }
});

// ============================================================================
// AUTOMATED ATTENDANCE MANAGEMENT
// ============================================================================

// Create daily attendance for all classes (Admin/Principal only)
router.post('/create-daily', authenticate, async (req, res) => {
    try {
        const { date, period_id } = req.body;

        if (!date) {
            return res.status(400).json({
                status: 'error',
                message: 'Date is required'
            });
        }

        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can create daily attendance for all classes'
            });
        }

        // Get all active class divisions
        const { data: classDivisions, error: classError } = await adminSupabase
            .from('class_divisions')
            .select('id')
            .eq('academic_year_id', (await getActiveAcademicYear()).id);

        if (classError) throw classError;

        const results = [];
        const errors = [];

        // Create attendance for each class
        for (const classDivision of classDivisions) {
            try {
                const dailyAttendance = await createOrGetDailyAttendance(
                    classDivision.id,
                    date,
                    period_id,
                    req.user.id
                );

                results.push({
                    class_division_id: classDivision.id,
                    daily_attendance_id: dailyAttendance.id,
                    is_holiday: dailyAttendance.is_holiday,
                    holiday_reason: dailyAttendance.holiday_reason
                });
            } catch (error) {
                errors.push({
                    class_division_id: classDivision.id,
                    error: error.message
                });
            }
        }

        res.json({
            status: 'success',
            data: {
                date,
                period_id,
                total_classes: classDivisions.length,
                created: results.length,
                errors: errors.length,
                results,
                errors
            },
            message: `Daily attendance created for ${results.length} classes`
        });
    } catch (error) {
        logger.error('Error creating daily attendance for all classes:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create daily attendance'
        });
    }
});

// Sync calendar events as holidays (Admin/Principal only)
router.post('/sync-calendar-holidays', authenticate, async (req, res) => {
    try {
        const { start_date, end_date } = req.body;

        if (!start_date || !end_date) {
            return res.status(400).json({
                status: 'error',
                message: 'start_date and end_date are required'
            });
        }

        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can sync calendar holidays'
            });
        }

        // Get holiday and exam events from calendar
        const { data: holidayEvents, error: eventsError } = await adminSupabase
            .from('calendar_events')
            .select('*')
            .in('event_category', ['holiday', 'exam'])
            .gte('event_date', start_date)
            .lte('event_date', end_date);

        if (eventsError) throw eventsError;

        const syncedHolidays = [];
        const errors = [];

        // Create attendance holidays from calendar events
        for (const event of holidayEvents) {
            try {
                // Check if holiday already exists
                const { data: existingHoliday, error: checkError } = await adminSupabase
                    .from('attendance_holidays')
                    .select('id')
                    .eq('holiday_date', event.event_date.split('T')[0])
                    .single();

                if (existingHoliday) {
                    syncedHolidays.push({
                        event_id: event.id,
                        holiday_id: existingHoliday.id,
                        status: 'already_exists'
                    });
                    continue;
                }

                // Create new holiday
                const { data: holiday, error: createError } = await adminSupabase
                    .from('attendance_holidays')
                    .insert([{
                        holiday_date: event.event_date.split('T')[0],
                        holiday_name: event.title,
                        holiday_type: event.event_category === 'exam' ? 'exam' :
                            (event.event_type === 'school_wide' ? 'school' : 'class_specific'),
                        description: event.description,
                        is_attendance_holiday: true,
                        created_by: req.user.id
                    }])
                    .select()
                    .single();

                if (createError) throw createError;

                syncedHolidays.push({
                    event_id: event.id,
                    holiday_id: holiday.id,
                    status: 'created'
                });
            } catch (error) {
                errors.push({
                    event_id: event.id,
                    error: error.message
                });
            }
        }

        res.json({
            status: 'success',
            data: {
                date_range: { start_date, end_date },
                total_events: holidayEvents.length,
                synced: syncedHolidays.length,
                errors: errors.length,
                synced_holidays: syncedHolidays,
                errors
            },
            message: `Synced ${syncedHolidays.length} calendar events as holidays`
        });
    } catch (error) {
        logger.error('Error syncing calendar holidays:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to sync calendar holidays'
        });
    }
});

// Get attendance status for a class on a specific date
router.get('/status/:class_division_id', authenticate, async (req, res) => {
    try {
        const { class_division_id } = req.params;
        const { date, period_id } = req.query;

        if (!date) {
            return res.status(400).json({
                status: 'error',
                message: 'Date parameter is required'
            });
        }

        // Check permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Create or get daily attendance record
        const dailyAttendance = await createOrGetDailyAttendance(class_division_id, date, req.user.id);

        // Get student records
        const { data: studentRecords, error: studentError } = await adminSupabase
            .from('student_attendance_records')
            .select('*')
            .eq('daily_attendance_id', dailyAttendance.id);

        if (studentError) throw studentError;

        // Get student details separately
        let studentDetails = [];
        if (studentRecords && studentRecords.length > 0) {
            const studentIds = studentRecords.map(record => record.student_id);
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .in('id', studentIds);

            if (!studentsError && students) {
                studentDetails = students;
            }
        }

        // Combine student records with student details
        const studentRecordsWithDetails = studentRecords.map(record => {
            const studentDetail = studentDetails.find(student => student.id === record.student_id);
            return {
                ...record,
                student: studentDetail || null
            };
        });

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecordsWithDetails || [],
                is_holiday: dailyAttendance.is_holiday,
                holiday_reason: dailyAttendance.holiday_reason
            }
        });
    } catch (error) {
        logger.error('Error getting attendance status:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get attendance status'
        });
    }
});

// Debug endpoint to check attendance records
router.get('/debug/attendance/:class_division_id', authenticate, async (req, res) => {
    try {
        const { class_division_id } = req.params;
        const { date } = req.query;

        // Check if user is admin or principal
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admin and principal can access debug endpoints'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Get all attendance records for this class and date
        const { data: allRecords, error: allError } = await adminSupabase
            .from('daily_attendance')
            .select('*')
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date);

        if (allError) throw allError;

        // Get all records for this date (no period filtering needed)
        const { data: allRecordsForDate, error: dateError } = await adminSupabase
            .from('daily_attendance')
            .select('*')
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date);

        if (dateError) throw dateError;

        res.json({
            status: 'success',
            data: {
                class_division_id,
                date,
                academic_year: academicYear,
                all_records: allRecords || [],
                records_for_date: allRecordsForDate || [],
                total_records: allRecords?.length || 0,
                records_for_date_count: allRecordsForDate?.length || 0
            }
        });
    } catch (error) {
        logger.error('Error in debug endpoint:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to debug attendance records',
            error: error.message
        });
    }
});

// Simple test endpoint for fetching attendance (no periods)
router.get('/test/class/:class_division_id', authenticate, async (req, res) => {
    try {
        const { class_division_id } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                status: 'error',
                message: 'Date parameter is required'
            });
        }

        // Check access permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view attendance for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Simple query without period joins
        const { data: dailyAttendance, error: dailyError } = await adminSupabase
            .from('daily_attendance')
            .select('*')
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date)
            .single();

        if (dailyError && dailyError.code !== 'PGRST116') {
            throw dailyError;
        }

        if (!dailyAttendance) {
            return res.json({
                status: 'success',
                data: {
                    daily_attendance: null,
                    student_records: [],
                    message: 'No attendance marked for this date'
                }
            });
        }

        // Get student attendance records
        const { data: studentRecords, error: studentError } = await adminSupabase
            .from('student_attendance_records')
            .select('*')
            .eq('daily_attendance_id', dailyAttendance.id);

        if (studentError) throw studentError;

        // Get student details separately
        let studentDetails = [];
        if (studentRecords && studentRecords.length > 0) {
            const studentIds = studentRecords.map(record => record.student_id);
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, admission_number')
                .in('id', studentIds);

            if (!studentsError && students) {
                studentDetails = students;
            }
        }

        // Combine student records with student details
        const studentRecordsWithDetails = studentRecords.map(record => {
            const studentDetail = studentDetails.find(student => student.id === record.student_id);
            return {
                ...record,
                student: studentDetail || null
            };
        });

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecordsWithDetails || []
            }
        });
    } catch (error) {
        logger.error('Error fetching test attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch attendance',
            error: error.message
        });
    }
});

// Principal endpoints for viewing all class attendance (optimized)
router.get('/principal/all-classes-summary', authenticate, async (req, res) => {
    try {
        // Check if user is principal or admin
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only principal and admin can access this endpoint'
            });
        }

        const { date } = req.query;
        if (!date) {
            return res.status(400).json({
                status: 'error',
                message: 'Date parameter is required'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Get all class divisions in the academic year
        const { data: allClassDivisions, error: classError } = await adminSupabase
            .from('class_divisions')
            .select(`
                id,
                division,
                class_level:class_levels(name, sequence_number)
            `)
            .eq('academic_year_id', academicYear.id);

        if (classError) throw classError;

        // Get attendance records for the specific date
        const { data: classAttendance, error } = await adminSupabase
            .from('daily_attendance')
            .select(`
                id,
                class_division_id,
                attendance_date,
                is_holiday,
                holiday_reason,
                marked_by
            `)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date);

        if (error) throw error;

        // Create a map for quick lookup of class divisions
        const classDivisionMap = {};
        allClassDivisions.forEach(cd => {
            classDivisionMap[cd.id] = cd;
        });

        // Create a map for quick lookup of attendance records
        const attendanceMap = {};
        classAttendance.forEach(attendance => {
            attendanceMap[attendance.class_division_id] = attendance;
        });

        // Process all classes (not just those with attendance)
        const attendanceCounts = await Promise.all(
            allClassDivisions.map(async (classDivision) => {
                const className = `${classDivision.class_level.name} ${classDivision.division}`;
                const attendance = attendanceMap[classDivision.id];

                if (!attendance) {
                    // No attendance record for this class on this date
                    return {
                        class_division_id: classDivision.id,
                        class_name: className,
                        is_holiday: false,
                        attendance_marked: false,
                        total_students: 0,
                        present_count: 0,
                        absent_count: 0,
                        attendance_percentage: 0,
                        marked_by: null
                    };
                }

                if (attendance.is_holiday) {
                    return {
                        class_division_id: classDivision.id,
                        class_name: className,
                        is_holiday: true,
                        attendance_marked: true,
                        holiday_reason: attendance.holiday_reason,
                        total_students: 0,
                        present_count: 0,
                        absent_count: 0,
                        attendance_percentage: 0
                    };
                }

                // Get student attendance records
                const { data: records, error: recordsError } = await adminSupabase
                    .from('student_attendance_records')
                    .select('status')
                    .eq('daily_attendance_id', attendance.id);

                if (recordsError) throw recordsError;

                const total = records.length;
                const present = records.filter(r => r.status === 'present').length;
                const absent = records.filter(r => r.status === 'absent').length;
                const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

                return {
                    class_division_id: classDivision.id,
                    class_name: className,
                    is_holiday: false,
                    attendance_marked: true,
                    total_students: total,
                    present_count: present,
                    absent_count: absent,
                    attendance_percentage: percentage,
                    marked_by: attendance.marked_by
                };
            })
        );

        // Sort by class level sequence and division
        attendanceCounts.sort((a, b) => {
            const classA = classDivisionMap[a.class_division_id];
            const classB = classDivisionMap[b.class_division_id];
            if (!classA || !classB) return 0;

            const seqDiff = classA.class_level.sequence_number - classB.class_level.sequence_number;
            if (seqDiff !== 0) return seqDiff;
            return classA.division.localeCompare(classB.division);
        });

        res.json({
            status: 'success',
            data: {
                date,
                academic_year: academicYear.year_name,
                total_classes: allClassDivisions.length,
                classes_with_attendance: attendanceCounts.filter(c => c.attendance_marked && !c.is_holiday).length,
                classes_without_attendance: attendanceCounts.filter(c => !c.attendance_marked).length,
                holiday_classes: attendanceCounts.filter(c => c.is_holiday).length,
                class_attendance: attendanceCounts
            }
        });
    } catch (error) {
        logger.error('Error fetching principal attendance summary:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch attendance summary'
        });
    }
});

// Principal endpoint for class attendance details (optimized)
router.get('/principal/class/:class_division_id', authenticate, async (req, res) => {
    try {
        // Check if user is principal or admin
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only principal and admin can access this endpoint'
            });
        }

        const { class_division_id } = req.params;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                status: 'error',
                message: 'Date parameter is required'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Get daily attendance with class details
        const { data: dailyAttendance, error: dailyError } = await adminSupabase
            .from('daily_attendance')
            .select(`
                *,
                class_division:class_divisions(
                    division,
                    class_level:class_levels(name, sequence_number)
                )
            `)
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date)
            .single();

        if (dailyError && dailyError.code !== 'PGRST116') {
            throw dailyError;
        }

        if (!dailyAttendance) {
            return res.json({
                status: 'success',
                data: {
                    daily_attendance: null,
                    student_records: [],
                    message: 'No attendance marked for this date'
                }
            });
        }

        // Get student attendance records with student details in one query
        const { data: studentRecords, error: studentError } = await adminSupabase
            .from('student_attendance_records')
            .select(`
                *,
                student:students_master!student_id(id, full_name, admission_number)
            `)
            .eq('daily_attendance_id', dailyAttendance.id)
            .order('student->admission_number');

        if (studentError) throw studentError;

        // Calculate summary
        const total = studentRecords.length;
        const present = studentRecords.filter(r => r.status === 'present').length;
        const absent = studentRecords.filter(r => r.status === 'absent').length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                class_name: `${dailyAttendance.class_division.class_level.name} ${dailyAttendance.class_division.division}`,
                summary: {
                    total_students: total,
                    present_count: present,
                    absent_count: absent,
                    attendance_percentage: percentage
                },
                student_records: studentRecords
            }
        });
    } catch (error) {
        logger.error('Error fetching principal class attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch class attendance'
        });
    }
});

// Principal endpoint for date range attendance (optimized)
router.get('/principal/date-range', authenticate, async (req, res) => {
    try {
        // Check if user is principal or admin
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only principal and admin can access this endpoint'
            });
        }

        const { start_date, end_date, class_division_id } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({
                status: 'error',
                message: 'start_date and end_date parameters are required'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Build query
        let query = adminSupabase
            .from('daily_attendance')
            .select(`
                id,
                class_division_id,
                attendance_date,
                is_holiday,
                holiday_reason,
                class_division:class_divisions(
                    division,
                    class_level:class_levels(name, sequence_number)
                )
            `)
            .eq('academic_year_id', academicYear.id)
            .gte('attendance_date', start_date)
            .lte('attendance_date', end_date)
            .order('attendance_date', { ascending: false });

        if (class_division_id) {
            query = query.eq('class_division_id', class_division_id);
        }

        const { data: attendanceRecords, error } = await query;

        if (error) throw error;

        // Get attendance counts for each record
        const attendanceWithCounts = await Promise.all(
            attendanceRecords.map(async (record) => {
                if (record.is_holiday) {
                    return {
                        ...record,
                        class_name: `${record.class_division.class_level.name} ${record.class_division.division}`,
                        total_students: 0,
                        present_count: 0,
                        absent_count: 0,
                        attendance_percentage: 0
                    };
                }

                const { data: records, error: recordsError } = await adminSupabase
                    .from('student_attendance_records')
                    .select('status')
                    .eq('daily_attendance_id', record.id);

                if (recordsError) throw recordsError;

                const total = records.length;
                const present = records.filter(r => r.status === 'present').length;
                const absent = records.filter(r => r.status === 'absent').length;
                const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

                return {
                    ...record,
                    class_name: `${record.class_division.class_level.name} ${record.class_division.division}`,
                    total_students: total,
                    present_count: present,
                    absent_count: absent,
                    attendance_percentage: percentage
                };
            })
        );

        res.json({
            status: 'success',
            data: {
                start_date,
                end_date,
                academic_year: academicYear.year_name,
                total_records: attendanceRecords.length,
                attendance_records: attendanceWithCounts
            }
        });
    } catch (error) {
        logger.error('Error fetching principal date range attendance:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch date range attendance'
        });
    }
});

// ============================================================================
// ATTENDANCE REPORTS (Teachers, Admin, Principal)
// ============================================================================

// Get class attendance report
router.get('/reports/class/:class_division_id', authenticate, async (req, res) => {
    try {
        const { class_division_id } = req.params;
        const { start_date, end_date, period_id } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({
                status: 'error',
                message: 'start_date and end_date are required'
            });
        }

        // Check permissions
        if (req.user.role === 'teacher') {
            const isTeacher = await isTeacherForClass(req.user.id, class_division_id);
            if (!isTeacher) {
                return res.status(403).json({
                    status: 'error',
                    message: 'You can only view reports for your assigned classes'
                });
            }
        } else if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Get class details
        const { data: classDetails, error: classError } = await adminSupabase
            .from('class_divisions')
            .select(`
                *,
                level:class_levels(name, sequence_number),
                teacher:users(full_name)
            `)
            .eq('id', class_division_id)
            .single();

        if (classError) throw classError;

        // Get students in the class
        const { data: students, error: studentsError } = await adminSupabase
            .from('student_academic_records')
            .select(`
                student:student_id(id, full_name, admission_number),
                roll_number
            `)
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .eq('status', 'ongoing')
            .order('roll_number');

        if (studentsError) throw studentsError;

        // Get attendance data for each student
        const attendanceData = await Promise.all(
            students.map(async (studentRecord) => {
                const { data: summary } = await adminSupabase
                    .rpc('get_student_attendance_summary', {
                        p_student_id: studentRecord.student.id,
                        p_academic_year_id: academicYear.id,
                        p_start_date: start_date,
                        p_end_date: end_date
                    });

                return {
                    student: studentRecord.student,
                    roll_number: studentRecord.roll_number,
                    attendance: summary[0] || {
                        total_days: 0,
                        present_days: 0,
                        absent_days: 0,
                        attendance_percentage: 0
                    }
                };
            })
        );

        res.json({
            status: 'success',
            data: {
                class_details: classDetails,
                academic_year: academicYear,
                date_range: { start_date, end_date },
                students: attendanceData
            }
        });
    } catch (error) {
        logger.error('Error generating class attendance report:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate report'
        });
    }
});

// Teacher attendance summary for all assigned classes
router.get('/teacher/summary', authenticate, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).json({
                status: 'error',
                message: 'start_date and end_date parameters are required'
            });
        }

        // Check if user is a teacher
        if (req.user.role !== 'teacher') {
            return res.status(403).json({
                status: 'error',
                message: 'Only teachers can access this endpoint'
            });
        }

        // Get active academic year
        const academicYear = await getActiveAcademicYear();

        // Get teacher's assigned classes (remove duplicates)
        const { data: teacherClasses, error: classesError } = await adminSupabase
            .from('class_teacher_assignments')
            .select(`
                class_division_id,
                class_division:class_divisions(
                    id,
                    division,
                    class_level:class_levels(name, sequence_number)
                )
            `)
            .eq('teacher_id', req.user.id)
            .eq('is_active', true);

        // Remove duplicate class assignments
        const uniqueClasses = teacherClasses.filter((class1, index, self) =>
            index === self.findIndex(class2 => class2.class_division_id === class1.class_division_id)
        );

        if (!uniqueClasses || uniqueClasses.length === 0) {
            return res.json({
                status: 'success',
                data: {
                    teacher_id: req.user.id,
                    date_range: { start_date, end_date },
                    summary: {
                        total_classes: 0,
                        total_attendance_days: 0,
                        average_attendance_percentage: 0,
                        classes_summary: []
                    }
                }
            });
        }

        // Get attendance data for each class
        const classesSummary = await Promise.all(
            uniqueClasses.map(async (teacherClass) => {
                // Get daily attendance records for this class
                const { data: dailyAttendance, error: attendanceError } = await adminSupabase
                    .from('daily_attendance')
                    .select('id, attendance_date, is_holiday')
                    .eq('class_division_id', teacherClass.class_division_id)
                    .eq('academic_year_id', academicYear.id)
                    .gte('attendance_date', start_date)
                    .lte('attendance_date', end_date)
                    .order('attendance_date');

                if (attendanceError) throw attendanceError;

                // Get daily breakdown for this class
                const dailyBreakdown = [];
                let totalPresent = 0;
                let totalAbsent = 0;
                let totalStudents = 0;

                for (const dailyRecord of dailyAttendance) {
                    if (!dailyRecord.is_holiday) {
                        const { data: studentRecords } = await adminSupabase
                            .from('student_attendance_records')
                            .select('status')
                            .eq('daily_attendance_id', dailyRecord.id);

                        if (studentRecords && studentRecords.length > 0) {
                            const presentCount = studentRecords.filter(r => r.status === 'present').length;
                            const absentCount = studentRecords.filter(r => r.status === 'absent').length;
                            const dayTotal = studentRecords.length;
                            const dayPercentage = dayTotal > 0 ? Math.round((presentCount / dayTotal) * 100) : 0;

                            dailyBreakdown.push({
                                date: dailyRecord.attendance_date,
                                total_students: dayTotal,
                                present_count: presentCount,
                                absent_count: absentCount,
                                attendance_percentage: dayPercentage
                            });

                            totalStudents += dayTotal;
                            totalPresent += presentCount;
                            totalAbsent += absentCount;
                        }
                    } else {
                        // Holiday day
                        dailyBreakdown.push({
                            date: dailyRecord.attendance_date,
                            is_holiday: true,
                            holiday_reason: dailyRecord.holiday_reason || 'Holiday',
                            total_students: 0,
                            present_count: 0,
                            absent_count: 0,
                            attendance_percentage: 0
                        });
                    }
                }

                const totalDays = dailyAttendance.filter(da => !da.is_holiday).length;
                const averageAttendance = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

                return {
                    class_division_id: teacherClass.class_division_id,
                    class_name: `${teacherClass.class_division.class_level.name} ${teacherClass.class_division.division}`,
                    total_days: totalDays,
                    average_attendance: averageAttendance,
                    total_students: totalStudents,
                    total_present: totalPresent,
                    total_absent: totalAbsent,
                    daily_breakdown: dailyBreakdown
                };
            })
        );

        // Calculate overall summary
        const totalClasses = classesSummary.length;
        const totalAttendanceDays = classesSummary.reduce((sum, cls) => sum + cls.total_days, 0);
        const totalStudents = classesSummary.reduce((sum, cls) => sum + cls.total_students, 0);
        const totalPresent = classesSummary.reduce((sum, cls) => sum + cls.total_present, 0);
        const totalAbsent = classesSummary.reduce((sum, cls) => sum + cls.total_absent, 0);
        const averageAttendancePercentage = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

        res.json({
            status: 'success',
            data: {
                teacher_id: req.user.id,
                date_range: { start_date, end_date },
                summary: {
                    total_classes: totalClasses,
                    total_attendance_days: totalAttendanceDays,
                    total_students: totalStudents,
                    total_present: totalPresent,
                    total_absent: totalAbsent,
                    average_attendance_percentage: averageAttendancePercentage,
                    classes_summary: classesSummary
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching teacher attendance summary:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch teacher summary'
        });
    }
});

export default router;
