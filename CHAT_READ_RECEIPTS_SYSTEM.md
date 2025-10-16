# Chat Read Receipts System

## Overview

The Chat Read Receipts System provides **WhatsApp-style message read tracking** at both the message level and thread level. This system works seamlessly with the existing approval system and provides real-time read receipt notifications via WebSocket.

## Key Features

✅ **Per-Message Read Receipts**: Track who has read each individual message  
✅ **Read-By Lists**: See who has read your messages in group chats  
✅ **Real-time Updates**: WebSocket events when messages are read  
✅ **Auto-Mark on Read**: Messages automatically marked as read when viewing  
✅ **Unread Counts**: Get unread message counts per thread and globally  
✅ **Backward Compatible**: Maintains existing `last_read_at` functionality  
✅ **Approval Integration**: Works with the message approval system

---

## Database Schema

### New Table: `message_reads`

```sql
CREATE TABLE message_reads (
    id UUID PRIMARY KEY,
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(message_id, user_id)  -- Each user can only read a message once
);
```

### Updated Table: `chat_messages`

```sql
-- Added column
delivered_at TIMESTAMP WITH TIME ZONE  -- When message was delivered
```

### Existing (Unchanged): `chat_participants`

```sql
-- Still maintains for backward compatibility
last_read_at TIMESTAMP WITH TIME ZONE  -- Last time user viewed thread
```

---

## Message Status Lifecycle

```
sent → delivered → read
```

| Status      | Description                       | When Set                        |
| ----------- | --------------------------------- | ------------------------------- |
| `sent`      | Message created and sent          | On message creation             |
| `delivered` | Message delivered to recipient(s) | When recipient fetches messages |
| `read`      | Message has been read             | When recipient marks it as read |

---

## API Endpoints

### 1. Mark Specific Message as Read

**Endpoint**: `POST /api/chat/messages/:message_id/read`

**Authentication**: Required

**Description**: Mark a single message as read

**Response**:

```json
{
  "status": "success",
  "message": "Message marked as read",
  "data": {
    "message_id": "message-uuid",
    "user_id": "user-uuid",
    "read_at": "2024-10-15T10:30:00Z"
  }
}
```

**Error Cases**:

- 404: Message not found
- 403: Access denied to this message
- 400: Cannot mark own messages as read
- 400: Cannot mark pending/rejected messages as read

---

### 2. Get Read-By List for a Message

**Endpoint**: `GET /api/chat/messages/:message_id/read-by`

**Authentication**: Required

**Description**: Get list of users who have read a specific message

**Response**:

```json
{
  "status": "success",
  "data": {
    "message_id": "message-uuid",
    "read_count": 3,
    "read_by": [
      {
        "user_id": "user-1-uuid",
        "user_name": "John Doe",
        "user_role": "parent",
        "read_at": "2024-10-15T10:30:00Z"
      },
      {
        "user_id": "user-2-uuid",
        "user_name": "Jane Smith",
        "user_role": "teacher",
        "read_at": "2024-10-15T10:35:00Z"
      }
    ]
  }
}
```

**Use Cases**:

- Show "Read by 3 people" indicator
- Display read receipts in group chats
- Show who hasn't read the message yet

---

### 3. Mark All Messages in Thread as Read (Bulk)

**Endpoint**: `POST /api/chat/threads/:thread_id/mark-all-read`

**Authentication**: Required

**Description**: Mark all unread messages in a thread as read at once

**Response**:

```json
{
  "status": "success",
  "message": "5 message(s) marked as read",
  "data": {
    "thread_id": "thread-uuid",
    "user_id": "user-uuid",
    "messages_marked": 5,
    "marked_at": "2024-10-15T10:30:00Z"
  }
}
```

**When to Use**:

- User opens a chat thread (auto-mark all as read)
- User clicks "Mark all as read" button
- Background sync when app comes to foreground

---

### 4. Get Unread Count for Specific Thread

**Endpoint**: `GET /api/chat/threads/:thread_id/unread-count`

**Authentication**: Required

**Description**: Get count of unread messages in a specific thread

**Response**:

```json
{
  "status": "success",
  "data": {
    "thread_id": "thread-uuid",
    "unread_count": 12
  }
}
```

**Use Cases**:

- Display badge on thread list item
- Update UI when messages are read
- Show unread indicator

---

### 5. Get Total Unread Count (All Threads)

**Endpoint**: `GET /api/chat/unread-count`

**Authentication**: Required

**Description**: Get total unread message count across all threads

**Response**:

```json
{
  "status": "success",
  "data": {
    "total_unread": 25,
    "threads": [
      {
        "thread_id": "thread-1-uuid",
        "unread_count": 12
      },
      {
        "thread_id": "thread-2-uuid",
        "unread_count": 8
      },
      {
        "thread_id": "thread-3-uuid",
        "unread_count": 5
      }
    ]
  }
}
```

**Use Cases**:

- App badge counter
- Navigation bar unread indicator
- Dashboard statistics

---

### 6. GET /api/chat/messages (Enhanced)

**Endpoint**: `GET /api/chat/messages?thread_id=xxx`

**Authentication**: Required

**Description**: Fetch messages with read receipt data included

**Enhanced Response**:

```json
{
  "status": "success",
  "data": {
    "participants": [...],
    "messages": [
      {
        "id": "message-uuid",
        "content": "Hello!",
        "sender_id": "sender-uuid",
        "created_at": "2024-10-15T10:00:00Z",
        "status": "read",
        "approval_status": "approved",
        // NEW: Read receipt data
        "is_read": true,  // Has current user read this?
        "read_count": 3,  // How many people read it?
        "read_by": [
          {
            "user_id": "user-1-uuid",
            "user_name": "John Doe",
            "user_role": "parent",
            "read_at": "2024-10-15T10:05:00Z"
          },
          {
            "user_id": "user-2-uuid",
            "user_name": "Jane Smith",
            "user_role": "teacher",
            "read_at": "2024-10-15T10:10:00Z"
          }
        ]
      }
    ],
    "pagination": {...}
  }
}
```

**Behavior**:

- Automatically marks messages as read when fetching
- Includes read receipt data for each message
- Updates `last_read_at` for backward compatibility

---

## WebSocket Events

### Client → Server Events

#### 1. Mark Message as Read

```json
{
  "type": "mark_as_read",
  "message_id": "message-uuid",
  "thread_id": "thread-uuid" // optional
}
```

**Server Response**:

```json
{
  "type": "message_read",
  "data": {
    "message_id": "message-uuid",
    "thread_id": "thread-uuid",
    "user_id": "your-user-uuid",
    "read_at": "2024-10-15T10:30:00Z"
  }
}
```

#### 2. Mark Thread as Read

```json
{
  "type": "mark_thread_read",
  "thread_id": "thread-uuid"
}
```

**Server Response**:

```json
{
  "type": "thread_marked_read",
  "data": {
    "thread_id": "thread-uuid",
    "messages_marked": 5,
    "marked_at": "2024-10-15T10:30:00Z"
  }
}
```

---

### Server → Client Events

#### 1. Message Read by Other User

**Triggered When**: Another participant reads your message

```json
{
  "type": "message_read_by_other",
  "data": {
    "message_id": "message-uuid",
    "thread_id": "thread-uuid",
    "read_by": {
      "user_id": "reader-uuid",
      "user_name": "John Doe",
      "user_role": "parent"
    },
    "read_at": "2024-10-15T10:30:00Z"
  }
}
```

**Use Cases**:

- Show "✓✓" (double check) when message is read
- Update read receipt counter in real-time
- Show "Seen by John Doe" notification

---

## Frontend Integration

### 1. Displaying Read Receipts (WhatsApp Style)

```javascript
function MessageStatus({ message, currentUserId }) {
  // Don't show read receipts for received messages
  if (message.sender_id !== currentUserId) {
    return null;
  }

  // Message sent by current user - show status
  if (message.read_count > 0) {
    // Read by at least one person (blue double check)
    return (
      <span className="read-receipt">
        <Icon name="double-check-blue" />
        {message.read_count > 1 && (
          <span className="read-count">{message.read_count}</span>
        )}
      </span>
    );
  } else if (message.status === "delivered") {
    // Delivered but not read (grey double check)
    return (
      <span className="delivered-receipt">
        <Icon name="double-check-grey" />
      </span>
    );
  } else if (message.status === "sent") {
    // Sent but not delivered (single check)
    return (
      <span className="sent-receipt">
        <Icon name="single-check-grey" />
      </span>
    );
  }

  return null;
}
```

### 2. Auto-Mark Messages as Read (When Opening Chat)

```javascript
async function openChatThread(threadId) {
  // Fetch messages (auto-marks as read)
  const messages = await fetchMessages(threadId);

  // Update UI
  displayMessages(messages);

  // Update unread badge
  updateUnreadCount();
}
```

### 3. Show Read-By List (Group Chats)

```javascript
async function showReadByList(messageId) {
  const response = await fetch(`/api/chat/messages/${messageId}/read-by`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (data.status === "success") {
    // Show modal or popup
    showModal({
      title: `Read by ${data.data.read_count} people`,
      content: (
        <div>
          {data.data.read_by.map((reader) => (
            <div key={reader.user_id}>
              <Avatar user={reader} />
              <span>{reader.user_name}</span>
              <span className="timestamp">{formatTime(reader.read_at)}</span>
            </div>
          ))}
        </div>
      ),
    });
  }
}
```

### 4. Real-time Read Receipt Updates

```javascript
// WebSocket handler
function handleWebSocketMessage(event) {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case "message_read_by_other":
      // Update UI to show message was read
      const { message_id, read_by } = message.data;

      // Update message status in state
      updateMessageStatus(message_id, {
        is_read: true,
        read_count: (prevCount) => prevCount + 1,
        read_by: (prevReadBy) => [...prevReadBy, read_by],
      });

      // Show notification
      showToast(`${read_by.user_name} read your message`);
      break;

    case "message_read":
      // Confirmation that you marked a message as read
      console.log("Message marked as read:", message.data);
      break;

    case "thread_marked_read":
      // Confirmation that thread was marked as read
      const { messages_marked } = message.data;
      console.log(`${messages_marked} messages marked as read`);
      break;
  }
}
```

### 5. Unread Badge Counter

```javascript
function ThreadListItem({ thread }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch unread count for this thread
    fetch(`/api/chat/threads/${thread.id}/unread-count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setUnreadCount(data.data.unread_count);
      });
  }, [thread.id]);

  return (
    <div className="thread-item">
      <Avatar user={thread.other_participant} />
      <div className="thread-info">
        <h3>{thread.title}</h3>
        <p>{thread.last_message}</p>
      </div>
      {unreadCount > 0 && <Badge count={unreadCount} />}
    </div>
  );
}
```

### 6. Global Unread Counter (App Badge)

```javascript
function App() {
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    // Fetch total unread count
    const fetchUnreadCount = async () => {
      const response = await fetch("/api/chat/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      setTotalUnread(data.data.total_unread);
    };

    fetchUnreadCount();

    // Refresh every minute
    const interval = setInterval(fetchUnreadCount, 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <NavigationBar>
        <NavItem icon="chat" badge={totalUnread} />
      </NavigationBar>
    </div>
  );
}
```

---

## Integration with Approval System

The read receipt system works seamlessly with the approval system:

### Rules:

1. **Only approved messages can be marked as read**
   - Pending messages are not visible to recipients
   - Therefore, they cannot be marked as read

2. **Auto-mark excludes unapproved messages**
   - When fetching messages, only approved ones are marked as read
   - Pending messages don't count towards unread total for recipients

3. **Teachers see their own pending messages**
   - But these are always considered "read" by the sender
   - `is_read` is `true` for own messages

### Example:

```javascript
// Teacher sends message to parent
POST /api/chat/messages
→ approval_status: "pending"
→ status: "sent"
→ Not visible to parent yet

// Admin approves message
POST /api/chat/messages/:id/approve
→ approval_status: "approved"
→ Now visible to parent
→ status: "delivered" (when parent fetches)

// Parent reads message
POST /api/chat/messages/:id/read
→ Creates read receipt
→ status: "read"
→ Teacher gets real-time notification
```

---

## Testing Guide

### Test Scenario 1: Mark Message as Read

```bash
# 1. Send a message (as User A)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Authorization: Bearer <user-a-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread-uuid",
    "content": "Hello!",
    "message_type": "text"
  }'

# 2. Mark message as read (as User B)
curl -X POST http://localhost:3000/api/chat/messages/<message-id>/read \
  -H "Authorization: Bearer <user-b-token>"

# Expected: Success, read receipt created

# 3. Get read-by list
curl http://localhost:3000/api/chat/messages/<message-id>/read-by \
  -H "Authorization: Bearer <user-a-token>"

# Expected: User B appears in read-by list
```

### Test Scenario 2: WebSocket Read Receipts

```javascript
// Connect to WebSocket
const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
  // Authenticate
  ws.send(
    JSON.stringify({
      type: "auth",
      token: userToken,
    })
  );

  // Mark message as read
  ws.send(
    JSON.stringify({
      type: "mark_as_read",
      message_id: "message-uuid",
    })
  );
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("Received:", message);
  // Expected: message_read confirmation
  // Expected: Other participants get message_read_by_other event
};
```

### Test Scenario 3: Unread Counts

```bash
# Get unread count for specific thread
curl http://localhost:3000/api/chat/threads/<thread-id>/unread-count \
  -H "Authorization: Bearer <token>"

# Expected: { unread_count: 5 }

# Mark all as read
curl -X POST http://localhost:3000/api/chat/threads/<thread-id>/mark-all-read \
  -H "Authorization: Bearer <token>"

# Expected: { messages_marked: 5 }

# Get unread count again
curl http://localhost:3000/api/chat/threads/<thread-id>/unread-count \
  -H "Authorization: Bearer <token>"

# Expected: { unread_count: 0 }
```

---

## Troubleshooting

### Issue: Messages not being marked as read automatically

**Check**:

1. Verify GET /chat/messages is being called when opening thread
2. Check that `markThreadAsRead()` is being called
3. Ensure user is participant in thread
4. Verify messages have `approval_status: 'approved'`

### Issue: Read receipts not showing in UI

**Check**:

1. Verify `read_by` array is being returned in message data
2. Check that `read_count` field exists
3. Ensure UI is handling `is_read` flag correctly
4. Verify sender_id !== current_user_id (don't show for own messages)

### Issue: WebSocket read events not broadcasting

**Check**:

1. Verify WebSocket connection is established
2. Check that `handleMarkAsRead()` is being called
3. Ensure participants are connected to WebSocket
4. Verify broadcast logic is sending to all participants except reader

### Issue: Unread count is incorrect

**Check**:

1. Verify only approved messages are counted
2. Check that own messages are excluded from unread count
3. Ensure `message_reads` table has correct entries
4. Verify query is filtering by `sender_id != user_id`

---

## Performance Considerations

### Database Indexes

The migration creates optimized indexes:

```sql
CREATE INDEX idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX idx_message_reads_user_id ON message_reads(user_id);
CREATE INDEX idx_message_reads_message_user ON message_reads(message_id, user_id);
CREATE INDEX idx_message_reads_read_at ON message_reads(read_at DESC);
```

### Query Optimization

1. **Batch Read Receipts**: When fetching messages, read receipts are fetched in one query for all messages
2. **Auto-Mark in Background**: Auto-marking as read doesn't block the response
3. **Unread Counts Cached**: Consider caching unread counts for frequent requests
4. **Pagination**: Messages are paginated to reduce data transfer

### Recommendations

- Cache unread counts in Redis for high-traffic applications
- Use database functions for complex queries (already provided in migration)
- Consider batch updates for mobile apps syncing after being offline

---

## Migration Guide

### Running the Migration

```bash
# Apply migration to Supabase database
psql -h <host> -U <user> -d <database> -f migrations/add_read_receipts_to_chat.sql
```

### Backward Compatibility

The system maintains full backward compatibility:

- `chat_participants.last_read_at` still updated
- Old unread count logic still works
- New features are additive, not breaking

### Migration Steps

1. **Apply SQL migration** (adds tables, indexes, functions)
2. **Deploy backend code** (new endpoints + WebSocket handlers)
3. **Update frontend** (add read receipt UI)
4. **Test thoroughly** (use test scenarios above)

---

## Summary

The Read Receipts System provides:

✅ **Complete Tracking**: Per-message and thread-level read tracking  
✅ **Real-time Updates**: WebSocket events for instant feedback  
✅ **WhatsApp-like UX**: Familiar read receipt patterns  
✅ **Performance**: Optimized queries and indexes  
✅ **Integration**: Works seamlessly with approval system  
✅ **Flexibility**: REST API + WebSocket support

This system enhances user engagement by providing transparent communication status while maintaining performance and scalability.
