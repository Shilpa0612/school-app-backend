import express from 'express';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * BIRTHDAYS API ENDPOINTS
 * 
 * Date Range Filtering:
 * - /upcoming now supports custom date ranges via start_date and end_date query parameters
 * - Format: YYYY-MM-DD (e.g., 2024-01-01)
 * - Alternative: Use days_ahead parameter to specify number of days from today
 * - Default behavior: next 7 days if no date parameters provided
 * 
 * Examples:
 * - /upcoming?start_date=2024-01-01&end_date=2024-01-31 (January 2024)
 * - /upcoming?days_ahead=30 (next 30 days)
 * - /upcoming?start_date=2024-12-01&end_date=2024-12-31 (December 2024)
 * - /upcoming (default: next 7 days)
 */

// Get today's birthdays (Admin/Principal/Teacher)
router.get('/today',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const today = new Date();
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const { class_division_id } = req.query; // Add division filter

            // Build query
            let query = adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    date_of_birth,
                    admission_number,
                    status,
                    student_academic_records (
                        class_division:class_division_id (
                            division,
                            level:class_level_id (
                                name,
                                sequence_number
                            )
                        ),
                        roll_number
                    )
                `)
                .eq('status', 'active');

            // Add division filter if provided
            if (class_division_id) {
                query = query.eq('student_academic_records.class_division_id', class_division_id);
            }

            const { data: students, error } = await query.order('full_name');

            if (error) throw error;

            // Filter students with birthdays today and current academic records
            const activeStudents = students.filter(student => {
                // Check if student has current academic records
                const hasAcademicRecords = student.student_academic_records && student.student_academic_records.length > 0;

                // Check if birthday is today
                const studentBirthday = new Date(student.date_of_birth);
                const isBirthdayToday = studentBirthday.getMonth() === today.getMonth() &&
                    studentBirthday.getDate() === today.getDate();

                return hasAcademicRecords && isBirthdayToday;
            });

            // Apply pagination
            const totalCount = activeStudents.length;
            const paginatedStudents = activeStudents.slice(offset, offset + limit);

            res.json({
                status: 'success',
                data: {
                    birthdays: paginatedStudents,
                    count: paginatedStudents.length,
                    total_count: totalCount,
                    date: today.toISOString().split('T')[0],
                    class_division_id: class_division_id || null,
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        total_pages: Math.ceil(totalCount / limit),
                        has_next: page < Math.ceil(totalCount / limit),
                        has_prev: page > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get upcoming birthdays with date range support
router.get('/upcoming',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const today = new Date();
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            const { class_division_id, start_date, end_date, days_ahead } = req.query;
            const upcoming = [];

            // Build query
            let query = adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    date_of_birth,
                    admission_number,
                    status,
                    student_academic_records (
                        class_division:class_division_id (
                            division,
                            level:class_level_id (
                                name,
                                sequence_number
                            )
                        ),
                        roll_number
                    )
                `)
                .eq('status', 'active');

            // Add division filter if provided
            if (class_division_id) {
                query = query.eq('student_academic_records.class_division_id', class_division_id);
            }

            const { data: allStudents, error: allStudentsError } = await query.order('full_name');

            if (allStudentsError) throw allStudentsError;

            let startDate, endDate;

            if (start_date && end_date) {
                // Use custom date range
                startDate = new Date(start_date);
                endDate = new Date(end_date);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid date format. Use YYYY-MM-DD'
                    });
                }

                if (startDate > endDate) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'start_date cannot be after end_date'
                    });
                }
            } else {
                // Use default behavior (next 7 days or custom days_ahead)
                const daysToCheck = parseInt(days_ahead) || 7;
                startDate = new Date(today);
                endDate = new Date(today);
                endDate.setDate(today.getDate() + daysToCheck - 1);
            }

            // Generate all dates in the range
            const datesInRange = [];
            const currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                datesInRange.push(new Date(currentDate));
                currentDate.setDate(currentDate.getDate() + 1);
            }

            // Get birthdays for each date in the range
            for (const date of datesInRange) {
                // Filter students with birthdays on this date and current academic records
                const activeStudents = allStudents.filter(student => {
                    // Check if student has current academic records
                    const hasAcademicRecords = student.student_academic_records && student.student_academic_records.length > 0;

                    // Check if birthday is on this date
                    const studentBirthday = new Date(student.date_of_birth);
                    const isBirthdayOnDate = studentBirthday.getMonth() === date.getMonth() &&
                        studentBirthday.getDate() === date.getDate();

                    return hasAcademicRecords && isBirthdayOnDate;
                });

                if (activeStudents.length > 0) {
                    upcoming.push({
                        date: date.toISOString().split('T')[0],
                        students: activeStudents,
                        count: activeStudents.length
                    });
                }
            }

            // Apply pagination to upcoming birthdays
            const totalUpcoming = upcoming.reduce((sum, day) => sum + day.count, 0);
            const paginatedUpcoming = upcoming.slice(offset, offset + limit);

            res.json({
                status: 'success',
                data: {
                    upcoming_birthdays: paginatedUpcoming,
                    total_count: totalUpcoming,
                    class_division_id: class_division_id || null,
                    date_range: {
                        start_date: startDate.toISOString().split('T')[0],
                        end_date: endDate.toISOString().split('T')[0],
                        total_days: datesInRange.length
                    },
                    pagination: {
                        page,
                        limit,
                        total: upcoming.length,
                        total_pages: Math.ceil(upcoming.length / limit),
                        has_next: page < Math.ceil(upcoming.length / limit),
                        has_prev: page > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get birthday statistics (Admin/Principal only)
router.get('/statistics',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentYear = today.getFullYear();

            // Get birthdays by month for current year
            const monthlyStats = [];

            // Get all active students for processing
            const { data: allStudents, error: allStudentsError } = await adminSupabase
                .from('students_master')
                .select('id, date_of_birth')
                .eq('status', 'active');

            if (allStudentsError) throw allStudentsError;

            // Process monthly statistics
            for (let month = 1; month <= 12; month++) {
                const monthStudents = allStudents.filter(student => {
                    const studentBirthday = new Date(student.date_of_birth);
                    return studentBirthday.getMonth() === month - 1; // getMonth() returns 0-11
                });

                monthlyStats.push({
                    month: month,
                    month_name: new Date(currentYear, month - 1, 1).toLocaleString('default', { month: 'long' }),
                    count: monthStudents.length
                });
            }

            // Get today's count
            const todayStudents = allStudents.filter(student => {
                const studentBirthday = new Date(student.date_of_birth);
                return studentBirthday.getMonth() === today.getMonth() &&
                    studentBirthday.getDate() === today.getDate();
            });

            res.json({
                status: 'success',
                data: {
                    monthly_statistics: monthlyStats,
                    today_count: todayStudents.length,
                    total_active_students: monthlyStats.reduce((sum, month) => sum + month.count, 0)
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get birthdays for a specific class (Teacher only)
router.get('/class/:class_division_id',
    authenticate,
    authorize('teacher'),
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const today = new Date();
            const month = today.getMonth() + 1;
            const day = today.getDate();

            // Verify teacher is assigned to this class (legacy or many-to-many)
            const { data: classData, error: classError } = await adminSupabase
                .from('class_divisions')
                .select('teacher_id')
                .eq('id', class_division_id)
                .single();

            if (classError || !classData) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            let isAssigned = classData.teacher_id === req.user.id;
            if (!isAssigned) {
                const { data: mmAssign } = await adminSupabase
                    .from('class_teacher_assignments')
                    .select('id')
                    .eq('class_division_id', class_division_id)
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle();
                isAssigned = !!mmAssign;
            }

            if (!isAssigned) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Not authorized to access this class'
                });
            }

            // Get students in this class
            const { data: students, error } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    date_of_birth,
                    admission_number,
                    student_academic_records!inner (
                        class_division_id,
                        roll_number
                    )
                `)
                .eq('status', 'active')
                .eq('student_academic_records.class_division_id', class_division_id)
                .order('full_name');

            if (error) throw error;

            // Filter students with birthdays today
            const birthdayStudents = students.filter(student => {
                const studentBirthday = new Date(student.date_of_birth);
                return studentBirthday.getMonth() === today.getMonth() &&
                    studentBirthday.getDate() === today.getDate();
            });

            res.json({
                status: 'success',
                data: {
                    class_birthdays: birthdayStudents,
                    count: birthdayStudents.length,
                    date: today.toISOString().split('T')[0]
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get birthdays for a specific division (Admin/Principal/Teacher)
router.get('/division/:class_division_id',
    authenticate,
    authorize(['admin', 'principal', 'teacher']),
    async (req, res, next) => {
        try {
            const { class_division_id } = req.params;
            const { date, start_date, end_date } = req.query; // Support single date or date range
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            // Validate date parameters
            if (date && (start_date || end_date)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot use both single date and date range parameters. Use either "date" or "start_date" and "end_date"'
                });
            }

            if (start_date && !end_date) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Both start_date and end_date are required for date range filtering'
                });
            }

            if (!start_date && end_date) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Both start_date and end_date are required for date range filtering'
                });
            }

            // Check if class division exists
            const { data: classData, error: classError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    teacher_id,
                    level:class_level_id (
                        name,
                        sequence_number
                    )
                `)
                .eq('id', class_division_id)
                .single();

            if (classError || !classData) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Class division not found'
                });
            }

            // Check authorization for teachers (legacy or many-to-many assignments)
            if (req.user.role === 'teacher') {
                let isAssigned = classData.teacher_id === req.user.id;
                if (!isAssigned) {
                    const { data: mmAssign } = await adminSupabase
                        .from('class_teacher_assignments')
                        .select('id')
                        .eq('class_division_id', class_division_id)
                        .eq('teacher_id', req.user.id)
                        .eq('is_active', true)
                        .limit(1)
                        .maybeSingle();
                    isAssigned = !!mmAssign;
                }

                if (!isAssigned) {
                    return res.status(403).json({
                        status: 'error',
                        message: 'Not authorized to access this class division'
                    });
                }
            }

            // Get students in this class division
            const { data: students, error } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    date_of_birth,
                    admission_number,
                    status,
                    student_academic_records!inner (
                        class_division_id,
                        roll_number
                    )
                `)
                .eq('status', 'active')
                .eq('student_academic_records.class_division_id', class_division_id)
                .order('full_name');

            if (error) throw error;

            let birthdayStudents = [];
            let filterInfo = {};

            if (date) {
                // Single date filtering
                const checkDate = new Date(date);
                if (isNaN(checkDate.getTime())) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid date format. Use YYYY-MM-DD'
                    });
                }

                const month = checkDate.getMonth();
                const day = checkDate.getDate();

                birthdayStudents = students.filter(student => {
                    const studentBirthday = new Date(student.date_of_birth);
                    return studentBirthday.getMonth() === month &&
                        studentBirthday.getDate() === day;
                });

                filterInfo = {
                    type: 'single_date',
                    date: checkDate.toISOString().split('T')[0]
                };
            } else if (start_date && end_date) {
                // Date range filtering
                const startDate = new Date(start_date);
                const endDate = new Date(end_date);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid date format. Use YYYY-MM-DD'
                    });
                }

                if (startDate > endDate) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'start_date cannot be after end_date'
                    });
                }

                birthdayStudents = students.filter(student => {
                    const studentBirthday = new Date(student.date_of_birth);
                    const currentYear = new Date().getFullYear();

                    // Create birthday dates for the current year
                    const birthdayThisYear = new Date(currentYear, studentBirthday.getMonth(), studentBirthday.getDate());
                    const birthdayNextYear = new Date(currentYear + 1, studentBirthday.getMonth(), studentBirthday.getDate());

                    // Check if birthday falls within the range
                    return (birthdayThisYear >= startDate && birthdayThisYear <= endDate) ||
                        (birthdayNextYear >= startDate && birthdayNextYear <= endDate);
                });

                filterInfo = {
                    type: 'date_range',
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                };
            } else {
                // Default to today's birthdays
                const today = new Date();
                const month = today.getMonth();
                const day = today.getDate();

                birthdayStudents = students.filter(student => {
                    const studentBirthday = new Date(student.date_of_birth);
                    return studentBirthday.getMonth() === month &&
                        studentBirthday.getDate() === day;
                });

                filterInfo = {
                    type: 'today',
                    date: today.toISOString().split('T')[0]
                };
            }

            // Apply pagination
            const totalCount = birthdayStudents.length;
            const paginatedStudents = birthdayStudents.slice(offset, offset + limit);

            res.json({
                status: 'success',
                data: {
                    class_division: {
                        id: classData.id,
                        division: classData.division,
                        level: classData.level
                    },
                    birthdays: paginatedStudents,
                    count: paginatedStudents.length,
                    total_count: totalCount,
                    filter: filterInfo,
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        total_pages: Math.ceil(totalCount / limit),
                        has_next: page < Math.ceil(totalCount / limit),
                        has_prev: page > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Get birthdays across all classes assigned to the teacher (class or subject teacher)
router.get('/my-classes',
    authenticate,
    authorize('teacher'),
    async (req, res, next) => {
        try {
            const { date, start_date, end_date } = req.query; // Support single date or date range
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            // Validate date parameters
            if (date && (start_date || end_date)) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Cannot use both single date and date range parameters. Use either "date" or "start_date" and "end_date"'
                });
            }

            if (start_date && !end_date) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Both start_date and end_date are required for date range filtering'
                });
            }

            if (!start_date && end_date) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Both start_date and end_date are required for date range filtering'
                });
            }

            // Collect class divisions where this teacher is assigned (legacy + many-to-many)
            const [{ data: legacyDivisions }, { data: mmAssignments }] = await Promise.all([
                adminSupabase
                    .from('class_divisions')
                    .select('id')
                    .eq('teacher_id', req.user.id),
                adminSupabase
                    .from('class_teacher_assignments')
                    .select('class_division_id')
                    .eq('teacher_id', req.user.id)
                    .eq('is_active', true)
            ]);

            const assignedIds = Array.from(new Set([
                ...(legacyDivisions?.map(d => d.id) || []),
                ...(mmAssignments?.map(a => a.class_division_id) || [])
            ]));

            if (assignedIds.length === 0) {
                let filterInfo = {};
                if (date) {
                    filterInfo = { type: 'single_date', date: date };
                } else if (start_date && end_date) {
                    filterInfo = { type: 'date_range', start_date, end_date };
                } else {
                    filterInfo = { type: 'today', date: new Date().toISOString().split('T')[0] };
                }

                return res.json({
                    status: 'success',
                    data: {
                        birthdays: [],
                        count: 0,
                        total_count: 0,
                        filter: filterInfo,
                        class_division_ids: [],
                        pagination: {
                            page,
                            limit,
                            total: 0,
                            total_pages: 0,
                            has_next: false,
                            has_prev: false
                        }
                    }
                });
            }

            // Fetch students for all assigned divisions
            const { data: students, error } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    date_of_birth,
                    admission_number,
                    status,
                    student_academic_records!inner (
                        class_division:class_division_id (
                            id,
                            division,
                            level:class_level_id (name, sequence_number)
                        ),
                        class_division_id,
                        roll_number
                    )
                `)
                .eq('status', 'active')
                .in('student_academic_records.class_division_id', assignedIds)
                .order('full_name');

            if (error) throw error;

            let birthdayStudents = [];
            let filterInfo = {};

            if (date) {
                // Single date filtering
                const checkDate = new Date(date);
                if (isNaN(checkDate.getTime())) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid date format. Use YYYY-MM-DD'
                    });
                }

                const month = checkDate.getMonth();
                const day = checkDate.getDate();

                birthdayStudents = students.filter(student => {
                    const studentBirthday = new Date(student.date_of_birth);
                    return studentBirthday.getMonth() === month &&
                        studentBirthday.getDate() === day;
                });

                filterInfo = {
                    type: 'single_date',
                    date: checkDate.toISOString().split('T')[0]
                };
            } else if (start_date && end_date) {
                // Date range filtering
                const startDate = new Date(start_date);
                const endDate = new Date(end_date);

                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid date format. Use YYYY-MM-DD'
                    });
                }

                if (startDate > endDate) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'start_date cannot be after end_date'
                    });
                }

                birthdayStudents = students.filter(student => {
                    const studentBirthday = new Date(student.date_of_birth);
                    const currentYear = new Date().getFullYear();

                    // Create birthday dates for the current year
                    const birthdayThisYear = new Date(currentYear, studentBirthday.getMonth(), studentBirthday.getDate());
                    const birthdayNextYear = new Date(currentYear + 1, studentBirthday.getMonth(), studentBirthday.getDate());

                    // Check if birthday falls within the range
                    return (birthdayThisYear >= startDate && birthdayThisYear <= endDate) ||
                        (birthdayNextYear >= startDate && birthdayNextYear <= endDate);
                });

                filterInfo = {
                    type: 'date_range',
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: endDate.toISOString().split('T')[0]
                };
            } else {
                // Default to today's birthdays
                const today = new Date();
                const month = today.getMonth();
                const day = today.getDate();

                birthdayStudents = students.filter(student => {
                    const studentBirthday = new Date(student.date_of_birth);
                    return studentBirthday.getMonth() === month &&
                        studentBirthday.getDate() === day;
                });

                filterInfo = {
                    type: 'today',
                    date: today.toISOString().split('T')[0]
                };
            }

            // Apply pagination
            const totalCount = birthdayStudents.length;
            const paginatedStudents = birthdayStudents.slice(offset, offset + limit);

            res.json({
                status: 'success',
                data: {
                    birthdays: paginatedStudents,
                    count: paginatedStudents.length,
                    total_count: totalCount,
                    filter: filterInfo,
                    class_division_ids: assignedIds,
                    pagination: {
                        page,
                        limit,
                        total: totalCount,
                        total_pages: Math.ceil(totalCount / limit),
                        has_next: page < Math.ceil(totalCount / limit),
                        has_prev: page > 1
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Test endpoint to see all student birthdays (for debugging)
router.get('/debug/all-birthdays',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { data: students, error } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    date_of_birth,
                    admission_number,
                    status,
                    student_academic_records (
                        class_division:class_division_id (
                            division,
                            level:class_level_id (
                                name,
                                sequence_number
                            )
                        ),
                        roll_number
                    )
                `)
                .eq('status', 'active')
                .order('full_name');

            if (error) throw error;

            // Get all students with their birthdays
            const allStudents = students.filter(student => {
                const hasAcademicRecords = student.student_academic_records && student.student_academic_records.length > 0;
                return hasAcademicRecords;
            });

            // Group by month for easier viewing
            const birthdaysByMonth = {};
            allStudents.forEach(student => {
                const birthday = new Date(student.date_of_birth);
                const month = birthday.getMonth() + 1;
                const day = birthday.getDate();

                if (!birthdaysByMonth[month]) {
                    birthdaysByMonth[month] = [];
                }

                birthdaysByMonth[month].push({
                    name: student.full_name,
                    date: student.date_of_birth,
                    day: day,
                    month: month,
                    admission_number: student.admission_number
                });
            });

            // Sort each month by day
            Object.keys(birthdaysByMonth).forEach(month => {
                birthdaysByMonth[month].sort((a, b) => a.day - b.day);
            });

            res.json({
                status: 'success',
                data: {
                    total_students: allStudents.length,
                    birthdays_by_month: birthdaysByMonth,
                    today: new Date().toISOString().split('T')[0]
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Test endpoint to check birthdays for a specific date
router.get('/debug/date/:date',
    authenticate,
    authorize(['admin', 'principal']),
    async (req, res, next) => {
        try {
            const { date } = req.params; // Format: YYYY-MM-DD
            const testDate = new Date(date);

            if (isNaN(testDate.getTime())) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid date format. Use YYYY-MM-DD'
                });
            }

            // First, let's check all students without any filters
            const { data: allStudents, error: allError } = await adminSupabase
                .from('students_master')
                .select('*')
                .order('full_name');

            if (allError) throw allError;

            // Check students with academic records
            const { data: studentsWithRecords, error: recordsError } = await adminSupabase
                .from('students_master')
                .select(`
                    id,
                    full_name,
                    date_of_birth,
                    admission_number,
                    status,
                    student_academic_records (
                        id,
                        roll_number,
                        status,
                        class_division_id
                    )
                `)
                .eq('status', 'active')
                .order('full_name');

            if (recordsError) throw recordsError;

            // Check academic records separately
            const { data: academicRecords, error: acadError } = await adminSupabase
                .from('student_academic_records')
                .select(`
                    id,
                    student_id,
                    roll_number,
                    status,
                    class_division_id
                `);

            if (acadError) throw acadError;

            // Filter students with birthdays on the test date
            const birthdayStudents = studentsWithRecords.filter(student => {
                const hasAcademicRecords = student.student_academic_records && student.student_academic_records.length > 0;
                const studentBirthday = new Date(student.date_of_birth);
                const isBirthdayOnDate = studentBirthday.getMonth() === testDate.getMonth() &&
                    studentBirthday.getDate() === testDate.getDate();

                return hasAcademicRecords && isBirthdayOnDate;
            });

            res.json({
                status: 'success',
                data: {
                    test_date: date,
                    birthday_students: birthdayStudents,
                    count: birthdayStudents.length,
                    all_students_count: allStudents.length,
                    active_students_count: studentsWithRecords.length,
                    students_with_academic_records: studentsWithRecords.filter(s => s.student_academic_records && s.student_academic_records.length > 0).length,
                    total_academic_records: academicRecords.length,
                    debug_info: {
                        all_students: allStudents.map(s => ({
                            id: s.id,
                            name: s.full_name,
                            status: s.status,
                            date_of_birth: s.date_of_birth
                        })),
                        academic_records: academicRecords.map(r => ({
                            id: r.id,
                            student_id: r.student_id,
                            status: r.status
                        }))
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Simple debug endpoint without authorization (for testing)
router.get('/debug/simple',
    async (req, res, next) => {
        try {
            // Check all students without any filters
            const { data: allStudents, error: allError } = await adminSupabase
                .from('students_master')
                .select('*')
                .order('full_name');

            if (allError) throw allError;

            // Check academic records
            const { data: academicRecords, error: acadError } = await adminSupabase
                .from('student_academic_records')
                .select('*');

            if (acadError) throw acadError;

            res.json({
                status: 'success',
                data: {
                    total_students: allStudents.length,
                    total_academic_records: academicRecords.length,
                    students: allStudents.map(s => ({
                        id: s.id,
                        name: s.full_name,
                        status: s.status,
                        date_of_birth: s.date_of_birth,
                        admission_number: s.admission_number
                    })),
                    academic_records: academicRecords.map(r => ({
                        id: r.id,
                        student_id: r.student_id,
                        status: r.status,
                        roll_number: r.roll_number
                    }))
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Direct database test endpoint
router.get('/debug/db-test',
    async (req, res, next) => {
        try {
            // Test 1: Direct students query
            const { data: students, error: studentsError } = await adminSupabase
                .from('students_master')
                .select('id, full_name, status')
                .limit(5);

            // Test 2: Direct academic records query
            const { data: records, error: recordsError } = await adminSupabase
                .from('student_academic_records')
                .select('id, student_id, status')
                .limit(5);

            // Test 3: Count queries
            const { count: studentsCount, error: countError } = await adminSupabase
                .from('students_master')
                .select('*', { count: 'exact', head: true });

            const { count: recordsCount, error: recordsCountError } = await adminSupabase
                .from('student_academic_records')
                .select('*', { count: 'exact', head: true });

            res.json({
                status: 'success',
                data: {
                    students_sample: students || [],
                    records_sample: records || [],
                    students_count: studentsCount || 0,
                    records_count: recordsCount || 0,
                    errors: {
                        students_error: studentsError?.message,
                        records_error: recordsError?.message,
                        count_error: countError?.message,
                        records_count_error: recordsCountError?.message
                    }
                }
            });
        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: error.message,
                stack: error.stack
            });
        }
    }
);

export default router; 