# Attendance System Endpoints Guide

## 🎯 **Simplified Attendance Endpoints (Recommended)**

### **Mark Attendance:**

```http
POST /api/attendance/daily
{
  "class_division_id": "uuid",
  "attendance_date": "2025-08-28",
  "present_students": ["student_id1", "student_id2"]
}
```

**Purpose:** Mark attendance for a class using present students array
**Optimization:** ✅ Lightweight, single query for updates

### **Fetch Attendance:**

```http
GET /api/attendance/daily/class/:class_division_id?date=2025-08-28
```

**Purpose:** Get attendance for a specific class and date
**Optimization:** ✅ Optimized queries with student details included in student_records

**Response Format:**

```json
{
  "status": "success",
  "data": {
    "daily_attendance": {
      "id": "uuid",
      "attendance_date": "2025-08-28",
      "class_division_id": "uuid",
      "marked_by": "uuid"
    },
    "student_records": [
      {
        "id": "uuid",
        "student_id": "uuid",
        "status": "present|absent",
        "remarks": "Optional remarks",
        "student": {
          "id": "uuid",
          "full_name": "Student Name",
          "admission_number": "2025001"
        }
      }
    ]
  }
}
```

### **Simple Mark Attendance:**

```http
POST /api/attendance/simple
{
  "class_division_id": "uuid",
  "attendance_date": "2025-08-28",
  "student_attendance": [
    {
      "student_id": "uuid",
      "status": "present|absent",
      "remarks": "Optional remarks"
    }
  ]
}
```

**Purpose:** Mark attendance with detailed status for each student
**Optimization:** ✅ Batch updates, efficient

### **Simple Fetch Attendance:**

```http
GET /api/attendance/simple/class/:class_division_id?date=2025-08-28
```

**Purpose:** Get simplified attendance data
**Optimization:** ✅ Lightweight, student details included in student_records

**Response Format:** Same as Fetch Attendance endpoint above

## 🗓️ **Holiday Integration with Calendar Events**

The attendance system automatically integrates with calendar events to handle holidays. Here's how to use it:

### **Creating Holiday Events in Calendar:**

```http
POST /api/calendar/events
{
  "title": "Independence Day",
  "description": "National holiday - school closed",
  "event_date": "2025-08-15T00:00:00Z",
  "event_type": "school_wide",
  "event_category": "holiday",
  "is_single_day": true
}
```

**Event Categories for Holidays:**

- `holiday`: General holidays (national, state, school)
- `exam`: Exam days (no regular classes)
- `meeting`: Staff meetings (no classes)

**Event Types:**

- `school_wide`: All classes affected
- `class_specific`: Only specific class affected
- `multi_class_specific`: Multiple specific classes affected

### **Automatic Holiday Detection:**

The attendance system automatically detects holidays from:

1. **Calendar Events** with `event_category: "holiday"`
2. **Attendance Holidays** table (manual entries)

**Holiday Detection Logic:**

```javascript
// School-wide holidays affect all classes
{
  "event_type": "school_wide",
  "event_category": "holiday"
}

// Class-specific holidays affect only that class
{
  "event_type": "class_specific",
  "event_category": "holiday",
  "class_division_id": "uuid"
}
```

### **Automatic Holiday Sync:**

The attendance system now **automatically syncs** calendar events to holidays! No manual sync required.

**How it works:**

1. **Create Event:** When you create a calendar event with `event_category: "holiday"` or `"exam"`
2. **Auto-Sync:** System automatically creates/updates attendance holiday
3. **Update Event:** When you update a holiday/exam event, attendance holiday is updated
4. **Delete Event:** When you delete a holiday/exam event, attendance holiday is removed

**Manual Sync (Optional):**

```http
POST /api/attendance/sync-calendar-holidays
{
  "start_date": "2025-08-01",
  "end_date": "2025-08-31"
}
```

**Purpose:** Manually sync existing calendar events to holidays (one-time setup)
**Access:** Admin/Principal only

**Response:**

```json
{
  "status": "success",
  "data": {
    "date_range": {
      "start_date": "2025-08-01",
      "end_date": "2025-08-31"
    },
    "total_events": 5,
    "synced": 5,
    "synced_holidays": [
      {
        "event_id": "uuid",
        "holiday_id": "uuid",
        "status": "created"
      }
    ]
  }
}
```

### **Holiday Examples:**

**National Holiday (School-wide):**

```json
{
  "title": "Republic Day",
  "description": "National holiday - school closed",
  "event_date": "2025-01-26T00:00:00Z",
  "event_type": "school_wide",
  "event_category": "holiday"
}
```

**Class-Specific Holiday:**

```json
{
  "title": "Grade 5 Field Trip",
  "description": "Grade 5 students on field trip - no classes",
  "event_date": "2025-09-15T00:00:00Z",
  "event_type": "class_specific",
  "event_category": "holiday",
  "class_division_id": "grade-5-a-uuid"
}
```

**Exam Day:**

```json
{
  "title": "Annual Examinations",
  "description": "Annual exams - no regular classes",
  "event_date": "2025-03-20T00:00:00Z",
  "event_type": "school_wide",
  "event_category": "exam"
}
```

### **Holiday Response in Attendance:**

When you fetch attendance on a holiday date:

```json
{
  "status": "success",
  "data": {
    "daily_attendance": {
      "id": "uuid",
      "attendance_date": "2025-08-15",
      "is_holiday": true,
      "holiday_reason": "Independence Day"
    },
    "student_records": [],
    "message": "Holiday: Independence Day"
  }
}
```

### **Benefits of Calendar Event Integration:**

✅ **Centralized Management:** All events in one place
✅ **Automatic Sync:** No manual sync required - happens automatically
✅ **Real-time Updates:** Changes to calendar events immediately reflect in attendance
✅ **Class-Specific:** Support for class-specific holidays
✅ **Multi-Class:** Support for multiple class holidays
✅ **Event Categories:** Different types (holiday, exam, meeting)
✅ **Approval Workflow:** Events can go through approval process
✅ **Notifications:** Calendar events can trigger notifications
✅ **No Manual Work:** Create calendar event = automatic attendance holiday

## 👨‍🏫 **Teacher Endpoints**

### **Get Attendance Status:**

```http
GET /api/attendance/status/:class_division_id?date=2025-08-28
```

**Purpose:** Check if attendance is marked for a date
**Optimization:** ✅ Single query check

### **Update Student Record:**

```http
PUT /api/attendance/student-record/:record_id
{
  "status": "full_day|half_day|absent",
  "remarks": "Updated remarks"
}
```

**Purpose:** Update individual student attendance
**Optimization:** ✅ Single record update

### **Date Range Attendance:**

```http
GET /api/attendance/daily/class/:class_division_id/range?start_date=2025-08-01&end_date=2025-08-31
```

**Purpose:** Get attendance for a date range
**Optimization:** ⚠️ Multiple queries, consider pagination for large ranges

## 🏫 **Principal/Admin Endpoints (New - Optimized)**

### **All Classes Summary (Fast):**

```http
GET /api/attendance/principal/all-classes-summary?date=2025-08-28
```

**Purpose:** Get attendance summary for all classes on a date
**Optimization:** ✅ Optimized with minimal queries, perfect for dashboards

**Response:**

```json
{
  "status": "success",
  "data": {
    "date": "2025-08-28",
    "total_classes": 10,
    "classes_with_attendance": 8,
    "holiday_classes": 2,
    "class_attendance": [
      {
        "class_division_id": "uuid",
        "class_name": "Grade 1 A",
        "is_holiday": false,
        "total_students": 25,
        "present_count": 22,
        "absent_count": 3,
        "attendance_percentage": 88
      }
    ]
  }
}
```

### **Class Details (Optimized):**

```http
GET /api/attendance/principal/class/:class_division_id?date=2025-08-28
```

**Purpose:** Get detailed attendance for a specific class
**Optimization:** ✅ Single query with joins, efficient

### **Date Range (Optimized):**

```http
GET /api/attendance/principal/date-range?start_date=2025-08-01&end_date=2025-08-31&class_division_id=uuid
```

**Purpose:** Get attendance for date range (optional class filter)
**Optimization:** ✅ Optimized queries, handles large date ranges

## 📊 **Reporting Endpoints**

### **Student Summary:**

```http
GET /api/attendance/student/:student_id/summary?start_date=2025-08-01&end_date=2025-08-31
```

**Purpose:** Get attendance summary for a student
**Optimization:** ⚠️ Multiple queries, consider caching for frequent access

### **Student Details:**

```http
GET /api/attendance/student/:student_id/details?start_date=2025-08-01&end_date=2025-08-31
```

**Purpose:** Get detailed attendance records for a student
**Optimization:** ⚠️ Multiple queries, paginate for large date ranges

### **Class Reports:**

```http
GET /api/attendance/reports/class/:class_division_id?start_date=2025-08-01&end_date=2025-08-31
```

**Purpose:** Get comprehensive class attendance reports
**Optimization:** ⚠️ Heavy queries, consider background processing for large reports

## 🗓️ **Holiday Management**

### **Get Holidays:**

```http
GET /api/attendance/holidays?academic_year_id=uuid
```

**Purpose:** Get all holidays for an academic year
**Optimization:** ✅ Lightweight, single query

### **Create Holiday:**

```http
POST /api/attendance/holidays
{
  "holiday_date": "2025-08-15",
  "holiday_name": "Independence Day",
  "holiday_reason": "National Holiday",
  "academic_year_id": "uuid"
}
```

**Purpose:** Create a new holiday
**Optimization:** ✅ Single insert

### **Update Holiday:**

```http
PUT /api/attendance/holidays/:holiday_id
{
  "holiday_name": "Updated Holiday Name"
}
```

**Purpose:** Update holiday details
**Optimization:** ✅ Single update

### **Delete Holiday:**

```http
DELETE /api/attendance/holidays/:holiday_id
```

**Purpose:** Delete a holiday
**Optimization:** ✅ Single delete

## 🔧 **Utility Endpoints**

### **Create Daily Attendance:**

```http
POST /api/attendance/create-daily
{
  "class_division_id": "uuid",
  "date": "2025-08-28"
}
```

**Purpose:** Manually create daily attendance record
**Optimization:** ✅ Single insert with defaults

### **Sync Calendar Holidays:**

```http
POST /api/attendance/sync-calendar-holidays
{
  "start_date": "2025-08-01",
  "end_date": "2025-08-31"
}
```

**Purpose:** Sync holidays from calendar events
**Optimization:** ⚠️ Multiple queries, consider background job

### **Debug Endpoint:**

```http
GET /api/attendance/debug/attendance/:class_division_id?date=2025-08-28
```

**Purpose:** Debug attendance records (Admin/Principal only)
**Optimization:** ✅ Lightweight debugging info

### **Test Endpoint:**

```http
GET /api/attendance/test/class/:class_division_id?date=2025-08-28
```

**Purpose:** Test simplified attendance fetching
**Optimization:** ✅ Lightweight, no complex joins

## 🚫 **Deprecated Endpoints (Period-based)**

These endpoints still exist but are deprecated due to period complexity:

- `GET /api/attendance/periods` - Get attendance periods
- `POST /api/attendance/periods` - Create attendance period
- `PUT /api/attendance/periods/:period_id` - Update attendance period
- `DELETE /api/attendance/periods/:period_id` - Delete attendance period

## ⚡ **Performance Optimization Tips**

### **For Teachers:**

1. Use `/api/attendance/daily` for quick marking
2. Use `/api/attendance/simple` for detailed marking
3. Use `/api/attendance/status` to check if already marked

### **For Principals:**

1. Use `/api/attendance/principal/all-classes-summary` for dashboard
2. Use `/api/attendance/principal/class/:id` for class details
3. Use `/api/attendance/principal/date-range` for reports

### **For Reports:**

1. Limit date ranges to reasonable periods
2. Consider pagination for large datasets
3. Use background jobs for heavy reports

## 🎯 **Recommended Usage**

### **Daily Operations:**

- **Teachers:** Use `/api/attendance/daily` for marking
- **Principals:** Use `/api/attendance/principal/all-classes-summary` for overview

### **Reports:**

- **Quick Summary:** `/api/attendance/principal/date-range`
- **Detailed Reports:** `/api/attendance/reports/class/:id`

### **Holiday Management:**

- **View:** `/api/attendance/holidays`
- **Manage:** POST/PUT/DELETE `/api/attendance/holidays`
- **Calendar Integration:** Use calendar events with `event_category: "holiday"`
- **Sync:** `/api/attendance/sync-calendar-holidays`

This simplified system is much faster and easier to use! 🚀
