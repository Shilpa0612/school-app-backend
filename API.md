# School App API Documentation

## Base URL

```
http://localhost:3000/api

Deployed URL:
https://school-app-backend-d143b785b631.herokuapp.com/
```

## 📊 **API Status: 97% Complete**

**Total Endpoints**: 150+ endpoints implemented
**Core Features**: All major features completed
**Real-time**: WebSocket + Supabase Realtime implemented
**Push Notifications**: Firebase SDK installed, implementation in progress

### Authentication

#### Create Parent Record (Admin/Principal Only)

```http
POST /auth/create-parent
```

**Body:**

```json
{
  "full_name": "Parent Name",
  "phone_number": "1234567890",
  "email": "parent@example.com",
  "student_details": [
    {
      "admission_number": "ADM123",
      "relationship": "father",
      "is_primary_guardian": true
    },
    {
      "admission_number": "ADM124",
      "relationship": "father",
      "is_primary_guardian": false
    }
  ]
}
```

**Notes:**

- Available for Admin and Principal only
- Creates parent record without password
- Uses existing `/api/academic/link-students` endpoint for parent-student mappings
- Validates students exist in database
- Parent can then register using their phone number

**Response:**

```json
{
  "status": "success",
  "data": {
    "parent": {
      "id": "uuid",
      "full_name": "Parent Name",
      "phone_number": "1234567890",
      "email": "parent@example.com",
      "role": "parent",
      "is_registered": false
    },
    "students": [
      {
        "id": "uuid",
        "admission_number": "ADM123",
        "full_name": "Student Name"
      }
    ],
    "mappings": [
      {
        "relationship": "father",
        "is_primary_guardian": true,
        "access_level": "full"
      }
    ],
    "registration_instructions": {
      "message": "Parent can now register using their phone number",
      "endpoint": "POST /api/auth/register",
      "required_fields": ["phone_number", "password", "role: \"parent\""]
    }
  },
  "message": "Parent record created successfully. Parent can now register using their phone number."
}
```

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

**Notes:**

- For new users: Creates complete user account
- For existing parents: Completes registration if parent record exists but `is_registered: false`

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
    "class_division_id": "uuid", // Optional - for class-specific messages
    "recipient_id": "uuid" // Optional - for individual messages
}
```

**Response:** Created message object

#### Get Messages

```http
GET /messages
```

**Query Parameters:**

- `status`: Filter by status (pending, approved, rejected)
- `class_division_id`: Filter by class division ID (for teachers)
- `child_id`: Filter messages by specific child (for parents)
- `student_id`: Filter messages by specific student (alternative to child_id for parents)

**Access Control:**

- **Teachers**: Can see messages they sent, received, and for their assigned classes
- **Parents**: Can see:
  - Messages sent to them directly
  - **Common messages** (approved messages with no class_division_id) - shown to all students
  - **Class-specific messages** (approved messages with class_division_id) - shown to students in that class
  - **Individual messages** - shown to specific recipient
- **Parents with multiple children**: Messages show `children_affected` array with child details
- **Admin/Principal**: Can see all messages (pending, approved, rejected)

**Response:** List of messages

**Example Response (Parent with multiple children):**

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "message-id",
        "content": "Math homework due tomorrow",
        "type": "group",
        "status": "approved",
        "class_division_id": "class-5a-id",
        "class": {
          "id": "class-5a-id",
          "division": "A",
          "academic_year": {
            "year_name": "2024-25"
          },
          "class_level": {
            "name": "Grade 5",
            "sequence_number": 5
          }
        },
        "children_affected": [
          {
            "student_id": "john-id",
            "student_name": "John Smith",
            "roll_number": "001"
          },
          {
            "student_id": "jane-id",
            "student_name": "Jane Smith",
            "roll_number": "002"
          }
        ],
        "class_students_count": 2,
        "sender": {
          "id": "teacher-id",
          "full_name": "Mrs. Johnson",
          "role": "teacher"
        }
      }
    ]
  }
}
```

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

### Classwork

#### Create Classwork (Teacher Only)

```http
POST /classwork
```

**Body:**

```json
{
  "class_division_id": "uuid",
  "subject": "Mathematics",
  "summary": "Today we covered basic addition and subtraction",
  "topics_covered": ["Addition", "Subtraction", "Number Line"],
  "date": "2024-01-15",
  "is_shared_with_parents": true
}
```

**Response:** Created classwork object

#### Get Classwork List

```http
GET /classwork
```

**Query Parameters:**

- `class_division_id`: Filter by class division ID
- `subject`: Filter by subject
- `date_from`: Filter from this date
- `date_to`: Filter until this date
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Teachers see their own classwork
- Parents see shared classwork for their children's classes
- Admin/Principal can see all classwork

**Response:**

```json
{
  "status": "success",
  "data": {
    "classwork": [
      {
        "id": "uuid",
        "class_division_id": "uuid",
        "teacher_id": "uuid",
        "subject": "Mathematics",
        "summary": "Today we covered basic addition and subtraction",
        "topics_covered": ["Addition", "Subtraction", "Number Line"],
        "date": "2024-01-15",
        "is_shared_with_parents": true,
        "created_at": "2024-01-15T10:00:00Z",
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
        "attachments": [...],
        "topics": [
          {
            "id": "uuid",
            "topic_name": "Addition",
            "topic_description": null
          }
        ]
      }
    ],
    "count": 5,
    "total_count": 15,
    "pagination": {...}
  }
}
```

#### Get Specific Classwork

```http
GET /classwork/:id
```

**Response:** Detailed classwork object with attachments and topics

#### Update Classwork (Teacher Only)

```http
PUT /classwork/:id
```

**Body:**

```json
{
  "subject": "Mathematics",
  "summary": "Updated summary",
  "topics_covered": ["Updated Topic 1", "Updated Topic 2"],
  "is_shared_with_parents": false
}
```

**Response:** Updated classwork object

#### Delete Classwork (Teacher Only)

```http
DELETE /classwork/:id
```

**Response:** Success message

#### Add Attachments to Classwork

```http
POST /classwork/:id/attachments
```

**Body:** Form-data with files (max 5 files)

**Response:** List of created attachments

#### Get Classwork by Class and Date Range

```http
GET /classwork/class/:class_division_id
```

**Query Parameters:**

- `date_from`: Start date (default: 30 days ago)
- `date_to`: End date (default: today)
- `page`: Page number for pagination
- `limit`: Number of items per page

**Response:**

```json
{
  "status": "success",
  "data": {
    "classwork": [...],
    "count": 5,
    "total_count": 15,
    "date_range": {
      "from": "2024-01-01",
      "to": "2024-01-15"
    },
    "pagination": {...}
  }
}
```

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
  "title": "Event title", // Required
  "description": "Event description", // Required
  "event_date": "2024-01-01T00:00:00Z", // Required
  "event_type": "school_wide", // Required
  "class_division_id": "uuid", // Optional - only for class_specific events
  "is_single_day": true, // Optional - defaults to true
  "start_time": "09:00:00", // Optional - for timed events
  "end_time": "10:00:00", // Optional - for timed events
  "event_category": "general", // Optional - defaults to "general"
  "timezone": "Asia/Kolkata" // Optional - defaults to "Asia/Kolkata"
}
```

**Required Fields:**

- `title`: Event title
- `description`: Event description
- `event_date`: Event date and time
- `event_type`: Type of event

**Optional Fields:**

- `class_division_id`: Only required for `class_specific` events
- `is_single_day`: Defaults to `true`
- `start_time` and `end_time`: For timed events (optional for all-day events)
- `event_category`: Defaults to `"general"`
- `timezone`: Defaults to `"Asia/Kolkata"`

**Event Type Rules:**

- `school_wide`: No `class_division_id` needed
- `teacher_specific`: No `class_division_id` needed
- `class_specific`: `class_division_id` is required

**Event Types:**

- `school_wide`: Visible to all users (Admin/Principal only)
- `class_specific`: Visible to specific class (Teachers can create for their classes)
- `teacher_specific`: Teacher-specific events (only visible to the teacher who created them)

**Event Categories:**

- `general`, `academic`, `sports`, `cultural`, `holiday`, `exam`, `meeting`, `other`

**Access Control:**

- **Admin/Principal**: Can create all event types
- **Teachers**: Can create class-specific events for their assigned classes
- **Parents**: Can only view events

**Response:** Created event object

#### Get Events

```http
GET /calendar/events
```

**Query Parameters:**

- `start_date`: Filter events from this date
- `end_date`: Filter events until this date
- `class_division_id`: Filter by specific class
- `event_type`: Filter by event type (`school_wide`, `class_specific`, `teacher_specific`)
- `event_category`: Filter by category
- `use_ist`: Set to `true` to get events in IST timezone (default: `true`)

**Response:** List of events with IST timezone conversion

**Example Response:**

```json
{
  "status": "success",
  "data": {
    "events": [
      {
        "id": "uuid",
        "title": "Parent-Teacher Meeting",
        "description": "Monthly parent-teacher meeting",
        "event_date": "2024-01-15T09:00:00Z",
        "event_date_ist": "2024-01-15T14:30:00+05:30",
        "start_time": "09:00:00",
        "end_time": "10:00:00",
        "is_single_day": true,
        "event_type": "class_specific",
        "event_category": "meeting",
        "class_division_id": "uuid",
        "timezone": "Asia/Kolkata",
        "created_by": "uuid",
        "created_at": "2024-01-10T10:00:00Z",
        "creator_name": "Teacher Name",
        "creator_role": "teacher",
        "class_info": {
          "id": "uuid",
          "division": "A",
          "academic_year": "2024-2025",
          "class_level": "Grade 1"
        }
      }
    ]
  }
}
```

#### Get Event by ID

```http
GET /calendar/events/:id
```

**Query Parameters:**

- `use_ist`: Set to `true` to get event in IST timezone (default: `true`)

**Response:** Single event object

#### Update Event

```http
PUT /calendar/events/:id
```

**Body:** Same as create event (all fields optional)

**Access Control:**

- Event creator can update their own events
- Admin/Principal can update any event

**Response:** Updated event object

#### Delete Event

```http
DELETE /calendar/events/:id
```

**Access Control:**

- Event creator can delete their own events
- Admin/Principal can delete any event

**Response:** Success message

#### Get Class-Specific Events

```http
GET /calendar/events/class/:class_division_id
```

**Query Parameters:**

- `start_date`: Filter events from this date
- `end_date`: Filter events until this date
- `event_category`: Filter by category

**Access Control:**

- Teachers can view events for their assigned classes
- Admin/Principal can view all class events

**Response:** List of class-specific events

#### Get Parent Events (School-wide + Class-specific)

```http
GET /calendar/events/parent
```

**Query Parameters:**

- `start_date`: Filter events from this date
- `end_date`: Filter events until this date
- `event_category`: Filter by category
- `use_ist`: Set to `true` to get events in IST timezone (default: `true`)

**Access Control:**

- Only parents can access this endpoint
- Returns both school-wide events and class-specific events for their children's classes

**Response:** List of all relevant events for the parent

**Example Response:**

```json
{
  "status": "success",
  "data": {
    "events": [
      {
        "id": "uuid",
        "title": "School Annual Day",
        "description": "Annual day celebration",
        "event_date": "2024-01-15T09:00:00Z",
        "event_date_ist": "2024-01-15T14:30:00+05:30",
        "event_type": "school_wide",
        "event_category": "cultural",
        "is_single_day": true,
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        "timezone": "Asia/Kolkata",
        "created_by": "uuid",
        "created_at": "2024-01-10T10:00:00Z",
        "creator_name": "Principal Name",
        "creator_role": "principal"
      },
      {
        "id": "uuid",
        "title": "Class 5A Parent Meeting",
        "description": "Monthly parent-teacher meeting",
        "event_date": "2024-01-20T14:00:00Z",
        "event_date_ist": "2024-01-20T19:30:00+05:30",
        "event_type": "class_specific",
        "class_division_id": "uuid",
        "event_category": "meeting",
        "is_single_day": true,
        "start_time": "14:00:00",
        "end_time": "15:00:00",
        "timezone": "Asia/Kolkata",
        "created_by": "uuid",
        "created_at": "2024-01-12T10:00:00Z",
        "creator_name": "Teacher Name",
        "creator_role": "teacher",
        "class_division": "A",
        "class_level": "Grade 5",
        "academic_year": "2024-2025"
      }
    ],
    "child_classes": [
      {
        "id": "uuid",
        "division": "A",
        "academic_year": {
          "year_name": "2024-2025"
        },
        "class_level": {
          "name": "Grade 5"
        }
      }
    ]
  }
}
```

#### Enhanced Features

**Single Day Events:**

- `is_single_day`: Boolean field to mark single-day vs multi-day events
- `start_time` and `end_time`: For precise scheduling of timed events
- Better handling of all-day vs timed events

**IST Timezone Support:**

- Automatic UTC to IST conversion
- `timezone` field with default 'Asia/Kolkata'
- `use_ist=true` query parameter for IST display
- All events displayed in Indian Standard Time

**Class-Specific Events:**

- Teachers can create events for their assigned classes
- Parents see events for their children's classes
- Better organization and filtering

**Enhanced Access Control:**

- Role-based permissions for all operations
- Teachers can manage their class events
- Parents can view relevant events

**Event Categories:**

- Better organization and filtering
- Different categories for different purposes
- All events are one-time only (no recurring events)

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

**Access Control:**

- Teachers can approve/reject leave requests
- Principals can approve/reject leave requests
- Admins can approve/reject leave requests

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

### Birthday Management

#### Get Today's Birthdays

```http
GET /api/birthdays/today
```

**Query Parameters:**

- `class_division_id` (optional): Filter by specific class division
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 20)

**Notes:**

- Available for Admin, Principal, and Teachers
- Returns only active students with current academic records
- Includes class and roll number information
- Can be filtered by specific class division

**Response:**

```json
{
  "status": "success",
  "data": {
    "birthdays": [
      {
        "id": "uuid",
        "full_name": "Student Name",
        "date_of_birth": "2018-05-15",
        "admission_number": "2024001",
        "status": "active",
        "academic_records": [
          {
            "class_division": {
              "division": "A",
              "level": {
                "name": "Grade 1",
                "sequence_number": 1
              }
            },
            "roll_number": "01"
          }
        ]
      }
    ],
    "count": 3,
    "total_count": 3,
    "date": "2024-01-15",
    "class_division_id": "uuid-or-null",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

#### Get Upcoming Birthdays (Next 7 Days)

```http
GET /api/birthdays/upcoming
```

**Query Parameters:**

- `class_division_id` (optional): Filter by specific class division
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 20)

**Notes:**

- Available for Admin, Principal, and Teachers
- Returns birthdays for the next 7 days
- Only includes active students with current academic records
- Can be filtered by specific class division

**Response:**

```json
{
  "status": "success",
  "data": {
    "upcoming_birthdays": [
      {
        "date": "2024-01-15",
        "students": [
          {
            "id": "uuid",
            "full_name": "Student Name",
            "date_of_birth": "2018-01-15",
            "admission_number": "2024001",
            "academic_records": [...]
          }
        ],
        "count": 2
      }
    ],
    "total_count": 5,
    "class_division_id": "uuid-or-null",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

#### Get Birthday Statistics

```http
GET /api/birthdays/statistics
```

**Notes:**

- Available for Admin and Principal only
- Returns monthly birthday distribution for current year
- Includes total active students count

**Response:**

```json
{
  "status": "success",
  "data": {
    "monthly_statistics": [
      {
        "month": 1,
        "month_name": "January",
        "count": 25
      }
    ],
    "today_count": 3,
    "total_active_students": 300
  }
}
```

#### Get Class Birthdays (Teacher Only)

```http
GET /api/birthdays/class/:class_division_id
```

**Notes:**

- Available for Teachers only
- Returns birthdays for students in the teacher's assigned class
- Verifies teacher is assigned to the specified class

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_birthdays": [
      {
        "id": "uuid",
        "full_name": "Student Name",
        "date_of_birth": "2018-01-15",
        "admission_number": "2024001",
        "academic_records": [...]
      }
    ],
    "count": 1,
    "date": "2024-01-15"
  }
}
```

#### Get Division Birthdays (Admin/Principal/Teacher)

```http
GET /api/birthdays/division/:class_division_id
```

**Query Parameters:**

- `date` (optional): Specific date to check (YYYY-MM-DD format, defaults to today)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 20)

**Notes:**

- Available for Admin, Principal, and Teachers
- Admin/Principal can access any division
- Teachers can only access their assigned divisions
- Can check birthdays for any specific date
- Includes class division information

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_division": {
      "id": "uuid",
      "division": "A",
      "level": {
        "name": "Grade 1",
        "sequence_number": 1
      }
    },
    "birthdays": [
      {
        "id": "uuid",
        "full_name": "Student Name",
        "date_of_birth": "2018-05-15",
        "admission_number": "2024001",
        "status": "active",
        "student_academic_records": [
          {
            "class_division_id": "uuid",
            "roll_number": "01"
          }
        ]
      }
    ],
    "count": 2,
    "total_count": 2,
    "date": "2024-01-15",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
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

#### Teacher-Class Assignments (Many-to-Many)

```http
GET /api/academic/class-divisions/:id/teachers
```

- Returns all teachers assigned to a class division

```http
POST /api/academic/class-divisions/:id/assign-teacher
```

Body:

```json
{
  "teacher_id": "uuid",
  "assignment_type": "class_teacher | subject_teacher | assistant_teacher | substitute_teacher",
  "is_primary": false
}
```

```http
DELETE /api/academic/class-divisions/:id/remove-teacher/:teacher_id?assignment_type=subject_teacher
```

- Removes/deactivates a teacher's assignment from a class (optionally by assignment_type)

```http
PUT /api/academic/class-divisions/:id/teacher-assignment/:assignment_id
```

Body:

```json
{
  "assignment_type": "class_teacher | subject_teacher | assistant_teacher | substitute_teacher",
  "is_primary": true
}
```

```http
GET /api/academic/teachers/:teacher_id/classes
```

- Returns all classes a teacher is assigned to (with assignment details)

```http
POST /api/academic/bulk-assign-teachers
```

Body:

```json
{
  "assignments": [
    {
      "class_division_id": "uuid",
      "teacher_id": "uuid",
      "assignment_type": "class_teacher",
      "is_primary": true
    }
  ]
}
```

Notes:

- All new endpoints are under the `academic` router prefix: use `/api/academic/...`
- Only one primary teacher is allowed per class; attempting to create another will return an error
- Removing an assignment is a soft delete (`is_active = false`)

### Student Management

#### Get All Students (Admin/Principal Only)

```http
GET /api/students
```

**Query Parameters:**

- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)
- `search`: Search by student name or admission number
- `class_division_id`: Filter by class division
- `class_level_id`: Filter by class level (Grade 1, Grade 2, etc.)
- `academic_year_id`: Filter by academic year
- `status`: Filter by status (default: 'active')
- `unlinked_only`: Show only students without parents (true/false)

**Response:**

```json
{
  "status": "success",
  "data": {
    "students": [
      {
        "id": "uuid",
        "full_name": "Student Name",
        "admission_number": "ADM2024001",
        "date_of_birth": "2018-01-01",
        "admission_date": "2024-01-01",
        "status": "active",
        "student_academic_records": [
          {
            "id": "uuid",
            "roll_number": "01",
            "status": "ongoing",
            "class_division": {
              "id": "uuid",
              "division": "A",
              "level": {
                "id": "uuid",
                "name": "Grade 1",
                "sequence_number": 1
              },
              "academic_year": {
                "id": "uuid",
                "year_name": "2024-2025"
              },
              "teacher": {
                "id": "uuid",
                "full_name": "Teacher Name"
              }
            }
          }
        ],
        "parent_student_mappings": [
          {
            "id": "uuid",
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
    ],
    "count": 25,
    "total_count": 300,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 300,
      "total_pages": 15,
      "has_next": true,
      "has_prev": false
    },
    "filters": {
      "search": "John",
      "class_division_id": null,
      "class_level_id": null,
      "academic_year_id": null,
      "status": "active",
      "unlinked_only": false
    },
    "available_filters": {
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
            "id": "uuid",
            "name": "Grade 1"
          },
          "teacher": {
            "id": "uuid",
            "full_name": "Teacher Name"
          },
          "academic_year": {
            "id": "uuid",
            "year_name": "2024-2025"
          }
        }
      ]
    }
  }
}
```

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

#### Get Students by Class Division

```http
GET /api/students/class/:class_division_id
```

**Notes:**

- Available for Admin, Principal, and Teachers
- Teachers can only access their assigned classes
- Returns students ordered by roll number

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_division": {
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
    },
    "students": [
      {
        "id": "uuid",
        "full_name": "Student Name",
        "admission_number": "2024001",
        "date_of_birth": "2018-01-01",
        "status": "active",
        "academic_records": [
          {
            "id": "uuid",
            "roll_number": "01",
            "status": "ongoing",
            "class_division_id": "uuid"
          }
        ]
      }
    ],
    "count": 25
  }
}
```

#### Get Students by Class Level

```http
GET /api/students/level/:class_level_id
```

**Notes:**

- Available for Admin and Principal only
- Returns students from all divisions of the specified level
- Ordered by division and roll number

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_level": {
      "id": "uuid",
      "name": "Grade 1",
      "sequence_number": 1
    },
    "class_divisions": [
      {
        "id": "uuid",
        "division": "A",
        "teacher": {
          "id": "uuid",
          "full_name": "Teacher Name"
        }
      }
    ],
    "students": [
      {
        "id": "uuid",
        "full_name": "Student Name",
        "admission_number": "2024001",
        "date_of_birth": "2018-01-01",
        "status": "active",
        "academic_records": [
          {
            "id": "uuid",
            "roll_number": "01",
            "status": "ongoing",
            "class_division": {
              "id": "uuid",
              "division": "A",
              "teacher": {
                "id": "uuid",
                "full_name": "Teacher Name"
              }
            }
          }
        ]
      }
    ],
    "count": 75
  }
}
```

#### Get Class Divisions Summary

```http
GET /api/students/divisions/summary
```

**Notes:**

- Available for Admin and Principal only
- Returns all class divisions with student counts
- Ordered by level sequence and division

**Response:**

```json
{
  "status": "success",
  "data": {
    "divisions": [
      {
        "id": "uuid",
        "division": "A",
        "level": {
          "id": "uuid",
          "name": "Grade 1",
          "sequence_number": 1
        },
        "teacher": {
          "id": "uuid",
          "full_name": "Teacher Name"
        },
        "student_count": 25
      }
    ],
    "total_divisions": 12,
    "total_students": 300
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

## 📈 **Implementation Status**

### ✅ **Completed Features (100%)**

- Authentication & Identity Management
- File Upload & Storage
- Homework Management
- Messages & Approvals System
- Leave Requests
- Calendar Events
- Academic Management
- Parent-Student Linking
- Birthday Management
- User Management
- Classwork Management
- Alerts System
- Chat System
- Lists Management (Uniforms, Books, Staff)
- Reports & Analytics
- Activity Planning
- Feedback System
- Real-time Messaging (WebSocket)

### ⚠️ **Partially Implemented (20-80%)**

- Push Notifications (Firebase SDK installed, logic pending)
- Content Localization (Database ready, UI pending)

### ❌ **Not Implemented**

- SMS Integration
- Dynamic Content Translation

## Rate Limiting

- 100 requests per minute per IP
- 1000 requests per hour per user

## File Upload Limits

- Maximum file size: 10MB
- Supported file types: PDF, JPEG, PNG
- Maximum files per request: 5

## Real-time Features

### WebSocket Connection

```javascript
const ws = new WebSocket("ws://localhost:3000?token=YOUR_JWT_TOKEN");
```

### Supabase Realtime

```javascript
const socket = supabase.channel("app-events");
```

### Available Events

#### Messages

- `new_message`: New message created
- `message_status_changed`: Message approved/rejected
- `message_read`: Message read status updated

#### Homework

- `new_homework`: New homework assigned
- `homework_updated`: Homework details updated

#### Leave Requests

- `leave_request_status_changed`: Leave request approved/rejected

#### Calendar

- `new_event`: New calendar event created
- `event_deleted`: Calendar event deleted

#### Alerts

- `new_alert`: New alert sent to recipients

#### Chat

- `new_chat_message`: New chat message
- `message_read`: Chat message read status

#### Classwork

- `new_classwork`: New classwork posted
- `classwork_updated`: Classwork updated

#### Activities

- `new_activity`: New activity created
- `activity_updated`: Activity details updated

## Push Notifications (In Progress)

### Firebase Configuration

The project has Firebase SDK installed and configured:

```javascript
// Environment variables required
FIREBASE_PROJECT_ID = your_firebase_project_id;
FIREBASE_PRIVATE_KEY = your_firebase_private_key;
FIREBASE_CLIENT_EMAIL = your_firebase_client_email;
```

### Implementation Status

- ✅ Firebase SDK installed (`firebase-admin: ^11.11.1`)
- ✅ Environment variables configured
- ⚠️ Notification sending logic (pending)
- ⚠️ Topic-based subscriptions (pending)
- ⚠️ Device token management (pending)

### Planned Endpoints

```http
POST /api/notifications/send
POST /api/notifications/subscribe
POST /api/notifications/unsubscribe
GET /api/notifications/history
```

### Alerts System

#### Create Alert (Draft)

```http
POST /api/alerts
```

**Body:**

```json
{
  "title": "Alert Title",
  "content": "Alert message content",
  "alert_type": "urgent" | "important" | "general",
  "recipient_type": "all" | "parents" | "teachers" | "students" | "specific_class",
  "class_division_id": "uuid" // Optional - for class-specific alerts (required when recipient_type is "specific_class")
}
```

**Notes:**

- Available for Admin and Principal only
- Creates alert in approved status (auto-approved)
- Ready to send immediately
- Can be school-wide or class-specific

**Response:**

```json
{
  "status": "success",
  "data": {
    "alert": {
      "id": "uuid",
      "title": "Alert Title",
      "content": "Alert message content",
      "alert_type": "general",
      "status": "approved",
      "sender_id": "uuid",
      "approved_by": "uuid",
      "approved_at": "2024-01-15T10:00:00Z",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### List Alerts

```http
GET /api/alerts
```

**Query Parameters:**

- `status`: Filter by status (approved, sent, rejected)
- `alert_type`: Filter by alert type
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for Admin and Principal only
- Returns alerts created by the user

**Response:**

```json
{
  "status": "success",
  "data": {
    "alerts": [
      {
        "id": "uuid",
        "title": "Alert Title",
        "content": "Alert message content",
        "alert_type": "general",
        "status": "approved",
        "sender_id": "uuid",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

#### Reject Alert

```http
PUT /api/alerts/:id/reject
```

**Body:**

```json
{
  "rejection_reason": "Reason for rejection"
}
```

**Notes:**

- Available for Principal only
- Changes status to rejected
- Requires rejection reason

**Response:**

```json
{
  "status": "success",
  "data": {
    "alert": {
      "id": "uuid",
      "status": "rejected",
      "rejection_reason": "Reason for rejection",
      "rejected_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Send Alert

```http
PUT /api/alerts/:id/send
```

**Notes:**

- Available for Admin and Principal only
- Changes status from approved to sent
- Delivers alert to recipients

**Response:**

```json
{
  "status": "success",
  "data": {
    "alert": {
      "id": "uuid",
      "status": "sent",
      "sent_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Chat System

#### List Chat Threads

```http
GET /api/chat/threads
```

**Query Parameters:**

- `thread_type`: Filter by type (direct, group)
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for Teachers and Parents
- Teachers see threads with parents of their students
- Parents see threads with their children's teachers

**Response:**

```json
{
  "status": "success",
  "data": {
    "threads": [
      {
        "id": "uuid",
        "thread_type": "direct",
        "title": "Chat with Parent Name",
        "participants": [
          {
            "id": "uuid",
            "full_name": "Teacher Name",
            "role": "teacher"
          },
          {
            "id": "uuid",
            "full_name": "Parent Name",
            "role": "parent"
          }
        ],
        "last_message": {
          "content": "Last message content",
          "created_at": "2024-01-15T10:00:00Z"
        },
        "unread_count": 2
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

#### Create Chat Thread

```http
POST /api/chat/threads
```

**Body:**

```json
{
  "thread_type": "direct" | "group",
  "title": "Thread Title",
  "participant_ids": ["uuid1", "uuid2"]
}
```

**Notes:**

- Available for Teachers and Parents
- Direct threads: 2 participants only
- Group threads: Multiple participants allowed

**Response:**

```json
{
  "status": "success",
  "data": {
    "thread": {
      "id": "uuid",
      "thread_type": "direct",
      "title": "Thread Title",
      "participants": [...],
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Get Messages

```http
GET /api/chat/messages
```

**Query Parameters:**

- `thread_id`: Filter by thread ID
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 50)

**Notes:**

- Available for thread participants only
- Messages are ordered by creation time (newest first)
- Includes read status information

**Response:**

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "uuid",
        "content": "Message content",
        "sender": {
          "id": "uuid",
          "full_name": "Sender Name",
          "role": "teacher"
        },
        "thread_id": "uuid",
        "is_read": false,
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "total_pages": 1
    }
  }
}
```

#### Send Message

```http
POST /api/chat/messages
```

**Body:**

```json
{
  "thread_id": "uuid",
  "content": "Message content"
}
```

**Notes:**

- Available for thread participants only
- Message is automatically marked as unread for other participants
- Supports real-time delivery

**Response:**

```json
{
  "status": "success",
  "data": {
    "message": {
      "id": "uuid",
      "content": "Message content",
      "sender": {
        "id": "uuid",
        "full_name": "Sender Name",
        "role": "teacher"
      },
      "thread_id": "uuid",
      "is_read": false,
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Update Message

```http
PUT /api/chat/messages/:id
```

**Body:**

```json
{
  "content": "Updated message content"
}
```

**Notes:**

- Available for message sender only
- Can only edit messages within 5 minutes of creation

**Response:**

```json
{
  "status": "success",
  "data": {
    "message": {
      "id": "uuid",
      "content": "Updated message content",
      "updated_at": "2024-01-15T10:05:00Z"
    }
  }
}
```

#### Delete Message

```http
DELETE /api/chat/messages/:id
```

**Notes:**

- Available for message sender only
- Can only delete messages within 5 minutes of creation

**Response:**

```json
{
  "status": "success",
  "message": "Message deleted successfully"
}
```

#### Add Participants to Thread

```http
POST /api/chat/threads/:id/participants
```

**Body:**

```json
{
  "participant_ids": ["uuid1", "uuid2"]
}
```

**Notes:**

- Available for thread participants only
- Only works for group threads
- Cannot add participants to direct threads

**Response:**

```json
{
  "status": "success",
  "data": {
    "thread": {
      "id": "uuid",
      "participants": [...]
    }
  }
}
```

#### Start Conversation (Create Thread + Send First Message)

```http
POST /api/chat/start-conversation
```

**Body:**

```json
{
  "participants": ["uuid1", "uuid2"],
  "message_content": "Hello! This is the first message.",
  "thread_type": "direct",
  "title": "Chat with Parent Name"
}
```

**Notes:**

- Available for Teachers and Parents
- Creates a chat thread and sends the first message in one operation
- `thread_type`: "direct" or "group" (default: "direct")
- `title`: Optional thread title (default: auto-generated)
- `participants`: Array of user IDs (minimum 2)
- `message_content`: Content of the first message

**Response:**

```json
{
  "status": "success",
  "data": {
    "thread": {
      "id": "uuid",
      "thread_type": "direct",
      "title": "Chat with Parent Name",
      "participants": [
        {
          "id": "uuid",
          "full_name": "Teacher Name",
          "role": "teacher"
        },
        {
          "id": "uuid",
          "full_name": "Parent Name",
          "role": "parent"
        }
      ],
      "created_at": "2024-01-15T10:00:00Z"
    },
    "message": {
      "id": "uuid",
      "content": "Hello! This is the first message.",
      "sender": {
        "id": "uuid",
        "full_name": "Teacher Name",
        "role": "teacher"
      },
      "thread_id": "uuid",
      "is_read": false,
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Real-time Messaging

#### Subscribe to Real-time Messages

```http
POST /api/chat/subscribe
```

**Body:**

```json
{
  "user_id": "uuid"
}
```

**Notes:**

- Subscribes user to real-time message updates
- Enables WebSocket connection for instant message delivery
- Returns subscription status

**Response:**

```json
{
  "status": "success",
  "data": {
    "subscription": {
      "user_id": "uuid",
      "status": "subscribed",
      "websocket_url": "ws://localhost:3000"
    }
  }
}
```

#### Get Offline Messages

```http
GET /api/chat/offline-messages
```

**Query Parameters:**

- `last_check_time`: ISO timestamp of last check (required)
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 50)

**Notes:**

- Fetches messages sent while user was offline
- `last_check_time`: When user last checked for messages
- Returns messages from all user's threads since that time

**Response:**

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "uuid",
        "content": "Message sent while offline",
        "sender": {
          "id": "uuid",
          "full_name": "Sender Name",
          "role": "teacher"
        },
        "thread_id": "uuid",
        "thread_title": "Chat with Parent",
        "is_read": false,
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "total_count": 5,
    "last_check_time": "2024-01-15T09:00:00Z",
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

#### Get Unread Message Count

```http
GET /api/chat/unread-count
```

**Notes:**

- Returns total unread messages across all user's threads
- Useful for showing notification badges

**Response:**

```json
{
  "status": "success",
  "data": {
    "unread_count": 12,
    "thread_breakdown": [
      {
        "thread_id": "uuid",
        "thread_title": "Chat with Parent",
        "count": 5
      },
      {
        "thread_id": "uuid",
        "thread_title": "Group Chat",
        "count": 7
      }
    ]
  }
}
```

#### Mark Messages as Read

```http
POST /api/chat/mark-read/:thread_id
```

**Body:**

```json
{
  "user_id": "uuid"
}
```

**Notes:**

- Marks all messages in a specific thread as read
- Updates `last_read_at` timestamp for the user in that thread

**Response:**

```json
{
  "status": "success",
  "data": {
    "thread_id": "uuid",
    "marked_read_at": "2024-01-15T10:00:00Z",
    "messages_marked": 5
  }
}
```

#### Unsubscribe from Real-time Messages

```http
POST /api/chat/unsubscribe
```

**Body:**

```json
{
  "user_id": "uuid"
}
```

**Notes:**

- Unsubscribes user from real-time message updates
- Closes WebSocket connection
- Stops receiving instant notifications

**Response:**

```json
{
  "status": "success",
  "data": {
    "subscription": {
      "user_id": "uuid",
      "status": "unsubscribed"
    }
  }
}
```

### WebSocket Connection

#### Connect to WebSocket

```javascript
const ws = new WebSocket("ws://localhost:3000?token=YOUR_JWT_TOKEN");

ws.onopen = () => {
  console.log("Connected to WebSocket");

  // Subscribe to a specific thread
  ws.send(
    JSON.stringify({
      type: "subscribe_thread",
      thread_id: "uuid",
    })
  );
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "new_message":
      console.log("New message:", data.message);
      break;
    case "message_read":
      console.log("Message read:", data.thread_id);
      break;
    case "pong":
      console.log("Ping response");
      break;
  }
};

ws.onclose = () => {
  console.log("WebSocket connection closed");
};
```

#### WebSocket Message Types

**Subscribe to Thread:**

```json
{
  "type": "subscribe_thread",
  "thread_id": "uuid"
}
```

**Ping (Keep Alive):**

```json
{
  "type": "ping"
}
```

**New Message (Received):**

```json
{
  "type": "new_message",
  "message": {
    "id": "uuid",
    "content": "Message content",
    "sender": {
      "id": "uuid",
      "full_name": "Sender Name",
      "role": "teacher"
    },
    "thread_id": "uuid",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

**Message Read (Received):**

```json
{
  "type": "message_read",
  "thread_id": "uuid",
  "user_id": "uuid",
  "read_at": "2024-01-15T10:00:00Z"
}
```

**Pong (Received):**

```json
{
  "type": "pong",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Lists Management

#### Uniforms

##### List Uniforms

```http
GET /api/lists/uniforms
```

**Query Parameters:**

- `grade_level`: Filter by grade level (e.g., "Grade 1")
- `gender`: Filter by gender (boys, girls, unisex)
- `season`: Filter by season (summer, winter, all)
- `is_required`: Filter by required status (true/false)
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for Admin, Principal, and Teachers
- Returns uniform catalog with pricing and specifications
- Grade levels should match class level names from your database

**Response:**

```json
{
  "status": "success",
  "data": {
    "uniforms": [
      {
        "id": "uuid",
        "name": "Summer Uniform",
        "description": "Light cotton uniform for summer",
        "grade_level": "Grade 1",
        "gender": "unisex",
        "season": "summer",
        "price": 500,
        "supplier": "School Supplies Co",
        "notes": "Available in multiple sizes",
        "is_required": true,
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "total_pages": 1
    }
  }
}
```

##### Create Uniform

```http
POST /api/lists/uniforms
```

**Body:**

```json
{
  "name": "Summer Uniform",
  "description": "Light cotton uniform for summer",
  "grade_level": "Grade 1",
  "gender": "unisex",
  "season": "summer",
  "price": 500,
  "supplier": "School Supplies Co",
  "notes": "Available in multiple sizes",
  "is_required": true
}
```

**Notes:**

- Available for Admin and Principal only
- Validates grade_level, gender, and season values
- Grade levels should match class level names from your database
- `is_required` defaults to true if not provided

**Response:**

```json
{
  "status": "success",
  "data": {
    "uniform": {
      "id": "uuid",
      "name": "Summer Uniform",
      "description": "Light cotton uniform for summer",
      "grade_level": "Grade 1",
      "gender": "unisex",
      "season": "summer",
      "price": 500,
      "supplier": "School Supplies Co",
      "notes": "Available in multiple sizes",
      "is_required": true,
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

##### Update Uniform

```http
PUT /api/lists/uniforms/:id
```

**Body:**

```json
{
  "name": "Updated Uniform Name",
  "description": "Updated description",
  "grade_level": "Grade 1",
  "gender": "unisex",
  "season": "summer",
  "price": 600,
  "supplier": "Updated Supplier",
  "notes": "Updated notes",
  "is_required": true
}
```

**Notes:**

- Available for Admin and Principal only
- All fields are optional
- Only allows fields that exist in the uniforms table: `name`, `description`, `grade_level`, `gender`, `season`, `price`, `supplier`, `notes`, `is_required`

**Response:**

```json
{
  "status": "success",
  "data": {
    "uniform": {
      "id": "uuid",
      "name": "Updated Uniform Name",
      "description": "Updated description",
      "grade_level": "Grade 1",
      "gender": "unisex",
      "season": "summer",
      "price": 600,
      "supplier": "Updated Supplier",
      "notes": "Updated notes",
      "is_required": true,
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

##### Delete Uniform

```http
DELETE /api/lists/uniforms/:id
```

**Notes:**

- Available for Admin and Principal only
- Permanently removes uniform from catalog

**Response:**

```json
{
  "status": "success",
  "message": "Uniform deleted successfully"
}
```

#### Books

##### List Books

```http
GET /api/lists/books
```

**Query Parameters:**

- `subject`: Filter by subject
- `grade`: Filter by grade level
- `publisher`: Filter by publisher
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for Admin, Principal, and Teachers
- Returns book catalog with pricing and details

**Response:**

```json
{
  "status": "success",
  "data": {
    "books": [
      {
        "id": "uuid",
        "title": "Mathematics Textbook",
        "author": "Author Name",
        "publisher": "Publisher Name",
        "subject": "Mathematics",
        "grade": "Grade 1",
        "isbn": "978-1234567890",
        "price": 250,
        "edition": "2024",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "total_pages": 2
    }
  }
}
```

##### Create Book

```http
POST /api/lists/books
```

**Body:**

```json
{
  "title": "Mathematics Textbook",
  "author": "Author Name",
  "publisher": "Publisher Name",
  "subject": "Mathematics",
  "grade_level": "Grade 1",
  "isbn": "978-1234567890",
  "price": 250,
  "edition": "2024"
}
```

**Notes:**

- Available for Admin and Principal only
- Validates ISBN format
- Checks for duplicate ISBN

**Response:**

```json
{
  "status": "success",
  "data": {
    "book": {
      "id": "uuid",
      "title": "Mathematics Textbook",
      "author": "Author Name",
      "publisher": "Publisher Name",
      "subject": "Mathematics",
      "grade": "Grade 1",
      "isbn": "978-1234567890",
      "price": 250,
      "edition": "2024",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

##### Update Book

```http
PUT /api/lists/books/:id
```

**Body:**

```json
{
  "title": "Updated Book Title",
  "price": 300,
  "edition": "2025"
}
```

**Notes:**

- Available for Admin and Principal only
- All fields are optional

**Response:**

```json
{
  "status": "success",
  "data": {
    "book": {
      "id": "uuid",
      "title": "Updated Book Title",
      "price": 300,
      "edition": "2025",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

##### Delete Book

```http
DELETE /api/lists/books/:id
```

**Notes:**

- Available for Admin and Principal only
- Permanently removes book from catalog

**Response:**

```json
{
  "status": "success",
  "message": "Book deleted successfully"
}
```

#### Staff

##### List Staff

```http
GET /api/lists/staff
```

**Query Parameters:**

- `department`: Filter by department
- `role`: Filter by role
- `subject`: Filter by subject taught
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for Admin, Principal, and Teachers
- Returns staff directory with contact information

**Response:**

```json
{
  "status": "success",
  "data": {
    "staff": [
      {
        "id": "uuid",
        "full_name": "Staff Name",
        "role": "teacher",
        "department": "Mathematics",
        "subject": "Mathematics",
        "phone_number": "1234567890",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 30,
      "total_pages": 2
    }
  }
}
```

##### Sync Teachers to Staff

```http
POST /api/lists/staff/sync
```

**Notes:**

- Available for Admin and Principal only
- Automatically creates staff records for users with "teacher" role
- Creates user accounts for staff who don't have them
- Uses default password: "Staff@123"

**Response:**

```json
{
  "status": "success",
  "message": "Teachers synced to staff table successfully",
  "data": {
    "synced": 5,
    "total_teachers": 8,
    "new_staff": [...],
    "created_users": [
      {
        "staff_id": "uuid",
        "user_id": "uuid",
        "phone_number": "1234567890",
        "default_password": "Staff@123"
      }
    ],
    "note": "Default password for new users is: Staff@123"
  }
}
```

##### Create Staff with User Account

```http
POST /api/lists/staff/with-user
```

**Body:**

```json
{
  "full_name": "Teacher Name",
  "phone_number": "1234567890",
  "role": "teacher",
  "department": "Mathematics",
  "designation": "Senior Teacher",
  "password": "MyPassword123",
  "user_role": "teacher"
}
```

**Notes:**

- Available for Admin and Principal only
- Creates both staff record and user account in one operation
- Automatically hashes password
- Validates phone number uniqueness

**Response:**

```json
{
  "status": "success",
  "message": "Staff member and user account created successfully",
  "data": {
    "staff": {
      "id": "uuid",
      "full_name": "Teacher Name",
      "phone_number": "1234567890",
      "role": "teacher",
      "department": "Mathematics",
      "designation": "Senior Teacher"
    },
    "user": {
      "id": "uuid",
      "full_name": "Teacher Name",
      "phone_number": "1234567890"
    },
    "login_credentials": {
      "phone_number": "1234567890",
      "password": "MyPassword123"
    }
  }
}
```

##### Create Staff Member

```http
POST /api/lists/staff
```

**Body:**

```json
{
  "full_name": "Staff Name",
  "role": "teacher",
  "department": "Mathematics",
  "phone_number": "1234567890"
}
```

**Notes:**

- Available for Admin and Principal only
- Validates phone number format
- Checks for duplicate phone numbers

**Response:**

```json
{
  "status": "success",
  "data": {
    "staff": {
      "id": "uuid",
      "full_name": "Staff Name",
      "role": "teacher",
      "department": "Mathematics",
      "phone_number": "1234567890",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

##### Update Staff Member

```http
PUT /api/lists/staff/:id
```

**Body:**

```json
{
  "full_name": "Updated Staff Name",
  "department": "Science",
  "designation": "Senior Teacher"
}
```

**Notes:**

- Available for Admin and Principal only
- All fields are optional
- Only allows fields that exist in the staff table: `full_name`, `phone_number`, `role`, `department`, `designation`, `is_active`

**Response:**

```json
{
  "status": "success",
  "data": {
    "staff": {
      "id": "uuid",
      "full_name": "Updated Staff Name",
      "department": "Science",
      "designation": "Senior Teacher",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

##### Delete Staff Member

```http
DELETE /api/lists/staff/:id
```

**Notes:**

- Available for Admin and Principal only
- Permanently removes staff member from directory

**Response:**

```json
{
  "status": "success",
  "message": "Staff member deleted successfully"
}
```

### Reports & Analytics

#### Analytics Summary

```http
GET /api/analytics/summary
```

**Query Parameters:**

- `date_from`: Start date (YYYY-MM-DD)
- `date_to`: End date (YYYY-MM-DD)

**Notes:**

- Available for Admin and Principal only
- Returns usage KPIs and statistics
- Defaults to current month if no dates provided

**Response:**

```json
{
  "status": "success",
  "data": {
    "summary": {
      "total_students": 300,
      "total_teachers": 25,
      "total_parents": 280,
      "active_homework": 45,
      "pending_messages": 12,
      "today_birthdays": 3,
      "upcoming_events": 5
    },
    "daily_stats": {
      "new_students": 5,
      "new_homework": 8,
      "new_messages": 15,
      "active_users": 150
    },
    "date_range": {
      "from": "2024-01-01",
      "to": "2024-01-31"
    }
  }
}
```

#### Daily Reports

```http
GET /api/analytics/daily
```

**Query Parameters:**

- `date_from`: Start date (YYYY-MM-DD)
- `date_to`: End date (YYYY-MM-DD)
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for Admin and Principal only
- Returns daily activity reports
- Includes user engagement metrics

**Response:**

```json
{
  "status": "success",
  "data": {
    "daily_reports": [
      {
        "date": "2024-01-15",
        "new_students": 2,
        "new_homework": 5,
        "new_messages": 8,
        "active_users": 120,
        "login_count": 85,
        "homework_completions": 12
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 31,
      "total_pages": 2
    }
  }
}
```

#### Generate Custom Report

```http
POST /api/analytics/reports
```

**Body:**

```json
{
  "report_type": "student_performance" | "teacher_activity" | "parent_engagement",
  "date_from": "2024-01-01",
  "date_to": "2024-01-31",
  "filters": {
    "class_division_id": "uuid",
    "subject": "Mathematics"
  }
}
```

**Notes:**

- Available for Admin and Principal only
- Generates reports in background
- Returns report ID for tracking

**Response:**

```json
{
  "status": "success",
  "data": {
    "report": {
      "id": "uuid",
      "report_type": "student_performance",
      "status": "processing",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### List Reports

```http
GET /api/analytics/reports
```

**Query Parameters:**

- `status`: Filter by status (processing, completed, failed)
- `report_type`: Filter by report type
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for Admin and Principal only
- Returns list of generated reports

**Response:**

```json
{
  "status": "success",
  "data": {
    "reports": [
      {
        "id": "uuid",
        "report_type": "student_performance",
        "status": "completed",
        "file_url": "https://storage.example.com/reports/report.pdf",
        "created_at": "2024-01-15T10:00:00Z",
        "completed_at": "2024-01-15T10:05:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "total_pages": 1
    }
  }
}
```

#### Get Report Details

```http
GET /api/analytics/reports/:id
```

**Notes:**

- Available for Admin and Principal only
- Returns detailed report information
- Includes download link if completed

**Response:**

```json
{
  "status": "success",
  "data": {
    "report": {
      "id": "uuid",
      "report_type": "student_performance",
      "status": "completed",
      "file_url": "https://storage.example.com/reports/report.pdf",
      "file_size": "2.5MB",
      "created_at": "2024-01-15T10:00:00Z",
      "completed_at": "2024-01-15T10:05:00Z",
      "parameters": {
        "date_from": "2024-01-01",
        "date_to": "2024-01-31",
        "filters": {...}
      }
    }
  }
}
```

### Activity Planning

#### List Activities

```http
GET /api/activities
```

**Query Parameters:**

- `class_division_id`: Filter by class division
- `activity_type`: Filter by activity type
- `date_from`: Filter from this date
- `date_to`: Filter until this date
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for Admin, Principal, and Teachers
- Teachers see activities for their assigned classes
- Admin/Principal see all activities

**Response:**

```json
{
  "status": "success",
  "data": {
    "activities": [
      {
        "id": "uuid",
        "title": "Science Fair",
        "description": "Annual science fair competition",
        "activity_type": "competition",
        "class_division_id": "uuid",
        "date": "2024-02-15",
        "time": "09:00",
        "venue": "School Auditorium",
        "required_items": ["Science project", "Display board"],
        "dress_code": "School uniform",
        "participants": [
          {
            "student_id": "uuid",
            "student_name": "Student Name",
            "status": "confirmed"
          }
        ],
        "created_by": "uuid",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "total_pages": 1
    }
  }
}
```

#### Create Activity

```http
POST /api/activities
```

**Body:**

```json
{
  "title": "Science Fair",
  "description": "Annual science fair competition",
  "activity_type": "competition",
  "class_division_id": "uuid",
  "date": "2024-02-15",
  "time": "09:00",
  "venue": "School Auditorium",
  "required_items": ["Science project", "Display board"],
  "dress_code": "School uniform",
  "max_participants": 30
}
```

**Notes:**

- Available for Teachers only
- Teachers can only create activities for their assigned classes
- Automatically notifies parents of required items

**Response:**

```json
{
  "status": "success",
  "data": {
    "activity": {
      "id": "uuid",
      "title": "Science Fair",
      "description": "Annual science fair competition",
      "activity_type": "competition",
      "class_division_id": "uuid",
      "date": "2024-02-15",
      "time": "09:00",
      "venue": "School Auditorium",
      "required_items": ["Science project", "Display board"],
      "dress_code": "School uniform",
      "max_participants": 30,
      "created_by": "uuid",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Get Activity Details

```http
GET /api/activities/:id
```

**Notes:**

- Available for activity participants and creators
- Returns detailed activity information with participant list

**Response:**

```json
{
  "status": "success",
  "data": {
    "activity": {
      "id": "uuid",
      "title": "Science Fair",
      "description": "Annual science fair competition",
      "activity_type": "competition",
      "class_division": {
        "id": "uuid",
        "division": "A",
        "level": {
          "name": "Grade 1",
          "sequence_number": 1
        }
      },
      "date": "2024-02-15",
      "time": "09:00",
      "venue": "School Auditorium",
      "required_items": ["Science project", "Display board"],
      "dress_code": "School uniform",
      "max_participants": 30,
      "current_participants": 25,
      "participants": [
        {
          "student_id": "uuid",
          "student_name": "Student Name",
          "status": "confirmed",
          "parent_name": "Parent Name"
        }
      ],
      "created_by": {
        "id": "uuid",
        "full_name": "Teacher Name"
      },
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Update Activity

```http
PUT /api/activities/:id
```

**Body:**

```json
{
  "title": "Updated Activity Title",
  "description": "Updated description",
  "date": "2024-02-20",
  "time": "10:00",
  "venue": "Updated Venue",
  "required_items": ["Updated item 1", "Updated item 2"]
}
```

**Notes:**

- Available for activity creator only
- All fields are optional
- Updates are notified to participants

**Response:**

```json
{
  "status": "success",
  "data": {
    "activity": {
      "id": "uuid",
      "title": "Updated Activity Title",
      "description": "Updated description",
      "date": "2024-02-20",
      "time": "10:00",
      "venue": "Updated Venue",
      "required_items": ["Updated item 1", "Updated item 2"],
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Delete Activity

```http
DELETE /api/activities/:id
```

**Notes:**

- Available for activity creator only
- Cancels activity and notifies participants
- Cannot delete activities that have started

**Response:**

```json
{
  "status": "success",
  "message": "Activity deleted successfully"
}
```

#### Add Participants to Activity

```http
POST /api/activities/:id/participants
```

**Body:**

```json
{
  "student_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Notes:**

- Available for activity creator only
- Adds students to activity participant list
- Automatically notifies parents of required items

**Response:**

```json
{
  "status": "success",
  "data": {
    "activity": {
      "id": "uuid",
      "current_participants": 28,
      "participants": [...]
    }
  }
}
```

### Feedback System

#### Get Feedback Categories

```http
GET /api/feedback/categories
```

**Notes:**

- Available for all authenticated users
- Returns predefined feedback categories

**Response:**

```json
{
  "status": "success",
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Academic",
        "description": "Feedback related to academic matters"
      },
      {
        "id": "uuid",
        "name": "Infrastructure",
        "description": "Feedback related to school infrastructure"
      },
      {
        "id": "uuid",
        "name": "Administration",
        "description": "Feedback related to administrative matters"
      }
    ]
  }
}
```

#### List Feedback

```http
GET /api/feedback
```

**Query Parameters:**

- `category_id`: Filter by category
- `status`: Filter by status (pending, in_progress, resolved, closed)
- `priority`: Filter by priority (low, medium, high, urgent)
- `page`: Page number for pagination (default: 1)
- `limit`: Number of items per page (default: 20)

**Notes:**

- Available for all authenticated users
- Users see their own feedback
- Admin/Principal see all feedback

**Response:**

```json
{
  "status": "success",
  "data": {
    "feedback": [
      {
        "id": "uuid",
        "title": "Feedback Title",
        "description": "Feedback description",
        "category": {
          "id": "uuid",
          "name": "Academic"
        },
        "status": "pending",
        "priority": "medium",
        "submitted_by": {
          "id": "uuid",
          "full_name": "Parent Name",
          "role": "parent"
        },
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "total_pages": 2
    }
  }
}
```

#### Submit Feedback

```http
POST /api/feedback
```

**Body:**

```json
{
  "title": "Feedback Title",
  "description": "Detailed feedback description",
  "category_id": "uuid",
  "priority": "medium"
}
```

**Notes:**

- Available for all authenticated users
- Creates feedback in pending status
- Admin/Principal are notified of new feedback

**Response:**

```json
{
  "status": "success",
  "data": {
    "feedback": {
      "id": "uuid",
      "title": "Feedback Title",
      "description": "Detailed feedback description",
      "category": {
        "id": "uuid",
        "name": "Academic"
      },
      "status": "pending",
      "priority": "medium",
      "submitted_by": "uuid",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Get Feedback Details

```http
GET /api/feedback/:id
```

**Notes:**

- Available for feedback submitter and Admin/Principal
- Returns detailed feedback with responses

**Response:**

```json
{
  "status": "success",
  "data": {
    "feedback": {
      "id": "uuid",
      "title": "Feedback Title",
      "description": "Detailed feedback description",
      "category": {
        "id": "uuid",
        "name": "Academic"
      },
      "status": "in_progress",
      "priority": "medium",
      "submitted_by": {
        "id": "uuid",
        "full_name": "Parent Name",
        "role": "parent"
      },
      "assigned_to": {
        "id": "uuid",
        "full_name": "Admin Name",
        "role": "admin"
      },
      "responses": [
        {
          "id": "uuid",
          "content": "Response content",
          "responded_by": {
            "id": "uuid",
            "full_name": "Admin Name",
            "role": "admin"
          },
          "created_at": "2024-01-15T10:00:00Z"
        }
      ],
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:05:00Z"
    }
  }
}
```

#### Update Feedback Status

```http
PUT /api/feedback/:id/status
```

**Body:**

```json
{
  "status": "in_progress" | "resolved" | "closed",
  "assigned_to": "uuid" // Optional - for assignment
}
```

**Notes:**

- Available for Admin and Principal only
- Updates feedback status and assignment
- Notifies feedback submitter of status changes

**Response:**

```json
{
  "status": "success",
  "data": {
    "feedback": {
      "id": "uuid",
      "status": "in_progress",
      "assigned_to": "uuid",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Add Response to Feedback

```http
POST /api/feedback/:id/responses
```

**Body:**

```json
{
  "content": "Response content"
}
```

**Notes:**

- Available for Admin, Principal, and feedback submitter
- Admin/Principal can respond to any feedback
- Submitters can only respond to their own feedback

**Response:**

```json
{
  "status": "success",
  "data": {
    "response": {
      "id": "uuid",
      "content": "Response content",
      "responded_by": {
        "id": "uuid",
        "full_name": "Admin Name",
        "role": "admin"
      },
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Update Feedback

```http
PUT /api/feedback/:id
```

**Body:**

```json
{
  "title": "Updated Feedback Title",
  "description": "Updated description",
  "priority": "high"
}
```

**Notes:**

- Available for feedback submitter only
- Can only update feedback in pending status
- All fields are optional

**Response:**

```json
{
  "status": "success",
  "data": {
    "feedback": {
      "id": "uuid",
      "title": "Updated Feedback Title",
      "description": "Updated description",
      "priority": "high",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Delete Feedback

```http
DELETE /api/feedback/:id
```

**Notes:**

- Available for feedback submitter only
- Can only delete feedback in pending status
- Admin/Principal can delete any feedback

**Response:**

```json
{
  "status": "success",
  "message": "Feedback deleted successfully"
}
```
