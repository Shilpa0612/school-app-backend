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
**Performance**: Optimized for fast response times (< 500ms login, < 1s children endpoint)

## 🔄 **Edit/Update Endpoints Summary**

### **Parent Management**

- `PUT /api/parents/:parent_id` - Update parent details (Admin/Principal only)
- `PUT /api/parent-student/parents/:parent_id` - Update parent via parent-student route

### **Student Management**

- `PUT /api/students-management/:student_id` - Update student details (Admin/Principal only)
- `PUT /api/students/:student_id` - Update student via students route

### **Parent-Student Relationships**

- `PUT /api/academic/update-parent-access/:mapping_id` - Update parent-student relationship
- `PUT /api/parent-student/mappings/:mapping_id` - Update mapping via parent-student route

### **User Management**

- `PUT /users/profile` - Update user profile (self only)

### **Academic Management**

- `PUT /api/academic/years/:id` - Update academic year (Admin/Principal only)
- `PUT /api/academic/class-levels/:id` - Update class level (Admin/Principal only)
- `PUT /api/academic/class-divisions/:id` - Update class division (Admin/Principal only)
- `PUT /api/academic/subjects/:id` - Update subject (Admin/Principal only)
- `PUT /api/academic/class-divisions/:id/teacher-assignment/:assignment_id` - Update teacher assignment

### **Content Management**

- `PUT /homework/:id` - Update homework (Teacher only)
- `PUT /classwork/:id` - Update classwork (Teacher only)
- `PUT /messages/:id/approve` - Approve message (Admin/Principal only)
- `PUT /messages/:id/reject` - Reject message (Admin/Principal only)
- `PUT /calendar/events/:id` - Update calendar event
- `PUT /leave-requests/:id/status` - Update leave request status
- `PUT /activities/:id` - Update activity (Creator only)
- `PUT /feedback/:id` - Update feedback (Submitter only)
- `PUT /feedback/:id/status` - Update feedback status (Admin/Principal only)
- `POST /api/students/:student_id/profile-photo` - Upload student profile photo (Admin/Principal/Teacher/Parent)

### **Chat System**

- `PUT /api/chat/messages/:id` - Update chat message (Sender only, within 5 minutes)

### **Lists Management**

- `PUT /api/lists/uniforms/:id` - Update uniform (Admin/Principal only)
- `PUT /api/lists/books/:id` - Update book (Admin/Principal only)
- `PUT /api/lists/staff/:id` - Update staff member (Admin/Principal only)

### **Attendance System**

- `PUT /api/attendance/daily/:daily_attendance_id` - Update daily attendance
- `PUT /api/attendance/student-record/:record_id` - Update individual student attendance
- `PUT /api/attendance/periods/:period_id` - Update attendance period (Admin/Principal only)
- `PUT /api/attendance/holidays/:holiday_id` - Update attendance holiday (Admin/Principal only)

### **Timetable Management**

- `PUT /api/timetable/entries/:id` - Update timetable entry (Admin/Principal only)
- `PUT /api/timetable/templates/:template_id/entries/:entry_id` - Update template entry (Admin/Principal only)

**Note**: All update endpoints support partial updates - you only need to include the fields you want to change!

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
  "initial_password": "Temp@1234", // Optional: stored in plaintext for onboarding
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
- If `initial_password` is provided, it is stored in `users.initial_password` as plaintext (for operational onboarding). The parent can keep it or set a new password during registration. Consider clearing it after first login.

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

**Notes:**

- All fields are optional (partial updates supported)
- `preferred_language` must be one of: english, hindi, marathi
- Users can only update their own profile

**Response:**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "full_name": "John Doe",
      "phone_number": "1234567890",
      "email": "john@example.com",
      "role": "parent",
      "preferred_language": "english",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Profile updated successfully"
}
```

#### Get Children (Parents Only)

```http
GET /users/children
```

**Response:** List of children with their class details

#### Get Child Details (Parents Only)

```http
GET /api/parent-student/child/:student_id
```

**Notes:**

- Only accessible to parents linked to the specified `student_id`
- Returns student details with current class division, level, academic year, teacher, roll number, and the parent's relationship

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
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
            "academic_year": { "year_name": "2024-2025" },
            "class_level": { "name": "Grade 1", "sequence_number": 1 },
            "teacher": { "id": "uuid", "full_name": "Teacher Name" }
          }
        }
      ]
    },
    "relationship": "father",
    "is_primary_guardian": true
  }
}
```

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

#### Update Homework (Teacher Only)

```http
PUT /homework/:id
```

**Body:**

```json
{
  "subject": "Advanced Mathematics",
  "title": "Updated Homework Title",
  "description": "Updated detailed description",
  "due_date": "2024-01-05T00:00:00Z"
}
```

**Notes:**

- Teachers can only update their own homework
- All fields are optional

**Response:**

```json
{
  "status": "success",
  "data": {
    "homework": {
      "id": "uuid",
      "subject": "Advanced Mathematics",
      "title": "Updated Homework Title",
      "description": "Updated detailed description",
      "due_date": "2024-01-05T00:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Delete Homework (Teacher Only)

```http
DELETE /homework/:id
```

**Notes:**

- Teachers can only delete their own homework
- Deletes the homework and all associated attachments

**Response:**

```json
{
  "status": "success",
  "message": "Homework deleted successfully"
}
```

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

#### Update Classwork (Teacher Only)

```http
PUT /classwork/:id
```

**Body:**

```json
{
  "subject": "Advanced Mathematics",
  "summary": "Updated summary with more details",
  "topics_covered": ["Addition", "Subtraction", "Multiplication"],
  "is_shared_with_parents": false
}
```

**Notes:**

- Teachers can only update their own classwork
- All fields are optional
- `topics_covered` is stored as a text array

**Response:**

```json
{
  "status": "success",
  "data": {
    "classwork": {
      "id": "uuid",
      "subject": "Advanced Mathematics",
      "summary": "Updated summary with more details",
      "topics_covered": ["Addition", "Subtraction", "Multiplication"],
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Delete Classwork (Teacher Only)

```http
DELETE /classwork/:id
```

**Notes:**

- Teachers can only delete their own classwork
- Deletes the classwork and all associated attachments

**Response:**

```json
{
  "status": "success",
  "message": "Classwork deleted successfully"
}
```

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
  "class_division_id": "uuid", // Optional - for single class events
  "class_division_ids": ["uuid1", "uuid2"], // Optional - for multi-class events
  "is_multi_class": false, // Optional - auto-detected based on class_division_ids
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

- `school_wide`: No class division fields needed
- `teacher_specific`: No class division fields needed
- `class_specific`: `class_division_id` is required (single class)
- `multi_class_specific`: `class_division_ids` array is required (multiple classes)

**Event Types:**

- `school_wide`: Visible to all users (Admin/Principal only)
- `class_specific`: Visible to specific class (Teachers can create for their classes)
- `multi_class_specific`: Visible to multiple classes (Teachers can create for their assigned classes)
- `teacher_specific`: Teacher-specific events (only visible to the teacher who created them)

**Event Categories:**

- `general`, `academic`, `sports`, `cultural`, `holiday`, `exam`, `meeting`, `other`

**Access Control:**

- **Admin/Principal**: Can create all event types
- **Teachers**: Can create class-specific events for their assigned classes
- **Parents**: Can only view events

**Response:** Created event object

**Multi-Class Event Example:**

```json
POST /calendar/events
{
  "title": "Math & English Quiz Competition",
  "description": "Inter-class competition for Math and English classes",
  "event_date": "2024-12-20T10:00:00Z",
  "event_type": "multi_class_specific",
  "class_division_ids": ["uuid-1a", "uuid-2b", "uuid-4d"],
  "event_category": "academic"
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Event created successfully for 3 classes",
  "data": {
    "event": {
      "id": "event-uuid",
      "title": "Math & English Quiz Competition",
      "event_type": "multi_class_specific",
      "is_multi_class": true,
      "class_division_ids": ["uuid-1a", "uuid-2b", "uuid-4d"],
      "classes": [
        {
          "id": "uuid-1a",
          "division": "A",
          "class_level": { "name": "Class 1" }
        },
        {
          "id": "uuid-2b",
          "division": "B",
          "class_level": { "name": "Class 2" }
        },
        {
          "id": "uuid-4d",
          "division": "D",
          "class_level": { "name": "Class 4" }
        }
      ]
    },
    "class_count": 3
  }
}
```

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
- `status`: Filter by approval status (`approved`, `pending`, `rejected`)
  - **Admin/Principal**: Can filter by any status
  - **Teachers**: Can filter by `approved`, `pending`, `rejected`
  - **Other roles**: Can only filter by `approved`
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

#### Get Teacher Events (School-wide + Assigned Classes)

```http
GET /calendar/events/teacher
```

**Query Parameters:**

- `start_date`: Filter events from this date
- `end_date`: Filter events until this date
- `event_category`: Filter by category
- `event_type`: Filter by event type (`school_wide`, `class_specific`, `teacher_specific`)
- `class_division_id`: Filter by specific class (must be teacher's assigned class)
- `use_ist`: Set to `true` to get events in IST timezone (default: `true`)

**Access Control:**

- Only teachers can access this endpoint
- Returns both school-wide events and class-specific events for their assigned classes
- Teachers can only view events for classes they are assigned to

**Response:** List of all relevant events for the teacher with assigned class information

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
    "assigned_classes": [
      {
        "class_division_id": "uuid",
        "assignment_type": "class_teacher",
        "subject": null,
        "is_primary": true,
        "class_info": {
          "id": "uuid",
          "division": "A",
          "academic_year": {
            "year_name": "2024-2025"
          },
          "class_level": {
            "name": "Grade 5"
          }
        }
      },
      {
        "class_division_id": "uuid",
        "assignment_type": "subject_teacher",
        "subject": "Mathematics",
        "is_primary": false,
        "class_info": {
          "id": "uuid",
          "division": "B",
          "academic_year": {
            "year_name": "2024-2025"
          },
          "class_level": {
            "name": "Grade 6"
          }
        }
      }
    ]
  }
}
```

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
- `from_date`: Start of date window (YYYY-MM-DD). Includes leaves that end on/after this date
- `to_date`: End of date window (YYYY-MM-DD). Includes leaves that start on/before this date

**Notes:**

- If both `from_date` and `to_date` are provided, results include leave requests that overlap the window: `start_date <= to_date` AND `end_date >= from_date`.

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

#### Subjects

```http
POST /api/academic/subjects
```

Body:

```json
{ "name": "Mathematics", "code": "MATH" }
```

```http
GET /api/academic/subjects
```

Query:

- `include_inactive`: true/false

```http
PUT /api/academic/subjects/:id
```

**Body:**

```json
{
  "name": "Updated Subject Name",
  "code": "UPD",
  "is_active": true
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `name` must be unique if provided
- `code` must be unique if provided
- `is_active` is a boolean

**Response:**

```json
{
  "status": "success",
  "data": {
    "subject": {
      "id": "uuid",
      "name": "Updated Subject Name",
      "code": "UPD",
      "is_active": true,
      "updated_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Subject updated successfully"
}
```

```http
DELETE /api/academic/subjects/:id
```

Soft-deactivate subject.

#### Class Division Subjects

```http
POST /api/academic/class-divisions/:id/subjects
```

Body:

```json
{ "subject_ids": ["uuid1", "uuid2"], "mode": "replace" }
```

- **mode**: `replace` (default) deactivates subjects not in list; `append` only adds/reactivates provided subjects

```http
GET /api/academic/class-divisions/:id/subjects
```

Response: active subjects assigned to the class division

```http
DELETE /api/academic/class-divisions/:id/subjects/:subject_id
```

Removes a subject from the class division (deactivates mapping).

Notes:

- When assigning a `subject_teacher` via `POST /api/academic/class-divisions/:id/assign-teacher`, if the class division has subjects configured, the subject must be among the assigned subjects.

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

**Notes:**

- All fields are optional (partial updates supported)
- `is_primary_guardian` is a boolean
- `access_level` must be one of: full, restricted, readonly
- `relationship` must be one of: father, mother, guardian

**Response:**

```json
{
  "status": "success",
  "data": {
    "mapping": {
      "id": "uuid",
      "parent_id": "uuid",
      "student_id": "uuid",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Parent-student relationship updated successfully"
}
```

#### Update Parent-Student Mapping via Parent-Student Route

```http
PUT /api/parent-student/mappings/:mapping_id
```

**Body:**

```json
{
  "relationship": "father",
  "is_primary_guardian": true,
  "access_level": "full"
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `is_primary_guardian` is a boolean
- `access_level` must be one of: full, restricted, readonly
- `relationship` must be one of: father, mother, guardian

**Response:**

```json
{
  "status": "success",
  "data": {
    "mapping": {
      "id": "uuid",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full",
      "parent": {
        "id": "uuid",
        "full_name": "Parent Name",
        "phone_number": "1234567890"
      },
      "student": {
        "id": "uuid",
        "full_name": "Student Name",
        "admission_number": "2024001"
      }
    }
  }
}
```

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
  "year_name": "2024-2025",
  "start_date": "2024-06-01",
  "end_date": "2025-03-31",
  "is_active": true
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `year_name` must be in format YYYY-YYYY
- `start_date` and `end_date` must be in YYYY-MM-DD format
- `is_active` is a boolean
- If setting as active, other years will be deactivated

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
      "updated_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Academic year updated successfully"
}
```

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
- Verifies teacher is assigned via either legacy `class_divisions.teacher_id` or any active assignment in `class_teacher_assignments` (class, subject, assistant, substitute)

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
- Teachers can access divisions where they are assigned via either legacy `class_divisions.teacher_id` or any active assignment in `class_teacher_assignments`
- Can check birthdays for any specific date
- Includes class division information

#### Get My Classes' Birthdays (Teacher Only)

```http
GET /api/birthdays/my-classes
```

**Query Parameters:**

- `date` (optional): Specific date to check (YYYY-MM-DD format, defaults to today)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 20)

**Notes:**

- Returns birthdays across all class divisions where the teacher is assigned (legacy `class_divisions.teacher_id` or any active row in `class_teacher_assignments`)

**Response:**

```json
{
  "status": "success",
  "data": {
    "birthdays": [
      {
        "id": "uuid",
        "full_name": "Student Name",
        "date_of_birth": "2018-01-15",
        "admission_number": "2024001",
        "student_academic_records": [
          {
            "class_division": {
              "id": "uuid",
              "division": "A",
              "level": {
                "name": "Grade 1",
                "sequence_number": 1
              }
            },
            "class_division_id": "uuid",
            "roll_number": "01"
          }
        ]
      }
    ],
    "count": 10,
    "total_count": 10,
    "date": "2024-01-15",
    "class_division_ids": ["uuid1", "uuid2"],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

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

#### Get Parent Birthday View (Teachers & Classmates)

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

**Features**:

- ✅ **Teacher birthdays** with contact info and assignments
- ✅ **Classmate birthdays** with shared class information
- ✅ **Upcoming birthdays** (next 30 days) highlighted
- ✅ **Days until birthday** calculation
- ✅ **Summary statistics** for quick overview
- ✅ **Sorted by upcoming birthdays** (most recent first)

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

#### Update Class Level (Admin/Principal Only)

```http
PUT /api/academic/class-levels/:id
```

**Body:**

```json
{
  "name": "Updated Grade Name",
  "sequence_number": 2
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `name` must be unique if provided
- `sequence_number` must be unique if provided

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_level": {
      "id": "uuid",
      "name": "Updated Grade Name",
      "sequence_number": 2,
      "updated_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Class level updated successfully"
}
```

#### Delete Class Level (Admin/Principal Only)

```http
DELETE /api/academic/class-levels/:id
```

**Notes:**

- Cannot delete if class divisions are using this level
- Cannot delete if any class divisions under this level have enrolled students
- Returns detailed error information if deletion is not allowed

**Response - Success:**

```json
{
  "status": "success",
  "message": "Class level deleted successfully",
  "data": {
    "deleted_class_level": {
      "id": "uuid",
      "name": "Grade 1"
    }
  }
}
```

**Response - Error (Class Divisions with Students):**

```json
{
  "status": "error",
  "message": "Cannot delete class level because it has class divisions with enrolled students",
  "data": {
    "class_level_id": "uuid",
    "class_level_name": "Grade 1",
    "divisions_with_students": ["A", "B"],
    "total_divisions_with_students": 2
  }
}
```

**Response - Error (Class Divisions Exist):**

```json
{
  "status": "error",
  "message": "Cannot delete class level because it has class divisions. Please delete the class divisions first.",
  "data": {
    "class_level_id": "uuid",
    "class_level_name": "Grade 1",
    "existing_divisions": ["A", "B"],
    "total_divisions": 2
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
  "teacher_id": "uuid"
}
```

**Notes:**

- `teacher_id` is optional (partial updates supported)
- Updates the legacy teacher assignment for the class division
- For new teacher assignment system, use the teacher assignment endpoints

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_division": {
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
      },
      "updated_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Class division updated successfully"
}
```

#### Delete Class Division (Admin/Principal Only)

```http
DELETE /api/academic/class-divisions/:id
```

**Notes:**

- Cannot delete if the class division has enrolled students
- Returns detailed error information if deletion is not allowed
- Will cascade delete related records (teacher assignments, subjects, etc.)

**Response - Success:**

```json
{
  "status": "success",
  "message": "Class division deleted successfully",
  "data": {
    "deleted_class_division": {
      "id": "uuid",
      "class_name": "Grade 1 A",
      "class_level_id": "uuid",
      "class_level_name": "Grade 1",
      "division": "A"
    }
  }
}
```

**Response - Error (Has Students):**

```json
{
  "status": "error",
  "message": "Cannot delete class division because it has enrolled students",
  "data": {
    "class_division_id": "uuid",
    "class_name": "Grade 1 A",
    "enrolled_students_count": 3,
    "students": [
      {
        "id": "uuid",
        "name": "John Doe"
      },
      {
        "id": "uuid",
        "name": "Jane Smith"
      }
    ]
  }
}
```

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

**Body:**

```json
{
  "assignment_type": "class_teacher | subject_teacher | assistant_teacher | substitute_teacher",
  "is_primary": true
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `assignment_type` must be one of: class_teacher, subject_teacher, assistant_teacher, substitute_teacher
- `is_primary` is a boolean
- Only one primary teacher is allowed per class

**Response:**

```json
{
  "status": "success",
  "data": {
    "assignment": {
      "id": "uuid",
      "class_division_id": "uuid",
      "teacher_id": "uuid",
      "assignment_type": "class_teacher",
      "is_primary": true,
      "updated_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Teacher assignment updated successfully"
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

### **NEW: Separate Parent and Student Management**

#### Create Parent (Admin/Principal Only)

```http
POST /api/parents
```

**Body:**

```json
{
  "full_name": "Parent Name",
  "phone_number": "1234567890",
  "email": "parent@example.com",
  "initial_password": "Temp@1234"
}
```

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
    "registration_instructions": {
      "message": "Parent can now register using their phone number",
      "endpoint": "POST /api/auth/register",
      "required_fields": ["phone_number", "password", "role: \"parent\""]
    },
    "initial_password": "Temp@1234",
    "note": "Use /api/parents/:parent_id/link-students to link this parent to students"
  },
  "message": "Parent created successfully. Parent can now register using their phone number."
}
```

#### Get All Parents (Admin/Principal Only)

```http
GET /api/parents?page=1&limit=20&search=parent
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search by name, phone, or email

**Response:**

```json
{
  "status": "success",
  "data": {
    "parents": [
      {
        "id": "uuid",
        "full_name": "Parent Name",
        "phone_number": "1234567890",
        "email": "parent@example.com",
        "role": "parent",
        "is_registered": false,
        "created_at": "2024-01-15T10:00:00Z",
        "students": [
          {
            "relationship": "father",
            "is_primary_guardian": true,
            "student": {
              "id": "uuid",
              "full_name": "Student Name",
              "admission_number": "2024001"
            }
          }
        ]
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

#### Get Specific Parent (Admin/Principal Only)

```http
GET /api/parents/:parent_id
```

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
      "is_registered": false,
      "created_at": "2024-01-15T10:00:00Z"
    },
    "students": [
      {
        "id": "uuid",
        "relationship": "father",
        "is_primary_guardian": true,
        "access_level": "full",
        "student": {
          "id": "uuid",
          "full_name": "Student Name",
          "admission_number": "2024001",
          "date_of_birth": "2018-01-01",
          "status": "active"
        }
      }
    ]
  }
}
```

#### Update Parent (Admin/Principal Only)

```http
PUT /api/parents/:parent_id
```

**Body:**

```json
{
  "full_name": "Updated Parent Name",
  "phone_number": "9876543210",
  "email": "updated@example.com",
  "initial_password": "NewTemp@1234"
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `phone_number` must be exactly 10 digits
- `email` must be valid email format
- `initial_password` is stored in plaintext for onboarding

**Response:**

```json
{
  "status": "success",
  "data": {
    "parent": {
      "id": "uuid",
      "full_name": "Updated Parent Name",
      "phone_number": "9876543210",
      "email": "updated@example.com",
      "role": "parent",
      "is_registered": false,
      "created_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Parent updated successfully"
}
```

#### Update Parent via Parent-Student Route (Admin/Principal Only)

```http
PUT /api/parent-student/parents/:parent_id
```

**Body:**

```json
{
  "full_name": "Updated Parent Name",
  "phone_number": "9876543210",
  "email": "updated@example.com"
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `phone_number` must be exactly 10 digits
- `email` must be valid email format

**Response:**

```json
{
  "status": "success",
  "data": {
    "parent": {
      "id": "uuid",
      "full_name": "Updated Parent Name",
      "phone_number": "9876543210",
      "email": "updated@example.com",
      "role": "parent",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Delete Parent (Admin/Principal Only)

```http
DELETE /api/parents/:parent_id
```

**Notes:**

- Cannot delete parent with linked students
- Must unlink all students first

**Response:**

```json
{
  "status": "success",
  "message": "Parent deleted successfully"
}
```

#### Link Students to Parent (Admin/Principal Only)

```http
POST /api/parents/:parent_id/link-students
```

**Body:**

```json
{
  "students": [
    {
      "student_id": "uuid",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full"
    },
    {
      "student_id": "uuid",
      "relationship": "father",
      "is_primary_guardian": false,
      "access_level": "full"
    }
  ]
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "parent_id": "uuid",
    "mappings": [
      {
        "id": "uuid",
        "relationship": "father",
        "is_primary_guardian": true,
        "access_level": "full",
        "student": {
          "id": "uuid",
          "full_name": "Student Name",
          "admission_number": "2024001"
        }
      }
    ]
  },
  "message": "Students linked to parent successfully"
}
```

#### Unlink Student from Parent (Admin/Principal Only)

```http
DELETE /api/parents/:parent_id/unlink-student/:student_id
```

**Response:**

```json
{
  "status": "success",
  "message": "Student unlinked from parent successfully",
  "data": {
    "was_primary_guardian": true
  }
}
```

#### Create Student (Admin/Principal Only)

```http
POST /api/students-management
```

**Body:**

```json
{
  "admission_number": "2024001",
  "full_name": "Student Name",
  "date_of_birth": "2018-01-01",
  "admission_date": "2024-01-01",
  "class_division_id": "uuid",
  "roll_number": "01",
  "gender": "male",
  "address": "123 Main St",
  "emergency_contact": "9876543210"
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid",
      "admission_number": "2024001",
      "full_name": "Student Name",
      "date_of_birth": "2018-01-01",
      "admission_date": "2024-01-01",
      "gender": "male",
      "address": "123 Main St",
      "emergency_contact": "9876543210",
      "status": "active"
    },
    "academic_record": {
      "id": "uuid",
      "roll_number": "01",
      "status": "active",
      "class_division": {
        "id": "uuid",
        "division": "A",
        "level": {
          "name": "Grade 1",
          "sequence_number": 1
        }
      }
    },
    "note": "Use /api/students-management/:student_id/link-parents to link this student to parents"
  },
  "message": "Student created successfully"
}
```

#### Get All Students (Admin/Principal Only)

```http
GET /api/students-management?page=1&limit=20&search=student&class_division_id=uuid&status=active
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search by name or admission number
- `class_division_id`: Filter by class division
- `status`: Filter by status (default: active)

**Response:**

```json
{
  "status": "success",
  "data": {
    "students": [
      {
        "id": "uuid",
        "admission_number": "2024001",
        "full_name": "Student Name",
        "date_of_birth": "2018-01-01",
        "admission_date": "2024-01-01",
        "gender": "male",
        "address": "123 Main St",
        "emergency_contact": "9876543210",
        "status": "active",
        "created_at": "2024-01-15T10:00:00Z",
        "academic_records": [
          {
            "id": "uuid",
            "roll_number": "01",
            "status": "active",
            "class_division": {
              "id": "uuid",
              "division": "A",
              "level": {
                "name": "Grade 1",
                "sequence_number": 1
              }
            }
          }
        ],
        "parents": [
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

#### Get Specific Student (Admin/Principal Only)

```http
GET /api/students-management/:student_id
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid",
      "admission_number": "2024001",
      "full_name": "Student Name",
      "date_of_birth": "2018-01-01",
      "admission_date": "2024-01-01",
      "gender": "male",
      "address": "123 Main St",
      "emergency_contact": "9876543210",
      "status": "active",
      "created_at": "2024-01-15T10:00:00Z",
      "academic_records": [
        {
          "id": "uuid",
          "roll_number": "01",
          "status": "active",
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
          "academic_year": {
            "id": "uuid",
            "year_name": "2024-2025"
          }
        }
      ]
    },
    "parents": [
      {
        "id": "uuid",
        "relationship": "father",
        "is_primary_guardian": true,
        "access_level": "full",
        "created_at": "2024-01-15T10:00:00Z",
        "parent": {
          "id": "uuid",
          "full_name": "Parent Name",
          "phone_number": "1234567890",
          "email": "parent@example.com",
          "is_registered": true
        }
      }
    ]
  }
}
```

#### Update Student (Admin/Principal Only)

```http
PUT /api/students-management/:student_id
```

**Body:**

```json
{
  "full_name": "Updated Student Name",
  "date_of_birth": "2018-01-01",
  "gender": "female",
  "address": "456 New St",
  "emergency_contact": "9876543210",
  "status": "active"
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `date_of_birth` must be in YYYY-MM-DD format
- `gender` must be one of: male, female, other
- `emergency_contact` must be exactly 10 digits
- `status` must be one of: active, inactive, transferred, graduated

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid",
      "admission_number": "2024001",
      "full_name": "Updated Student Name",
      "date_of_birth": "2018-01-01",
      "admission_date": "2024-01-01",
      "gender": "female",
      "address": "456 New St",
      "emergency_contact": "9876543210",
      "status": "active",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  },
  "message": "Student updated successfully"
}
```

#### Update Student via Students Route (Admin/Principal Only)

```http
PUT /api/students/:student_id
```

**Body:**

```json
{
  "full_name": "Updated Student Name",
  "date_of_birth": "2018-01-01",
  "status": "active"
}
```

**Notes:**

- All fields are optional (partial updates supported)
- `date_of_birth` must be in YYYY-MM-DD format
- `status` must be one of: active, inactive, transferred, graduated

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid",
      "admission_number": "2024001",
      "full_name": "Updated Student Name",
      "date_of_birth": "2018-01-01",
      "admission_date": "2024-01-01",
      "status": "active",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Delete Student (Admin/Principal Only)

```http
DELETE /api/students-management/:student_id
```

**Notes:**

- Cannot delete student with linked parents
- Must unlink all parents first

**Response:**

```json
{
  "status": "success",
  "message": "Student deleted successfully",
  "data": {
    "admission_number": "2024001"
  }
}
```

#### Link Parents to Student (Admin/Principal Only)

```http
POST /api/students-management/:student_id/link-parents
```

**Body:**

```json
{
  "parents": [
    {
      "parent_id": "uuid",
      "relationship": "father",
      "is_primary_guardian": true,
      "access_level": "full"
    },
    {
      "parent_id": "uuid",
      "relationship": "mother",
      "is_primary_guardian": false,
      "access_level": "full"
    }
  ]
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "uuid",
      "full_name": "Student Name",
      "admission_number": "2024001"
    },
    "mappings": [
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
  },
  "message": "Parents linked to student successfully"
}
```

#### Unlink Parent from Student (Admin/Principal Only)

```http
DELETE /api/students-management/:student_id/unlink-parent/:parent_id
```

**Response:**

```json
{
  "status": "success",
  "message": "Parent unlinked from student successfully",
  "data": {
    "was_primary_guardian": true
  }
}
```

### **LEGACY: Combined Student Management (Still Available)**

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

#### Upload Student Profile Photo (Admin/Principal/Teacher/Parent)

```http
POST /api/students/:student_id/profile-photo
```

**Authorization:**

- Admin, Principal, Teacher: Can upload for any student
- Parent: Can only upload for their own children (verified via parent_student_mappings)

**Body:** form-data with field `photo` (JPEG/PNG, max 2MB)

**Storage:**

- Stored in Supabase Storage bucket `profile-pictures` at `students/{student_id}/avatar.jpg`
- `students_master.profile_photo_path` records `profile-pictures/students/{student_id}/avatar.jpg`
- Public URL is returned in response and included in student profile as `profile_photo_url`

**Response:**

```json
{
  "status": "success",
  "data": {
    "student_id": "uuid",
    "profile_photo_path": "profile-pictures/students/uuid/avatar.jpg",
    "profile_photo_url": "https://.../profile-pictures/students/uuid/avatar.jpg"
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
    "count": 20,
    "total_count": 25,
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 25,
      "total_pages": 2,
      "has_next": true,
      "has_prev": false
    }
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
- Timetable Management
- **Student Attendance System** - Complete attendance tracking, marking, and reporting

### ⚠️ **Partially Implemented (20-80%)**

- Push Notifications (Firebase SDK installed, logic pending)
- Content Localization (Database ready, UI pending)

### ✅ **Recently Implemented (100%)**

- **Student Attendance System** - Complete attendance tracking, marking, and reporting functionality

### ❌ **Not Implemented**

- SMS Integration
- Dynamic Content Translation

## Student Attendance System

**Status**: ✅ **Fully Implemented**

The student attendance system provides comprehensive attendance tracking, marking, and reporting functionality:

- **Daily attendance marking** by teachers for their assigned classes
- **Multiple attendance statuses**: present, absent, late, half_day, excused
- **Attendance periods**: morning, afternoon, full day
- **Holiday management** for accurate attendance calculations
- **Detailed reports** for parents, teachers, and administrators
- **Role-based access control** ensuring data privacy
- **Integration** with existing academic year and class systems

---

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

### Timetable Management

**Overview:**
The timetable system manages class schedules with academic year scope and supports Monday to Saturday schedules. It includes conflict prevention, template-based creation, and role-based access control.

**Key Features:**

- **Academic Year Specific**: Each academic year can have different timetables
- **Weekday Support**: Monday to Saturday (1-6)
- **Conflict Prevention**: No overlapping periods or teacher conflicts
- **Template System**: Reusable schedules for similar classes
- **Role-Based Access**: Different permissions for different user types

**Access Control Summary:**

- **Admin/Principal**: Full access to create, manage, and view all timetables
- **Teachers**: Can view their own timetable and their assigned class timetables
- **Parents**: Can view their children's class timetables

#### Get All Periods

```http
GET /api/timetable/periods
```

**Access Control:**

- **Admin/Principal**: Full access
- **Teachers**: Can view periods for reference
- **Parents**: Not available (parents don't need period information)

**Notes:**

- Returns all active periods with timing information
- Teachers use this to understand the school's period structure

**Response:**

```json
{
  "status": "success",
  "data": {
    "periods": [
      {
        "id": "uuid",
        "name": "Period 1",
        "start_time": "08:00:00",
        "end_time": "08:45:00",
        "period_type": "academic",
        "sequence_number": 1
      }
    ]
  }
}
```

#### Create Period

```http
POST /api/timetable/periods
```

**Body:**

```json
{
  "name": "Period 1",
  "start_time": "08:00:00",
  "end_time": "08:45:00",
  "period_type": "academic",
  "sequence_number": 1
}
```

**Access Control:**

- **Admin/Principal**: Can create and manage periods
- **Teachers**: Not available (administrative function)
- **Parents**: Not available (administrative function)

**Notes:**

- Validates no overlapping periods
- Period types: `academic`, `break`, `lunch`, `assembly`, `other`
- This is a school-wide administrative setting

**Response:**

```json
{
  "status": "success",
  "data": {
    "period": {
      "id": "uuid",
      "name": "Period 1",
      "start_time": "08:00:00",
      "end_time": "08:45:00",
      "period_type": "academic",
      "sequence_number": 1,
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Create Timetable Entry

```http
POST /api/timetable/entries
```

**Body:**

```json
{
  "class_division_id": "uuid",
  "academic_year_id": "uuid",
  "period_id": "uuid",
  "day_of_week": 1,
  "subject": "Mathematics",
  "teacher_id": "uuid",
  "notes": "Bring calculator for this period"
}
```

**Access Control:**

- **Admin/Principal**: Can create timetable entries
- **Teachers**: Not available (administrative function)
- **Parents**: Not available (administrative function)

**Notes:**

- Day of week: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- Validates no conflicts for class or teacher
- Academic year specific timetables
- This creates the master school schedule

**Response:**

```json
{
  "status": "success",
  "data": {
    "entry": {
      "id": "uuid",
      "class_division_id": "uuid",
      "academic_year_id": "uuid",
      "period_id": "uuid",
      "day_of_week": 1,
      "subject": "Mathematics",
      "teacher_id": "uuid",
      "notes": "Bring calculator for this period",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Get Class Timetable

```http
GET /api/timetable/class/:class_division_id
```

**Query Parameters:**

- `academic_year_id`: Filter by academic year (optional)
- `day_of_week`: Filter by specific day (1-6)

**Access Control:**

- **Admin/Principal**: Can view any class timetable
- **Teachers**: Can only view timetables for their assigned classes
- **Parents**: Can view timetables for their children's classes

**Notes:**

- Returns timetable organized by day
- Teachers see schedules for classes they teach
- Parents see schedules for their children's classes

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
    "timetable": {
      "1": {
        "day_name": "Monday",
        "day_number": 1,
        "entries": [
          {
            "id": "uuid",
            "period": {
              "name": "Period 1",
              "start_time": "08:00:00",
              "end_time": "08:45:00"
            },
            "subject": "Mathematics",
            "teacher": {
              "id": "uuid",
              "full_name": "Teacher Name"
            },
            "notes": "Bring calculator"
          }
        ]
      },
      "6": {
        "day_name": "Saturday",
        "day_number": 6,
        "entries": []
      }
    },
    "total_entries": 25
  }
}
```

#### Get Teacher Timetable

```http
GET /api/timetable/teacher/:teacher_id
```

**Query Parameters:**

- `academic_year_id`: Filter by academic year (optional)
- `day_of_week`: Filter by specific day (1-6)

**Access Control:**

- **Admin/Principal**: Can view any teacher's timetable
- **Teachers**: Can only view their own timetable
- **Parents**: Not available (privacy concern)

**Notes:**

- Returns teacher's schedule across all assigned classes
- Teachers see their complete weekly schedule
- Admin/Principal can monitor teacher workload

**Response:**

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "uuid",
      "full_name": "Teacher Name"
    },
    "timetable": {
      "1": {
        "day_name": "Monday",
        "day_number": 1,
        "entries": [
          {
            "id": "uuid",
            "period": {
              "name": "Period 1",
              "start_time": "08:00:00",
              "end_time": "08:45:00"
            },
            "subject": "Mathematics",
            "class_division": {
              "division": "A",
              "level": {
                "name": "Grade 1"
              }
            },
            "notes": "Bring calculator"
          }
        ]
      }
    },
    "total_entries": 15
  }
}
```

#### Update Timetable Entry

```http
PUT /api/timetable/entries/:id
```

**Body:**

```json
{
  "subject": "Advanced Mathematics",
  "teacher_id": "uuid",
  "notes": "Updated notes"
}
```

**Notes:**

- Available for Admin and Principal only
- All fields are optional
- Validates teacher conflicts

**Response:**

```json
{
  "status": "success",
  "data": {
    "entry": {
      "id": "uuid",
      "subject": "Advanced Mathematics",
      "teacher_id": "uuid",
      "notes": "Updated notes",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Delete Timetable Entry

```http
DELETE /api/timetable/entries/:id
```

**Access Control:**

- **Admin/Principal**: Can delete timetable entries
- **Teachers**: Not available (administrative function)
- **Parents**: Not available (administrative function)

**Notes:**

- Soft deletes the entry
- Removes the entry from the class schedule

**Response:**

```json
{
  "status": "success",
  "message": "Timetable entry deleted successfully"
}
```

#### Bulk Update Timetable Entries

```http
PUT /api/timetable/bulk-update
```

**Body:**

```json
{
  "filters": {
    "class_level_id": "uuid",
    "academic_year_id": "uuid",
    "day_of_week": 1,
    "period_id": "uuid"
  },
  "updates": {
    "subject": "Science",
    "teacher_id": "uuid",
    "notes": "Updated subject"
  }
}
```

**Access Control:**

- **Admin/Principal**: Can perform bulk updates
- **Teachers**: Not available (administrative function)
- **Parents**: Not available (administrative function)

**Notes:**

- Updates multiple timetable entries based on filters
- Useful for changing the same period across multiple classes
- Validates teacher conflicts before applying updates

**Response:**

```json
{
  "status": "success",
  "data": {
    "updated_entries": 15,
    "filters_applied": {
      "class_level_id": "uuid",
      "day_of_week": 1,
      "period_id": "uuid"
    }
  }
}
```

#### Update Template Entry

```http
PUT /api/timetable/templates/:template_id/entries/:entry_id
```

**Body:**

```json
{
  "subject": "Updated Subject",
  "notes": "Updated notes"
}
```

**Access Control:**

- **Admin/Principal**: Can update template entries
- **Teachers**: Not available (administrative function)
- **Parents**: Not available (administrative function)

**Notes:**

- Updates a specific entry in a template
- Changes the pattern for all classes using this template
- Must re-apply template to affected classes for changes to take effect

**Response:**

```json
{
  "status": "success",
  "data": {
    "entry": {
      "id": "uuid",
      "subject": "Updated Subject",
      "notes": "Updated notes",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Create Timetable Template

```http
POST /api/timetable/templates
```

**Body:**

```json
{
  "name": "Primary Template",
  "description": "Standard primary class schedule",
  "academic_year_id": "uuid",
  "class_level_id": "uuid"
}
```

**Access Control:**

- **Admin/Principal**: Can create and manage templates
- **Teachers**: Not available (administrative function)
- **Parents**: Not available (administrative function)

**Why Templates Are Needed:**

1. **Efficiency**: Instead of creating timetables from scratch for each class, templates provide a standard structure
2. **Consistency**: Ensures all classes of the same level follow similar patterns
3. **Time Saving**: Apply one template to multiple classes (e.g., all Grade 1 classes)
4. **Standardization**: Maintains consistent subject distribution across similar classes
5. **Easy Updates**: Change the template once, apply to all affected classes

**Example Use Cases:**

- **Primary Template**: Standard schedule for Grades 1-5
- **Secondary Template**: Different schedule for Grades 6-10
- **Special Needs Template**: Modified schedule for special education classes
- **Exam Template**: Adjusted schedule during exam periods

**Notes:**

- Templates can be applied to multiple classes
- Each template is specific to an academic year and class level

**Response:**

```json
{
  "status": "success",
  "data": {
    "template": {
      "id": "uuid",
      "name": "Primary Template",
      "description": "Standard primary class schedule",
      "created_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Apply Template to Class

```http
POST /api/timetable/templates/:template_id/apply/:class_division_id
```

**Access Control:**

- **Admin/Principal**: Can apply templates to classes
- **Teachers**: Not available (administrative function)
- **Parents**: Not available (administrative function)

**Notes:**

- Creates timetable entries from template
- Replaces existing entries for the class
- Useful for bulk timetable creation at the start of academic year

**Response:**

```json
{
  "status": "success",
  "data": {
    "applied_entries": 30,
    "class_division_id": "uuid",
    "template_id": "uuid"
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

---

## Student Attendance System

### Attendance Periods

#### Get Attendance Periods

```http
GET /api/attendance/periods
```

**Notes:**

- Available for all authenticated users
- Returns active attendance periods (morning, afternoon, full day)

**Response:**

```json
{
  "status": "success",
  "data": {
    "periods": [
      {
        "id": "uuid",
        "name": "Morning",
        "start_time": "08:00:00",
        "end_time": "08:30:00",
        "is_active": true
      }
    ]
  }
}
```

#### Create Attendance Period (Admin/Principal Only)

```http
POST /api/attendance/periods
```

**Body:**

```json
{
  "name": "Evening",
  "start_time": "15:00:00",
  "end_time": "15:30:00"
}
```

**Response:** Created attendance period object

#### Update Attendance Period (Admin/Principal Only)

```http
PUT /api/attendance/periods/:period_id
```

**Body:**

```json
{
  "name": "Updated Evening",
  "start_time": "15:30:00",
  "end_time": "16:00:00",
  "is_active": true
}
```

**Response:** Updated attendance period object

#### Delete Attendance Period (Admin/Principal Only)

```http
DELETE /api/attendance/periods/:period_id
```

**Notes:**

- Cannot delete periods that are being used in attendance records
- Returns error if period is in use

**Response:**

```json
{
  "status": "success",
  "message": "Attendance period deleted successfully"
}
```

### Daily Attendance

#### Mark Daily Attendance (Automated - Teachers only mark present students)

```http
POST /api/attendance/daily
```

**Body:**

```json
{
  "class_division_id": "uuid",
  "attendance_date": "2024-01-15",
  "period_id": "uuid",
  "present_students": ["uuid1", "uuid2", "uuid3"]
}
```

**Notes:**

- **Automated System**: Daily attendance records are created automatically
- **Default Status**: All students are marked as "absent" by default
- **Teacher Workflow**: Teachers only need to provide list of present students
- **Holiday Detection**: Automatically detects holidays from calendar events and attendance_holidays table
- **Class-Specific Holidays**: Supports holidays specific to certain classes
- Teachers can only mark attendance for their assigned classes
- Admin/Principal can mark attendance for any class

**Response:**

```json
{
  "status": "success",
  "data": {
    "daily_attendance": {
      "id": "uuid",
      "class_division_id": "uuid",
      "attendance_date": "2024-01-15",
      "period_id": "uuid",
      "marked_by": "uuid",
      "is_holiday": false,
      "holiday_reason": null
    },
    "student_records": [
      {
        "id": "uuid",
        "student_id": "uuid",
        "status": "present",
        "remarks": "Marked present by teacher",
        "student": {
          "full_name": "Student Name",
          "admission_number": "ADM001"
        }
      },
      {
        "id": "uuid",
        "student_id": "uuid",
        "status": "absent",
        "remarks": "Not marked by teacher",
        "student": {
          "full_name": "Student Name",
          "admission_number": "ADM002"
        }
      }
    ]
  },
  "message": "Attendance marked successfully"
}
```

**Holiday Response:**

```json
{
  "status": "success",
  "data": {
    "daily_attendance": {
      "id": "uuid",
      "is_holiday": true,
      "holiday_reason": "Republic Day"
    }
  },
  "message": "Holiday: Republic Day"
}
```

#### Get Daily Attendance for Class

```http
GET /api/attendance/daily/class/:class_division_id?date=2024-01-15&period_id=uuid
```

**Query Parameters:**

- `date`: Attendance date (YYYY-MM-DD)
- `period_id`: Attendance period ID (optional)

**Notes:**

- Teachers can only view attendance for their assigned classes
- Admin/Principal can view attendance for any class
- Returns attendance records with student details

**Response:**

```json
{
  "status": "success",
  "data": {
    "daily_attendance": {
      "id": "uuid",
      "attendance_date": "2024-01-15",
      "period": {
        "name": "Morning",
        "start_time": "08:00:00",
        "end_time": "08:30:00"
      },
      "marked_by_user": {
        "full_name": "Teacher Name",
        "role": "teacher"
      }
    },
    "student_records": [
      {
        "id": "uuid",
        "student_id": "uuid",
        "status": "present",
        "remarks": "On time",
        "student": {
          "full_name": "Student Name",
          "admission_number": "ADM001"
        }
      }
    ]
  }
}
```

#### Update Daily Attendance

```http
PUT /api/attendance/daily/:daily_attendance_id
```

**Body:**

```json
{
  "student_attendance": [
    {
      "student_id": "uuid",
      "status": "present",
      "remarks": "Updated remarks"
    }
  ]
}
```

**Notes:**

- Teachers can only update attendance for their assigned classes
- Admin/Principal can update any attendance
- Updates individual student attendance records

**Response:**

```json
{
  "status": "success",
  "data": {
    "student_records": [
      {
        "id": "uuid",
        "status": "present",
        "remarks": "Updated remarks",
        "student": {
          "full_name": "Student Name",
          "admission_number": "ADM001"
        }
      }
    ]
  },
  "message": "Attendance updated successfully"
}
```

#### Edit Individual Student Attendance Record

```http
PUT /api/attendance/student-record/:record_id
```

**Body:**

```json
{
  "status": "present",
  "remarks": "Student arrived on time"
}
```

**Notes:**

- Teachers can only edit attendance for their assigned classes
- Admin/Principal can edit any attendance record
- Updates a single student's attendance for a specific day

**Response:**

```json
{
  "status": "success",
  "data": {
    "record": {
      "id": "uuid",
      "status": "present",
      "remarks": "Student arrived on time",
      "student": {
        "full_name": "Student Name",
        "admission_number": "ADM001"
      },
      "daily_attendance": {
        "attendance_date": "2024-01-15",
        "period": {
          "name": "Morning"
        }
      }
    }
  },
  "message": "Attendance record updated successfully"
}
```

#### Delete Daily Attendance (Teachers, Admin, Principal)

```http
DELETE /api/attendance/daily/:daily_attendance_id
```

**Notes:**

- Teachers can only delete attendance for their assigned classes
- Admin/Principal can delete any attendance
- Deletes the entire daily attendance record and all student records for that day

**Response:**

```json
{
  "status": "success",
  "message": "Daily attendance deleted successfully"
}
```

#### Get Attendance Status for Class (Automated)

```http
GET /api/attendance/status/:class_division_id?date=2024-01-15&period_id=uuid
```

**Query Parameters:**

- `date`: Attendance date (YYYY-MM-DD, required)
- `period_id`: Attendance period ID (optional)

**Notes:**

- **Automated Creation**: Creates attendance record if it doesn't exist
- **Holiday Detection**: Automatically detects and marks holidays
- **Default Absent**: All students marked as absent by default
- Teachers can only access their assigned classes
- Admin/Principal can access any class

**Response:**

```json
{
  "status": "success",
  "data": {
    "daily_attendance": {
      "id": "uuid",
      "is_holiday": false,
      "holiday_reason": null
    },
    "student_records": [
      {
        "id": "uuid",
        "status": "absent",
        "remarks": "Not marked by teacher",
        "student": {
          "full_name": "Student Name",
          "admission_number": "ADM001"
        }
      }
    ]
  }
}
```

### Automated Attendance Management

#### Create Daily Attendance for All Classes (Admin/Principal Only)

```http
POST /api/attendance/create-daily
```

**Body:**

```json
{
  "date": "2024-01-15",
  "period_id": "uuid"
}
```

**Notes:**

- Creates attendance records for all active classes
- Automatically handles holidays
- Sets all students as absent by default
- Useful for bulk attendance preparation

**Response:**

```json
{
  "status": "success",
  "data": {
    "date": "2024-01-15",
    "period_id": "uuid",
    "total_classes": 12,
    "created": 10,
    "errors": 2,
    "results": [
      {
        "class_division_id": "uuid",
        "daily_attendance_id": "uuid",
        "is_holiday": false,
        "holiday_reason": null
      }
    ],
    "errors": [
      {
        "class_division_id": "uuid",
        "error": "Error message"
      }
    ]
  },
  "message": "Daily attendance created for 10 classes"
}
```

#### Sync Calendar Events as Holidays (Admin/Principal Only)

```http
POST /api/attendance/sync-calendar-holidays
```

**Body:**

```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

**Notes:**

- Automatically creates attendance holidays from calendar events
- Only syncs events with `event_category: "holiday"`
- Supports both school-wide and class-specific holidays
- Prevents duplicate holidays

**Response:**

```json
{
  "status": "success",
  "data": {
    "date_range": {
      "start_date": "2024-01-01",
      "end_date": "2024-12-31"
    },
    "total_events": 15,
    "synced": 12,
    "errors": 3,
    "synced_holidays": [
      {
        "event_id": "uuid",
        "holiday_id": "uuid",
        "status": "created"
      }
    ]
  },
  "message": "Synced 12 calendar events as holidays"
}
```

### Student Attendance Records

#### Get Student Attendance Summary (Parents, Teachers, Admin, Principal)

```http
GET /api/attendance/student/:student_id/summary?academic_year_id=uuid&start_date=2024-01-01&end_date=2024-01-31
```

**Query Parameters:**

- `academic_year_id`: Academic year ID (optional, defaults to active year)
- `start_date`: Start date for summary (YYYY-MM-DD, optional)
- `end_date`: End date for summary (YYYY-MM-DD, optional)

**Access Control:**

- **Parents**: Can only view their own children's attendance
- **Teachers**: Can view attendance for students in their assigned classes
- **Admin/Principal**: Can view any student's attendance

**Response:**

```json
{
  "status": "success",
  "data": {
    "student": {
      "full_name": "Student Name",
      "admission_number": "ADM001"
    },
    "academic_year_id": "uuid",
    "summary": {
      "total_days": 25,
      "present_days": 22,
      "absent_days": 2,
      "late_days": 1,
      "half_days": 0,
      "excused_days": 0,
      "attendance_percentage": 88.0
    }
  }
}
```

#### Get Student Attendance Details (Daily Records)

```http
GET /api/attendance/student/:student_id/details?academic_year_id=uuid&start_date=2024-01-01&end_date=2024-01-31&page=1&limit=30
```

**Query Parameters:**

- `academic_year_id`: Academic year ID (optional, defaults to active year)
- `start_date`: Start date filter (YYYY-MM-DD, optional)
- `end_date`: End date filter (YYYY-MM-DD, optional)
- `page`: Page number for pagination (default: 1)
- `limit`: Number of records per page (default: 30)

**Access Control:** Same as summary endpoint

**Response:**

```json
{
  "status": "success",
  "data": {
    "student_id": "uuid",
    "academic_year_id": "uuid",
    "records": [
      {
        "id": "uuid",
        "status": "present",
        "remarks": "On time",
        "daily_attendance": {
          "attendance_date": "2024-01-15",
          "period": {
            "name": "Morning",
            "start_time": "08:00:00",
            "end_time": "08:30:00"
          },
          "class_division": {
            "division": "A",
            "level": {
              "name": "Grade 1",
              "sequence_number": 1
            }
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 30,
      "total": 25
    }
  }
}
```

### Attendance Holidays

#### Get Attendance Holidays

```http
GET /api/attendance/holidays?year=2024&month=1&holiday_type=national
```

**Query Parameters:**

- `year`: Filter by year (optional)
- `month`: Filter by month (1-12, optional)
- `holiday_type`: Filter by type (national, state, school, exam, optional)

**Notes:**

- Available for all authenticated users
- Holidays marked as `is_attendance_holiday = true` are excluded from attendance calculations

**Response:**

```json
{
  "status": "success",
  "data": {
    "holidays": [
      {
        "id": "uuid",
        "holiday_date": "2024-01-26",
        "holiday_name": "Republic Day",
        "holiday_type": "national",
        "description": "National holiday",
        "is_attendance_holiday": true
      }
    ]
  }
}
```

#### Create Attendance Holiday (Admin, Principal Only)

```http
POST /api/attendance/holidays
```

**Body:**

```json
{
  "holiday_date": "2024-01-26",
  "holiday_name": "Republic Day",
  "holiday_type": "national",
  "description": "National holiday",
  "is_attendance_holiday": true
}
```

**Response:** Created holiday object

#### Update Attendance Holiday (Admin, Principal Only)

```http
PUT /api/attendance/holidays/:holiday_id
```

**Body:**

```json
{
  "holiday_date": "2024-01-26",
  "holiday_name": "Republic Day 2024",
  "holiday_type": "national",
  "description": "Updated description",
  "is_attendance_holiday": true
}
```

**Response:** Updated holiday object

#### Delete Attendance Holiday (Admin, Principal Only)

```http
DELETE /api/attendance/holidays/:holiday_id
```

**Response:**

```json
{
  "status": "success",
  "message": "Holiday deleted successfully"
}
```

### Attendance Reports

#### Get Class Attendance Report

```http
GET /api/attendance/reports/class/:class_division_id?start_date=2024-01-01&end_date=2024-01-31&period_id=uuid
```

**Query Parameters:**

- `start_date`: Start date for report (YYYY-MM-DD, required)
- `end_date`: End date for report (YYYY-MM-DD, required)
- `period_id`: Filter by specific period (optional)

**Access Control:**

- **Teachers**: Can only view reports for their assigned classes
- **Admin/Principal**: Can view reports for any class

**Response:**

```json
{
  "status": "success",
  "data": {
    "class_details": {
      "id": "uuid",
      "division": "A",
      "level": {
        "name": "Grade 1",
        "sequence_number": 1
      },
      "teacher": {
        "full_name": "Teacher Name"
      }
    },
    "academic_year": {
      "id": "uuid",
      "year_name": "2024-2025"
    },
    "date_range": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    },
    "students": [
      {
        "student": {
          "id": "uuid",
          "full_name": "Student Name",
          "admission_number": "ADM001"
        },
        "roll_number": "01",
        "attendance": {
          "total_days": 25,
          "present_days": 22,
          "absent_days": 2,
          "late_days": 1,
          "half_days": 0,
          "excused_days": 0,
          "attendance_percentage": 88.0
        }
      }
    ]
  }
}
```

### Key Features

#### Automated Attendance System

- **Automatic Creation**: Daily attendance records are created automatically for all classes
- **Default Absent Status**: All students are marked as "absent" by default
- **Teacher-Friendly Workflow**: Teachers only need to mark present students
- **Holiday Detection**: Automatically detects holidays from calendar events and attendance_holidays table
- **Class-Specific Holidays**: Supports holidays specific to certain classes

#### Attendance Statuses

- **Present**: Student attended the full period (marked by teacher)
- **Absent**: Student did not attend (default status)
- **Late**: Student arrived after the period started
- **Half Day**: Student attended for part of the period
- **Excused**: Student absent with valid excuse (e.g., medical certificate)

#### Attendance Periods

- **Morning**: Early morning attendance (e.g., 8:00 AM - 8:30 AM)
- **Afternoon**: Afternoon attendance (e.g., 1:00 PM - 1:30 PM)
- **Full Day**: Complete day attendance (e.g., 8:00 AM - 3:00 PM)

#### Holiday Integration

- **Calendar Event Sync**: Automatically syncs calendar events marked as holidays
- **Multiple Sources**: Checks both attendance_holidays table and calendar events
- **Class-Specific**: Supports holidays specific to certain classes
- **School-Wide**: Supports national, state, and school holidays
- **Automatic Detection**: Holidays are automatically detected and marked

#### Teacher Workflow

1. **Daily Preparation**: Admin/Principal can create attendance for all classes
2. **Teacher Marking**: Teachers only mark students who are present
3. **Automatic Updates**: System automatically updates absent students
4. **Holiday Handling**: System automatically detects and marks holidays

#### Role-Based Access Control

- **Teachers**: Can mark/edit attendance for their assigned classes only
- **Parents**: Can view attendance for their own children only
- **Admin/Principal**: Full access to all attendance data and automation features
- **Students**: No direct access (data accessed through parents)

#### Data Privacy

- Row Level Security (RLS) ensures data isolation
- Parents can only see their children's attendance
- Teachers can only see attendance for their assigned classes
- All access is logged and audited
- Holiday information is properly isolated by class

#### Get Teacher's Linked Parents and Principal

```http
GET /api/users/teacher-linked-parents
```

**Access**: Teachers (own data), Admin, Principal (any teacher)
**Description**: Get all parents linked to students where the teacher is either a class teacher or subject teacher

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

**Use Cases**:

- Teachers can see which parents they can communicate with
- Teachers can send messages to specific parents
- Teachers can understand their student-parent relationships
- Admin/Principal can view any teacher's parent connections

#### Get Children's Teachers (Parent View - Enhanced for Messaging)

```http
GET /api/users/children/teachers
```

**Access**: Parents only
**Description**: Get comprehensive information about children's teachers, classes, and contact details for messaging purposes

**Response:**

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

## Homework Management

### Get Homework List

```http
GET /api/homework
```

**Access**: All authenticated users (filtered by role)
**Description**: Get list of homework assignments

**Query Parameters**:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `subject` (optional): Filter by subject
- `class_division_id` (optional): Filter by class division
- `teacher_id` (optional): Filter by teacher (admin/principal only)
- `due_date_from` (optional): Filter by due date from (ISO date)
- `due_date_to` (optional): Filter by due date to (ISO date)

**Response**:

```json
{
  "status": "success",
  "data": {
    "homework": [
      {
        "id": "uuid",
        "class_division_id": "uuid",
        "teacher_id": "uuid",
        "subject": "Mathematics",
        "title": "Chapter 5 Exercises",
        "description": "Complete exercises 5.1 to 5.5",
        "due_date": "2024-03-20T23:59:59Z",
        "created_at": "2024-03-15T10:00:00Z",
        "teacher": {
          "id": "uuid",
          "full_name": "John Doe"
        },
        "class_division": {
          "id": "uuid",
          "division": "A",
          "level": {
            "name": "Grade 10",
            "sequence_number": 10
          }
        },
        "attachments": [
          {
            "id": "uuid",
            "file_name": "chapter5.pdf",
            "file_type": "application/pdf",
            "storage_path": "homework-id/filename.pdf"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### Get Homework Details

```http
GET /api/homework/:id
```

**Access**: All authenticated users (filtered by role)
**Description**: Get detailed information about a specific homework

**Response**:

```json
{
  "status": "success",
  "data": {
    "homework": {
      "id": "uuid",
      "class_division_id": "uuid",
      "teacher_id": "uuid",
      "subject": "Mathematics",
      "title": "Chapter 5 Exercises",
      "description": "Complete exercises 5.1 to 5.5",
      "due_date": "2024-03-20T23:59:59Z",
      "created_at": "2024-03-15T10:00:00Z",
      "teacher": {
        "id": "uuid",
        "full_name": "John Doe"
      },
      "class_division": {
        "id": "uuid",
        "division": "A",
        "level": {
          "name": "Grade 10",
          "sequence_number": 10
        }
      },
      "attachments": [
        {
          "id": "uuid",
          "file_name": "chapter5.pdf",
          "file_type": "application/pdf",
          "storage_path": "homework-id/filename.pdf"
        }
      ]
    }
  }
}
```

### Create Homework

```http
POST /api/homework
```

**Access**: Teachers, Parents
**Description**: Create a new homework assignment

**Payload**:

```json
{
  "class_division_id": "uuid",
  "subject": "Mathematics",
  "title": "Chapter 5 Exercises",
  "description": "Complete exercises 5.1 to 5.5",
  "due_date": "2024-03-20T23:59:59Z"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "homework": {
      "id": "uuid",
      "class_division_id": "uuid",
      "teacher_id": "uuid",
      "subject": "Mathematics",
      "title": "Chapter 5 Exercises",
      "description": "Complete exercises 5.1 to 5.5",
      "due_date": "2024-03-20T23:59:59Z",
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

### Update Homework

```http
PUT /api/homework/:id
```

**Access**: Teachers (own homework), Parents (children's homework)
**Description**: Update an existing homework assignment

**Payload**:

```json
{
  "subject": "Mathematics",
  "title": "Updated Chapter 5 Exercises",
  "description": "Complete exercises 5.1 to 5.10",
  "due_date": "2024-03-25T23:59:59Z"
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "homework": {
      "id": "uuid",
      "subject": "Mathematics",
      "title": "Updated Chapter 5 Exercises",
      "description": "Complete exercises 5.1 to 5.10",
      "due_date": "2024-03-25T23:59:59Z",
      "updated_at": "2024-03-16T10:00:00Z"
    }
  }
}
```

### Delete Homework

```http
DELETE /api/homework/:id
```

**Access**: Teachers (own homework), Parents (children's homework)
**Description**: Delete a homework assignment

**Response**:

```json
{
  "status": "success",
  "message": "Homework deleted successfully"
}
```

### Add Homework Attachments

```http
POST /api/homework/:id/attachments
```

**Access**: Teachers (own homework), Parents (children's homework)
**Description**: Upload file attachments to homework

**Content-Type**: `multipart/form-data`

**Form Data**:

- `files`: Array of files (max 5 files, 10MB each)

**Supported File Types**:

- Images: `image/jpeg`, `image/png`
- Documents: `application/pdf`, `text/plain`, `text/csv`
- Word Documents: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

**Response**:

```json
{
  "status": "success",
  "data": {
    "attachments": [
      {
        "id": "uuid",
        "homework_id": "uuid",
        "storage_path": "homework-id/filename.pdf",
        "file_name": "chapter5.pdf",
        "file_type": "application/pdf",
        "file_size": 1024000,
        "uploaded_by": "uuid",
        "created_at": "2024-03-15T10:00:00Z"
      }
    ]
  }
}
```

### Get Homework Attachments List

```http
GET /api/homework/:homework_id/attachments
```

**Access**:

- **Teachers**: Homework creator OR assigned to the class
- **Parents**: Children enrolled in the class OR attachment uploader
- **Admin/Principal**: All homework (full access)
  **Description**: Get list of all attachments for a homework with metadata

**Response**:

```json
{
  "status": "success",
  "data": {
    "homework": {
      "id": "uuid",
      "subject": "Mathematics",
      "title": "Chapter 5 Exercises"
    },
    "attachments": [
      {
        "id": "uuid",
        "file_name": "chapter5.pdf",
        "file_type": "application/pdf",
        "file_size": 1024000,
        "storage_path": "homework-id/filename.pdf",
        "uploaded_by": "uuid",
        "created_at": "2024-03-15T10:00:00Z",
        "uploader": {
          "id": "uuid",
          "full_name": "John Doe",
          "role": "teacher"
        },
        "download_url": "https://storage.supabase.co/...",
        "download_endpoint": "/api/homework/uuid/attachments/uuid"
      }
    ],
    "total_attachments": 2
  }
}
```

### Download Homework Attachment

```http
GET /api/homework/:homework_id/attachments/:attachment_id
```

**Access**:

- **Teachers**: Homework creator OR assigned to the class
- **Parents**: Children enrolled in the class OR attachment uploader
- **Admin/Principal**: All homework (full access)
  **Description**: Download a specific homework attachment file

**Response**: File download with appropriate headers

- `Content-Type`: File's MIME type
- `Content-Disposition`: `attachment; filename="filename.pdf"`
- `Content-Length`: File size in bytes
- `Cache-Control`: `no-cache`

**Example Usage**:

```javascript
// Download file
const response = await fetch("/api/homework/uuid/attachments/uuid", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

if (response.ok) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "filename.pdf";
  a.click();
  window.URL.revokeObjectURL(url);
}
```

### Edit Homework Attachments (Replace All)

```http
PUT /api/homework/:homework_id/attachments
```

**Access**:

- **Teachers**: Homework creator OR assigned to the class
- **Parents**: Children enrolled in the class
- **Admin/Principal**: All homework (full access)

**Description**: Replace all existing attachments with new files. This endpoint will:

1. Delete all existing attachments (files and database records)
2. Upload new files
3. Create new database records for the uploaded files

**Request**:

- **Method**: `PUT`
- **Content-Type**: `multipart/form-data`
- **Body**: Form data with files
  - `attachments`: Array of files (max 10 files)

**Example Request**:

```javascript
const formData = new FormData();
formData.append("attachments", file1);
formData.append("attachments", file2);
formData.append("attachments", file3);

const response = await fetch("/api/homework/uuid/attachments", {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

**Response**:

```json
{
  "status": "success",
  "message": "Successfully replaced attachments. 3 new files uploaded.",
  "data": {
    "homework_id": "uuid",
    "new_attachments": [
      {
        "id": "uuid",
        "file_name": "chapter5.pdf",
        "file_type": "application/pdf",
        "storage_path": "homework-id/timestamp_filename.pdf"
      },
      {
        "id": "uuid",
        "file_name": "exercises.docx",
        "file_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "storage_path": "homework-id/timestamp_filename.docx"
      }
    ],
    "total_files": 2
  }
}
```

**Error Response** (if some files fail):

```json
{
  "status": "success",
  "message": "Successfully replaced attachments. 2 new files uploaded. 1 files failed to upload.",
  "data": {
    "homework_id": "uuid",
    "new_attachments": [...],
    "total_files": 2
  },
  "warnings": [
    "Failed to upload large_file.pdf: File size exceeds limit"
  ]
}
```

**Notes**:

- All existing attachments will be permanently deleted
- Maximum 10 files can be uploaded at once
- File size limit: 10MB per file (configurable)
- Supported file types: Images, PDFs, Documents, Text files
- Files are stored with timestamp prefixes to avoid conflicts

### Get Homework Filters

```http
GET /api/homework/filters
```

**Access**: All authenticated users
**Description**: Get available filters for homework queries

**Response**:

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
          "name": "Grade 10",
          "sequence_number": 10
        }
      ],
      "class_divisions": [
        {
          "id": "uuid",
          "division": "A",
          "level": {
            "name": "Grade 10",
            "sequence_number": 10
          }
        }
      ],
      "teachers": [
        {
          "id": "uuid",
          "full_name": "John Doe"
        }
      ]
    }
  }
}
```
