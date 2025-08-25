# Parent API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All endpoints require authentication with Parent role. Use the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Parent Endpoints

### Birthday Management

#### Get Teacher & Classmate Birthdays

```http
GET /api/birthdays/parent-view
```

**Access**: Parents only
**Description**: Get birthdays of class teachers, subject teachers, and classmates for parent's children

**Query Parameters**:
- `days_ahead` (optional): Number of days to look ahead for upcoming birthdays (default: 30)
- `specific_date` (optional): Specific date to check for birthdays (YYYY-MM-DD format)

**Examples**:
- `GET /api/birthdays/parent-view` - Next 30 days (default)
- `GET /api/birthdays/parent-view?days_ahead=7` - Next 7 days
- `GET /api/birthdays/parent-view?specific_date=2025-03-15` - Specific date

**Response**:

```json
{
  "status": "success",
  "data": {
    "teachers": [
      {
        "teacher_id": "uuid",
        "full_name": "John Smith",
        "date_of_birth": "1985-03-15",
        "assignments": [
          {
            "subject": "Mathematics",
            "is_class_teacher": true
          }
        ],
        "days_until_birthday": 45,
        "is_upcoming": true
      }
    ],
    "classmates": [
      {
        "student_id": "uuid",
        "full_name": "Bob Wilson",
        "date_of_birth": "2008-07-22",
        "class_division": "Grade 10 A",
        "days_until_birthday": 12,
        "is_upcoming": true
      }
    ],
    "summary": {
      "total_teachers": 5,
      "total_classmates": 25,
      "upcoming_birthdays": 8,
      "teachers_upcoming": 2,
      "classmates_upcoming": 6,
      "date_range": {
        "days_ahead": 30,
        "specific_date": null,
        "filter_applied": "date_range"
      }
    }
  }
}
```

**Key Features**:

- ✅ **Teacher birthdays** with contact info and assignments
- ✅ **Classmate birthdays** with shared class information
- ✅ **Upcoming birthdays** (next 30 days) highlighted
- ✅ **Days until birthday** calculation
- ✅ **Summary statistics** for quick overview
- ✅ **Sorted by upcoming birthdays** (most recent first)

**Use Cases**:

- Parents can see teacher birthdays to send wishes
- Parents can see classmate birthdays for their children
- Parents can plan birthday celebrations
- Parents can track upcoming birthdays

### 1. Fetch Children Details

```http
GET /api/users/children
```

**Access**: Parent (own children only)
**Description**: Get basic information about all linked children

**Response**:

```json
{
  "status": "success",
  "data": {
    "children": [
      {
        "id": "uuid",
        "name": "Student Name",
        "admission_number": "2024001",
        "class": "10-A",
        "profile_photo": "path/to/photo",
        "academic_year": "2024-2025"
      }
    ]
  }
}
```

### 2. Get Children Details

```http
GET /api/users/children/:student_id
```

**Access**: Parent (own children only)
**Description**: Get detailed information about a specific child

**Response**:

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid",
      "name": "Student Name",
      "admission_number": "2024001",
      "date_of_birth": "2010-05-15",
      "gender": "male",
      "profile_photo": "path/to/photo",
      "class_details": {
        "class": "10-A",
        "academic_year": "2024-2025",
        "class_teacher": {
          "id": "uuid",
          "name": "Teacher Name"
        }
      },
      "attendance": {
        "total_present": 150,
        "total_absent": 5,
        "percentage": 96.77
      }
    }
  }
}
```

### 3. Get Children's Teachers (Enhanced for Messaging)

```http
GET /api/users/children/teachers
```

**Access**: Parents only
**Description**: Get comprehensive information about children's teachers, classes, and contact details for messaging purposes

**Response**:

```json
{
  "status": "success",
  "data": {
    "children": [
      {
        "student_id": "uuid",
        "student_name": "Alex Johnson",
        "admission_number": "ADM2024001",
        "relationship": "father",
        "is_primary_guardian": true,
        "class_info": {
          "class_division_id": "uuid",
          "class_name": "Grade 10 A",
          "division": "A",
          "academic_year": "2024-2025",
          "class_level": "Grade 10",
          "roll_number": "001"
        },
        "teachers": [
          {
            "assignment_id": "uuid",
            "teacher_id": "uuid",
            "full_name": "Mrs. Sarah Wilson",
            "phone_number": "+1234567890",
            "email": "sarah.wilson@school.com",
            "assignment_type": "class_teacher",
            "subject": null,
            "is_primary": true,
            "assigned_date": "2024-06-01T00:00:00Z",
            "contact_info": {
              "phone": "+1234567890",
              "email": "sarah.wilson@school.com"
            }
          },
          {
            "assignment_id": "uuid",
            "teacher_id": "uuid",
            "full_name": "Mr. John Smith",
            "phone_number": "+1234567891",
            "email": "john.smith@school.com",
            "assignment_type": "subject_teacher",
            "subject": "Mathematics",
            "is_primary": false,
            "assigned_date": "2024-06-01T00:00:00Z",
            "contact_info": {
              "phone": "+1234567891",
              "email": "john.smith@school.com"
            }
          }
        ]
      }
    ],
    "principal": {
      "id": "uuid",
      "full_name": "Dr. Michael Brown",
      "email": "principal@school.com",
      "phone_number": "+1234567899",
      "role": "principal",
      "contact_info": {
        "phone": "+1234567899",
        "email": "principal@school.com"
      }
    },
    "summary": {
      "total_children": 2,
      "total_teachers": 5,
      "total_classes": 2,
      "children_with_teachers": 2,
      "children_without_teachers": 0
    }
  }
}
```

**Key Features**:

- ✅ **Complete child information** with admission number and relationship
- ✅ **Detailed class information** including roll number and academic year
- ✅ **All teacher assignments** (class teacher, subject teachers)
- ✅ **Contact information** for all teachers and principal
- ✅ **Assignment details** including subject and assignment type
- ✅ **Summary statistics** for quick overview
- ✅ **Sorted alphabetically** by child name

**Use Cases**:

- Parents can see all teachers for their children
- Parents can contact specific subject teachers
- Parents can message class teachers for general concerns
- Parents can contact principal for school-wide issues
- Parents can understand teacher roles and subjects

### 4. Update Profile

```http
PUT /api/users/profile
```

**Access**: Parent
**Description**: Update parent's profile information

**Payload**:

```json
{
  "full_name": "Updated Parent Name",
  "phone_number": "+1234567890",
  "email": "updated@example.com"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "full_name": "Updated Parent Name",
      "email": "updated@example.com",
      "phone_number": "+1234567890",
      "role": "parent",
      "updated_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### 5. Upload Profile Photo

```http
POST /api/users/profile/photo
```

**Access**: Parent
**Description**: Upload or update profile photo

**Payload** (multipart/form-data):

```
file: [binary photo file]
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "profile_photo": "path/to/photo",
    "updated_at": "2024-03-15T10:00:00Z"
  }
}
```

### 6. Edit Parent Details

```http
PUT /api/parents/:parent_id
```

**Access**: Parent (own profile only)
**Description**: Update detailed parent information

**Payload**:

```json
{
  "full_name": "Updated Parent Name",
  "phone_number": "+1234567890",
  "email": "updated@example.com",
  "address": {
    "street": "123 Main St",
    "city": "Example City",
    "state": "Example State",
    "postal_code": "12345"
  },
  "emergency_contact": {
    "name": "Contact Name",
    "relationship": "Spouse",
    "phone_number": "+0987654321"
  }
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "parent": {
      "id": "uuid",
      "full_name": "Updated Parent Name",
      "email": "updated@example.com",
      "phone_number": "+1234567890",
      "address": {
        "street": "123 Main St",
        "city": "Example City",
        "state": "Example State",
        "postal_code": "12345"
      },
      "emergency_contact": {
        "name": "Contact Name",
        "relationship": "Spouse",
        "phone_number": "+0987654321"
      },
      "updated_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### 7. Submit Leave Request

```http
POST /api/leave-requests
```

**Access**: Parent
**Description**: Submit leave request for child

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
      "reason": "Family function",
      "status": "pending",
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### 8. View Leave Requests

```http
GET /api/leave-requests
```

**Access**: Parent
**Description**: View all leave requests for children

**Query Parameters**:

- `student_id`: Filter by specific child (optional)
- `status`: Filter by status (pending/approved/rejected)
- `from_date`: Filter from date
- `to_date`: Filter to date

**Response**:

```json
{
  "status": "success",
  "data": {
    "leave_requests": [
      {
        "id": "uuid",
        "student": {
          "id": "uuid",
          "name": "Student Name"
        },
        "start_date": "2024-03-20",
        "end_date": "2024-03-22",
        "reason": "Family function",
        "status": "pending",
        "created_at": "2024-03-15T10:00:00Z"
      }
    ]
  }
}
```

### 9. View Child's Homework

```http
GET /api/homework
```

**Access**: Parent
**Description**: View homework assigned to child

**Query Parameters**:

- `student_id`: Filter by specific child
- `subject_id`: Filter by subject (optional)
- `status`: Filter by status (pending/completed)
- `due_date`: Filter by due date

**Response**:

```json
{
  "status": "success",
  "data": {
    "homework": [
      {
        "id": "uuid",
        "title": "Chapter 5 Exercises",
        "description": "Complete exercises 5.1 to 5.5",
        "subject": {
          "id": "uuid",
          "name": "Mathematics"
        },
        "due_date": "2024-03-20",
        "status": "pending",
        "attachments": [
          {
            "id": "uuid",
            "file_url": "https://example.com/file.pdf",
            "file_name": "exercises.pdf"
          }
        ]
      }
    ]
  }
}
```

### 10. View Calendar Events

```http
GET /api/calendar/events
```

**Access**: Parent
**Description**: View calendar events relevant to children

**Query Parameters**:

- `student_id`: Filter by specific child (optional)
- `from_date`: Filter from date
- `to_date`: Filter to date

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
        "class_division": {
          "id": "uuid",
          "name": "10-A"
        },
        "created_by": {
          "id": "uuid",
          "name": "Teacher Name"
        }
      }
    ]
  }
}
```

## Access Control Summary

### Parent Access Levels

1. Full Access
   - Can view all academic information
   - Can submit leave requests
   - Can view all communications
   - Can access all homework and assignments

2. Restricted Access
   - Can view basic academic information
   - Can submit leave requests
   - Limited access to communications
   - Can view only important notifications

3. Read-only Access
   - Can only view basic information
   - Cannot submit leave requests
   - Limited to viewing essential notifications

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
