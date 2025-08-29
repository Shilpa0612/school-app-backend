/**
 * Holiday Calendar Integration Examples
 * 
 * This file demonstrates how to use calendar events for holidays
 * in the attendance system.
 */

// Example 1: Create a National Holiday (School-wide)
const nationalHoliday = {
    title: "Independence Day",
    description: "National holiday - school closed for all classes",
    event_date: "2025-08-15T00:00:00Z",
    event_type: "school_wide",
    event_category: "holiday",
    is_single_day: true
};

// Example 2: Create a Class-Specific Holiday
const classSpecificHoliday = {
    title: "Grade 5 Field Trip",
    description: "Grade 5 students on educational field trip - no classes for Grade 5 only",
    event_date: "2025-09-15T00:00:00Z",
    event_type: "class_specific",
    event_category: "holiday",
    class_division_id: "grade-5-a-uuid", // Replace with actual UUID
    is_single_day: true
};

// Example 3: Create a Multi-Class Holiday
const multiClassHoliday = {
    title: "Senior Classes Sports Day",
    description: "Sports day for Grades 9-12 - no regular classes",
    event_date: "2025-10-20T00:00:00Z",
    event_type: "multi_class_specific",
    event_category: "holiday",
    class_division_ids: ["grade-9-a-uuid", "grade-10-a-uuid", "grade-11-a-uuid", "grade-12-a-uuid"],
    is_single_day: true
};

// Example 4: Create an Exam Day (School-wide)
const examDay = {
    title: "Annual Examinations",
    description: "Annual examinations - no regular classes for all students",
    event_date: "2025-03-20T00:00:00Z",
    event_type: "school_wide",
    event_category: "exam",
    is_single_day: true
};

// Example 5: Create a Class-Specific Exam Day
const classExamDay = {
    title: "Grade 10 Board Exams",
    description: "Board examinations for Grade 10 - no regular classes for Grade 10",
    event_date: "2025-02-15T00:00:00Z",
    event_type: "class_specific",
    event_category: "exam",
    class_division_id: "grade-10-a-uuid", // Replace with actual UUID
    is_single_day: true
};

/**
 * API Usage Examples
 */

// 1. Create a holiday event via API
async function createHolidayEvent(eventData) {
    const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
    });

    return await response.json();
}

// 2. Sync calendar events as holidays
async function syncCalendarHolidays(startDate, endDate) {
    const response = await fetch('/api/attendance/sync-calendar-holidays', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            start_date: startDate,
            end_date: endDate
        })
    });

    return await response.json();
}

// 3. Check attendance on a holiday date
async function checkAttendanceOnHoliday(classDivisionId, date) {
    const response = await fetch(`/api/attendance/daily/class/${classDivisionId}?date=${date}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    return await response.json();
}

/**
 * Usage Examples
 */

// Example: Create and sync holidays for a month
async function setupHolidaysForMonth() {
    try {
        // 1. Create national holiday
        const independenceDay = await createHolidayEvent(nationalHoliday);
        console.log('Created Independence Day event:', independenceDay);

        // 2. Create class-specific holiday
        const fieldTrip = await createHolidayEvent(classSpecificHoliday);
        console.log('Created Field Trip event:', fieldTrip);

        // 3. Sync all calendar events as holidays
        const syncResult = await syncCalendarHolidays('2025-08-01', '2025-08-31');
        console.log('Synced holidays:', syncResult);

        // 4. Check attendance on holiday date
        const attendance = await checkAttendanceOnHoliday('grade-5-a-uuid', '2025-08-15');
        console.log('Attendance on Independence Day:', attendance);

    } catch (error) {
        console.error('Error setting up holidays:', error);
    }
}

/**
 * Holiday Detection Logic
 * 
 * The attendance system automatically detects holidays from:
 * 
 * 1. Calendar Events with event_category: "holiday" or "exam"
 * 2. Manual entries in attendance_holidays table
 * 
 * Priority order:
 * 1. School-wide events (affect all classes)
 * 2. Multi-class events (affect specific classes)
 * 3. Class-specific events (affect single class)
 * 4. Manual holiday entries
 */

/**
 * Response Examples
 */

// When fetching attendance on a holiday date:
const holidayAttendanceResponse = {
    "status": "success",
    "data": {
        "daily_attendance": {
            "id": "uuid",
            "attendance_date": "2025-08-15",
            "class_division_id": "uuid",
            "is_holiday": true,
            "holiday_reason": "Independence Day"
        },
        "student_records": [],
        "message": "Holiday: Independence Day"
    }
};

// When syncing calendar holidays:
const syncResponse = {
    "status": "success",
    "data": {
        "date_range": {
            "start_date": "2025-08-01",
            "end_date": "2025-08-31"
        },
        "total_events": 3,
        "synced": 3,
        "synced_holidays": [
            {
                "event_id": "uuid1",
                "holiday_id": "uuid2",
                "status": "created"
            },
            {
                "event_id": "uuid3",
                "holiday_id": "uuid4",
                "status": "created"
            }
        ]
    },
    "message": "Synced 3 calendar events as holidays"
};

module.exports = {
    nationalHoliday,
    classSpecificHoliday,
    multiClassHoliday,
    examDay,
    classExamDay,
    createHolidayEvent,
    syncCalendarHolidays,
    checkAttendanceOnHoliday,
    setupHolidaysForMonth
};
