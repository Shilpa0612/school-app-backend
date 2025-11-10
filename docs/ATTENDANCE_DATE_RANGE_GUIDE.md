# 📅 Attendance Date Range Guide

This guide shows how to get attendance data for specific date ranges for different user roles.

## 🎯 **Available Endpoints for Date Ranges**

### **1. Student Attendance Summary** 📊

**Endpoint:** `GET /api/attendance/student/:student_id/summary`

**Parameters:**

- `academic_year_id` (optional) - Defaults to active academic year
- `start_date` (required) - Start date in YYYY-MM-DD format
- `end_date` (required) - End date in YYYY-MM-DD format

**Example Request:**

```bash
GET /api/attendance/student/d2e4585e-830c-40ba-b29c-cc62ff146607/summary?start_date=2025-08-01&end_date=2025-08-31
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
      "full_name": "John Doe",
      "admission_number": "2025001"
    },
    "academic_year_id": "f6905bae-23b4-45fc-bcf2-4bb19beee945",
    "class_division_id": "4ded8472-fe26-4cf3-ad25-23f601960a0b",
    "date_range": {
      "start_date": "2025-08-01",
      "end_date": "2025-08-31"
    },
    "summary": {
      "total_days": 22,
      "present_days": 20,
      "absent_days": 2,
      "attendance_percentage": 91,
      "holiday_days": 3
    }
  }
}
```

### **2. Student Attendance Details (Daily Records)** 📝

**Endpoint:** `GET /api/attendance/student/:student_id/details`

**Parameters:**

- `academic_year_id` (optional) - Defaults to active academic year
- `start_date` (required) - Start date in YYYY-MM-DD format
- `end_date` (required) - End date in YYYY-MM-DD format
- `page` (optional) - Page number for pagination (default: 1)
- `limit` (optional) - Records per page (default: 30)

**Example Request:**

```bash
GET /api/attendance/student/d2e4585e-830c-40ba-b29c-cc62ff146607/details?start_date=2025-08-01&end_date=2025-08-31&page=1&limit=10
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
      "full_name": "John Doe",
      "admission_number": "2025001"
    },
    "pagination": {
      "page": 1,
      "limit": 10,
      "total_records": 22,
      "total_pages": 3
    },
    "attendance_records": [
      {
        "date": "2025-08-01",
        "status": "present",
        "remarks": "Marked present by teacher",
        "marked_by": "teacher-uuid",
        "is_holiday": false
      },
      {
        "date": "2025-08-02",
        "status": "absent",
        "remarks": "Not marked by teacher - default status",
        "marked_by": "teacher-uuid",
        "is_holiday": false
      }
    ]
  }
}
```

### **3. Class Attendance Range** 🏫

**Endpoint:** `GET /api/attendance/daily/class/:class_division_id/range`

**Parameters:**

- `start_date` (required) - Start date in YYYY-MM-DD format
- `end_date` (required) - End date in YYYY-MM-DD format

**Example Request:**

```bash
GET /api/attendance/daily/class/4ded8472-fe26-4cf3-ad25-23f601960a0b/range?start_date=2025-08-01&end_date=2025-08-31
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_division_id": "4ded8472-fe26-4cf3-ad25-23f601960a0b",
    "date_range": {
      "start_date": "2025-08-01",
      "end_date": "2025-08-31"
    },
    "attendance_records": [
      {
        "date": "2025-08-01",
        "is_holiday": false,
        "total_students": 25,
        "present_count": 23,
        "absent_count": 2,
        "attendance_percentage": 92,
        "marked_by": "teacher-uuid"
      }
    ]
  }
}
```

### **4. Teacher Attendance Summary** 👨‍🏫

**Endpoint:** `GET /api/attendance/teacher/summary`

**Parameters:**

- `start_date` (required) - Start date in YYYY-MM-DD format
- `end_date` (required) - End date in YYYY-MM-DD format

**Example Request:**

```bash
GET /api/attendance/teacher/summary?start_date=2025-08-01&end_date=2025-08-31
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "teacher_id": "teacher-uuid",
    "date_range": {
      "start_date": "2025-08-01",
      "end_date": "2025-08-31"
    },
    "summary": {
      "total_classes": 3,
      "total_attendance_days": 66,
      "average_attendance_percentage": 89,
      "classes_summary": [
        {
          "class_division_id": "uuid",
          "class_name": "Grade 1 A",
          "total_days": 22,
          "average_attendance": 92
        }
      ]
    }
  }
}
```

## 👥 **User Role Access**

### **Parents** 👨‍👩‍👧‍👦

- ✅ Can view attendance for their own children only
- ✅ Student summary and details endpoints
- ❌ Cannot access class-wide or teacher endpoints

### **Teachers** 👨‍🏫

- ✅ Can view attendance for students in their assigned classes
- ✅ Student summary and details for their students
- ✅ Class attendance range for their classes
- ✅ Teacher summary for their classes
- ❌ Cannot access other teachers' data

### **Principals/Admins** 👑

- ✅ Can view all attendance data
- ✅ All endpoints accessible
- ✅ Principal all-classes-summary endpoint

## 🔧 **Usage Examples**

### **For Parents:**

```javascript
// Get child's attendance summary for August
const response = await fetch(
  "/api/attendance/student/child-student-id/summary?start_date=2025-08-01&end_date=2025-08-31",
  {
    headers: {
      Authorization: "Bearer parent-token",
    },
  }
);

// Get child's daily attendance records
const details = await fetch(
  "/api/attendance/student/child-student-id/details?start_date=2025-08-01&end_date=2025-08-31",
  {
    headers: {
      Authorization: "Bearer parent-token",
    },
  }
);
```

### **For Teachers:**

```javascript
// Get class attendance for the month
const classAttendance = await fetch(
  "/api/attendance/daily/class/class-id/range?start_date=2025-08-01&end_date=2025-08-31",
  {
    headers: {
      Authorization: "Bearer teacher-token",
    },
  }
);

// Get teacher's summary for all classes
const teacherSummary = await fetch(
  "/api/attendance/teacher/summary?start_date=2025-08-01&end_date=2025-08-31",
  {
    headers: {
      Authorization: "Bearer teacher-token",
    },
  }
);

// Get specific student's attendance
const studentAttendance = await fetch(
  "/api/attendance/student/student-id/summary?start_date=2025-08-01&end_date=2025-08-31",
  {
    headers: {
      Authorization: "Bearer teacher-token",
    },
  }
);
```

### **For Principals:**

```javascript
// Get all classes summary for a date
const allClasses = await fetch(
  "/api/attendance/principal/all-classes-summary?date=2025-08-28",
  {
    headers: {
      Authorization: "Bearer principal-token",
    },
  }
);

// Get specific class details
const classDetails = await fetch(
  "/api/attendance/principal/class/class-id?date=2025-08-28",
  {
    headers: {
      Authorization: "Bearer principal-token",
    },
  }
);
```

## 📊 **Response Data Explained**

### **Summary Endpoints:**

- `total_days`: Number of school days (excluding holidays)
- `present_days`: Days student was present
- `absent_days`: Days student was absent
- `attendance_percentage`: (present_days / total_days) \* 100
- `holiday_days`: Number of holidays in the date range

### **Details Endpoints:**

- `date`: Specific date
- `status`: 'present', 'absent', 'late', etc.
- `remarks`: Notes from teacher
- `marked_by`: Teacher who marked the attendance
- `is_holiday`: Whether it was a holiday

## ⚡ **Performance Tips**

1. **Use appropriate date ranges** - Don't request very large date ranges
2. **Use pagination** for details endpoints with many records
3. **Cache results** on the frontend for frequently accessed data
4. **Use summary endpoints** when you only need statistics, not detailed records

## 🔒 **Security Notes**

- All endpoints require authentication
- Users can only access data they're authorized to see
- Student IDs are validated against user permissions
- Class access is restricted to assigned teachers
- Parent access is restricted to their own children
