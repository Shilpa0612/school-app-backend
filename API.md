# School App API Documentation

## Base URL

```
http://localhost:3000/api
```

### Authentication

#### Register User

```http
POST /auth/register
```

**Body:**

```json
{
    "phone_number": "1234567890",
    "password": "password123",
    "role": "parent" | "teacher" | "admin" | "principal",
    "full_name": "John Doe"
}
```

**Response:**
`For Teacher`
{
"status": "success",
"data": {
"user": {
"id": "df07bb9f-4ffe-47f7-9a0d-5fc0e3896a51",
"phone_number": "1234567893",
"role": "teacher",
"full_name": "Teacher 1"
},
"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZjA3YmI5Zi00ZmZlLTQ3ZjctOWEwZC01ZmMwZTM4OTZhNTEiLCJyb2xlIjoidGVhY2hlciIsImlhdCI6MTc1MzQyODI2MSwiZXhwIjoxNzUzNTE0NjYxfQ.pHfDbjg0jct9ojg3NOcj3xlxw_jZKdUGta0sW4z4gJU"
}
}

#### Register First System Admin

```http
POST /api/system/register-first-admin
```

**Body:**

```json
{
  "phone_number": "1234567890",
  "password": "Password123!",
  "full_name": "Admin Name",
  "email": "admin@example.com"
}
```

**Notes:**

- This endpoint is only available when no system admin exists
- Password must contain uppercase, lowercase, number and special character
- Phone number must be exactly 10 digits

**Response:** Created admin object

#### Login

```http
POST /auth/login
```

**Body:**

```json
{
  "phone_number": "1234567890",
  "password": "password123"
}
```

**Response:** User object with JWT token

### User Management

#### Get User Profile

```http
GET /users/profile
```

**Response:** User profile details

#### Update User Profile

```http
PUT /users/profile
```

**Body:**

```json
{
    "full_name": "John Doe",
    "email": "john@example.com",
    "preferred_language": "english" | "hindi" | "marathi"
}
```

**Response:** Updated user profile

#### Get Children (Parents Only)

```http
GET /users/children
```

**Response:** List of children with their class details

### Messages

#### Send Message

```http
POST /messages
```

**Body:**

```json
{
    "content": "Message content",
    "type": "individual" | "group" | "announcement",
    "class_id": "uuid", // Optional
    "recipient_id": "uuid" // Optional
}
```

**Response:** Created message object

#### Get Messages

```http
GET /messages
```

**Query Parameters:**

- `status`: Filter by status (pending, approved, rejected)
- `class_id`: Filter by class ID

**Response:** List of messages

#### Approve Message

```http
PUT /messages/:id/approve
```

**Response:** Updated message object

#### Reject Message

```http
PUT /messages/:id/reject
```

**Response:** Updated message object

### Homework

#### Create Homework (Teacher Only)

```http
POST /homework
```

**Body:**

```json
{
  "class_id": "uuid",
  "subject": "Mathematics",
  "title": "Homework title",
  "description": "Detailed description",
  "due_date": "2024-01-01T00:00:00Z"
}
```

**Response:** Created homework object

#### Get Homework List

```http
GET /homework
```

**Query Parameters:**

- `class_division_id`: Filter by class division ID
- `subject`: Filter by subject
- `teacher_id`: Filter by teacher ID (admin/principal only)
- `academic_year_id`: Filter by academic year
- `class_level_id`: Filter by class level (Grade 1, Grade 2, etc.)
- `due_date_from`: Filter homework due from this date
- `due_date_to`: Filter homework due until this date
- `status`: Filter by status (`overdue`, `upcoming`)
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20, max: 100)

**Response:**

```json
{
  "status": "success",
  "data": {
    "homework": [
      {
        "id": "uuid",
        "subject": "Mathematics",
        "title": "Addition Practice",
        "description": "Complete exercises 1-10",
        "due_date": "2025-07-30T23:59:59Z",
        "teacher": {
          "id": "uuid",
          "full_name": "Teacher Name"
        },
        "class_division": {
          "id": "uuid",
          "division": "A",
          "level": {
            "name": "Grade 1",
            "sequence_number": 1
          }
        },
        "attachments": []
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

#### Get Homework Details

```http
GET /homework/:id
```

**Response:** Homework details with attachments

#### Get Homework Filters

```http
GET /homework/filters
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "filters": {
      "subjects": ["Mathematics", "Science", "English"],
      "academic_years": [
        {
          "id": "uuid",
          "year_name": "2024-2025"
        }
      ],
      "class_levels": [
        {
          "id": "uuid",
          "name": "Grade 1",
          "sequence_number": 1
        }
      ],
      "class_divisions": [
        {
          "id": "uuid",
          "division": "A",
          "level": {
            "name": "Grade 1",
            "sequence_number": 1
          },
          "teacher": {
            "id": "uuid",
            "full_name": "Teacher Name"
          }
        }
      ],
      "teachers": [
        {
          "id": "uuid",
          "full_name": "Teacher Name"
        }
      ]
    }
  }
}
```

**Notes:**

- Available filters depend on user role
- Teachers see only their assigned classes
- Parents see only their children's classes
- Admin/Principal see all classes and teachers

#### Add Homework Attachments

```http
POST /homework/:id/attachments
```

**Body:** Form-data with files (max 5 files)

- Supported types: PDF, JPEG, PNG
- Max file size: 10MB

**Response:** List of created attachments

### Calendar

#### Create Event

```http
POST /calendar/events
```

**Body:**

```json
{
  "title": "Event title",
  "description": "Event description",
  "event_date": "2024-01-01T00:00:00Z"
}
```

**Response:** Created event object

#### Get Events

```http
GET /calendar/events
```

**Query Parameters:**

- `start_date`: Filter events from this date
- `end_date`: Filter events until this date

**Response:** List of events

#### Delete Event

```http
DELETE /calendar/events/:id
```

**Response:** Success message

### Leave Requests

#### Create Leave Request

```http
POST /leave-requests
```

**Body:**

```json
{
  "student_id": "uuid",
  "start_date": "2024-01-01T00:00:00Z",
  "end_date": "2024-01-02T00:00:00Z",
  "reason": "Reason for leave"
}
```

**Response:** Created leave request object

#### Get Leave Requests

```http
GET /leave-requests
```

**Query Parameters:**

- `status`: Filter by status (pending, approved, rejected)

**Response:** List of leave requests

#### Update Leave Request Status

```http
PUT /leave-requests/:id/status
```

**Body:**

```json
{
    "status": "approved" | "rejected"
}
```

**Response:** Updated leave request object

### Academic Management

#### Get Students Eligible for Promotion

```http
GET /api/academic/promotion-eligible/:academic_year_id
```

**Response:** List of students eligible for promotion with their current class details

#### Promote Selected Students

```http
POST /api/academic/promote-selected
```

**Body:**

```json
{
  "to_academic_year_id": "uuid",
  "promotions": [
    {
      "student_id": "uuid",
      "new_class_division_id": "uuid",
      "new_roll_number": "01"
    }
  ]
}
```

**Response:** List of promoted student records

#### Get Student Academic History

```http
GET /api/academic/student-history/:student_id
```

**Response:**

```json
{
  "academic_history": [
    {
      "academic_year": {
        "year_name": "2023-2024",
        "start_date": "2023-06-01",
        "end_date": "2024-03-31"
      },
      "class": {
        "division": "A",
        "level": {
          "name": "Grade 1",
          "sequence_number": 1
        },
        "teacher": {
          "full_name": "Teacher Name"
        }
      },
      "roll_number": "01",
      "status": "promoted"
    }
  ],
  "parents": [
    {
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full",
      "parent": {
        "full_name": "Parent Name",
        "phone_number": "1234567890",
        "email": "parent@example.com"
      }
    }
  ]
}
```

#### Link Multiple Students to Parent

```http
POST /api/academic/link-students
```

**Body:**

```json
{
  "parent_id": "uuid",
  "students": [
    {
      "student_id": "uuid",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full"
    }
  ]
}
```

**Response:** Created parent-student mappings

#### Update Parent-Student Relationship

```http
PUT /api/academic/update-parent-access/:mapping_id
```

**Body:**

```json
{
  "is_primary_guardian": true,
  "access_level": "full",
  "relationship": "father"
}
```

**Response:** Updated mapping details

### Academic Year Management

#### Create Academic Year (Admin/Principal Only)

```http
POST /api/academic/years
```

**Body:**

```json
{
  "year_name": "2024-2025",
  "start_date": "2024-06-01",
  "end_date": "2025-03-31",
  "is_active": true
}
```

**Notes:**

- Year name must be in format YYYY-YYYY
- Only one academic year can be active at a time
- If setting as active, other years will be deactivated

**Response:** Created academic year object

#### Get All Academic Years

```http
GET /api/academic/years
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "academic_years": [
      {
        "id": "uuid",
        "year_name": "2024-2025",
        "start_date": "2024-06-01",
        "end_date": "2025-03-31",
        "is_active": true,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### Get Active Academic Year

```http
GET /api/academic/years/active
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "academic_year": {
      "id": "uuid",
      "year_name": "2024-2025",
      "start_date": "2024-06-01",
      "end_date": "2025-03-31",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### Update Academic Year (Admin/Principal Only)

```http
PUT /api/academic/years/:id
```

**Body:**

```json
{
  "year_name": "2024-2025", // Optional
  "start_date": "2024-06-01", // Optional
  "end_date": "2025-03-31", // Optional
  "is_active": true // Optional
}
```

**Response:** Updated academic year object

#### Delete Academic Year (Admin Only)

```http
DELETE /api/academic/years/:id
```

**Notes:**

- Can only delete if no students are enrolled in that academic year
- Returns error if students are enrolled

**Response:**

```json
{
  "status": "success",
  "message": "Academic year deleted successfully"
}
```

### Class Management

#### Create Class Level (Admin/Principal Only)

```http
POST /api/academic/class-levels
```

**Body:**

```json
{
  "name": "Grade 1",
  "sequence_number": 1
}
```

**Response:** Created class level object

#### Get All Class Levels

```http
GET /api/academic/class-levels
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_levels": [
      {
        "id": "36bb861b-eed6-4038-8ad4-524441cde543",
        "name": "Grade 1",
        "sequence_number": 1,
        "created_at": "2025-07-25T07:15:37.489402+00:00"
      },
      {
        "id": "1e85bc0f-8fe5-4c25-9a19-1f6cc9f36d20",
        "name": "Grade 2",
        "sequence_number": 2,
        "created_at": "2025-07-25T07:17:07.9027+00:00"
      },
      {
        "id": "0da58ae9-5f0b-4617-8f1d-66090dcd26f9",
        "name": "Grade 3",
        "sequence_number": 3,
        "created_at": "2025-07-25T07:17:18.715633+00:00"
      }
    ]
  }
}
```

#### Create Class Division (Admin/Principal Only)

```http
POST /api/academic/class-divisions
```

**Body:**

```json
{
  "academic_year_id": "uuid",
  "class_level_id": "uuid",
  "division": "A",
  "teacher_id": "uuid" // Optional
}
```

**Response:** Created class division object

#### Get Class Divisions

```http
GET /api/academic/class-divisions
```

**Query Parameters:**

- `academic_year_id`: (Optional) Filter by academic year

**Response:**

```json
{
  "class_divisions": [
    {
      "id": "uuid",
      "academic_year": {
        "year_name": "2024-2025"
      },
      "class_level": {
        "name": "Grade 1",
        "sequence_number": 1
      },
      "division": "A",
      "teacher": {
        "id": "uuid",
        "full_name": "Teacher Name"
      }
    }
  ]
}
```

#### Update Class Division (Admin/Principal Only)

```http
PUT /api/academic/class-divisions/:id
```

**Body:**

```json
{
  "teacher_id": "uuid" // Optional
}
```

**Response:** Updated class division object

### Student Management

#### Create New Student (Admin/Principal Only)

```http
POST /api/students
```

**Body:**

```json
{
  "admission_number": "2024001",
  "full_name": "Student Name",
  "date_of_birth": "2018-01-01",
  "admission_date": "2024-01-01",
  "class_division_id": "uuid",
  "roll_number": "01"
}
```

**Response:** Created student object with academic record

#### Link Student to Parent (Admin/Principal Only)

```http
POST /api/students/:student_id/link-parent
```

**Body:**

```json
{
    "parent_id": "uuid",
    "relationship": "father" | "mother" | "guardian",
    "is_primary_guardian": true,
    "access_level": "full" | "restricted" | "readonly"
}
```

**Response:** Created parent-student mapping

#### Get Student Details

```http
GET /api/students/:student_id
```

**Response:**

```json
{
  "student": {
    "id": "uuid",
    "admission_number": "2024001",
    "full_name": "Student Name",
    "date_of_birth": "2018-01-01",
    "admission_date": "2024-01-01",
    "status": "active",
    "academic_records": [
      {
        "id": "uuid",
        "class_division": {
          "division": "A",
          "class_level": {
            "name": "Grade 1",
            "sequence_number": 1
          }
        },
        "roll_number": "01",
        "status": "ongoing"
      }
    ],
    "guardians": [
      {
        "relationship": "father",
        "is_primary_guardian": true,
        "access_level": "full",
        "parent": {
          "id": "uuid",
          "full_name": "Parent Name",
          "phone_number": "1234567890",
          "email": "parent@example.com"
        }
      }
    ]
  }
}
```

## Error Codes

- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Invalid or missing token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `422`: Unprocessable Entity - Validation error
- `500`: Internal Server Error

## Rate Limiting

- 100 requests per minute per IP
- 1000 requests per hour per user

## File Upload Limits

- Maximum file size: 10MB
- Supported file types: PDF, JPEG, PNG
- Maximum files per request: 5

## Websocket Events

### Connection

```javascript
const socket = supabase.channel("app-events");
```

### Available Events

#### Messages

- `new_message`: New message created
- `message_status_changed`: Message approved/rejected

#### Homework

- `new_homework`: New homework assigned
- `homework_updated`: Homework details updated

#### Leave Requests

- `leave_request_status_changed`: Leave request approved/rejected

#### Calendar

- `new_event`: New calendar event created
- `event_deleted`: Calendar event deleted
