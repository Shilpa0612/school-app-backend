# Postman Testing Guide

## Environment Setup

1. Create a new environment in Postman with these variables:
```
BASE_URL: http://localhost:3000/api
TOKEN: <will be set after login>
```

2. Import the following collection or create new requests as described below.

## Authentication Endpoints

### 1. Register Admin (First Admin)
```http
POST {{BASE_URL}}/auth/register
Content-Type: application/json

{
    "phone_number": "1234567890",
    "password": "admin123",
    "role": "admin",
    "full_name": "Admin User",
    "email": "admin@school.com"
}
```

### 2. Login
```http
POST {{BASE_URL}}/auth/login
Content-Type: application/json

{
    "phone_number": "1234567890",
    "password": "admin123"
}
```
**After successful login:**
1. Copy the token from response
2. Set it in the environment variable `TOKEN`
3. All subsequent requests will use this token

### 3. Register Teacher (Admin/Principal Only)
```http
POST {{BASE_URL}}/auth/register
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
    "phone_number": "9876543210",
    "password": "teacher123",
    "role": "teacher",
    "full_name": "Teacher User",
    "email": "teacher@school.com",
    "subjects": ["Mathematics", "Physics"]
}
```

### 4. Register Parent
```http
POST {{BASE_URL}}/auth/register
Content-Type: application/json

{
    "phone_number": "5555555555",
    "password": "parent123",
    "role": "parent",
    "full_name": "Parent User",
    "email": "parent@example.com"
}
```

## Parent-Student Linking

### 1. Link Parent to Student
```http
POST {{BASE_URL}}/parent-student/link
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
    "student_details": [
        {
            "admission_number": "ADM123",
            "student_name": "Student Name",
            "relationship": "father",
            "is_primary_guardian": true
        }
    ]
}
```

### 2. Get Parent-Student Mappings
```http
GET {{BASE_URL}}/parent-student/mappings
Authorization: Bearer {{TOKEN}}
```

## Messages

### 1. Send Message
```http
POST {{BASE_URL}}/messages
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
    "content": "Test message",
    "type": "individual",
    "recipient_id": "user_uuid"
}
```

### 2. Get Messages
```http
GET {{BASE_URL}}/messages
Authorization: Bearer {{TOKEN}}
```

### 3. Approve Message (Admin/Principal)
```http
PUT {{BASE_URL}}/messages/message_uuid/approve
Authorization: Bearer {{TOKEN}}
```

## Homework

### 1. Create Homework (Teacher)
```http
POST {{BASE_URL}}/homework
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
    "class_id": "class_uuid",
    "subject": "Mathematics",
    "title": "Chapter 1 Exercise",
    "description": "Complete problems 1-10",
    "due_date": "2024-01-20T00:00:00Z"
}
```

### 2. Add Homework Attachments
```http
POST {{BASE_URL}}/homework/homework_uuid/attachments
Authorization: Bearer {{TOKEN}}
Content-Type: multipart/form-data

files: [Select Files]
```

### 3. Get Homework List
```http
GET {{BASE_URL}}/homework
Authorization: Bearer {{TOKEN}}
```

## Calendar Events

### 1. Create Event (Admin/Principal)
```http
POST {{BASE_URL}}/calendar/events
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
    "title": "Parent Teacher Meeting",
    "description": "Annual PTM",
    "event_date": "2024-01-25T14:00:00Z"
}
```

### 2. Get Events
```http
GET {{BASE_URL}}/calendar/events
Authorization: Bearer {{TOKEN}}
```

## Leave Requests

### 1. Create Leave Request (Parent)
```http
POST {{BASE_URL}}/leave-requests
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
    "student_id": "student_uuid",
    "start_date": "2024-01-22T00:00:00Z",
    "end_date": "2024-01-23T00:00:00Z",
    "reason": "Family function"
}
```

### 2. Update Leave Request Status (Teacher/Principal)
```http
PUT {{BASE_URL}}/leave-requests/request_uuid/status
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
    "status": "approved"
}
```

## Testing Flow

1. **Initial Setup:**
   - Register admin
   - Login as admin
   - Create classes
   - Register teachers
   - Add students

2. **Parent Registration Flow:**
   - Register parent
   - Login as parent
   - Link children
   - View children details

3. **Message Flow:**
   - Send message as teacher
   - Approve message as principal
   - View messages as parent

4. **Homework Flow:**
   - Create homework as teacher
   - Add attachments
   - View homework as parent

5. **Leave Request Flow:**
   - Submit leave request as parent
   - Approve/reject as teacher 