# Principal Division Messages API Documentation

## Overview

This API endpoint allows principals to fetch all group chat messages for a specific class division, including messages from class teachers and subject teachers. This provides comprehensive visibility into all communication happening within a particular class.

## Endpoint

```http
GET /api/users/principal/division/:class_division_id/messages
```

**Access**: Admin, Principal only

## Parameters

### Path Parameters

- `class_division_id` (required): UUID of the class division

### Query Parameters

- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of messages per page (default: 50)
- `start_date` (optional): Filter messages from this date (ISO 8601 format)
- `end_date` (optional): Filter messages until this date (ISO 8601 format)
- `message_type` (optional): Filter by message type - `text`, `image`, `file`, or `all` (default: `all`)

## Response Structure

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
    "filters_applied": {
      "start_date": "2024-06-01T00:00:00Z",
      "end_date": "2024-06-30T23:59:59Z",
      "message_type": "all",
      "class_division_id": "uuid"
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

## Key Features

### 1. **Comprehensive Teacher Coverage**

- ✅ Fetches all teachers assigned to the division
- ✅ Includes class teachers, subject teachers, assistant teachers, and substitute teachers
- ✅ Shows assignment details (subject, primary status, assignment date)

### 2. **Complete Message History**

- ✅ Retrieves all group chat messages from division teachers
- ✅ Includes message metadata (type, status, timestamps)
- ✅ Shows sender information for each message
- ✅ Supports message attachments

### 3. **Advanced Filtering**

- ✅ Date range filtering (`start_date`, `end_date`)
- ✅ Message type filtering (`text`, `image`, `file`, `all`)
- ✅ Pagination support for large message volumes

### 4. **Organized Structure**

- ✅ Messages grouped by chat thread
- ✅ Thread participants clearly identified
- ✅ Teacher assignment details included
- ✅ Summary statistics provided

## Usage Examples

### 1. Get All Messages for a Division

```http
GET /api/users/principal/division/123e4567-e89b-12d3-a456-426614174000/messages
```

### 2. Get Messages with Date Filter

```http
GET /api/users/principal/division/123e4567-e89b-12d3-a456-426614174000/messages?start_date=2024-06-01&end_date=2024-06-30
```

### 3. Get Text Messages Only with Pagination

```http
GET /api/users/principal/division/123e4567-e89b-12d3-a456-426614174000/messages?message_type=text&page=2&limit=25
```

## Error Responses

### 400 Bad Request

```json
{
  "status": "error",
  "message": "Invalid class_division_id format. Must be a valid UUID"
}
```

### 404 Not Found

```json
{
  "status": "error",
  "message": "Class division not found"
}
```

### 500 Internal Server Error

```json
{
  "status": "error",
  "message": "Failed to fetch teacher assignments"
}
```

## Security & Access Control

- **Authentication Required**: JWT token must be provided
- **Authorization**: Only Admin and Principal roles can access
- **Data Privacy**: Only group chat messages are included (no direct messages)
- **Teacher Scope**: Only messages from teachers assigned to the specific division

## Performance Considerations

- **Pagination**: Default limit of 50 messages per page
- **Indexing**: Optimized queries using database indexes
- **Filtering**: Server-side filtering reduces data transfer
- **Caching**: Consider implementing caching for frequently accessed divisions

## Integration Notes

- This endpoint complements the existing `/api/users/principal/chats` endpoint
- Use this for division-specific message monitoring
- Combine with teacher assignment APIs for complete oversight
- Real-time updates can be achieved through WebSocket subscriptions

## Related Endpoints

- `GET /api/users/principal/chats` - General principal chat management
- `GET /api/academic/teachers-with-assignments` - Teacher assignment details
- `GET /api/academic/class-divisions/:id/teachers` - Division teachers
- `GET /api/chat/threads/:thread_id/messages` - Individual thread messages
