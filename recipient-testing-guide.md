# Recipient Testing Guide

## 🎯 **Objective**

Test the messaging system from the recipient's perspective to ensure messages are properly delivered and can be read.

## 📋 **Prerequisites**

- Server running on `http://localhost:3000`
- Postman or similar API testing tool

## 🔄 **Step-by-Step Testing**

### **Step 1: Create Test Users**

#### **Create User 1 (Sender)**

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
    "phone_number": "1111111111",
    "password": "password123",
    "role": "teacher",
    "full_name": "John Teacher"
}
```

#### **Create User 2 (Recipient)**

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
    "phone_number": "2222222222",
    "password": "password123",
    "role": "parent",
    "full_name": "Mary Parent"
}
```

### **Step 2: Get User IDs**

#### **Login as User 1**

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
    "phone_number": "1111111111",
    "password": "password123"
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user1-uuid",
      "phone_number": "1111111111",
      "role": "teacher",
      "full_name": "John Teacher"
    },
    "token": "jwt-token-1"
  }
}
```

#### **Login as User 2**

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
    "phone_number": "2222222222",
    "password": "password123"
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "user2-uuid",
      "phone_number": "2222222222",
      "role": "parent",
      "full_name": "Mary Parent"
    },
    "token": "jwt-token-2"
  }
}
```

### **Step 3: Create Chat Thread (as User 1)**

```http
POST http://localhost:3000/api/chat/threads
Content-Type: application/json
Authorization: Bearer jwt-token-1

{
    "thread_type": "direct",
    "title": "John & Mary Chat",
    "participants": ["user2-uuid"]
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "id": "thread-uuid",
    "thread_type": "direct",
    "title": "John & Mary Chat",
    "created_by": "user1-uuid"
  }
}
```

### **Step 4: Send Message (as User 1)**

```http
POST http://localhost:3000/api/chat/messages
Content-Type: application/json
Authorization: Bearer jwt-token-1

{
    "thread_id": "thread-uuid",
    "content": "Hello Mary! How are you doing?",
    "message_type": "text"
}
```

### **Step 5: Check Messages as Recipient (User 2)**

#### **A. Get All Threads (as User 2)**

```http
GET http://localhost:3000/api/chat/threads
Authorization: Bearer jwt-token-2
```

#### **B. Get Messages in Thread (as User 2)**

```http
GET http://localhost:3000/api/chat/messages?thread_id=thread-uuid&page=1&limit=50
Authorization: Bearer jwt-token-2
```

**Expected Response:**

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "message-uuid",
        "thread_id": "thread-uuid",
        "sender_id": "user1-uuid",
        "content": "Hello Mary! How are you doing?",
        "message_type": "text",
        "created_at": "2024-01-01T12:00:00Z",
        "sender": {
          "full_name": "John Teacher",
          "role": "teacher"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "total_pages": 1
    }
  }
}
```

### **Step 6: Test Real-time Features (as User 2)**

#### **A. Subscribe to Real-time**

```http
POST http://localhost:3000/api/chat/subscribe
Authorization: Bearer jwt-token-2
```

#### **B. Get Unread Count**

```http
GET http://localhost:3000/api/chat/unread-count
Authorization: Bearer jwt-token-2
```

#### **C. Get Offline Messages**

```http
GET http://localhost:3000/api/chat/offline-messages?last_check_time=2024-01-01T00:00:00Z
Authorization: Bearer jwt-token-2
```

#### **D. Mark Messages as Read**

```http
POST http://localhost:3000/api/chat/mark-read/thread-uuid
Authorization: Bearer jwt-token-2
```

### **Step 7: Send Another Message (as User 1)**

```http
POST http://localhost:3000/api/chat/messages
Content-Type: application/json
Authorization: Bearer jwt-token-1

{
    "thread_id": "thread-uuid",
    "content": "Are you there?",
    "message_type": "text"
}
```

### **Step 8: Check Updated Messages (as User 2)**

```http
GET http://localhost:3000/api/chat/messages?thread_id=thread-uuid&page=1&limit=50
Authorization: Bearer jwt-token-2
```

## 🧪 **Testing Scenarios**

### **Scenario 1: New Message Notification**

1. User 2 subscribes to real-time
2. User 1 sends a message
3. User 2 should receive real-time notification
4. User 2 checks unread count
5. User 2 marks messages as read

### **Scenario 2: Offline Message Sync**

1. User 1 sends messages while User 2 is "offline"
2. User 2 comes back online
3. User 2 gets offline messages
4. User 2 checks unread count

### **Scenario 3: Multiple Messages**

1. User 1 sends multiple messages
2. User 2 checks all messages
3. User 2 marks thread as read
4. User 2 verifies unread count is 0

## ✅ **Expected Results**

### **As Recipient, You Should See:**

- ✅ Messages from sender in thread
- ✅ Correct sender information
- ✅ Proper message timestamps
- ✅ Unread count updates
- ✅ Real-time notifications (if subscribed)
- ✅ Offline message retrieval
- ✅ Ability to mark messages as read

### **Common Issues to Check:**

- ❌ Messages not appearing (check thread permissions)
- ❌ Wrong sender info (check user data)
- ❌ Unread count not updating (check last_read_at)
- ❌ Real-time not working (check WebSocket connection)

## 🔧 **Troubleshooting**

### **If Messages Don't Appear:**

1. Check if both users are participants in the thread
2. Verify the thread_id is correct
3. Check if the JWT token is valid
4. Look at server logs for errors

### **If Real-time Not Working:**

1. Check WebSocket connection
2. Verify subscription is active
3. Check server logs for WebSocket errors

### **If Unread Count is Wrong:**

1. Check last_read_at timestamps
2. Verify message timestamps
3. Check participant permissions

## 📊 **Testing Checklist**

- [ ] User 1 can send messages
- [ ] User 2 can see messages
- [ ] User 2 can get unread count
- [ ] User 2 can mark messages as read
- [ ] User 2 can subscribe to real-time
- [ ] User 2 can get offline messages
- [ ] Real-time notifications work
- [ ] Offline message sync works

This guide ensures you can properly test the messaging system from the recipient's perspective! 🎉
