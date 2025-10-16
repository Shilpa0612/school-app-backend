# Manual Chat System Testing - Copy & Paste Commands

## ⚡ Quick Testing (No Admin Required)

Follow these steps in your terminal. Copy each command one at a time.

---

### **STEP 1: Verify Server is Running**

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok",...}`

---

### **STEP 2: Create Test Teacher**

```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"phone_number\":\"8888000001\",\"password\":\"Teacher@123\",\"full_name\":\"Test Teacher\",\"role\":\"teacher\",\"email\":\"teacher.test@test.com\"}"
```

**From the response, copy:**

- `token` → This is your `TEACHER_TOKEN`
- `user.id` → This is your `TEACHER_ID`

---

### **STEP 3: Create Test Parent**

```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"phone_number\":\"7777000001\",\"password\":\"Parent@123\",\"full_name\":\"Test Parent\",\"role\":\"parent\",\"email\":\"parent.test@test.com\"}"
```

**From the response, copy:**

- `token` → This is your `PARENT_TOKEN`
- `user.id` → This is your `PARENT_ID`

---

### **STEP 4: Parent Creates Chat with Teacher**

Replace `PARENT_TOKEN` and `TEACHER_ID` with your actual values:

```bash
curl -X POST http://localhost:3000/api/chat/start-conversation -H "Authorization: Bearer PASTE_YOUR_PARENT_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"participants\":[\"PASTE_TEACHER_ID_HERE\"],\"message_content\":\"Hello teacher!\",\"thread_type\":\"direct\"}"
```

**Expected:**

```json
{
  "data": {
    "message": {
      "approval_status": "approved" // ← AUTO-APPROVED! ✅
    }
  }
}
```

**From response, copy:**

- `data.thread.id` → This is your `THREAD_ID`
- `data.message.id` → This is your `MESSAGE_ID`

---

### **STEP 5: Teacher Views Message (AUTO-MARKS AS READ)**

Replace `TEACHER_TOKEN` and `THREAD_ID`:

```bash
curl -X GET "http://localhost:3000/api/chat/messages?thread_id=PASTE_THREAD_ID_HERE" -H "Authorization: Bearer PASTE_TEACHER_TOKEN_HERE"
```

**Expected:**

```json
{
  "data": {
    "messages": [
      {
        "content": "Hello teacher!",
        "status": "read", // ← AUTO-MARKED AS READ! ✅
        "is_read": true, // ← For teacher (they read it)
        "read_count": 1, // ← 1 person read it
        "read_by": [
          {
            "user_name": "Test Teacher",
            "read_at": "2024-10-15..."
          }
        ]
      }
    ]
  }
}
```

---

### **STEP 6: Check Read Receipts**

Replace `MESSAGE_ID` and `PARENT_TOKEN`:

```bash
curl -X GET "http://localhost:3000/api/chat/messages/PASTE_MESSAGE_ID_HERE/read-by" -H "Authorization: Bearer PASTE_PARENT_TOKEN_HERE"
```

**Expected:**

```json
{
  "data": {
    "read_count": 1,
    "read_by": [
      {
        "user_name": "Test Teacher",
        "user_role": "teacher",
        "read_at": "2024-10-15..."
      }
    ]
  }
}
```

✅ **READ RECEIPTS WORKING!**

---

### **STEP 7: Teacher Replies (Will Need Approval)**

Replace `TEACHER_TOKEN` and `THREAD_ID`:

```bash
curl -X POST http://localhost:3000/api/chat/messages -H "Authorization: Bearer PASTE_TEACHER_TOKEN_HERE" -H "Content-Type: application/json" -d "{\"thread_id\":\"PASTE_THREAD_ID_HERE\",\"content\":\"Thank you for your question!\",\"message_type\":\"text\"}"
```

**Expected:**

```json
{
  "data": {
    "approval_status": "pending" // ← NEEDS APPROVAL! ✅
  },
  "message": "Message sent successfully and is pending approval"
}
```

✅ **APPROVAL SYSTEM WORKING!**

---

### **STEP 8: Parent Tries to See Teacher's Reply**

```bash
curl -X GET "http://localhost:3000/api/chat/messages?thread_id=PASTE_THREAD_ID_HERE" -H "Authorization: Bearer PASTE_PARENT_TOKEN_HERE"
```

**Expected:** Only see 1 message (the parent's own message)

- Teacher's pending reply is NOT visible ✅

---

### **STEP 9: Get Unread Counts**

```bash
curl -X GET "http://localhost:3000/api/chat/unread-count" -H "Authorization: Bearer PASTE_PARENT_TOKEN_HERE"
```

**Expected:**

```json
{
  "data": {
    "total_unread": 0 // Parent has read all their messages
  }
}
```

---

## 🧹 **STEP 10: Cleanup Test Users**

**⚠️ IMPORTANT:** Do NOT use wildcard deletion (`LIKE '8888%'`) because you have REAL parents with similar numbers!

### Safe Cleanup Method:

**Option 1: Delete by Exact Phone Numbers (SAFEST)**

```sql
-- PREVIEW first (make sure these are test users!)
SELECT id, phone_number, full_name, role
FROM users
WHERE phone_number IN ('8888000001', '7777000001');

-- If preview shows ONLY test users, then delete:
DELETE FROM users
WHERE phone_number IN ('8888000001', '7777000001');
```

**Option 2: Delete by Exact IDs**

If you saved the user IDs from Step 2 and 3, use this:

```sql
-- Replace with your actual test user IDs
DELETE FROM users
WHERE id IN (
    'your-teacher-user-id-here',
    'your-parent-user-id-here'
);
```

**Option 3: Filter by Full Name + Created Date**

```sql
-- Delete ONLY users named "Test Teacher" or "Test Parent" created today
DELETE FROM users
WHERE full_name IN ('Test Teacher', 'Test Parent')
  AND email LIKE '%test.com%'
  AND created_at >= CURRENT_DATE;
```

This will delete the test users and ALL related data (threads, messages, read receipts).

---

## ✅ **What You Just Tested**

| Feature                 | Status                         |
| ----------------------- | ------------------------------ |
| Parent→Teacher messages | ✅ Auto-approved               |
| Teacher→Parent messages | ✅ Requires approval (pending) |
| Auto-mark as read       | ✅ When fetching messages      |
| Read receipts           | ✅ Tracks who read what        |
| Read-by list            | ✅ Shows all readers           |
| Unread counts           | ✅ Accurate counting           |
| Message visibility      | ✅ Pending messages hidden     |

---

## 🎯 To Test Approval Workflow Completely

You need admin access. Find your admin credentials:

**Option 1: Check with your team/documentation**

**Option 2: Create new admin (if first one doesn't exist):**

```bash
curl -X POST http://localhost:3000/api/system/register-first-admin -H "Content-Type: application/json" -d "{\"phone_number\":\"1111111111\",\"password\":\"Admin@123\",\"full_name\":\"Test Admin\",\"email\":\"admin@test.com\"}"
```

**Option 3: SQL check:**

```sql
SELECT phone_number, email, full_name
FROM users
WHERE role = 'admin';
```

Then use those credentials to approve the pending teacher message!

---

## 🎉 Summary

**Without admin, you successfully tested:**

- ✅ Parent→Teacher auto-approval
- ✅ Read receipts
- ✅ Auto-marking as read
- ✅ Unread counts

**With admin, you can also test:**

- Pending messages view
- Approve/reject workflow
- Full Teacher→Parent flow

Your chat system is working! 🚀
