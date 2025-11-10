# Children Teachers API - Chat Information Feature

## Overview

The `/api/users/children/teachers` endpoint has been enhanced to include chat thread information for each teacher. This allows parents to see which teachers they have existing chat conversations with, along with message counts and participant details.

## New Response Structure

### Teacher Object with Chat Information

Each teacher in the `teachers` array now includes a `chat_info` object:

```json
{
  "assignment_id": "uuid",
  "teacher_id": "uuid",
  "full_name": "Teacher Name",
  "phone_number": "+1234567890",
  "email": "teacher@school.com",
  "assignment_type": "primary",
  "subject": "Mathematics",
  "is_primary": true,
  "assigned_date": "2024-01-15T10:00:00Z",
  "contact_info": {
    "phone": "+1234567890",
    "email": "teacher@school.com"
  },
  "chat_info": {
    "has_thread": true,
    "thread_id": "uuid",
    "message_count": 25,
    "participants": [
      {
        "user_id": "uuid",
        "role": "member",
        "last_read_at": "2024-01-15T10:30:00Z",
        "user": {
          "full_name": "Parent Name",
          "role": "parent"
        }
      },
      {
        "user_id": "uuid",
        "role": "member",
        "last_read_at": "2024-01-15T10:25:00Z",
        "user": {
          "full_name": "Teacher Name",
          "role": "teacher"
        }
      }
    ],
    "thread_title": "Parent Name & Teacher Name",
    "thread_type": "direct",
    "created_at": "2024-01-10T09:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Chat Info Fields

| Field           | Type    | Description                                             |
| --------------- | ------- | ------------------------------------------------------- |
| `has_thread`    | boolean | Whether a chat thread exists between parent and teacher |
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
    "total_children": 3,
    "total_teachers": 8,
    "total_classes": 2,
    "children_with_teachers": 3,
    "children_without_teachers": 0,
    "teachers_with_chat": 5,
    "teachers_without_chat": 3
  }
}
```

## API Usage

### Request

```http
GET /api/users/children/teachers
Authorization: Bearer {parent_token}
```

### Response Example

```json
{
  "status": "success",
  "data": {
    "children": [
      {
        "student_id": "student-uuid",
        "student_name": "John Smith",
        "admission_number": "2024001",
        "relationship": "father",
        "is_primary_guardian": true,
        "class_info": {
          "class_division_id": "class-uuid",
          "class_name": "Class 5 A",
          "division": "A",
          "academic_year": "2024-25",
          "class_level": "Class 5",
          "roll_number": 15
        },
        "teachers": [
          {
            "assignment_id": "assignment-uuid",
            "teacher_id": "teacher-uuid",
            "full_name": "Jane Doe",
            "phone_number": "+1234567890",
            "email": "jane@school.com",
            "assignment_type": "primary",
            "subject": "Mathematics",
            "is_primary": true,
            "assigned_date": "2024-01-15T10:00:00Z",
            "contact_info": {
              "phone": "+1234567890",
              "email": "jane@school.com"
            },
            "chat_info": {
              "has_thread": true,
              "thread_id": "thread-uuid",
              "message_count": 25,
              "participants": [...],
              "thread_title": "Parent Name & Jane Doe",
              "thread_type": "direct",
              "created_at": "2024-01-10T09:00:00Z",
              "updated_at": "2024-01-15T10:30:00Z"
            }
          }
        ]
      }
    ],
    "principal": {
      "id": "principal-uuid",
      "full_name": "Principal Name",
      "email": "principal@school.com",
      "phone_number": "+1234567890",
      "role": "principal",
      "contact_info": {
        "phone": "+1234567890",
        "email": "principal@school.com"
      }
    },
    "summary": {
      "total_children": 3,
      "total_teachers": 8,
      "total_classes": 2,
      "children_with_teachers": 3,
      "children_without_teachers": 0,
      "teachers_with_chat": 5,
      "teachers_without_chat": 3
    }
  }
}
```

## Implementation Details

### Database Queries

The feature performs the following database operations for each teacher:

1. **Get Parent Threads**: Fetches all chat threads where the parent is a participant
2. **Get Teacher Threads**: Fetches all chat threads where the teacher is a participant
3. **Find Common Threads**: Identifies threads where both parent and teacher are participants
4. **Get Thread Details**: Retrieves complete thread information including participants
5. **Get Message Count**: Counts total messages in the thread

### Performance Considerations

- Uses nested `Promise.all()` to fetch chat information for all teachers across all children concurrently
- Includes error handling for each teacher to prevent one failure from affecting others
- Uses efficient database queries with proper indexing
- Processes children and their teachers in parallel

### Error Handling

If chat information cannot be retrieved for a specific teacher, the API will:

- Log the error for debugging
- Return `has_thread: false` for that teacher
- Continue processing other teachers
- Not fail the entire request

## Use Cases

1. **Parent Dashboard**: Show which teachers have active chat conversations
2. **Quick Access**: Provide direct links to existing chat threads with teachers
3. **Communication Status**: Display message counts and last activity timestamps
4. **Teacher Prioritization**: Highlight teachers with active communication
5. **Analytics**: Track communication patterns between parents and teachers

## Testing

Use the provided test script `test_children_teachers.js` to verify the functionality:

```bash
node test_children_teachers.js
```

Make sure to:

1. Replace placeholder values with actual parent auth token
2. Have the server running on `http://localhost:3000`
3. Have some chat threads created between parents and teachers

## Database Requirements

The feature requires the following tables to be properly set up:

- `chat_threads` - Stores chat conversation metadata
- `chat_participants` - Maps users to threads
- `chat_messages` - Stores individual messages
- `users` - User information
- `parent_student_mappings` - Parent-child relationships
- `student_academic_records` - Student class assignments
- `class_teacher_assignments` - Teacher class assignments

Ensure these tables exist and have the correct relationships before using this feature.

## Comparison with Teacher-Linked-Parents API

| Feature           | Teacher-Linked-Parents    | Children-Teachers                     |
| ----------------- | ------------------------- | ------------------------------------- |
| **Perspective**   | Teacher's view of parents | Parent's view of teachers             |
| **User Role**     | Teacher/Admin/Principal   | Parent only                           |
| **Chat Info**     | For each parent           | For each teacher                      |
| **Structure**     | Parents with chat info    | Children with teachers with chat info |
| **Summary Stats** | Parents with/without chat | Teachers with/without chat            |

Both endpoints now provide comprehensive chat information to enable seamless communication between teachers and parents.
