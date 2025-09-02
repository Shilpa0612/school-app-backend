# Chat API Structure Guide

## 🎯 **Overview**

The chat system has been restructured to follow proper API design principles:

- **Thread List**: Shows only essential thread information with the most recent message
- **Message Fetching**: Separate endpoint for getting messages with proper pagination
- **Performance**: Optimized queries and reduced response sizes

## 🔧 **API Endpoints**

### **1. GET `/api/chat/threads` - Thread List**

**Purpose**: Get list of chat threads for the current user

**Response Structure**:

```json
{
  "status": "success",
  "data": {
    "threads": [
      {
        "id": "thread-uuid",
        "thread_type": "direct",
        "title": "Chat with Teacher 1",
        "created_by": "user-uuid",
        "status": "active",
        "created_at": "2025-08-19T07:14:13.202861+00:00",
        "updated_at": "2025-08-28T09:18:03.726221+00:00",
        "participants": [...],
        "last_message": [
          {
            "content": "Good morning",
            "created_at": "2025-08-28T09:18:03.463556+00:00",
            "sender": {
              "full_name": "Vishu"
            }
          }
        ],
        "unread_count": 2
      }
    ],
    "pagination": {...}
  }
}
```

**Key Features**:

- ✅ **Only 1 message** shown per thread (most recent)
- ✅ **Unread count** for each thread
- ✅ **Efficient queries** - no unnecessary data
- ✅ **Proper pagination** for thread list

### **2. GET `/api/chat/threads/:thread_id/messages` - Thread Messages**

**Purpose**: Get messages from a specific thread with pagination

**Query Parameters**:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50)
- `before_date` (optional): Get messages before this date
- `after_date` (optional): Get messages after this date

**Response Structure**:

```json
{
  "status": "success",
  "data": {
    "thread": {
      "id": "thread-uuid",
      "title": "Chat with Teacher 1",
      "thread_type": "direct",
      "created_at": "2025-08-19T07:14:13.202861+00:00",
      "updated_at": "2025-08-28T09:18:03.726221+00:00"
    },
    "messages": [
      {
        "id": "message-uuid",
        "content": "Good morning",
        "created_at": "2025-08-28T09:18:03.463556+00:00",
        "sender": {
          "id": "user-uuid",
          "full_name": "Vishu",
          "role": "parent"
        },
        "attachments": []
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    },
    "summary": {
      "total_messages": 15,
      "current_page_messages": 15,
      "thread_type": "direct"
    }
  }
}
```

**Key Features**:

- ✅ **Proper pagination** for messages
- ✅ **Date filtering** options
- ✅ **Thread context** included
- ✅ **Auto-updates** last read timestamp
- ✅ **Efficient queries** with proper indexing

## 📱 **Frontend Implementation**

### **1. Thread List (Dashboard)**

```javascript
const fetchThreads = async (page = 1, limit = 20) => {
  try {
    const response = await fetch(
      `/api/chat/threads?page=${page}&limit=${limit}`
    );
    const data = await response.json();

    if (data.status === "success") {
      // Display thread list with last message preview
      data.data.threads.forEach((thread) => {
        const lastMessage = thread.last_message[0];
        const preview = lastMessage ? lastMessage.content : "No messages yet";

        displayThread({
          id: thread.id,
          title: thread.title,
          lastMessage: preview,
          unreadCount: thread.unread_count,
          updatedAt: thread.updated_at,
        });
      });
    }
  } catch (error) {
    console.error("Error fetching threads:", error);
  }
};
```

### **2. Thread Messages (Chat View)**

```javascript
const fetchThreadMessages = async (threadId, page = 1, limit = 50) => {
  try {
    const response = await fetch(
      `/api/chat/threads/${threadId}/messages?page=${page}&limit=${limit}`
    );
    const data = await response.json();

    if (data.status === "success") {
      // Display messages with pagination
      displayMessages(data.data.messages);

      // Show pagination controls
      if (data.data.pagination.total_pages > 1) {
        showPagination(data.data.pagination);
      }
    }
  } catch (error) {
    console.error("Error fetching messages:", error);
  }
};
```

### **3. Load More Messages (Infinite Scroll)**

```javascript
const loadMoreMessages = async (threadId, beforeDate) => {
  try {
    const response = await fetch(
      `/api/chat/threads/${threadId}/messages?before_date=${beforeDate}&limit=20`
    );
    const data = await response.json();

    if (data.status === "success") {
      // Prepend older messages to chat
      prependMessages(data.data.messages);

      // Update pagination state
      updatePaginationState(data.data.pagination);
    }
  } catch (error) {
    console.error("Error loading more messages:", error);
  }
};
```

## 🔄 **Data Flow**

### **1. User Opens Chat App**

```
1. Fetch thread list → GET /api/chat/threads
2. Display threads with last message preview
3. Show unread counts
```

### **2. User Clicks on Thread**

```
1. Navigate to chat view
2. Fetch first page of messages → GET /api/chat/threads/{id}/messages
3. Display messages
4. Update last read timestamp
```

### **3. User Scrolls for More Messages**

```
1. Detect scroll position
2. Load more messages → GET /api/chat/threads/{id}/messages?before_date={date}
3. Append/prepend messages
4. Update pagination state
```

## 📊 **Performance Benefits**

### **Before (Old Implementation)**:

- ❌ **Large responses** - all messages in thread list
- ❌ **Slow loading** - unnecessary data transfer
- ❌ **No pagination** - could overwhelm client
- ❌ **Mixed concerns** - thread info + message content

### **After (New Implementation)**:

- ✅ **Small responses** - only essential data
- ✅ **Fast loading** - optimized queries
- ✅ **Proper pagination** - controlled data loading
- ✅ **Separated concerns** - thread list vs messages

## 🛠 **Query Optimization**

### **Thread List Query**:

```sql
-- Only fetches thread metadata + participants
SELECT
  chat_threads.*,
  chat_participants(user_id, role, last_read_at, users(full_name, role))
FROM chat_threads
WHERE id IN (user_thread_ids)
ORDER BY updated_at DESC;
```

### **Last Message Query** (per thread):

```sql
-- Fetches only the most recent message
SELECT content, created_at, users(full_name)
FROM chat_messages
WHERE thread_id = ?
ORDER BY created_at DESC
LIMIT 1;
```

### **Messages Query**:

```sql
-- Fetches paginated messages with sender info
SELECT
  chat_messages.*,
  users(full_name, role),
  chat_message_attachments(*)
FROM chat_messages
WHERE thread_id = ?
ORDER BY created_at DESC
LIMIT ? OFFSET ?;
```

## 📋 **Best Practices**

### **1. Thread List Usage**:

- ✅ Use for **dashboard/overview**
- ✅ Show **last message preview**
- ✅ Display **unread counts**
- ✅ Handle **thread navigation**

### **2. Messages Endpoint Usage**:

- ✅ Use for **chat view**
- ✅ Implement **pagination**
- ✅ Handle **infinite scroll**
- ✅ Update **read status**

### **3. Performance Tips**:

- ✅ **Cache thread list** (refresh on new messages)
- ✅ **Lazy load** messages when needed
- ✅ **Use pagination** for large conversations
- ✅ **Implement debouncing** for scroll events

## 🔍 **Error Handling**

### **Thread List Errors**:

```javascript
if (data.status === "error") {
  if (data.error_details?.code === "ACCESS_DENIED") {
    showMessage("Access denied to some threads");
  } else {
    showMessage("Failed to load threads");
  }
}
```

### **Message Fetching Errors**:

```javascript
if (data.status === "error") {
  if (data.error_details?.code === "ACCESS_DENIED") {
    redirectToThreads();
  } else {
    showMessage("Failed to load messages");
  }
}
```

## 🚀 **Migration Guide**

### **From Old Implementation**:

1. **Update thread list calls** - remove message content expectation
2. **Add message fetching calls** - use new endpoint for chat view
3. **Update UI components** - separate thread list and chat view
4. **Test pagination** - ensure proper message loading

### **Benefits of Migration**:

- 🚀 **Faster app loading**
- 📱 **Better mobile performance**
- 💾 **Reduced memory usage**
- 🔄 **Improved user experience**

This new structure provides a much better user experience with proper separation of concerns and optimized performance! 🎉
