# Parent Notifications System

## 🎯 Overview

A comprehensive real-time notification system for parents to receive live updates about their children's school activities including announcements, events, homework, classwork, and messages.

## ✨ Features

### **Real-time Notifications**

- Live WebSocket-based notifications
- Instant delivery to connected parents
- Automatic reconnection and heartbeat mechanism
- Offline notification storage for later delivery

### **Notification Types**

- **Announcements**: School-wide and class-specific announcements
- **Events**: Calendar events, meetings, celebrations
- **Homework**: New homework assignments with due dates
- **Classwork**: Class activities and assignments
- **Messages**: Direct messages from teachers
- **Attendance**: Attendance updates and alerts
- **Birthdays**: Student birthday reminders
- **System**: System notifications and updates

### **Priority Levels**

- **Low**: General information
- **Normal**: Standard notifications
- **High**: Important updates (homework, events)
- **Urgent**: Critical alerts requiring immediate attention

## 🏗️ Architecture

### **Components**

1. **Notification Service** (`src/services/notificationService.js`)
   - Handles notification creation and delivery
   - Manages notification types and priorities
   - Provides bulk notification capabilities

2. **WebSocket Service** (`src/services/websocketService.js`)
   - Real-time communication with parents
   - Connection management and heartbeat
   - Notification broadcasting

3. **Realtime Service** (`src/services/realtimeService.js`)
   - Supabase real-time subscriptions
   - Database change listeners
   - Notification triggers

4. **Database Schema** (`parent_notifications_schema.sql`)
   - Notification storage and history
   - Read status tracking
   - Performance optimizations

5. **API Routes** (`src/routes/notifications.js`)
   - Parent notification management
   - Read/unread status management
   - Statistics and analytics

## 📊 Database Schema

### **parent_notifications Table**

```sql
CREATE TABLE parent_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('announcement', 'event', 'homework', 'classwork', 'message', 'attendance', 'birthday', 'system')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    related_id UUID, -- ID of the related record
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **Indexes for Performance**

- `idx_parent_notifications_parent_id` - Fast parent lookups
- `idx_parent_notifications_student_id` - Fast student lookups
- `idx_parent_notifications_unread` - Unread notifications
- `idx_parent_notifications_parent_unread_type` - Complex queries

## 🔌 API Endpoints

### **Get Notifications**

```http
GET /api/notifications
```

**Query Parameters:**

- `student_id` - Filter by specific student
- `type` - Filter by notification type
- `is_read` - Filter by read status
- `priority` - Filter by priority level
- `limit` - Number of notifications (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:**

```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "type": "announcement",
      "title": "New School Announcement",
      "message": "Parent-teacher meeting next week",
      "priority": "normal",
      "is_read": false,
      "created_at": "2024-01-15T10:30:00Z",
      "student": {
        "full_name": "John Doe",
        "admission_number": "2024001",
        "class_division": {
          "class_name": "Grade 5",
          "division_name": "A"
        }
      }
    }
  ]
}
```

### **Get Unread Count**

```http
GET /api/notifications/unread-count
```

**Query Parameters:**

- `student_id` - Count for specific student

**Response:**

```json
{
  "status": "success",
  "data": {
    "unread_count": 5
  }
}
```

### **Mark as Read**

```http
PUT /api/notifications/:id/read
```

**Response:**

```json
{
  "status": "success",
  "message": "Notification marked as read"
}
```

### **Mark All as Read**

```http
PUT /api/notifications/mark-all-read
```

**Body:**

```json
{
  "student_id": "optional-student-id"
}
```

### **Get Statistics**

```http
GET /api/notifications/stats
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "total": 25,
    "unread": 5,
    "byType": {
      "announcement": 10,
      "homework": 8,
      "event": 5,
      "message": 2
    },
    "byPriority": {
      "normal": 15,
      "high": 8,
      "urgent": 2
    }
  }
}
```

## 🔄 WebSocket Integration

### **Connection**

```javascript
const ws = new WebSocket(`ws://localhost:3000?token=${jwtToken}`);
```

### **Message Types**

#### **Connection Established**

```json
{
  "type": "connection_established",
  "user_id": "parent-uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### **Heartbeat**

```json
{
  "type": "heartbeat",
  "timestamp": 1640995200000,
  "timeout": 60000
}
```

#### **Notification**

```json
{
  "type": "notification",
  "data": {
    "id": "notification-uuid",
    "type": "homework",
    "title": "New Homework: Math Assignment",
    "message": "Complete exercises 1-10...",
    "priority": "high",
    "student_id": "student-uuid",
    "created_at": "2024-01-15T10:30:00Z",
    "is_read": false
  }
}
```

### **Client Implementation**

```javascript
class ParentNotificationClient {
  constructor(token) {
    this.token = token;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.ws = new WebSocket(`ws://localhost:3000?token=${this.token}`);

    this.ws.onopen = () => {
      console.log("Connected to notification service");
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      console.log("Disconnected from notification service");
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case "heartbeat":
        this.respondToHeartbeat();
        break;
      case "notification":
        this.showNotification(message.data);
        break;
      case "connection_established":
        console.log("Connection established for user:", message.user_id);
        break;
    }
  }

  respondToHeartbeat() {
    this.ws.send(
      JSON.stringify({
        type: "heartbeat_response",
        timestamp: Date.now(),
      })
    );
  }

  showNotification(notification) {
    // Show notification in UI
    console.log("New notification:", notification);

    // You can integrate with browser notifications, toast messages, etc.
    if (Notification.permission === "granted") {
      new Notification(notification.title, {
        body: notification.message,
        icon: "/notification-icon.png",
      });
    }
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
      setTimeout(() => this.connect(), 5000);
    }
  }
}

// Usage
const client = new ParentNotificationClient(parentJWTToken);
client.connect();
```

## 🚀 Setup Instructions

### **1. Database Setup**

```bash
# Run the database schema
psql -d your_database -f parent_notifications_schema.sql
```

### **2. Environment Variables**

```bash
# Add to .env file
JWT_SECRET=your-jwt-secret
WEBSOCKET_HEARTBEAT_INTERVAL=30000
WEBSOCKET_CONNECTION_TIMEOUT=60000
```

### **3. Install Dependencies**

```bash
npm install ws jsonwebtoken
```

### **4. Start the Server**

```bash
npm start
```

### **5. Test the System**

```bash
node test_notifications.js
```

## 🔧 Integration with Existing APIs

### **Announcements**

- **Approved Announcements**: Notifications sent immediately when announcements are approved by principal/admin
- **Pending Announcements**: No notifications sent until approved (teachers create pending announcements)
- **Auto-Approved**: Principal/admin created announcements are auto-approved and notifications sent immediately
- Targeted to parents based on announcement target roles
- Includes announcement details and student context

### **Homework**

- Notifications sent when homework is assigned
- Targeted to parents of students in the specific class
- Includes homework details, due date, and subject

### **Events**

- **Approved Events**: Notifications sent immediately when events are created and approved
- **Pending Events**: No notifications sent until approved (teachers create pending events)
- **Auto-Approved**: Principal/admin created events are auto-approved and notifications sent immediately
- Targeted based on event visibility and class associations
- Includes event details and timing

### **Messages**

- Real-time message notifications
- Targeted to specific parent-student relationships
- Includes sender information and message content

## 📱 Frontend Integration

### **React Example**

```jsx
import { useEffect, useState } from "react";

function ParentDashboard() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const token = localStorage.getItem("parentToken");
    const websocket = new WebSocket(`ws://localhost:3000?token=${token}`);

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "notification") {
        setNotifications((prev) => [message.data, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
    };

    setWs(websocket);

    // Load existing notifications
    fetchNotifications();

    return () => websocket.close();
  }, []);

  const fetchNotifications = async () => {
    const response = await fetch("/api/notifications", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("parentToken")}`,
      },
    });
    const data = await response.json();
    setNotifications(data.data);
    setUnreadCount(data.data.filter((n) => !n.is_read).length);
  };

  const markAsRead = async (notificationId) => {
    await fetch(`/api/notifications/${notificationId}/read`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("parentToken")}`,
      },
    });
    setUnreadCount((prev) => prev - 1);
  };

  return (
    <div>
      <h2>Notifications ({unreadCount} unread)</h2>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={notification.is_read ? "read" : "unread"}
        >
          <h3>{notification.title}</h3>
          <p>{notification.message}</p>
          <button onClick={() => markAsRead(notification.id)}>
            Mark as Read
          </button>
        </div>
      ))}
    </div>
  );
}
```

## 🧪 Testing

### **Run Test Suite**

```bash
node test_notifications.js
```

### **Test Coverage**

- ✅ WebSocket connection and heartbeat
- ✅ Real-time notification delivery
- ✅ Notification API endpoints
- ✅ Read/unread status management
- ✅ Statistics and analytics
- ✅ Bulk operations
- ✅ Error handling

### **Manual Testing**

1. **Connect as Parent**: Use parent JWT token to connect via WebSocket
2. **Create Content**: Create announcements, homework, events as teacher/admin
3. **Verify Notifications**: Check that parents receive real-time notifications
4. **Test APIs**: Use notification endpoints to manage notifications
5. **Test Offline**: Disconnect and reconnect to verify offline storage

## 🔒 Security

### **Authentication**

- JWT token required for all operations
- Parent role verification for notification access
- Row-level security (RLS) in database

### **Authorization**

- Parents can only access their own notifications
- System can create notifications for any parent
- Proper validation of notification data

### **Data Protection**

- Sensitive data encrypted in transit
- Secure WebSocket connections
- Input validation and sanitization

## 📈 Performance

### **Optimizations**

- Database indexes for fast queries
- Connection pooling for WebSocket
- Efficient notification batching
- Automatic cleanup of old notifications

### **Monitoring**

- Connection count tracking
- Notification delivery metrics
- Error rate monitoring
- Performance analytics

## 🚨 Troubleshooting

### **Common Issues**

1. **WebSocket Connection Drops**
   - Check heartbeat implementation
   - Verify network stability
   - Check JWT token validity

2. **Notifications Not Received**
   - Verify parent-student mappings
   - Check notification service logs
   - Ensure WebSocket connection is active

3. **Database Errors**
   - Check database connectivity
   - Verify table permissions
   - Check RLS policies

### **Debug Commands**

```bash
# Check WebSocket connections
curl http://localhost:3000/api/health

# Test notification creation
node test_notifications.js

# Check database
psql -d your_database -c "SELECT COUNT(*) FROM parent_notifications;"
```

## 🎉 Success Metrics

- **Real-time Delivery**: < 1 second notification delivery
- **Connection Stability**: 99%+ uptime
- **Performance**: < 100ms API response times
- **Scalability**: Support for 1000+ concurrent connections
- **Reliability**: 99.9% notification delivery success rate

The Parent Notifications System provides a comprehensive, real-time communication channel between the school and parents, ensuring they stay informed about their children's academic activities and school events.
