import express from 'express';
import { adminSupabase } from '../config/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

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
                        class_divisions: [],
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

            // Get class division details for all assigned classes (even if no birthdays)
            const { data: classDivisions, error: classDivisionsError } = await adminSupabase
                .from('class_divisions')
                .select(`
                    id,
                    division,
                    level:class_level_id (
                        name,
                        sequence_number
                    )
                `)
                .in('id', assignedIds);

            if (classDivisionsError) {
                logger.error('Error fetching class divisions:', classDivisionsError);
            }

            // Format class divisions for response
            const formattedClassDivisions = (classDivisions || []).map(division => ({
                id: division.id,
                name: division.level ? `${division.level.name} ${division.division}`.trim() : `Class ${division.division}`,
                division: division.division,
                level: division.level?.name || null,
                sequence_number: division.level?.sequence_number || null
            }));

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

            // Enhance the response to include class division details
            const enhancedBirthdays = paginatedStudents.map(student => {
                const academicRecord = student.student_academic_records?.[0];
                const classDivision = academicRecord?.class_division;

                return {
                    id: student.id,
                    full_name: student.full_name,
                    date_of_birth: student.date_of_birth,
                    admission_number: student.admission_number,
                    roll_number: academicRecord?.roll_number,
                    class_division: {
                        id: classDivision?.id || null,
                        name: classDivision ? `${classDivision.level?.name || 'Unknown'} ${classDivision.division || ''}`.trim() : 'Unknown',
                        division: classDivision?.division || null,
                        level: classDivision?.level?.name || null,
                        sequence_number: classDivision?.level?.sequence_number || null
                    }
                };
            });

            res.json({
                status: 'success',
                data: {
                    birthdays: enhancedBirthdays,
                    count: enhancedBirthdays.length,
                    total_count: totalCount,
                    filter: filterInfo,
                    class_division_ids: assignedIds,
                    class_divisions: formattedClassDivisions, // Use formatted class divisions (always populated)
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

// Get birthdays for parents (teachers and classmates)
router.get('/parent-view',
    authenticate,
    authorize('parent'),
    async (req, res, next) => {
        try {
            const parentId = req.user.id;

            // Date range filtering (default: next 30 days)
            const { days_ahead = 30, specific_date } = req.query;
            const today = new Date();
            const endDate = new Date();
            endDate.setDate(today.getDate() + parseInt(days_ahead));

            // If specific date is provided, use that instead
            let targetDate = null;
            if (specific_date) {
                targetDate = new Date(specific_date);
                if (isNaN(targetDate.getTime())) {
                    return res.status(400).json({
                        status: 'error',
                        message: 'Invalid specific_date format. Use YYYY-MM-DD'
                    });
                }
            }

            // Optimized query with date filtering at database level
            let childrenQuery = adminSupabase
                .from('parent_student_mappings')
                .select(`
                    students:students_master!inner (
                        id,
                        full_name,
                        date_of_birth,
                        student_academic_records!inner (
                            class_division_id,
                            roll_number,
                            status,
                            class_division:class_division_id (
                                id,
                                division,
                                level:class_level_id (name),
                                class_teacher_assignments!inner (
                                    id,
                                    assignment_type,
                                    subject,
                                    is_primary,
                                    is_active,
                                    teacher:teacher_id (
                                        id,
                                        full_name
                                    )
                                )
                            )
                        )
                    )
                `)
                .eq('parent_id', parentId)
                .eq('students.student_academic_records.status', 'ongoing');

            // For now, let's fetch all children data and filter in JavaScript
            // This is more reliable for birthday date range logic
            // We can optimize this later with better database queries

            const { data: childrenData, error: childrenError } = await childrenQuery;

            if (childrenError) {
                throw childrenError;
            }

            // Get staff information for teachers separately
            const teacherIds = new Set();
            (childrenData || []).forEach(mapping => {
                const student = mapping.students;
                const academicRecord = student.student_academic_records[0];
                if (academicRecord && academicRecord.class_division && academicRecord.class_division.class_teacher_assignments) {
                    academicRecord.class_division.class_teacher_assignments.forEach(assignment => {
                        if (assignment.teacher) {
                            teacherIds.add(assignment.teacher.id);
                        }
                    });
                }
            });

            // Fetch staff information for all teachers with date filtering
            let staffQuery = adminSupabase
                .from('staff')
                .select(`
                    id,
                    full_name,
                    date_of_birth,
                    user_id
                `)
                .in('user_id', Array.from(teacherIds));

            // For now, fetch all staff data and filter in JavaScript
            // This is more reliable for birthday date range logic

            const { data: staffData, error: staffError } = await staffQuery;

            if (staffError) {
                throw staffError;
            }

            // Create a map of user_id to staff data
            const staffMap = new Map();
            (staffData || []).forEach(staff => {
                if (staff.user_id) {
                    staffMap.set(staff.user_id, staff);
                }
            });

            // Process the data to organize birthdays
            const birthdays = {
                teachers: [],
                classmates: [],
                summary: {
                    total_teachers: 0,
                    total_classmates: 0,
                    upcoming_birthdays: 0
                }
            };

            const teacherMap = new Map();
            const classmateMap = new Map();
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentDay = currentDate.getDate();

            // For date range filtering, we need to process ALL children to get their classmates
            // but only include children and classmates that meet the date criteria
            let childrenToProcess = childrenData || [];

            // Process each child's data
            childrenToProcess.forEach(mapping => {
                const student = mapping.students;
                const academicRecord = student.student_academic_records[0];

                if (!academicRecord || !academicRecord.class_division) return;

                const classDivision = academicRecord.class_division;
                const childInfo = {
                    student_id: student.id,
                    student_name: student.full_name,
                    class_division: `${classDivision.level.name} ${classDivision.division}`
                };

                // Process all children to get their classmates
                // We'll filter the results later

                // Process teachers for this class
                (classDivision.class_teacher_assignments || []).forEach(assignment => {
                    if (!assignment.is_active || !assignment.teacher) return;

                    const teacher = assignment.teacher;
                    const teacherKey = teacher.id;

                    if (!teacherMap.has(teacherKey)) {
                        // Get staff info for birthday data
                        const staffInfo = staffMap.get(teacher.id) || null;
                        const teacherBirthday = staffInfo && staffInfo.date_of_birth ? new Date(staffInfo.date_of_birth) : null;
                        const daysUntilBirthday = teacherBirthday ? getDaysUntilBirthday(teacherBirthday) : null;
                        const isUpcoming = daysUntilBirthday !== null && daysUntilBirthday <= parseInt(days_ahead);

                        teacherMap.set(teacherKey, {
                            teacher_id: teacher.id,
                            full_name: teacher.full_name,
                            date_of_birth: staffInfo ? staffInfo.date_of_birth : null,
                            assignments: [],
                            days_until_birthday: daysUntilBirthday,
                            is_upcoming: isUpcoming
                        });
                    }

                    const teacherData = teacherMap.get(teacherKey);
                    teacherData.assignments.push({
                        subject: assignment.subject,
                        is_class_teacher: assignment.is_primary
                    });
                    // No need to track children taught for simplified response
                });

                // Get classmates for this child
                getClassmatesForStudent(student.id, classDivision.id, childInfo);
            });

            // Get classmates for all children with date filtering
            async function getClassmatesForStudent(studentId, classDivisionId, childInfo) {
                let classmatesQuery = adminSupabase
                    .from('student_academic_records')
                    .select(`
                        student_id,
                        roll_number,
                        students:students_master!inner (
                            id,
                            full_name,
                            date_of_birth
                        )
                    `)
                    .eq('class_division_id', classDivisionId)
                    .eq('status', 'ongoing')
                    .neq('student_id', studentId); // Exclude the child themselves

                // For now, fetch all classmates and filter in JavaScript
                // This is more reliable for birthday date range logic

                const { data: classmates, error: classmatesError } = await classmatesQuery;

                if (!classmatesError && classmates) {
                    classmates.forEach(classmate => {
                        const classmateStudent = classmate.students;
                        const classmateKey = classmateStudent.id;

                        if (!classmateMap.has(classmateKey)) {
                            const classmateBirthday = classmateStudent.date_of_birth ? new Date(classmateStudent.date_of_birth) : null;
                            const daysUntilBirthday = classmateBirthday ? getDaysUntilBirthday(classmateBirthday) : null;
                            const isUpcoming = daysUntilBirthday !== null && daysUntilBirthday <= parseInt(days_ahead);

                            classmateMap.set(classmateKey, {
                                student_id: classmateStudent.id,
                                full_name: classmateStudent.full_name,
                                date_of_birth: classmateStudent.date_of_birth,
                                class_division: childInfo.class_division,
                                days_until_birthday: daysUntilBirthday,
                                is_upcoming: isUpcoming
                            });
                        }
                    });
                }
            }

            // Wait for all classmate queries to complete (for all children to get their classmates)
            await Promise.all(
                childrenToProcess.map(mapping => {
                    const student = mapping.students;
                    const academicRecord = student.student_academic_records[0];
                    if (!academicRecord || !academicRecord.class_division) return Promise.resolve();

                    const childInfo = {
                        student_id: student.id,
                        student_name: student.full_name,
                        class_division: `${academicRecord.class_division.level.name} ${academicRecord.class_division.division}`
                    };

                    return getClassmatesForStudent(student.id, academicRecord.class_division.id, childInfo);
                })
            );

            // Convert maps to arrays and apply final filtering
            let allTeachers = Array.from(teacherMap.values());
            let allClassmates = Array.from(classmateMap.values());

            // Apply date filtering if not specific date
            if (!targetDate) {
                allTeachers = allTeachers.filter(teacher => teacher.is_upcoming);
                allClassmates = allClassmates.filter(classmate => classmate.is_upcoming);
            }

            // Sort by upcoming birthdays
            birthdays.teachers = allTeachers.sort((a, b) => {
                if (a.is_upcoming && !b.is_upcoming) return -1;
                if (!a.is_upcoming && b.is_upcoming) return 1;
                return (a.days_until_birthday || 999) - (b.days_until_birthday || 999);
            });

            birthdays.classmates = allClassmates.sort((a, b) => {
                if (a.is_upcoming && !b.is_upcoming) return -1;
                if (!a.is_upcoming && b.is_upcoming) return 1;
                return (a.days_until_birthday || 999) - (b.days_until_birthday || 999);
            });

            // Calculate summary
            birthdays.summary = {
                total_teachers: birthdays.teachers.length,
                total_classmates: birthdays.classmates.length,
                upcoming_birthdays: birthdays.teachers.filter(t => t.is_upcoming).length +
                    birthdays.classmates.filter(c => c.is_upcoming).length,
                teachers_upcoming: birthdays.teachers.filter(t => t.is_upcoming).length,
                classmates_upcoming: birthdays.classmates.filter(c => c.is_upcoming).length,
                date_range: {
                    days_ahead: parseInt(days_ahead),
                    specific_date: specific_date || null,
                    filter_applied: targetDate ? 'specific_date' : 'date_range'
                }
            };

            res.json({
                status: 'success',
                data: birthdays
            });

        } catch (error) {
            console.error('Error in parent birthdays endpoint:', error);
            next(error);
        }
    }
);

// Helper function to calculate days until birthday
function getDaysUntilBirthday(birthday) {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Create birthday for current year
    const birthdayThisYear = new Date(birthday);
    birthdayThisYear.setFullYear(currentYear);

    // If birthday has passed this year, calculate for next year
    if (birthdayThisYear < today) {
        birthdayThisYear.setFullYear(currentYear + 1);
    }

    const timeDiff = birthdayThisYear.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
}

// Debug endpoint for teacher class assignments
router.get('/debug/teacher-assignments',
    authenticate,
    authorize('teacher'),
    async (req, res, next) => {
        try {
            const teacherId = req.user.id;

            // Check legacy class assignments
            const { data: legacyDivisions, error: legacyError } = await adminSupabase
                .from('class_divisions')
                .select('id, division, class_level:class_level_id(name)')
                .eq('teacher_id', teacherId);

            if (legacyError) {
                logger.error('Error checking legacy divisions:', legacyError);
            }

            // Check many-to-many assignments
            const { data: mmAssignments, error: mmError } = await adminSupabase
                .from('class_teacher_assignments')
                .select(`
                    class_division_id,
                    assignment_type,
                    subject,
                    is_primary,
                    is_active,
                    class_division:class_division_id(
                        id,
                        division,
                        class_level:class_level_id(name)
                    )
                `)
                .eq('teacher_id', teacherId)
                .eq('is_active', true);

            if (mmError) {
                logger.error('Error checking many-to-many assignments:', mmError);
            }

            // Get all unique assigned class IDs
            const assignedIds = Array.from(new Set([
                ...(legacyDivisions?.map(d => d.id) || []),
                ...(mmAssignments?.map(a => a.class_division_id) || [])
            ]));

            res.json({
                status: 'success',
                data: {
                    teacher_id: teacherId,
                    teacher_name: req.user.full_name,
                    legacy_assignments: legacyDivisions || [],
                    many_to_many_assignments: mmAssignments || [],
                    total_assigned_classes: assignedIds.length,
                    assigned_class_ids: assignedIds,
                    debug_info: {
                        legacy_count: legacyDivisions?.length || 0,
                        mm_count: mmAssignments?.length || 0,
                        has_assignments: assignedIds.length > 0
                    }
                }
            });

        } catch (error) {
            logger.error('Error in debug teacher assignments:', error);
            next(error);
        }
    }
);

export default router; 