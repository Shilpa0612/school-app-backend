# Teacher Linked Parents API - Chat Information Feature

## Overview

The `/api/users/teacher-linked-parents` endpoint has been enhanced to include chat thread information for each linked parent. This allows teachers to see which parents they have existing chat conversations with, along with message counts and participant details.

## New Response Structure

### Parent Object with Chat Information

Each parent in the `linked_parents` array now includes a `chat_info` object:

```json
{
  "parent_id": "uuid",
  "full_name": "Parent Name",
  "email": "parent@example.com",
  "phone_number": "+1234567890",
  "linked_students": [...],
  "chat_info": {
    "has_thread": true,
    "thread_id": "uuid",
    "message_count": 15,
    "participants": [
      {
        "user_id": "uuid",
        "role": "member",
        "last_read_at": "2024-01-15T10:30:00Z",
        "user": {
          "full_name": "Teacher Name",
          "role": "teacher"
        }
      },
      {
        "user_id": "uuid",
        "role": "member",
        "last_read_at": "2024-01-15T10:25:00Z",
        "user": {
          "full_name": "Parent Name",
          "role": "parent"
        }
      }
    ],
    "thread_title": "Teacher Name & Parent Name",
    "thread_type": "direct",
    "created_at": "2024-01-10T09:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Chat Info Fields

| Field           | Type    | Description                                             |
| --------------- | ------- | ------------------------------------------------------- |
| `has_thread`    | boolean | Whether a chat thread exists between teacher and parent |
| `thread_id`     | uuid    | The chat thread ID (null if no thread exists)           |
| `message_count` | number  | Total number of messages in the thread                  |
| `participants`  | array   | Array of participants in the thread with their details  |
| `thread_title`  | string  | Title of the chat thread                                |
| `thread_type`   | string  | Type of thread (usually "direct")                       |
| `created_at`    | string  | When the thread was created                             |
| `updated_at`    | string  | When the thread was last updated                        |

### Enhanced Summary Statistics

The response now includes additional chat-related statistics:

```json
{
  "summary": {
    "total_linked_parents": 25,
    "total_students": 45,
    "total_classes": 8,
    "total_assignments": 12,
    "primary_teacher_for": 3,
    "subject_teacher_for": 9,
    "parents_with_chat": 18,
    "parents_without_chat": 7
  }
}
```

## API Usage

### Request

```http
GET /api/users/teacher-linked-parents?teacher_id={teacher_id}
Authorization: Bearer {token}
```

### Response Example

```json
{
  "status": "success",
  "data": {
    "teacher": {
      "id": "teacher-uuid",
      "full_name": "John Doe",
      "assignments": [...]
    },
    "linked_parents": [
      {
        "parent_id": "parent-uuid",
        "full_name": "Jane Smith",
        "email": "jane@example.com",
        "phone_number": "+1234567890",
        "linked_students": [...],
        "chat_info": {
          "has_thread": true,
          "thread_id": "thread-uuid",
          "message_count": 15,
          "participants": [...],
          "thread_title": "John Doe & Jane Smith",
          "thread_type": "direct",
          "created_at": "2024-01-10T09:00:00Z",
          "updated_at": "2024-01-15T10:30:00Z"
        }
      }
    ],
    "principal": {...},
    "summary": {
      "total_linked_parents": 25,
      "parents_with_chat": 18,
      "parents_without_chat": 7,
      ...
    }
  }
}
```

## Implementation Details

### Database Queries

The feature performs the following database operations:

1. **Get Teacher Threads**: Fetches all chat threads where the teacher is a participant
2. **Get Parent Threads**: Fetches all chat threads where the parent is a participant
3. **Find Common Threads**: Identifies threads where both teacher and parent are participants
4. **Get Thread Details**: Retrieves complete thread information including participants
5. **Get Message Count**: Counts total messages in the thread

### Performance Considerations

- Uses `Promise.all()` to fetch chat information for all parents concurrently
- Includes error handling for each parent to prevent one failure from affecting others
- Uses efficient database queries with proper indexing
- Caches results where appropriate

### Error Handling

If chat information cannot be retrieved for a specific parent, the API will:

- Log the error for debugging
- Return `has_thread: false` for that parent
- Continue processing other parents
- Not fail the entire request

## Use Cases

1. **Teacher Dashboard**: Show which parents have active chat conversations
2. **Quick Access**: Provide direct links to existing chat threads
3. **Analytics**: Track communication patterns between teachers and parents
4. **UI Enhancement**: Display message counts and last activity timestamps

## Testing

Use the provided test script `test_teacher_linked_parents.js` to verify the functionality:

```bash
node test_teacher_linked_parents.js
```

Make sure to:

1. Replace placeholder values with actual teacher ID and auth token
2. Have the server running on `http://localhost:3000`
3. Have some chat threads created between teachers and parents

## Database Requirements

The feature requires the following tables to be properly set up:

- `chat_threads` - Stores chat conversation metadata
- `chat_participants` - Maps users to threads
- `chat_messages` - Stores individual messages
- `users` - User information

Ensure these tables exist and have the correct relationships before using this feature.
