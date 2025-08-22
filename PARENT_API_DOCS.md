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

### 3. View Profile

```http
GET /api/users/profile
```

**Access**: Parent
**Description**: Get parent's profile information

**Response**:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "full_name": "Parent Name",
      "email": "parent@example.com",
      "phone_number": "+1234567890",
      "role": "parent",
      "profile_photo": "path/to/photo",
      "is_registered": true,
      "created_at": "2024-03-15T10:00:00Z"
    }
  }
}
```

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
