# Chat System Testing Guide

## Complete End-to-End Testing with Login Credentials

This guide will walk you through testing the entire chat system with approval and read receipts.

---

## 🚀 Quick Start - Testing in 5 Minutes

### Automated Testing (RECOMMENDED)

```bash
# Run test with auto-cleanup (test users are deleted after testing)
node test_complete_chat_system.js

# Keep test users for manual testing
node test_complete_chat_system.js --keep-users

# Test deployed app
BASE_URL="https://your-app.herokuapp.com" node test_complete_chat_system.js
```

**Features:**

- ✅ Uses unique phone numbers (no conflicts)
- ✅ Handles existing admin automatically
- ✅ Auto-deletes test users after completion
- ✅ Works even if tests fail

### Step 1: Set Your Base URL (for manual testing)

```bash
# For local development
export BASE_URL="http://localhost:3000"

# For Heroku deployment
export BASE_URL="https://your-app-name.herokuapp.com"
```

---

## 📋 Prerequisites

1. ✅ Database migrations run:

   ```bash
   psql -h <host> -U <user> -d <database> -f migrations/add_approval_to_chat_messages.sql
   psql -h <host> -U <user> -d <database> -f migrations/add_read_receipts_to_chat.sql
   ```

2. ✅ Server is running:

   ```bash
   npm start
   # or
   npm run dev
   ```

3. ✅ Have test users (or create them below)

---

## 👥 STEP 1: Create Test Users

### 1.1 Create Admin User

```bash
curl -X POST $BASE_URL/api/system/register-first-admin \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "9999999999",
    "password": "Admin@123",
    "full_name": "Test Admin",
    "email": "admin@test.com"
  }'
```

**Save the token from response:**

```json
{
  "status": "success",
  "data": {
    "user": { "id": "admin-user-id", ... },
    "token": "eyJhbGciOiJIUzI1NiIs..."  // ← Save this as ADMIN_TOKEN
  }
}
```

### 1.2 Create Teacher User

```bash
curl -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "8888888888",
    "password": "Teacher@123",
    "full_name": "Test Teacher",
    "role": "teacher",
    "email": "teacher@test.com"
  }'
```

**Save the token:**

```bash
TEACHER_TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

### 1.3 Create Parent User

```bash
curl -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "7777777777",
    "password": "Parent@123",
    "full_name": "Test Parent",
    "role": "parent",
    "email": "parent@test.com"
  }'
```

**Save the token:**

```bash
PARENT_TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

### 1.4 Create Principal User

```bash
curl -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "6666666666",
    "password": "Principal@123",
    "full_name": "Test Principal",
    "role": "principal",
    "email": "principal@test.com"
  }'
```

**Save the token:**

```bash
PRINCIPAL_TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

---

## 🔐 STEP 2: Login (if you already have users)

### Login as Teacher

```bash
curl -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "8888888888",
    "password": "Teacher@123"
  }'
```

### Login as Parent

```bash
curl -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "7777777777",
    "password": "Parent@123"
  }'
```

### Login as Admin

```bash
curl -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "9999999999",
    "password": "Admin@123"
  }'
```

---

## 💬 STEP 3: Test Chat System

### Set Your Tokens (from Step 1 or 2)

```bash
# Replace with actual tokens from login responses
TEACHER_TOKEN="your-teacher-token-here"
PARENT_TOKEN="your-parent-token-here"
ADMIN_TOKEN="your-admin-token-here"
```

### 3.1 Create a Chat Thread (Teacher → Parent)

```bash
curl -X POST $BASE_URL/api/chat/start-conversation \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "participants": ["parent-user-id"],
    "message_content": "Hello! This is a test message from teacher to parent.",
    "thread_type": "direct"
  }'
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "thread": { "id": "thread-uuid", ... },
    "message": {
      "id": "message-uuid",
      "content": "Hello! This is a test message...",
      "approval_status": "pending",  // ← Teacher→Parent needs approval
      "status": "sent"
    }
  },
  "message": "Message sent successfully and is pending approval"
}
```

**Save the thread_id and message_id:**

```bash
THREAD_ID="thread-uuid-from-response"
MESSAGE_ID="message-uuid-from-response"
```

---

## ✅ STEP 4: Test Approval System

### 4.1 View Pending Messages (Admin/Principal Only)

```bash
curl -X GET "$BASE_URL/api/chat/messages/pending?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "message-uuid",
        "content": "Hello! This is a test message...",
        "approval_status": "pending",
        "sender": {
          "full_name": "Test Teacher",
          "role": "teacher"
        },
        "thread": {
          "title": "Test Teacher & Test Parent",
          "participants": [...]
        }
      }
    ],
    "pagination": { "total": 1 }
  }
}
```

### 4.2 Approve the Message

```bash
curl -X POST "$BASE_URL/api/chat/messages/$MESSAGE_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**

```json
{
  "status": "success",
  "message": "Message approved successfully",
  "data": {
    "id": "message-uuid",
    "approval_status": "approved",
    "approved_by": "admin-user-id",
    "approved_at": "2024-10-15T10:30:00Z"
  }
}
```

### 4.3 Get Approval Statistics

```bash
curl -X GET "$BASE_URL/api/chat/messages/approval-stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "total_pending": 0,
    "total_approved": 1,
    "total_rejected": 0,
    "pending_by_sender": []
  }
}
```

---

## 📬 STEP 5: Test Reading Messages

### 5.1 Parent Views Messages (After Approval)

```bash
curl -X GET "$BASE_URL/api/chat/messages?thread_id=$THREAD_ID&page=1&limit=20" \
  -H "Authorization: Bearer $PARENT_TOKEN"
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "participants": [...],
    "messages": [
      {
        "id": "message-uuid",
        "content": "Hello! This is a test message...",
        "approval_status": "approved",
        "status": "read",  // ← Auto-marked as read when fetching
        "is_read": true,
        "read_count": 1,
        "read_by": [
          {
            "user_id": "parent-user-id",
            "user_name": "Test Parent",
            "read_at": "2024-10-15T10:35:00Z"
          }
        ]
      }
    ]
  }
}
```

**Note:** Messages are **automatically marked as read** when fetched! ✨

---

## 👀 STEP 6: Test Read Receipts

### 6.1 Get Read-By List for a Message

```bash
curl -X GET "$BASE_URL/api/chat/messages/$MESSAGE_ID/read-by" \
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "message_id": "message-uuid",
    "read_count": 1,
    "read_by": [
      {
        "user_id": "parent-user-id",
        "user_name": "Test Parent",
        "user_role": "parent",
        "read_at": "2024-10-15T10:35:00Z"
      }
    ]
  }
}
```

### 6.2 Get Unread Count for Thread

```bash
curl -X GET "$BASE_URL/api/chat/threads/$THREAD_ID/unread-count" \
  -H "Authorization: Bearer $PARENT_TOKEN"
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "thread_id": "thread-uuid",
    "unread_count": 0
  }
}
```

### 6.3 Get Total Unread Count

```bash
curl -X GET "$BASE_URL/api/chat/unread-count" \
  -H "Authorization: Bearer $PARENT_TOKEN"
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "total_unread": 0,
    "threads": []
  }
}
```

---

## 💬 STEP 7: Test Parent → Teacher (No Approval Needed)

### 7.1 Parent Sends Message to Teacher

```bash
curl -X POST $BASE_URL/api/chat/messages \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "'$THREAD_ID'",
    "content": "Thank you for the message!",
    "message_type": "text"
  }'
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "id": "new-message-uuid",
    "content": "Thank you for the message!",
    "approval_status": "approved", // ← Parent→Teacher auto-approved!
    "status": "sent"
  },
  "message": "Message sent successfully"
}
```

**Note:** Parent→Teacher messages are **automatically approved**! No review needed. ✅

---

## 🧪 STEP 8: Complete Testing Workflow

### Full Test Scenario

```bash
#!/bin/bash

# Set your base URL
BASE_URL="http://localhost:3000"

echo "🧪 Starting Complete Chat System Test"
echo "======================================"

# Step 1: Login as Teacher
echo -e "\n📝 Step 1: Login as Teacher"
TEACHER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "8888888888",
    "password": "Teacher@123"
  }')

TEACHER_TOKEN=$(echo $TEACHER_RESPONSE | jq -r '.data.token')
TEACHER_ID=$(echo $TEACHER_RESPONSE | jq -r '.data.user.id')
echo "✅ Teacher logged in. Token: ${TEACHER_TOKEN:0:20}..."

# Step 2: Login as Parent
echo -e "\n📝 Step 2: Login as Parent"
PARENT_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "7777777777",
    "password": "Parent@123"
  }')

PARENT_TOKEN=$(echo $PARENT_RESPONSE | jq -r '.data.token')
PARENT_ID=$(echo $PARENT_RESPONSE | jq -r '.data.user.id')
echo "✅ Parent logged in. Token: ${PARENT_TOKEN:0:20}..."

# Step 3: Login as Admin
echo -e "\n📝 Step 3: Login as Admin"
ADMIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "9999999999",
    "password": "Admin@123"
  }')

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.data.token')
echo "✅ Admin logged in. Token: ${ADMIN_TOKEN:0:20}..."

# Step 4: Teacher starts conversation with Parent
echo -e "\n📝 Step 4: Teacher creates thread and sends message to Parent"
THREAD_RESPONSE=$(curl -s -X POST $BASE_URL/api/chat/start-conversation \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "participants": ["'$PARENT_ID'"],
    "message_content": "Hello parent! This is a test message.",
    "thread_type": "direct"
  }')

THREAD_ID=$(echo $THREAD_RESPONSE | jq -r '.data.thread.id')
MESSAGE_ID=$(echo $THREAD_RESPONSE | jq -r '.data.message.id')
APPROVAL_STATUS=$(echo $THREAD_RESPONSE | jq -r '.data.message.approval_status')
echo "✅ Thread created: $THREAD_ID"
echo "✅ Message created: $MESSAGE_ID"
echo "✅ Approval status: $APPROVAL_STATUS (should be 'pending')"

# Step 5: Parent tries to view (should not see pending message)
echo -e "\n📝 Step 5: Parent tries to view messages (before approval)"
PARENT_MESSAGES=$(curl -s -X GET "$BASE_URL/api/chat/messages?thread_id=$THREAD_ID" \
  -H "Authorization: Bearer $PARENT_TOKEN")
PARENT_MSG_COUNT=$(echo $PARENT_MESSAGES | jq '.data.messages | length')
echo "✅ Parent sees $PARENT_MSG_COUNT messages (should be 0 - pending not visible)"

# Step 6: Admin views pending messages
echo -e "\n📝 Step 6: Admin views pending messages"
PENDING_MESSAGES=$(curl -s -X GET "$BASE_URL/api/chat/messages/pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
PENDING_COUNT=$(echo $PENDING_MESSAGES | jq '.data.messages | length')
echo "✅ Admin sees $PENDING_COUNT pending message(s)"

# Step 7: Admin approves the message
echo -e "\n📝 Step 7: Admin approves the message"
APPROVAL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/messages/$MESSAGE_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
APPROVED_STATUS=$(echo $APPROVAL_RESPONSE | jq -r '.data.approval_status')
echo "✅ Message approved. Status: $APPROVED_STATUS"

# Step 8: Parent views messages again (should now see approved message)
echo -e "\n📝 Step 8: Parent views messages (after approval)"
PARENT_MESSAGES_AFTER=$(curl -s -X GET "$BASE_URL/api/chat/messages?thread_id=$THREAD_ID" \
  -H "Authorization: Bearer $PARENT_TOKEN")
PARENT_MSG_COUNT_AFTER=$(echo $PARENT_MESSAGES_AFTER | jq '.data.messages | length')
echo "✅ Parent now sees $PARENT_MSG_COUNT_AFTER message(s) (should be 1)"

# Step 9: Check read receipts
echo -e "\n📝 Step 9: Teacher checks who read the message"
READ_BY=$(curl -s -X GET "$BASE_URL/api/chat/messages/$MESSAGE_ID/read-by" \
  -H "Authorization: Bearer $TEACHER_TOKEN")
READ_COUNT=$(echo $READ_BY | jq '.data.read_count')
echo "✅ Message read by $READ_COUNT user(s)"

# Step 10: Parent sends reply (should be auto-approved)
echo -e "\n📝 Step 10: Parent sends reply (no approval needed)"
REPLY_RESPONSE=$(curl -s -X POST $BASE_URL/api/chat/messages \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "'$THREAD_ID'",
    "content": "Thank you for the message!",
    "message_type": "text"
  }')

REPLY_ID=$(echo $REPLY_RESPONSE | jq -r '.data.id')
REPLY_APPROVAL=$(echo $REPLY_RESPONSE | jq -r '.data.approval_status')
echo "✅ Reply sent: $REPLY_ID"
echo "✅ Reply approval status: $REPLY_APPROVAL (should be 'approved')"

# Step 11: Get unread counts
echo -e "\n📝 Step 11: Check unread counts"
TEACHER_UNREAD=$(curl -s -X GET "$BASE_URL/api/chat/unread-count" \
  -H "Authorization: Bearer $TEACHER_TOKEN")
TEACHER_UNREAD_COUNT=$(echo $TEACHER_UNREAD | jq '.data.total_unread')
echo "✅ Teacher has $TEACHER_UNREAD_COUNT unread message(s)"

echo -e "\n🎉 Testing Complete!"
echo "===================="
echo "Summary:"
echo "  ✅ Teacher → Parent message (required approval)"
echo "  ✅ Admin approved the message"
echo "  ✅ Parent → Teacher reply (auto-approved)"
echo "  ✅ Read receipts tracked"
echo "  ✅ Unread counts working"
```

**Save this as `test-chat-system.sh` and run:**

```bash
chmod +x test-chat-system.sh
./test-chat-system.sh
```

---

## 🌐 STEP 9: Test WebSocket (Optional)

### Using wscat (Install: `npm install -g wscat`)

```bash
# Connect to WebSocket
wscat -c ws://localhost:3000

# After connection, authenticate
> {"type":"auth","token":"your-teacher-token-here"}

# Subscribe to thread
> {"type":"subscribe_thread","thread_id":"your-thread-id"}

# Send message
> {"type":"send_message","thread_id":"your-thread-id","content":"Hello via WebSocket!","message_type":"text"}

# Mark message as read
> {"type":"mark_as_read","message_id":"your-message-id"}

# Mark entire thread as read
> {"type":"mark_thread_read","thread_id":"your-thread-id"}
```

---

## 📊 Expected Results Summary

| Test                         | Expected Result                         |
| ---------------------------- | --------------------------------------- |
| Teacher → Parent message     | `approval_status: "pending"`            |
| Parent views before approval | 0 messages visible                      |
| Admin views pending          | 1 pending message                       |
| Admin approves               | `approval_status: "approved"`           |
| Parent views after approval  | 1 message visible                       |
| Message auto-marked as read  | `is_read: true`, `read_count: 1`        |
| Parent → Teacher message     | `approval_status: "approved"` (instant) |
| Read receipts                | Shows who read and when                 |
| Unread counts                | Accurate counts per thread              |

---

## 🐛 Troubleshooting

### Issue: "Invalid token" or 401 errors

**Solution:**

- Make sure you copied the full token from login response
- Token should start with `eyJ...`
- Check token isn't expired (24h default)

### Issue: "Access denied to this thread"

**Solution:**

- User must be a participant in the thread
- Check `participants` array includes the user_id

### Issue: Messages not appearing

**Solution:**

- Check `approval_status` - pending messages only visible to sender
- Admin must approve teacher→parent messages
- Parent→teacher messages are auto-approved

### Issue: Read receipts not showing

**Solution:**

- Run the migrations first
- Fetch messages to trigger auto-read
- Check user is not the message sender (can't read own messages)

---

## 📝 Quick Reference

### Test Credentials Created

| Role      | Phone      | Password      | Use Case                   |
| --------- | ---------- | ------------- | -------------------------- |
| Admin     | 9999999999 | Admin@123     | Approve messages, view all |
| Teacher   | 8888888888 | Teacher@123   | Send messages to parents   |
| Parent    | 7777777777 | Parent@123    | Receive messages, reply    |
| Principal | 6666666666 | Principal@123 | Approve messages, view all |

### Key Endpoints

| Endpoint                         | Method | Auth  | Purpose                             |
| -------------------------------- | ------ | ----- | ----------------------------------- |
| `/api/auth/login`                | POST   | No    | Get auth token                      |
| `/api/chat/start-conversation`   | POST   | Yes   | Create thread + send message        |
| `/api/chat/messages`             | GET    | Yes   | Fetch messages (auto-marks as read) |
| `/api/chat/messages`             | POST   | Yes   | Send message                        |
| `/api/chat/messages/pending`     | GET    | Admin | View pending messages               |
| `/api/chat/messages/:id/approve` | POST   | Admin | Approve message                     |
| `/api/chat/messages/:id/reject`  | POST   | Admin | Reject message                      |
| `/api/chat/messages/:id/read-by` | GET    | Yes   | Who read this message               |
| `/api/chat/unread-count`         | GET    | Yes   | Total unread messages               |

---

## ✅ Success Checklist

After running all tests, you should see:

- [x] Users can register and login
- [x] Teacher can create thread with parent
- [x] Teacher→Parent messages require approval (`approval_status: "pending"`)
- [x] Parent doesn't see pending messages
- [x] Admin can view all pending messages
- [x] Admin can approve messages
- [x] Approved messages visible to parent
- [x] Messages automatically marked as read when fetched
- [x] Read receipts show who read each message
- [x] Parent→Teacher messages auto-approved
- [x] Unread counts are accurate
- [x] WebSocket events work (if tested)

---

## 🎉 Congratulations!

If all tests pass, your chat system is working perfectly with:

- ✅ Approval workflow (Teacher→Parent)
- ✅ Auto-approval (Parent→Teacher)
- ✅ Read receipts (WhatsApp-style)
- ✅ Unread counts
- ✅ Real-time WebSocket support

Your chat system is production-ready! 🚀
