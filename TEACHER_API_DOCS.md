# Teacher API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All endpoints require authentication with Teacher role. Use the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Teacher Endpoints

### 1. View Assigned Classes

```http
GET /api/academic/teachers/:teacher_id/classes
```

**Access**: Admin, Principal, Teacher (own classes only)
**Description**: Get all classes assigned to a teacher with assignment details

**Response**:

```json
{
  "status": "success",
  "data": {
    "assignments": [
      {
        "id": "uuid",
        "assignment_type": "class_teacher",
        "subject": "Mathematics",
        "is_primary": true,
        "assigned_date": "2024-03-15T10:00:00Z",
        "is_active": true,
        "class_division": {
          "id": "uuid",
          "division": "A",
          "academic_year": {
            "year_name": "2024-2025"
          },
          "class_level": {
            "name": "Grade 10",
            "sequence_number": 10
          }
        }
      }
    ]
  }
}
```

### 2. View Class Teachers

```http
GET /api/academic/class-divisions/:id/teachers
```

**Access**: Admin, Principal, Teacher
**Description**: Get all teachers assigned to a specific class division

**Response**:

```json
{
  "status": "success",
  "data": {
    "teachers": [
      {
        "assignment_id": "uuid",
        "teacher_id": "uuid",
        "full_name": "Teacher Name",
        "assignment_type": "class_teacher",
        "is_primary": true,
        "subject": "Mathematics",
        "assigned_date": "2024-03-15T10:00:00Z"
      }
    ]
  }
}
```

### 3. View Profile

```http
GET /api/users/profile
```

**Access**: Both Class and Subject Teachers
**Description**: Get teacher's profile and assignments

**Response**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "full_name": "Teacher Name",
      "email": "teacher@example.com",
      "phone_number": "+1234567890",
      "role": "teacher",
      "assignments": [
        {
          "class_division": {
            "id": "uuid",
            "name": "10-A"
          },
          "assignment_type": "class_teacher",
          "is_primary": true,
          "subject": "Mathematics"
        }
      ]
    }
  }
}
```

### 4. Create Homework

```http
POST /api/homework
```

**Access**: Both Class and Subject Teachers
**Description**: Create homework for students

**Payload**:

```json
{
  "class_division_id": "uuid",
  "subject_id": "uuid",
  "title": "Chapter 5 Exercises",
  "description": "Complete exercises 5.1 to 5.5",
  "due_date": "2024-03-20",
  "attachments": [
    {
      "file_url": "https://example.com/file.pdf",
      "file_name": "exercises.pdf"
    }
  ]
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "homework": {
      "id": "uuid",
      "title": "Chapter 5 Exercises",
      "subject": {
        "id": "uuid",
        "name": "Mathematics"
      },
      "due_date": "2024-03-20",
      "class_division": {
        "id": "uuid",
        "name": "10-A"
      },
      "attachments": [
        {
          "id": "uuid",
          "file_url": "https://example.com/file.pdf",
          "file_name": "exercises.pdf"
        }
      ]
    }
  }
}
```

### 5. View Calendar Events

```http
GET /api/calendar/events
```

**Access**: Both Class and Subject Teachers
**Description**: View calendar events relevant to the teacher

**Response**:

```json
{
  "status": "success",
  "data": {
    "events": [
      {
        "id": "uuid",
        "title": "Parent Teacher Meeting",
        "description": "Annual PTM",
        "date": "2024-03-20",
        "type": "class_event",
        "class_divisions": [
          {
            "id": "uuid",
            "name": "10-A"
          }
        ],
        "created_by": {
          "id": "uuid",
          "name": "Admin Name"
        }
      }
    ]
  }
}
```

### 6. Get Linked Parents and Principal

```http
GET /api/users/teacher-linked-parents
```

**Access**: Teachers (own data), Admin, Principal (any teacher)
**Description**: Get all parents linked to students where the teacher is either a class teacher or subject teacher, plus principal information

**Query Parameters**:

- `teacher_id`: (Optional) Teacher ID to query (required for admin/principal, auto-filled for teachers)

**Response**:

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "uuid",
      "full_name": "Teacher Name",
      "assignments": [
        {
          "assignment_type": "class_teacher",
          "subject": null,
          "is_primary": true,
          "class_name": "Grade 10 A",
          "academic_year": "2024-2025"
        },
        {
          "assignment_type": "subject_teacher",
          "subject": "Mathematics",
          "is_primary": false,
          "class_name": "Grade 9 B",
          "academic_year": "2024-2025"
        }
      ]
    },
    "linked_parents": [
      {
        "parent_id": "uuid",
        "full_name": "Parent Name",
        "email": "parent@email.com",
        "phone_number": "+1234567890",
        "linked_students": [
          {
            "student_id": "uuid",
            "student_name": "Student Name",
            "roll_number": "10A001",
            "class_division_id": "uuid",
            "teacher_assignments": [
              {
                "assignment_type": "class_teacher",
                "subject": null,
                "is_primary": true,
                "class_name": "Grade 10 A",
                "academic_year": "2024-2025"
              }
            ]
          }
        ]
      }
    ],
    "principal": {
      "id": "uuid",
      "full_name": "Principal Name",
      "email": "principal@school.com",
      "phone_number": "+1234567890",
      "role": "principal"
    },
    "summary": {
      "total_linked_parents": 25,
      "total_students": 30,
      "total_classes": 3,
      "total_assignments": 4,
      "primary_teacher_for": 1,
      "subject_teacher_for": 3
    }
  }
}
```

**Key Features**:

- ✅ **Complete parent information** with contact details
- ✅ **Linked students** for each parent with teacher assignments
- ✅ **Teacher assignments** showing role (class teacher vs subject teacher)
- ✅ **Principal information** for school-wide communication
- ✅ **Summary statistics** for quick overview
- ✅ **Deduplication** - parents with multiple children appear once
- ✅ **Sorted alphabetically** by parent name

### 7. View Calendar Events

## Class Teacher Specific Endpoints

### 1. Mark Attendance

```http
POST /api/academic/class-divisions/:class_division_id/attendance
```

**Access**: Class Teacher Only
**Description**: Mark attendance for the entire class

**Payload**:

```json
{
  "date": "2024-03-15",
  "attendance": [
    {
      "student_id": "uuid",
      "status": "present|absent|late",
      "remarks": "Optional remarks"
    }
  ]
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "attendance": {
      "date": "2024-03-15",
      "total_students": 40,
      "present": 38,
      "absent": 2,
      "records": [
        {
          "student_id": "uuid",
          "student_name": "Student Name",
          "status": "present",
          "remarks": "Optional remarks"
        }
      ]
    }
  }
}
```

### 2. Manage Leave Requests

```http
PUT /api/leave-requests/:id/status
```

**Access**: Class Teacher Only
**Description**: Approve or reject student leave requests

**Payload**:

```json
{
  "status": "approved|rejected",
  "remarks": "Approved for family function"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "leave_request": {
      "id": "uuid",
      "student": {
        "id": "uuid",
        "name": "Student Name"
      },
      "start_date": "2024-03-20",
      "end_date": "2024-03-22",
      "status": "approved",
      "remarks": "Approved for family function",
      "updated_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

## Access Control Summary

### Class Teacher

- Full access to assigned class data
- Can mark attendance for their class
- Can approve/reject leave requests
- Can create homework for any subject in their class
- Can view all student details in their class

### Subject Teacher

- Limited to assigned subjects and classes
- Can create homework only for their subjects
- Can view basic student information
- Cannot manage attendance or leave requests

## Error Responses

### 1. Permission Error

```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
  }
}
```

### 2. Resource Not Found

```json
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "Requested resource not found"
  }
}
```

### 3. Validation Error

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field_name": ["Error message"]
    }
  }
}
```

## Rate Limits

- Standard endpoints: 100 requests/minute
- File upload endpoints: 20 requests/minute
- Bulk operations: 10 requests/minute
