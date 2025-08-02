# Real-Time Messaging System Guide

## Overview

This implementation provides real-time messaging capabilities for your school app with the following features:

- ✅ **Real-time messages** when app is open (WebSocket + Supabase Realtime)
- ✅ **Offline message sync** when app reopens (Smart polling)
- ✅ **Authentication integration** with JWT tokens
- ✅ **S3 compatible** - will work when you migrate from Supabase
- ✅ **No app store deployment required** - works immediately

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   WebSocket      │    │   Supabase      │
│                 │◄──►│   Server         │◄──►│   Realtime      │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Offline       │    │   Message        │    │   Database      │
│   Polling       │    │   Persistence    │    │   (Supabase)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## How It Works

### 1. When App is Open

- **WebSocket connection** established with authentication
- **Supabase Realtime** subscribes to message changes
- **Instant delivery** of new messages to connected users

### 2. When App is Closed

- Messages are stored in database
- **No real-time delivery** (no push notifications without FCM)
- **Smart polling** when app reopens to fetch missed messages

### 3. When App Reopens

- **Offline messages endpoint** fetches messages since last check
- **Unread count** shows pending messages
- **Real-time connection** re-established

## API Endpoints

### WebSocket Connection

```
ws://your-server:port?token=JWT_TOKEN
```

**Connection Headers:**

```
Authorization: Bearer JWT_TOKEN
```

### REST Endpoints

#### 1. Subscribe to Real-time Messages

```http
POST /api/chat/subscribe
Authorization: Bearer JWT_TOKEN
```

**Response:**

```json
{
  "status": "success",
  "message": "Subscribed to real-time messages",
  "user_id": "user-uuid"
}
```

#### 2. Get Offline Messages

```http
GET /api/chat/offline-messages?last_check_time=2024-01-01T00:00:00Z
Authorization: Bearer JWT_TOKEN
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "message-uuid",
        "thread_id": "thread-uuid",
        "sender_id": "user-uuid",
        "content": "Hello!",
        "message_type": "text",
        "created_at": "2024-01-01T12:00:00Z",
        "sender": {
          "full_name": "John Doe",
          "role": "teacher"
        }
      }
    ],
    "count": 1,
    "last_check_time": "2024-01-01T12:30:00Z"
  }
}
```

#### 3. Get Unread Count

```http
GET /api/chat/unread-count
Authorization: Bearer JWT_TOKEN
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "unread_count": 5
  }
}
```

#### 4. Mark Messages as Read

```http
POST /api/chat/mark-read/:thread_id
Authorization: Bearer JWT_TOKEN
```

**Response:**

```json
{
  "status": "success",
  "message": "Messages marked as read",
  "thread_id": "thread-uuid",
  "user_id": "user-uuid"
}
```

#### 5. Unsubscribe from Real-time

```http
POST /api/chat/unsubscribe
Authorization: Bearer JWT_TOKEN
```

## WebSocket Message Types

### From Server to Client

#### 1. Connection Established

```json
{
  "type": "connection_established",
  "user_id": "user-uuid",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### 2. New Message

```json
{
  "type": "new_message",
  "data": {
    "id": "message-uuid",
    "thread_id": "thread-uuid",
    "sender_id": "user-uuid",
    "content": "Hello!",
    "message_type": "text",
    "created_at": "2024-01-01T12:00:00Z",
    "sender": {
      "full_name": "John Doe",
      "role": "teacher"
    }
  }
}
```

#### 3. Thread Subscribed

```json
{
  "type": "thread_subscribed",
  "thread_id": "thread-uuid"
}
```

#### 4. Thread Unsubscribed

```json
{
  "type": "thread_unsubscribed",
  "thread_id": "thread-uuid"
}
```

#### 5. Error

```json
{
  "type": "error",
  "message": "Real-time connection error"
}
```

#### 6. Pong (Response to Ping)

```json
{
  "type": "pong"
}
```

### From Client to Server

#### 1. Subscribe to Thread

```json
{
  "type": "subscribe_thread",
  "thread_id": "thread-uuid"
}
```

#### 2. Unsubscribe from Thread

```json
{
  "type": "unsubscribe_thread",
  "thread_id": "thread-uuid"
}
```

#### 3. Ping (Keep Alive)

```json
{
  "type": "ping"
}
```

## Client Implementation Examples

### JavaScript/Web Client

```javascript
class ChatClient {
  constructor(token, serverUrl) {
    this.token = token;
    this.serverUrl = serverUrl;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    const wsUrl = `${this.serverUrl.replace("http", "ws")}?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case "new_message":
        this.onNewMessage(message.data);
        break;
      case "connection_established":
        console.log("Connection established for user:", message.user_id);
        break;
      case "error":
        console.error("Server error:", message.message);
        break;
      default:
        console.log("Unknown message type:", message.type);
    }
  }

  onNewMessage(message) {
    // Handle new message - update UI, play sound, etc.
    console.log("New message:", message);
    // Emit event or call callback
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }
  }

  subscribeToThread(threadId) {
    this.send({
      type: "subscribe_thread",
      thread_id: threadId,
    });
  }

  unsubscribeFromThread(threadId) {
    this.send({
      type: "unsubscribe_thread",
      thread_id: threadId,
    });
  }

  ping() {
    this.send({ type: "ping" });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage
const chatClient = new ChatClient("your-jwt-token", "http://localhost:3000");
chatClient.connect();

// Subscribe to a thread
chatClient.subscribeToThread("thread-uuid");

// Handle new messages
chatClient.onMessageCallback = (message) => {
  // Update your UI here
  console.log("Received message:", message);
};
```

### React Native Client

```javascript
import { useEffect, useRef } from "react";

const useWebSocket = (token, serverUrl) => {
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  const connect = () => {
    const wsUrl = `${serverUrl.replace("http", "ws")}?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
      // Reconnect after 5 seconds
      reconnectTimeout.current = setTimeout(connect, 5000);
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  const handleMessage = (message) => {
    switch (message.type) {
      case "new_message":
        // Handle new message
        console.log("New message:", message.data);
        break;
      case "connection_established":
        console.log("Connected as user:", message.user_id);
        break;
    }
  };

  const send = (message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  const subscribeToThread = (threadId) => {
    send({
      type: "subscribe_thread",
      thread_id: threadId,
    });
  };

  useEffect(() => {
    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [token, serverUrl]);

  return { send, subscribeToThread };
};
```

## Offline Message Sync

When the app reopens, use this flow:

1. **Get unread count** to show badge
2. **Get offline messages** since last check
3. **Reconnect WebSocket** for real-time updates
4. **Mark messages as read** when user views them

```javascript
// App startup flow
async function initializeChat() {
  // 1. Get unread count
  const unreadResponse = await fetch("/api/chat/unread-count", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { unread_count } = await unreadResponse.json();

  // Show badge with unread count
  updateBadge(unread_count);

  // 2. Get offline messages
  const lastCheckTime =
    localStorage.getItem("lastMessageCheck") || "2024-01-01T00:00:00Z";
  const offlineResponse = await fetch(
    `/api/chat/offline-messages?last_check_time=${lastCheckTime}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const { messages, last_check_time } = await offlineResponse.json();

  // Process offline messages
  messages.forEach((message) => {
    displayMessage(message);
  });

  // Update last check time
  localStorage.setItem("lastMessageCheck", last_check_time);

  // 3. Connect WebSocket for real-time
  chatClient.connect();
}
```

## S3 Migration Compatibility

When you migrate from Supabase to S3:

1. **Replace Supabase client** with your S3 database client
2. **Update realtimeService.js** to use your new database
3. **WebSocket service** remains unchanged
4. **API endpoints** remain the same
5. **Client code** remains unchanged

The architecture is database-agnostic, so only the data layer needs updates.

## Security Features

- ✅ **JWT Authentication** for WebSocket connections
- ✅ **User authorization** for thread access
- ✅ **Message ownership** validation
- ✅ **Rate limiting** (can be added)
- ✅ **Input validation** on all endpoints

## Performance Considerations

- **Connection pooling** for WebSocket clients
- **Message batching** for high-volume scenarios
- **Database indexing** on frequently queried fields
- **Caching** for user threads and participants

## Monitoring

The system includes comprehensive logging:

- WebSocket connection/disconnection events
- Message delivery status
- Error tracking
- Performance metrics

## Next Steps

1. **Install dependencies**: `npm install ws`
2. **Test WebSocket connection** with a simple client
3. **Implement client-side** message handling
4. **Add offline sync** to your mobile app
5. **Test with multiple users** in different scenarios

This implementation provides a solid foundation for real-time messaging that will work immediately and scale with your needs!
