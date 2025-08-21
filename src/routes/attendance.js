import express from 'express';
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
            .eq('is_active', true)
            .single();

        return !!assignmentCheck;
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

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Error getting active academic year:', error);
        throw error;
    }
}

// Helper function to check if date is a holiday (from attendance_holidays table)
async function isAttendanceHoliday(date, classDivisionId = null) {
    try {
        let query = adminSupabase
            .from('attendance_holidays')
            .select('*')
            .eq('holiday_date', date)
            .eq('is_attendance_holiday', true);

        const { data: holidays, error } = await query;

        if (error) throw error;

        // Check for school-wide holidays
        const schoolWideHoliday = holidays.find(h =>
            h.holiday_type === 'national' ||
            h.holiday_type === 'state' ||
            h.holiday_type === 'school'
        );

        if (schoolWideHoliday) {
            return { isHoliday: true, holiday: schoolWideHoliday, type: 'school_wide' };
        }

        // Check for class-specific holidays (if classDivisionId provided)
        if (classDivisionId) {
            const classSpecificHoliday = holidays.find(h =>
                h.holiday_type === 'class_specific' &&
                h.class_division_id === classDivisionId
            );

            if (classSpecificHoliday) {
                return { isHoliday: true, holiday: classSpecificHoliday, type: 'class_specific' };
            }
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
        // Check for school-wide events that are holidays
        let query = supabase
            .from('calendar_events')
            .select('*')
            .eq('event_date::date', date)
            .eq('event_category', 'holiday');

        const { data: events, error } = await query;

        if (error) throw error;

        // Check for school-wide holiday events
        const schoolWideHoliday = events.find(e =>
            e.event_type === 'school_wide' &&
            e.event_category === 'holiday'
        );

        if (schoolWideHoliday) {
            return { isHoliday: true, event: schoolWideHoliday, type: 'school_wide' };
        }

        // Check for class-specific holiday events
        if (classDivisionId) {
            const classSpecificHoliday = events.find(e =>
                e.event_type === 'class_specific' &&
                e.class_division_id === classDivisionId &&
                e.event_category === 'holiday'
            );

            if (classSpecificHoliday) {
                return { isHoliday: true, event: classSpecificHoliday, type: 'class_specific' };
            }
        }

        return { isHoliday: false, event: null, type: null };
    } catch (error) {
        logger.error('Error checking calendar event holiday:', error);
        return { isHoliday: false, event: null, type: null };
    }
}

// Helper function to create or get daily attendance record
async function createOrGetDailyAttendance(classDivisionId, date, periodId = null) {
    try {
        const academicYear = await getActiveAcademicYear();

        // Check if attendance already exists
        const { data: existingAttendance, error: checkError } = await supabase
            .from('daily_attendance')
            .select('id')
            .eq('class_division_id', classDivisionId)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date)
            .eq('period_id', periodId)
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
            const { data: holidayAttendance, error: holidayError } = await supabase
                .from('daily_attendance')
                .insert([{
                    class_division_id: classDivisionId,
                    academic_year_id: academicYear.id,
                    attendance_date: date,
                    period_id: periodId,
                    marked_by: null, // System-generated
                    is_holiday: true,
                    holiday_reason: holiday ? holiday.holiday_name || holiday.title : 'Holiday'
                }])
                .select()
                .single();

            if (holidayError) throw holidayError;
            return holidayAttendance;
        }

        // Create new daily attendance record
        const { data: dailyAttendance, error: createError } = await supabase
            .from('daily_attendance')
            .insert([{
                class_division_id: classDivisionId,
                academic_year_id: academicYear.id,
                attendance_date: date,
                period_id: periodId,
                marked_by: null // Will be updated when teacher marks attendance
            }])
            .select()
            .single();

        if (createError) throw createError;

        // Get all students in the class
        const { data: students, error: studentsError } = await supabase
            .from('student_academic_records')
            .select('student_id')
            .eq('class_division_id', classDivisionId)
            .eq('academic_year_id', academicYear.id)
            .eq('status', 'ongoing');

        if (studentsError) throw studentsError;

        // Create default absent records for all students
        if (students && students.length > 0) {
            const defaultRecords = students.map(student => ({
                daily_attendance_id: dailyAttendance.id,
                student_id: student.student_id,
                status: 'absent',
                remarks: 'Not marked by teacher',
                marked_by: null
            }));

            const { error: recordsError } = await supabase
                .from('student_attendance_records')
                .insert(defaultRecords);

            if (recordsError) throw recordsError;
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
        const { data: periods, error } = await supabase
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

        const { data: period, error } = await supabase
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
        const { class_division_id, attendance_date, period_id, present_students } = req.body;

        if (!class_division_id || !attendance_date) {
            return res.status(400).json({
                status: 'error',
                message: 'class_division_id and attendance_date are required'
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
        const dailyAttendance = await createOrGetDailyAttendance(class_division_id, attendance_date, period_id);

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
        await supabase
            .from('daily_attendance')
            .update({ marked_by: req.user.id })
            .eq('id', dailyAttendance.id);

        // If present_students provided, update their status to present
        if (present_students && Array.isArray(present_students) && present_students.length > 0) {
            const updatePromises = present_students.map(async (studentId) => {
                const { error } = await supabase
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

        // Get all student records for this day
        const { data: studentRecords, error: studentError } = await supabase
            .from('student_attendance_records')
            .select(`
                *,
                student:students_master(full_name, admission_number)
            `)
            .eq('daily_attendance_id', dailyAttendance.id)
            .order('student->admission_number');

        if (studentError) throw studentError;

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecords
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

// Get daily attendance for a class
router.get('/daily/class/:class_division_id', authenticate, async (req, res) => {
    try {
        const { class_division_id } = req.params;
        const { date, period_id } = req.query;

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

        // Get daily attendance
        const { data: dailyAttendance, error: dailyError } = await supabase
            .from('daily_attendance')
            .select(`
                *,
                period:attendance_periods(name, start_time, end_time),
                marked_by_user:users!daily_attendance_marked_by_fkey(full_name, role)
            `)
            .eq('class_division_id', class_division_id)
            .eq('academic_year_id', academicYear.id)
            .eq('attendance_date', date)
            .eq('period_id', period_id)
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
        const { data: studentRecords, error: studentError } = await supabase
            .from('student_attendance_records')
            .select(`
                *,
                student:students_master(full_name, admission_number, id)
            `)
            .eq('daily_attendance_id', dailyAttendance.id)
            .order('student->admission_number');

        if (studentError) throw studentError;

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecords
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
        const { data: dailyAttendance, error: fetchError } = await supabase
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
            const { error } = await supabase
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
        const { data: updatedRecords, error: getError } = await supabase
            .from('student_attendance_records')
            .select(`
                *,
                student:students_master(full_name, admission_number)
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
        const { data: record, error: fetchError } = await supabase
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
        const { data: updatedRecord, error: updateError } = await supabase
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
                student:students_master(full_name, admission_number),
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
        const { data: period, error } = await supabase
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
        const { data: holiday, error } = await supabase
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
        const { data: usageCheck, error: checkError } = await supabase
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
        const { error } = await supabase
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
        const { error } = await supabase
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
        const { data: dailyAttendance, error: fetchError } = await supabase
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
        const { error } = await supabase
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
            const { data: studentClass, error: classError } = await supabase
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

        // Call the database function to get attendance summary
        const { data: summary, error } = await supabase
            .rpc('get_student_attendance_summary', {
                p_student_id: student_id,
                p_academic_year_id: academicYearId,
                p_start_date: start_date,
                p_end_date: end_date
            });

        if (error) throw error;

        // Get student details
        const { data: student, error: studentError } = await supabase
            .from('students_master')
            .select('full_name, admission_number')
            .eq('id', student_id)
            .single();

        if (studentError) throw studentError;

        res.json({
            status: 'success',
            data: {
                student,
                academic_year_id: academicYearId,
                summary: summary[0] || {
                    total_days: 0,
                    present_days: 0,
                    absent_days: 0,
                    late_days: 0,
                    half_days: 0,
                    excused_days: 0,
                    attendance_percentage: 0
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
            const { data: studentClass, error: classError } = await supabase
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
        let query = supabase
            .from('student_attendance_records')
            .select(`
                *,
                daily_attendance!inner(
                    attendance_date,
                    period:attendance_periods(name, start_time, end_time),
                    class_division:class_divisions(
                        division,
                        level:class_levels(name, sequence_number)
                    )
                )
            `)
            .eq('student_id', student_id)
            .eq('daily_attendance.academic_year_id', academicYearId)
            .order('daily_attendance.attendance_date', { ascending: false });

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

        res.json({
            status: 'success',
            data: {
                student_id,
                academic_year_id: academicYearId,
                records: records || [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0
                }
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

        const { data: holiday, error } = await supabase
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
        const { data: classDivisions, error: classError } = await supabase
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
                    period_id
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

        // Get holiday events from calendar
        const { data: holidayEvents, error: eventsError } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('event_category', 'holiday')
            .gte('event_date', start_date)
            .lte('event_date', end_date);

        if (eventsError) throw eventsError;

        const syncedHolidays = [];
        const errors = [];

        // Create attendance holidays from calendar events
        for (const event of holidayEvents) {
            try {
                // Check if holiday already exists
                const { data: existingHoliday, error: checkError } = await supabase
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
                const { data: holiday, error: createError } = await supabase
                    .from('attendance_holidays')
                    .insert([{
                        holiday_date: event.event_date.split('T')[0],
                        holiday_name: event.title,
                        holiday_type: event.event_type === 'school_wide' ? 'school' : 'class_specific',
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
        const dailyAttendance = await createOrGetDailyAttendance(class_division_id, date, period_id);

        // Get student records
        const { data: studentRecords, error: studentError } = await supabase
            .from('student_attendance_records')
            .select(`
                *,
                student:students_master(full_name, admission_number)
            `)
            .eq('daily_attendance_id', dailyAttendance.id)
            .order('student->admission_number');

        if (studentError) throw studentError;

        res.json({
            status: 'success',
            data: {
                daily_attendance: dailyAttendance,
                student_records: studentRecords,
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
        const { data: classDetails, error: classError } = await supabase
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
        const { data: students, error: studentsError } = await supabase
            .from('student_academic_records')
            .select(`
                student:students_master(id, full_name, admission_number),
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
                const { data: summary } = await supabase
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
                        late_days: 0,
                        half_days: 0,
                        excused_days: 0,
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

export default router;
