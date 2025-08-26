# Principal Chats API Documentation

## Overview

The `/api/users/principal/chats` endpoint provides principals and admins with comprehensive access to all chat threads in the system, including filtering capabilities for date ranges, class divisions, chat types, and principal participation.

## Endpoint Details

- **URL**: `/api/users/principal/chats`
- **Method**: `GET`
- **Authentication**: Required (Bearer Token)
- **Authorization**: Admin or Principal role only
- **Content-Type**: `application/json`

## Query Parameters

| Parameter           | Type   | Default | Description                                              |
| ------------------- | ------ | ------- | -------------------------------------------------------- |
| `start_date`        | string | null    | Start date for filtering (YYYY-MM-DD format)             |
| `end_date`          | string | null    | End date for filtering (YYYY-MM-DD format)               |
| `class_division_id` | string | null    | Filter by specific class division                        |
| `chat_type`         | string | 'all'   | Filter by chat type: 'direct', 'group', or 'all'         |
| `includes_me`       | string | 'all'   | Filter by principal participation: 'yes', 'no', or 'all' |
| `page`              | number | 1       | Page number for pagination                               |
| `limit`             | number | 20      | Number of items per page                                 |

## Response Structure

### Success Response (200)

```json
{
  "status": "success",
  "data": {
    "threads": [
      {
        "thread_id": "uuid",
        "title": "Chat Title",
        "thread_type": "direct|group",
        "created_at": "2024-01-15T10:00:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "created_by": "uuid",
        "message_count": 25,
        "is_principal_participant": true,
        "participants": {
          "all": [
            {
              "user_id": "uuid",
              "role": "member|admin",
              "last_read_at": "2024-01-15T10:25:00Z",
              "user": {
                "id": "uuid",
                "full_name": "User Name",
                "role": "teacher|parent|student|admin",
                "email": "user@example.com",
                "phone_number": "+1234567890"
              },
              "is_principal": false
            }
          ],
          "teachers": [...],
          "parents": [...],
          "students": [...],
          "admins": [...],
          "count": 5
        },
        "last_message": {
          "id": "uuid",
          "content": "Message content",
          "created_at": "2024-01-15T10:30:00Z",
          "sender": {
            "id": "uuid",
            "full_name": "Sender Name",
            "role": "teacher"
          }
        },
        "class_info": {
          "id": "uuid",
          "name": "Class 5 A",
          "academic_year": "2024-25"
        },
        "badges": {
          "includes_principal": true,
          "is_group": false,
          "is_direct": true,
          "has_teachers": true,
          "has_parents": true,
          "has_students": false,
          "has_admins": false
        }
      }
    ],
    "filters": {
      "start_date": "2024-01-01",
      "end_date": "2024-12-31",
      "class_division_id": "uuid",
      "chat_type": "direct",
      "includes_me": "yes",
      "page": 1,
      "limit": 20
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    },
    "summary": {
      "total_threads": 20,
      "direct_chats": 15,
      "group_chats": 5,
      "includes_principal": 12,
      "excludes_principal": 8,
      "total_messages": 450,
      "average_messages_per_thread": 22,
      "participant_stats": {
        "total_unique": 45,
        "teachers": 25,
        "parents": 30,
        "students": 10,
        "admins": 5
      }
    }
  }
}
```

## Field Descriptions

### Thread Object

| Field                      | Type    | Description                            |
| -------------------------- | ------- | -------------------------------------- |
| `thread_id`                | string  | Unique identifier for the chat thread  |
| `title`                    | string  | Title of the chat thread               |
| `thread_type`              | string  | Type of chat: 'direct' or 'group'      |
| `created_at`               | string  | When the thread was created            |
| `updated_at`               | string  | When the thread was last updated       |
| `created_by`               | string  | User ID who created the thread         |
| `message_count`            | number  | Total number of messages in the thread |
| `is_principal_participant` | boolean | Whether the principal is a participant |

### Participants Object

| Field      | Type   | Description                    |
| ---------- | ------ | ------------------------------ |
| `all`      | array  | All participants in the thread |
| `teachers` | array  | Only teacher participants      |
| `parents`  | array  | Only parent participants       |
| `students` | array  | Only student participants      |
| `admins`   | array  | Only admin participants        |
| `count`    | number | Total number of participants   |

### Badges Object

| Field                | Type    | Description                |
| -------------------- | ------- | -------------------------- |
| `includes_principal` | boolean | Principal is a participant |
| `is_group`           | boolean | Thread is a group chat     |
| `is_direct`          | boolean | Thread is a direct chat    |
| `has_teachers`       | boolean | Thread includes teachers   |
| `has_parents`        | boolean | Thread includes parents    |
| `has_students`       | boolean | Thread includes students   |
| `has_admins`         | boolean | Thread includes admins     |

## Usage Examples

### 1. Get All Chats (Default)

```bash
curl -X GET "http://localhost:3000/api/users/principal/chats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Filter by Date Range

```bash
curl -X GET "http://localhost:3000/api/users/principal/chats?start_date=2024-01-01&end_date=2024-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Filter by Chat Type

```bash
# Direct chats only
curl -X GET "http://localhost:3000/api/users/principal/chats?chat_type=direct" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Group chats only
curl -X GET "http://localhost:3000/api/users/principal/chats?chat_type=group" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Filter by Principal Participation

```bash
# Chats where principal is a participant
curl -X GET "http://localhost:3000/api/users/principal/chats?includes_me=yes" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Chats where principal is NOT a participant
curl -X GET "http://localhost:3000/api/users/principal/chats?includes_me=no" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Filter by Class Division

```bash
curl -X GET "http://localhost:3000/api/users/principal/chats?class_division_id=YOUR_CLASS_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Combined Filters with Pagination

```bash
curl -X GET "http://localhost:3000/api/users/principal/chats?chat_type=direct&includes_me=yes&page=2&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 7. Complex Filter Combination

```bash
curl -X GET "http://localhost:3000/api/users/principal/chats?start_date=2024-08-01&end_date=2024-08-31&chat_type=group&includes_me=yes&class_division_id=CLASS_ID&page=1&limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Filter Logic

### Date Range Filter

- `start_date`: Threads created on or after this date
- `end_date`: Threads created on or before this date
- Both dates are inclusive
- Date format: YYYY-MM-DD

### Chat Type Filter

- `direct`: One-on-one conversations
- `group`: Multi-participant conversations
- `all`: Both types (default)

### Principal Participation Filter

- `yes`: Only threads where principal is a participant
- `no`: Only threads where principal is NOT a participant
- `all`: Both types (default)

### Class Division Filter

- Filters threads based on associated class division
- Only applies to group chats with class context
- Requires valid class division ID

## Pagination

The API supports pagination with the following parameters:

- `page`: Page number (starts from 1)
- `limit`: Number of items per page (max 100)

Response includes pagination metadata:

- `total`: Total number of threads
- `total_pages`: Total number of pages
- `has_next`: Whether there's a next page
- `has_prev`: Whether there's a previous page

## Summary Statistics

The response includes comprehensive statistics:

### Thread Statistics

- `total_threads`: Total threads matching filters
- `direct_chats`: Number of direct chats
- `group_chats`: Number of group chats
- `includes_principal`: Threads with principal participation
- `excludes_principal`: Threads without principal participation

### Message Statistics

- `total_messages`: Total messages across all threads
- `average_messages_per_thread`: Average messages per thread

### Participant Statistics

- `total_unique`: Unique participants across all threads
- `teachers`: Total teacher participations
- `parents`: Total parent participations
- `students`: Total student participations
- `admins`: Total admin participations

## Error Responses

### 401 Unauthorized

```json
{
  "status": "error",
  "message": "Unauthorized"
}
```

### 403 Forbidden

```json
{
  "status": "error",
  "message": "Access denied. Admin or Principal role required."
}
```

### 500 Internal Server Error

```json
{
  "status": "error",
  "message": "Failed to fetch chat threads"
}
```

## Performance Considerations

- **Indexing**: Ensure proper database indexes on:
  - `chat_threads(created_at)`
  - `chat_threads(thread_type)`
  - `chat_participants(user_id)`
  - `chat_messages(thread_id)`

- **Pagination**: Use pagination for large datasets
- **Filtering**: Apply filters early in the query to reduce data processing
- **Caching**: Consider caching for frequently accessed data

## Testing

Use the provided test script:

```bash
node test_principal_chats.js
```

Make sure to:

1. Replace placeholder auth token with actual principal/admin token
2. Have the server running on `http://localhost:3000`
3. Have some chat threads created in the system

## Use Cases

1. **Administrative Oversight**: Monitor all communication in the school
2. **Compliance**: Track conversations for policy enforcement
3. **Analytics**: Analyze communication patterns
4. **Support**: Help resolve communication issues
5. **Reporting**: Generate communication reports

## Security Notes

- Only principals and admins can access this endpoint
- All data is filtered based on user permissions
- Sensitive information is properly handled
- Audit trails are maintained for administrative access
