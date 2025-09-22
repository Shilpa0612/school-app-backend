# Admin and Principal API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All endpoints require authentication with Admin or Principal role. Use the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Academic Management

### 1. Academic Years

#### Create Academic Year

```http
POST /api/academic/years
```

**Access**: Admin, Principal
**Description**: Create a new academic year in the system

**Payload**:

```json
{
  "name": "2024-2025",
  "start_date": "2024-06-01",
  "end_date": "2025-03-31",
  "is_active": true,
  "description": "Academic year 2024-2025"
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
      "description": "Academic year 2024-2025",
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

#### Update Academic Year

```http
PUT /api/academic/years/:id
```

**Access**: Admin, Principal
**Description**: Update an existing academic year

**Payload**:

```json
{
  "name": "2024-2025 Updated",
  "start_date": "2024-06-01",
  "end_date": "2025-03-31",
  "is_active": true,
  "description": "Updated description"
}
```

**Response**: Same as Create response

#### List Academic Years

```http
GET /api/academic/years
```

**Access**: Admin, Principal
**Description**: Get list of all academic years

**Query Parameters**:

- `active_only`: boolean (default: false)
- `page`: number (default: 1)
- `limit`: number (default: 10)

**Response**:

```json
{
  "status": "success",
  "data": {
    "academic_years": [
      {
        "id": "uuid",
        "name": "2024-2025",
        "start_date": "2024-06-01",
        "end_date": "2025-03-31",
        "is_active": true,
        "description": "Academic year 2024-2025"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 10
    }
  }
}
```

### 2. Class Management

#### Create Class Level

```http
POST /api/academic/class-levels
```

**Access**: Admin, Principal
**Description**: Create a new class level

**Payload**:

```json
{
  "name": "Class 10",
  "code": "C10",
  "academic_year_id": "uuid",
  "description": "Secondary class level"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "class_level": {
      "id": "uuid",
      "name": "Class 10",
      "code": "C10",
      "academic_year": {
        "id": "uuid",
        "name": "2024-2025"
      },
      "description": "Secondary class level",
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

#### Create Class Division

```http
POST /api/academic/class-divisions
```

**Access**: Admin, Principal
**Description**: Create a new division within a class level

**Payload**:

```json
{
  "name": "10-A",
  "class_level_id": "uuid",
  "academic_year_id": "uuid",
  "max_students": 40,
  "room_number": "301",
  "description": "Science division"
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
      "class_level": {
        "id": "uuid",
        "name": "Class 10"
      },
      "academic_year": {
        "id": "uuid",
        "name": "2024-2025"
      },
      "max_students": 40,
      "room_number": "301",
      "description": "Science division",
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### 3. Teacher Management

#### Assign Class Teacher

```http
POST /api/academic/class-divisions/:class_division_id/assign-teacher
```

**Access**: Admin, Principal
**Description**: Assign a teacher as class teacher

**Payload**:

```json
{
  "teacher_id": "uuid",
  "assignment_type": "class_teacher",
  "is_primary": true,
  "academic_year_id": "uuid"
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
      "class_division": {
        "id": "uuid",
        "name": "10-A"
      },
      "assignment_type": "class_teacher",
      "is_primary": true,
      "academic_year": {
        "id": "uuid",
        "name": "2024-2025"
      },
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

#### Assign Subject Teacher

```http
POST /api/academic/class-divisions/:class_division_id/assign-teacher
```

**Access**: Admin, Principal
**Description**: Assign a teacher to teach a subject

**Payload**:

```json
{
  "teacher_id": "uuid",
  "assignment_type": "subject_teacher",
  "subject_id": "uuid",
  "academic_year_id": "uuid"
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
      "subject": {
        "id": "uuid",
        "name": "Mathematics"
      },
      "class_division": {
        "id": "uuid",
        "name": "10-A"
      },
      "assignment_type": "subject_teacher",
      "academic_year": {
        "id": "uuid",
        "name": "2024-2025"
      }
    }
  }
}
```

### 4. Student Management

#### Create Student

```http
POST /api/academic/students
```

**Access**: Admin, Principal
**Description**: Create a new student record

**Payload**:

```json
{
  "name": "Student Name",
  "admission_number": "2024001",
  "date_of_birth": "2010-05-15",
  "gender": "male|female|other",
  "class_division_id": "uuid",
  "academic_year_id": "uuid",
  "contact_details": {
    "primary_contact": "+1234567890",
    "secondary_contact": "+0987654321",
    "email": "student@example.com",
    "address": "Full address"
  }
}
```

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
      "class_division": {
        "id": "uuid",
        "name": "10-A"
      },
      "academic_year": {
        "id": "uuid",
        "name": "2024-2025"
      },
      "contact_details": {
        "primary_contact": "+1234567890",
        "secondary_contact": "+0987654321",
        "email": "student@example.com",
        "address": "Full address"
      },
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### 5. Subject Management

#### Create Subject

```http
POST /api/academic/subjects
```

**Access**: Admin, Principal
**Description**: Create a new subject

**Payload**:

```json
{
  "name": "Mathematics",
  "code": "MATH101",
  "class_level_id": "uuid",
  "academic_year_id": "uuid",
  "description": "Advanced Mathematics",
  "is_mandatory": true,
  "credits": 5
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "subject": {
      "id": "uuid",
      "name": "Mathematics",
      "code": "MATH101",
      "class_level": {
        "id": "uuid",
        "name": "Class 10"
      },
      "academic_year": {
        "id": "uuid",
        "name": "2024-2025"
      },
      "description": "Advanced Mathematics",
      "is_mandatory": true,
      "credits": 5,
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### 6. Resource Management

#### Create Book Resource

```http
POST /api/lists/books
```

**Access**: Admin, Principal
**Description**: Add a new book to the resource list

**Payload**:

```json
{
  "title": "Advanced Mathematics Textbook",
  "author": "Author Name",
  "publisher": "Publisher Name",
  "isbn": "1234567890",
  "subject_id": "uuid",
  "class_level_id": "uuid",
  "academic_year_id": "uuid",
  "quantity": 100,
  "price": 299.99
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "book": {
      "id": "uuid",
      "title": "Advanced Mathematics Textbook",
      "author": "Author Name",
      "publisher": "Publisher Name",
      "isbn": "1234567890",
      "subject": {
        "id": "uuid",
        "name": "Mathematics"
      },
      "class_level": {
        "id": "uuid",
        "name": "Class 10"
      },
      "quantity": 100,
      "price": 299.99,
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### 7. Communication Management

#### Approve Message

```http
PUT /api/messages/:id/approve
```

**Access**: Admin, Principal
**Description**: Approve a message for broadcast

**Payload**:

```json
{
  "remarks": "Approved for broadcast",
  "priority": "high|medium|low"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "message": {
      "id": "uuid",
      "content": "Message content",
      "status": "approved",
      "approved_by": {
        "id": "uuid",
        "name": "Admin Name"
      },
      "approved_at": "2024-03-15T10:00:00Z",
      "remarks": "Approved for broadcast",
      "priority": "high"
    }
  }
}
```

### 8. Leave Management

#### Approve/Reject Leave Request

```http
PUT /api/leave-requests/:id/status
```

**Access**: Admin, Principal
**Description**: Update status of a leave request

**Payload**:

```json
{
  "status": "approved|rejected",
  "remarks": "Leave approved for family function",
  "approved_by": "uuid"
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
      "status": "approved",
      "approved_by": {
        "id": "uuid",
        "name": "Admin Name"
      },
      "remarks": "Leave approved for family function",
      "updated_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

## Error Responses

### 1. Validation Error

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

### 3. Permission Error

```json
{
  "status": "error",
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions to perform this action"
  }
}
```

## Rate Limits

- Standard endpoints: 100 requests/minute
- Resource creation endpoints: 50 requests/minute
- Bulk operations: 10 requests/minute
- File upload endpoints: 20 requests/minute

# Teacher API Documentation

## Class Teacher vs Subject Teacher Access

### Key Differences:

1. Class Teachers:
   - Full access to all class information
   - Can manage all subjects for their class
   - Can manage attendance
   - Can approve/reject leave requests
   - Can communicate with all parents of the class

2. Subject Teachers:
   - Access limited to their subject
   - Can only manage their subject's homework/classwork
   - Can only view attendance
   - Cannot manage leave requests
   - Can communicate with parents regarding their subject only

## Common Teacher Endpoints

### 1. View Profile

```http
GET /api/users/profile
```

**Access**: Both Class and Subject Teachers
**Description**: Get teacher's profile and assignments

**Response for Class Teacher**:

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "uuid",
      "name": "Teacher Name",
      "email": "teacher@example.com",
      "role": "class_teacher",
      "primary_class": {
        "id": "uuid",
        "name": "10-A",
        "strength": 40,
        "subjects": [
          {
            "id": "uuid",
            "name": "Mathematics",
            "teacher": {
              "id": "uuid",
              "name": "Math Teacher"
            }
          }
        ]
      }
    }
  }
}
```

**Response for Subject Teacher**:

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "uuid",
      "name": "Teacher Name",
      "email": "teacher@example.com",
      "role": "subject_teacher",
      "assigned_classes": [
        {
          "class_division": {
            "id": "uuid",
            "name": "10-A"
          },
          "subject": {
            "id": "uuid",
            "name": "Physics"
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

**Response for Class Teacher**:

```json
{
  "status": "success",
  "data": {
    "homework": {
      "id": "uuid",
      "title": "Chapter 5 Exercises",
      "subject": {
        "id": "uuid",
        "name": "Mathematics",
        "teacher": {
          "id": "uuid",
          "name": "Math Teacher"
        }
      },
      "due_date": "2024-03-20",
      "class_stats": {
        "total_students": 40,
        "notified": 40
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

**Response for Subject Teacher**:

```json
{
  "status": "success",
  "data": {
    "homework": {
      "id": "uuid",
      "title": "Chapter 5 Exercises",
      "subject": {
        "id": "uuid",
        "name": "Physics"
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

## Class Teacher Specific Endpoints

### 1. View Class Dashboard

```http
GET /api/academic/class-divisions/:class_division_id/dashboard
```

**Access**: Class Teacher Only
**Description**: Get comprehensive dashboard of class

**Response**:

```json
{
  "status": "success",
  "data": {
    "class_division": {
      "id": "uuid",
      "name": "10-A",
      "strength": 40,
      "attendance_today": {
        "present": 38,
        "absent": 2,
        "percentage": 95
      },
      "subjects": [
        {
          "id": "uuid",
          "name": "Mathematics",
          "teacher": {
            "id": "uuid",
            "name": "Math Teacher"
          },
          "pending_homework": 2
        }
      ],
      "upcoming_events": [
        {
          "id": "uuid",
          "title": "Parent Teacher Meeting",
          "date": "2024-03-20"
        }
      ],
      "pending_leave_requests": 3
    }
  }
}
```

### 2. Manage Attendance

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

### 3. Manage Leave Requests

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

### 3. Get All Teachers with Assignments

```http
GET /api/academic/teachers-with-assignments
```

**Access**: Admin, Principal only
**Description**: Get all teachers with their complete assignment details including primary classes, subject teacher assignments, assistant assignments, and substitute assignments

**Response**:

```json
{
  "status": "success",
  "data": {
    "teachers": [
      {
        "teacher_id": "uuid",
        "full_name": "Teacher Name",
        "phone_number": "+1234567890",
        "email": "teacher@school.com",
        "role": "teacher",
        "staff_info": {
          "staff_id": "uuid",
          "department": "Mathematics",
          "designation": "Senior Teacher",
          "is_active": true
        },
        "assignments": {
          "total": 3,
          "primary_classes": [
            {
              "assignment_id": "uuid",
              "class_division_id": "uuid",
              "class_name": "Grade 10 A",
              "academic_year": "2024-2025",
              "assignment_type": "class_teacher",
              "is_primary": true,
              "assigned_date": "2024-06-01T00:00:00Z"
            }
          ],
          "subject_teacher_assignments": [
            {
              "assignment_id": "uuid",
              "class_division_id": "uuid",
              "class_name": "Grade 9 B",
              "academic_year": "2024-2025",
              "subject": "Mathematics",
              "assignment_type": "subject_teacher",
              "is_primary": false,
              "assigned_date": "2024-06-01T00:00:00Z"
            }
          ],
          "assistant_assignments": [],
          "substitute_assignments": []
        },
        "summary": {
          "total_classes": 3,
          "primary_teacher_for": 1,
          "subject_teacher_for": 2,
          "assistant_teacher_for": 0,
          "substitute_teacher_for": 0,
          "subjects_taught": ["Mathematics", "Physics"],
          "has_assignments": true
        }
      }
    ],
    "total": 15,
    "summary": {
      "total_teachers": 15,
      "teachers_with_assignments": 12,
      "teachers_without_assignments": 3,
      "total_primary_assignments": 12,
      "total_subject_assignments": 25
    }
  }
}
```

**Key Features**:

- ✅ Complete teacher information with staff details
- ✅ All assignment types (primary, subject teacher, assistant, substitute)
- ✅ Subject information for subject teacher assignments
- ✅ Summary statistics for each teacher
- ✅ Overall summary for the school
- ✅ Sorted alphabetically by teacher name

### 4. Get Division Group Chat Messages

```http
GET /api/users/principal/division/:class_division_id/messages
```

**Access**: Admin, Principal only
**Description**: Get all group chat messages for a specific class division, including messages from class teachers and subject teachers

**Query Parameters**:

- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of messages per page (default: 50)
- `start_date` (optional): Filter messages from this date (ISO 8601 format)
- `end_date` (optional): Filter messages until this date (ISO 8601 format)
- `message_type` (optional): Filter by message type - `text`, `image`, `file`, or `all` (default: `all`)

**Response**:

```json
{
  "status": "success",
  "data": {
    "class_division": {
      "id": "uuid",
      "class_name": "Grade 10 A",
      "academic_year": "2024-2025",
      "division": "A"
    },
    "teachers": [
      {
        "assignment_id": "uuid",
        "teacher_id": "uuid",
        "full_name": "Teacher Name",
        "email": "teacher@school.com",
        "phone_number": "+1234567890",
        "assignment_type": "class_teacher",
        "subject": "Mathematics",
        "is_primary": true,
        "assigned_date": "2024-06-01T00:00:00Z"
      }
    ],
    "threads": [
      {
        "thread_id": "uuid",
        "thread_title": "Grade 10 A Group Chat",
        "thread_type": "group",
        "created_at": "2024-06-01T00:00:00Z",
        "updated_at": "2024-06-15T10:30:00Z",
        "participants": [
          {
            "user_id": "uuid",
            "role": "admin",
            "full_name": "Teacher Name",
            "user_role": "teacher"
          }
        ],
        "messages": [
          {
            "message_id": "uuid",
            "content": "Hello everyone!",
            "message_type": "text",
            "status": "sent",
            "created_at": "2024-06-15T10:30:00Z",
            "updated_at": "2024-06-15T10:30:00Z",
            "sender": {
              "id": "uuid",
              "full_name": "Teacher Name",
              "role": "teacher",
              "email": "teacher@school.com"
            },
            "attachments": []
          }
        ]
      }
    ],
    "total_messages": 150,
    "pagination": {
      "page": 1,
      "limit": 50,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    },
    "summary": {
      "total_teachers": 5,
      "class_teachers": 1,
      "subject_teachers": 3,
      "assistant_teachers": 1,
      "substitute_teachers": 0,
      "total_threads": 3,
      "messages_found": 50,
      "unique_senders": 4
    }
  }
}
```

**Key Features**:

- ✅ Complete teacher coverage (class teachers, subject teachers, assistants, substitutes)
- ✅ All group chat messages from division teachers
- ✅ Message metadata (type, status, timestamps, attachments)
- ✅ Advanced filtering (date range, message type)
- ✅ Pagination support for large message volumes
- ✅ Organized by chat threads with participant details
- ✅ Comprehensive summary statistics

## Common Response Differences

### 1. View Student Details

```http
GET /api/academic/students/:student_id
```

**Class Teacher Response** (Full Access):

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid",
      "name": "Student Name",
      "admission_number": "2024001",
      "attendance": {
        "total_present": 150,
        "total_absent": 5,
        "percentage": 96.77
      },
      "subjects": [
        {
          "name": "Mathematics",
          "teacher": "Math Teacher",
          "performance": {
            "assignments_completed": 25,
            "assignments_pending": 2,
            "average_score": 85
          }
        }
      ],
      "parents": [
        {
          "id": "uuid",
          "name": "Parent Name",
          "relationship": "father",
          "contact": "+1234567890"
        }
      ],
      "leave_history": [
        {
          "id": "uuid",
          "from_date": "2024-03-01",
          "to_date": "2024-03-02",
          "status": "approved"
        }
      ]
    }
  }
}
```

**Subject Teacher Response** (Limited Access):

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid",
      "name": "Student Name",
      "admission_number": "2024001",
      "subject_performance": {
        "subject": "Physics",
        "assignments_completed": 20,
        "assignments_pending": 1,
        "average_score": 85,
        "attendance_in_subject": "92%"
      }
    }
  }
}
```

### 2. View Calendar Events

```http
GET /api/calendar/events
```

**Class Teacher Response**:

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

**Subject Teacher Response**:

```json
{
  "status": "success",
  "data": {
    "events": [
      {
        "id": "uuid",
        "title": "Physics Lab Session",
        "description": "Practical examination",
        "date": "2024-03-20",
        "type": "subject_event",
        "subject": {
          "id": "uuid",
          "name": "Physics"
        },
        "class_division": {
          "id": "uuid",
          "name": "10-A"
        }
      }
    ]
  }
}
```

## Staff Birthday Management

### 1. Update Staff Date of Birth

```http
PUT /api/users/staff/:id/date-of-birth
```

**Access**: Admin only
**Description**: Update date of birth for staff members (teachers, principals, admins)

**Request Body**:

```json
{
  "date_of_birth": "1985-03-15"
}
```

**Response**:

```json
{
  "status": "success",
  "message": "Staff date of birth updated successfully",
  "data": {
    "staff": {
      "id": "uuid",
      "full_name": "John Smith",
      "role": "teacher",
      "date_of_birth": "1985-03-15"
    }
  }
}
```

### 2. Get Staff Birthdays

```http
GET /api/users/staff/birthdays
```

**Access**: Admin, Principal
**Description**: Get staff birthdays with upcoming birthday calculations

**Query Parameters**:

- `date` (optional): Filter by specific date (YYYY-MM-DD format)
- `upcoming_days` (optional): Number of days to look ahead for upcoming birthdays (default: 30)

**Response**:

```json
{
  "status": "success",
  "data": {
    "staff": [
      {
        "id": "uuid",
        "full_name": "John Smith",
        "role": "teacher",
        "date_of_birth": "1985-03-15",
        "email": "john.smith@school.com",
        "phone_number": "+1234567890",
        "days_until_birthday": 45,
        "is_upcoming": true
      }
    ],
    "summary": {
      "total_staff": 5,
      "upcoming_birthdays": 2,
      "filter_date": null,
      "upcoming_days": 30
    }
  }
}
```
