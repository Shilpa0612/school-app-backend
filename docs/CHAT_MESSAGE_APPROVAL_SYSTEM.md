# Chat Message Approval System

## Overview

The Chat Message Approval System implements a controlled messaging workflow where **teacher-to-parent messages require approval** from admins or principals before they are visible to parents, while **parent-to-teacher messages are automatically approved** and do not require any review.

## Key Features

✅ **Selective Approval**: Only teacher→parent messages need approval  
✅ **Automatic Approval**: Parent→teacher, teacher→teacher, and admin messages are auto-approved  
✅ **Role-Based Access**: Only admins and principals can approve/reject messages  
✅ **Real-time Support**: Works with both REST API and WebSocket connections  
✅ **Transparency**: Teachers see their pending messages; parents only see approved content

---

## Database Schema

### Added Columns to `chat_messages` Table

```sql
-- Approval status: pending, approved, rejected
approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'))

-- User who approved/rejected the message
approved_by UUID REFERENCES users(id) ON DELETE SET NULL

-- Timestamp of approval/rejection
approved_at TIMESTAMP WITH TIME ZONE

-- Reason for rejection (if applicable)
rejection_reason TEXT
```

### Migration File

Run the migration file: `migrations/add_approval_to_chat_messages.sql`

```bash
# Apply migration to your Supabase database
psql -h <your-db-host> -U <your-db-user> -d <your-db-name> -f migrations/add_approval_to_chat_messages.sql
```

---

## Approval Logic

### Who Needs Approval?

| Sender Role | Recipient Role | Requires Approval? |
| ----------- | -------------- | ------------------ |
| Teacher     | Parent         | ✅ YES             |
| Teacher     | Teacher        | ❌ NO              |
| Parent      | Teacher        | ❌ NO              |
| Admin       | Anyone         | ❌ NO              |
| Principal   | Anyone         | ❌ NO              |

### Message Visibility

| User Role              | What They See                                      |
| ---------------------- | -------------------------------------------------- |
| **Admin/Principal**    | All messages (pending, approved, rejected)         |
| **Teacher (sender)**   | Their own pending messages + all approved messages |
| **Parent**             | Only approved messages                             |
| **Other participants** | Only approved messages                             |

---

## API Endpoints

### 1. Send Message (with Approval)

**Endpoint**: `POST /api/chat/messages`

**Authentication**: Required

**Request Body**:

```json
{
  "thread_id": "uuid",
  "content": "Message content",
  "message_type": "text" // text, image, file, system
}
```

**Response**:

```json
{
  "status": "success",
  "data": {
    "id": "message-uuid",
    "thread_id": "thread-uuid",
    "sender_id": "user-uuid",
    "content": "Message content",
    "message_type": "text",
    "approval_status": "pending", // or "approved"
    "created_at": "2024-10-15T10:30:00Z",
    "sender": {
      "full_name": "John Doe",
      "role": "teacher"
    }
  },
  "message": "Message sent successfully and is pending approval"
}
```

**Behavior**:

- If sender is teacher and recipient is parent → `approval_status: "pending"`
- Otherwise → `approval_status: "approved"`

---

### 2. Get Messages (Filtered by Approval)

**Endpoint**: `GET /api/chat/messages`

**Authentication**: Required

**Query Parameters**:

- `thread_id` (required): Thread UUID
- `page` (optional, default: 1)
- `limit` (optional, default: 50)

**Response**:

```json
{
  "status": "success",
  "data": {
    "participants": [...],
    "messages": [
      {
        "id": "message-uuid",
        "content": "Message content",
        "approval_status": "approved",
        "approved_by": "admin-uuid",
        "approved_at": "2024-10-15T11:00:00Z",
        "sender": {
          "full_name": "John Doe",
          "role": "teacher"
        },
        "approver": {
          "full_name": "Admin Name",
          "role": "admin"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "total_pages": 2
    }
  }
}
```

**Filtering Logic**:

- **Admin/Principal**: See all messages
- **Others**: See approved messages + their own pending messages

---

### 3. Get Pending Messages (Admin/Principal Only)

**Endpoint**: `GET /api/chat/messages/pending`

**Authentication**: Required (Admin/Principal only)

**Query Parameters**:

- `page` (optional, default: 1)
- `limit` (optional, default: 50)
- `thread_id` (optional): Filter by specific thread

**Response**:

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "message-uuid",
        "content": "Message content",
        "approval_status": "pending",
        "created_at": "2024-10-15T10:30:00Z",
        "sender": {
          "id": "teacher-uuid",
          "full_name": "John Doe",
          "role": "teacher",
          "email": "john@school.com"
        },
        "thread": {
          "id": "thread-uuid",
          "title": "Teacher & Parent",
          "thread_type": "direct",
          "participants": [...]
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15,
      "total_pages": 1
    }
  }
}
```

---

### 4. Approve Message (Admin/Principal Only)

**Endpoint**: `POST /api/chat/messages/:message_id/approve`

**Authentication**: Required (Admin/Principal only)

**Request**: No body required

**Response**:

```json
{
  "status": "success",
  "message": "Message approved successfully",
  "data": {
    "id": "message-uuid",
    "content": "Message content",
    "approval_status": "approved",
    "approved_by": "admin-uuid",
    "approved_at": "2024-10-15T11:00:00Z",
    "sender": {
      "full_name": "John Doe",
      "role": "teacher"
    },
    "approver": {
      "full_name": "Admin Name",
      "role": "admin"
    }
  }
}
```

**Error Cases**:

- 403: Not authorized (non-admin/principal)
- 404: Message not found
- 400: Message already approved/rejected

---

### 5. Reject Message (Admin/Principal Only)

**Endpoint**: `POST /api/chat/messages/:message_id/reject`

**Authentication**: Required (Admin/Principal only)

**Request Body**:

```json
{
  "rejection_reason": "Inappropriate content"
}
```

**Response**:

```json
{
  "status": "success",
  "message": "Message rejected successfully",
  "data": {
    "id": "message-uuid",
    "content": "Message content",
    "approval_status": "rejected",
    "approved_by": "admin-uuid",
    "approved_at": "2024-10-15T11:00:00Z",
    "rejection_reason": "Inappropriate content",
    "sender": {
      "full_name": "John Doe",
      "role": "teacher"
    },
    "approver": {
      "full_name": "Admin Name",
      "role": "admin"
    }
  }
}
```

**Error Cases**:

- 403: Not authorized (non-admin/principal)
- 404: Message not found
- 400: Message already approved/rejected
- 400: Rejection reason required

---

### 6. Get Approval Statistics (Admin/Principal Only)

**Endpoint**: `GET /api/chat/messages/approval-stats`

**Authentication**: Required (Admin/Principal only)

**Response**:

```json
{
  "status": "success",
  "data": {
    "total_pending": 15,
    "total_approved": 250,
    "total_rejected": 5,
    "pending_by_sender": [
      {
        "sender_id": "teacher-uuid",
        "sender_name": "John Doe",
        "sender_role": "teacher",
        "pending_count": 8
      },
      {
        "sender_id": "teacher-uuid-2",
        "sender_name": "Jane Smith",
        "sender_role": "teacher",
        "pending_count": 7
      }
    ]
  }
}
```

---

## WebSocket Support

### Sending Messages via WebSocket

**Message Format**:

```json
{
  "type": "send_message",
  "thread_id": "thread-uuid",
  "content": "Message content",
  "message_type": "text"
}
```

**Response (Success)**:

```json
{
  "type": "message_sent",
  "data": {
    "id": "message-uuid",
    "thread_id": "thread-uuid",
    "content": "Message content",
    "message_type": "text",
    "status": "sent",
    "approval_status": "pending",
    "created_at": "2024-10-15T10:30:00Z",
    "sender": {
      "full_name": "John Doe",
      "role": "teacher"
    }
  },
  "message": "Message sent successfully and is pending approval"
}
```

**Broadcasting Behavior**:

- **Approved messages**: Broadcast to all participants immediately
- **Pending messages**: NOT broadcast; only sender sees them until approved

---

## Implementation Details

### Helper Function: `needsApproval(senderId, threadId)`

Located in:

- `src/routes/chat.js` (for REST API)
- `src/services/websocketService.js` (for WebSocket)

**Logic**:

1. Fetch sender's role
2. If sender is NOT a teacher → return `false`
3. Fetch thread participants (excluding sender)
4. Check if any participant is a parent
5. If yes → return `true` (requires approval)
6. Otherwise → return `false`

**Code Example**:

```javascript
async function needsApproval(senderId, threadId) {
  try {
    // Get sender's role
    const { data: sender } = await adminSupabase
      .from("users")
      .select("role")
      .eq("id", senderId)
      .single();

    // Only teachers need approval check
    if (sender.role !== "teacher") {
      return false;
    }

    // Get participants (excluding sender)
    const { data: participants } = await adminSupabase
      .from("chat_participants")
      .select("user_id, user:users!chat_participants_user_id_fkey(role)")
      .eq("thread_id", threadId)
      .neq("user_id", senderId);

    // Check if any participant is a parent
    const hasParentRecipient = participants.some(
      (p) => p.user?.role === "parent"
    );

    return hasParentRecipient;
  } catch (error) {
    logger.error("Error in needsApproval check:", error);
    return false;
  }
}
```

---

## Testing Guide

### Test Scenario 1: Teacher → Parent (Requires Approval)

1. **Teacher sends message to parent**:

   ```bash
   curl -X POST http://localhost:3000/api/chat/messages \
     -H "Authorization: Bearer <teacher-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "thread_id": "thread-uuid",
       "content": "Hello parent!",
       "message_type": "text"
     }'
   ```

2. **Expected**: Message created with `approval_status: "pending"`

3. **Parent retrieves messages**:

   ```bash
   curl http://localhost:3000/api/chat/messages?thread_id=thread-uuid \
     -H "Authorization: Bearer <parent-token>"
   ```

4. **Expected**: Pending message is NOT visible to parent

5. **Admin approves message**:

   ```bash
   curl -X POST http://localhost:3000/api/chat/messages/<message-id>/approve \
     -H "Authorization: Bearer <admin-token>"
   ```

6. **Expected**: Message status changes to `approved`

7. **Parent retrieves messages again**:

   ```bash
   curl http://localhost:3000/api/chat/messages?thread_id=thread-uuid \
     -H "Authorization: Bearer <parent-token>"
   ```

8. **Expected**: Approved message is now visible to parent

---

### Test Scenario 2: Parent → Teacher (No Approval Needed)

1. **Parent sends message to teacher**:

   ```bash
   curl -X POST http://localhost:3000/api/chat/messages \
     -H "Authorization: Bearer <parent-token>" \
     -H "Content-Type: application/json" \
     -d '{
       "thread_id": "thread-uuid",
       "content": "Hello teacher!",
       "message_type": "text"
     }'
   ```

2. **Expected**: Message created with `approval_status: "approved"`

3. **Teacher retrieves messages**:

   ```bash
   curl http://localhost:3000/api/chat/messages?thread_id=thread-uuid \
     -H "Authorization: Bearer <teacher-token>"
   ```

4. **Expected**: Message is immediately visible to teacher

---

### Test Scenario 3: Admin Views Pending Messages

```bash
curl http://localhost:3000/api/chat/messages/pending \
  -H "Authorization: Bearer <admin-token>"
```

**Expected**: List of all pending messages from teachers to parents

---

### Test Scenario 4: Get Approval Statistics

```bash
curl http://localhost:3000/api/chat/messages/approval-stats \
  -H "Authorization: Bearer <admin-token>"
```

**Expected**: Statistics showing pending, approved, and rejected message counts

---

## Frontend Integration Guide

### 1. Sending Messages (Handle Approval Status)

```javascript
async function sendMessage(threadId, content) {
  const response = await fetch("/api/chat/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      thread_id: threadId,
      content: content,
      message_type: "text",
    }),
  });

  const data = await response.json();

  if (data.status === "success") {
    const message = data.data;

    if (message.approval_status === "pending") {
      // Show user that message is pending approval
      showNotification("Message sent and is pending approval");
    } else {
      // Message sent and immediately visible
      showNotification("Message sent successfully");
    }
  }
}
```

### 2. Displaying Messages (Consider Approval Status)

```javascript
function renderMessage(message, currentUserId) {
  const isPending = message.approval_status === "pending";
  const isOwnMessage = message.sender_id === currentUserId;

  if (isPending && !isOwnMessage) {
    // Don't display pending messages from others
    return null;
  }

  return (
    <div className={`message ${isPending ? "pending" : ""}`}>
      <p>{message.content}</p>
      {isPending && isOwnMessage && (
        <span className="pending-badge">Pending Approval</span>
      )}
      {message.approval_status === "rejected" && isOwnMessage && (
        <span className="rejected-badge">
          Rejected: {message.rejection_reason}
        </span>
      )}
    </div>
  );
}
```

### 3. Admin Panel - Approve/Reject Messages

```javascript
async function loadPendingMessages() {
  const response = await fetch("/api/chat/messages/pending", {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  const data = await response.json();
  return data.data.messages;
}

async function approveMessage(messageId) {
  const response = await fetch(`/api/chat/messages/${messageId}/approve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });

  const data = await response.json();

  if (data.status === "success") {
    showNotification("Message approved successfully");
    // Refresh pending messages list
    loadPendingMessages();
  }
}

async function rejectMessage(messageId, reason) {
  const response = await fetch(`/api/chat/messages/${messageId}/reject`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rejection_reason: reason,
    }),
  });

  const data = await response.json();

  if (data.status === "success") {
    showNotification("Message rejected successfully");
    // Refresh pending messages list
    loadPendingMessages();
  }
}
```

---

## Security Considerations

### 1. Authorization Checks

- All approval endpoints verify user role (admin/principal only)
- Non-admin users cannot approve/reject messages
- Users can only see messages they're authorized to view

### 2. Message Visibility

- Parents cannot see pending messages from teachers
- Teachers can see their own pending messages for transparency
- Admins/principals can see all messages for moderation

### 3. Data Validation

- Rejection reason is required when rejecting messages
- Message status transitions are validated (can't approve already-approved messages)
- Thread participation is verified before sending messages

---

## Troubleshooting

### Issue: Messages not appearing for parents

**Check**:

1. Verify message `approval_status` is `'approved'`
2. Check if admin/principal has approved the message
3. Ensure parent is a participant in the thread

### Issue: Teacher can't see their pending messages

**Check**:

1. Verify filtering logic in GET /chat/messages
2. Ensure OR filter includes `sender_id.eq.${userId}`

### Issue: WebSocket messages not broadcasting

**Check**:

1. Verify `approval_status` is `'approved'`
2. Check broadcast condition: `if (!requiresApproval || approvalStatus === 'approved')`
3. Ensure participants are connected to WebSocket

---

## Performance Optimization

### Database Indexes

The migration automatically creates these indexes:

```sql
CREATE INDEX idx_chat_messages_approval_status ON chat_messages(approval_status);
CREATE INDEX idx_chat_messages_approval_status_created ON chat_messages(approval_status, created_at DESC);
CREATE INDEX idx_chat_messages_thread_approval ON chat_messages(thread_id, approval_status);
```

### Query Optimization

- Use composite indexes for filtering by approval_status + other columns
- Paginate pending messages list for admins
- Cache approval statistics for dashboard

---

## Summary

This approval system provides:

✅ **Control**: Admins/principals review teacher→parent messages  
✅ **Flexibility**: Parent→teacher messages flow freely  
✅ **Transparency**: Teachers know when messages are pending  
✅ **Security**: Role-based access controls  
✅ **Performance**: Optimized with proper indexes

The system balances oversight with usability, ensuring appropriate communication while not burdening the workflow unnecessarily.
