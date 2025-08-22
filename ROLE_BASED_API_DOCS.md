# School App Role-Based API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All endpoints require authentication unless specified otherwise. Use the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Authentication Endpoints (Public)

### 1. Register

```http
POST /api/auth/register
```

**Access**: Public
**Description**: Register a new user in the system

**Payload**:

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "role": "teacher|parent|student",
  "name": "Full Name",
  "phone": "+1234567890"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Full Name",
      "role": "teacher",
      "created_at": "2024-03-15T10:00:00Z"
    },
    "token": "jwt_token"
  }
}
```

### 2. Login

```http
POST /api/auth/login
```

**Access**: Public
**Description**: Authenticate user and get access token

**Payload**:

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Full Name",
      "role": "teacher"
    },
    "token": "jwt_token"
  }
}
```

## Admin/Principal Endpoints

### Academic Management

#### 1. Create Academic Year

```http
POST /api/academic/years
```

**Access**: Admin, Principal
**Description**: Create a new academic year

**Payload**:

```json
{
  "name": "2024-2025",
  "start_date": "2024-06-01",
  "end_date": "2025-03-31",
  "is_active": true
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "academic_year": {
      "id": "uuid",
      "name": "2024-2025",
      "start_date": "2024-06-01",
      "end_date": "2025-03-31",
      "is_active": true,
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

#### 2. Create Class Division

```http
POST /api/academic/class-divisions
```

**Access**: Admin, Principal
**Description**: Create a new class division

**Payload**:

```json
{
  "name": "10-A",
  "academic_year_id": "uuid",
  "class_level_id": "uuid",
  "max_students": 40
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "class_division": {
      "id": "uuid",
      "name": "10-A",
      "academic_year": {
        "id": "uuid",
        "name": "2024-2025"
      },
      "class_level": {
        "id": "uuid",
        "name": "Class 10"
      },
      "max_students": 40
    }
  }
}
```

#### 3. Assign Teacher to Class

```http
POST /api/academic/class-divisions/:class_division_id/assign-teacher
```

**Access**: Admin, Principal
**Description**: Assign a teacher to a class division

**Payload**:

```json
{
  "teacher_id": "uuid",
  "assignment_type": "class_teacher|subject_teacher|assistant_teacher|substitute_teacher",
  "is_primary": true,
  "subject_id": "uuid" // Required only for subject_teacher
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "assignment": {
      "id": "uuid",
      "teacher": {
        "id": "uuid",
        "name": "Teacher Name"
      },
      "assignment_type": "class_teacher",
      "is_primary": true,
      "subject": {
        "id": "uuid",
        "name": "Mathematics"
      }
    }
  }
}
```

## Class Teacher Endpoints

### 1. View Class Details

```http
GET /api/academic/class-divisions/:class_division_id
```

**Access**: Class Teacher (own class only), Admin, Principal
**Description**: Get comprehensive details of a class division

**Response**:

```json
{
  "status": "success",
  "data": {
    "class_division": {
      "id": "uuid",
      "name": "10-A",
      "academic_year": {
        "id": "uuid",
        "name": "2024-2025"
      },
      "students": [
        {
          "id": "uuid",
          "name": "Student Name",
          "roll_number": "1001",
          "attendance_percentage": 95.5
        }
      ],
      "subject_teachers": [
        {
          "id": "uuid",
          "name": "Teacher Name",
          "subject": {
            "id": "uuid",
            "name": "Mathematics"
          }
        }
      ]
    }
  }
}
```

### 2. Create Homework

```http
POST /api/homework
```

**Access**: Class Teacher (own class), Subject Teacher (assigned subjects)
**Description**: Create homework for a class

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
      "file_name": "chapter5.pdf"
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
      "created_at": "2024-03-15T10:00:00Z",
      "attachments": [
        {
          "id": "uuid",
          "file_url": "https://example.com/file.pdf",
          "file_name": "chapter5.pdf"
        }
      ]
    }
  }
}
```

### 3. Mark Attendance

```http
POST /api/academic/class-divisions/:class_division_id/attendance
```

**Access**: Class Teacher (own class only)
**Description**: Mark attendance for the class

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
      "marked_by": {
        "id": "uuid",
        "name": "Teacher Name"
      },
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

## Subject Teacher Endpoints

### 1. View Assigned Classes

```http
GET /api/academic/teachers/:teacher_id/classes
```

**Access**: Subject Teacher (own assignments only), Admin, Principal
**Description**: Get list of classes assigned to the teacher

**Response**:

```json
{
  "status": "success",
  "data": {
    "assignments": [
      {
        "class_division": {
          "id": "uuid",
          "name": "10-A"
        },
        "subject": {
          "id": "uuid",
          "name": "Physics"
        },
        "assignment_type": "subject_teacher",
        "schedule": [
          {
            "day": "Monday",
            "period": 2,
            "time": "09:00-10:00"
          }
        ]
      }
    ]
  }
}
```

### 2. Create Classwork

```http
POST /api/classwork
```

**Access**: Subject Teacher (assigned subjects only), Class Teacher (own class)
**Description**: Create classwork entry

**Payload**:

```json
{
  "class_division_id": "uuid",
  "subject_id": "uuid",
  "title": "Lab Experiment",
  "description": "Ohm's Law Verification",
  "date": "2024-03-15",
  "attachments": [
    {
      "file_url": "https://example.com/lab.pdf",
      "file_name": "lab_manual.pdf"
    }
  ]
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "classwork": {
      "id": "uuid",
      "title": "Lab Experiment",
      "subject": {
        "id": "uuid",
        "name": "Physics"
      },
      "date": "2024-03-15",
      "created_at": "2024-03-15T10:00:00Z",
      "attachments": [
        {
          "id": "uuid",
          "file_url": "https://example.com/lab.pdf",
          "file_name": "lab_manual.pdf"
        }
      ]
    }
  }
}
```

## Parent Endpoints

### 1. View Children

```http
GET /api/users/children
```

**Access**: Parent (own children only)
**Description**: Get information about linked children

**Response**:

```json
{
  "status": "success",
  "data": {
    "children": [
      {
        "id": "uuid",
        "name": "Student Name",
        "class": {
          "id": "uuid",
          "name": "10-A"
        },
        "attendance": {
          "total_present": 150,
          "total_absent": 5,
          "percentage": 96.77
        },
        "recent_homework": [
          {
            "id": "uuid",
            "subject": "Mathematics",
            "title": "Chapter 5 Exercises",
            "due_date": "2024-03-20"
          }
        ]
      }
    ]
  }
}
```

### 2. Submit Leave Request

```http
POST /api/leave-requests
```

**Access**: Parent (for their children only)
**Description**: Submit a leave request

**Payload**:

```json
{
  "student_id": "uuid",
  "start_date": "2024-03-20",
  "end_date": "2024-03-22",
  "reason": "Family function",
  "attachments": [
    {
      "file_url": "https://example.com/document.pdf",
      "file_name": "invitation.pdf"
    }
  ]
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
      "status": "pending",
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

## Common Features

### 1. Update Profile

```http
PUT /api/users/profile
```

**Access**: All authenticated users (own profile only)
**Description**: Update user profile information

**Payload**:

```json
{
  "name": "Updated Name",
  "phone": "+1234567890",
  "address": "New Address",
  "profile_picture": "https://example.com/picture.jpg"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Updated Name",
      "email": "user@example.com",
      "phone": "+1234567890",
      "address": "New Address",
      "profile_picture": "https://example.com/picture.jpg",
      "updated_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### 2. Create Calendar Event

```http
POST /api/calendar/events
```

**Access**:

- Admin, Principal: All events
- Teachers: Class-specific events
- Parents: View only

**Payload**:

```json
{
  "title": "Parent Teacher Meeting",
  "description": "Annual PTM for Class 10",
  "event_date": "2024-03-25",
  "start_time": "09:00:00",
  "end_time": "15:00:00",
  "class_division_ids": ["uuid1", "uuid2"],
  "is_public": true
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "event": {
      "id": "uuid",
      "title": "Parent Teacher Meeting",
      "description": "Annual PTM for Class 10",
      "event_date": "2024-03-25",
      "start_time": "09:00:00",
      "end_time": "15:00:00",
      "created_by": {
        "id": "uuid",
        "name": "Creator Name"
      },
      "class_divisions": [
        {
          "id": "uuid1",
          "name": "10-A"
        }
      ],
      "is_public": true
    }
  }
}
```

## Error Responses

### 1. Authentication Error

```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### 2. Permission Error

```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to access this resource"
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
      "field": ["error message"]
    }
  }
}
```

## Access Control Matrix

### Admin/Principal

- Full access to all endpoints
- Can manage all users, classes, and resources
- Can approve/reject all requests
- Can view all data across the system

### Class Teacher

- Full access to own class data
- Can create/manage homework and classwork
- Can mark attendance
- Can communicate with parents
- Can view only assigned class details

### Subject Teacher

- Limited to assigned subjects/classes
- Can create subject-specific content
- Can view student performance
- Cannot modify class structure
- Cannot access administrative functions

### Parent

- View only their children's data
- Submit leave requests
- Communicate with teachers
- Cannot modify any school data
- Cannot view other students' information

## Rate Limiting

- Standard endpoints: 100 requests/minute
- File upload endpoints: 20 requests/minute
- Bulk operations: 10 requests/minute
- WebSocket: 1 connection/user
