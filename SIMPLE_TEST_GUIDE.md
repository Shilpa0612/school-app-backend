# 🚀 Simple Testing Guide - Copy & Paste

## ⚠️ You Got This Error Because:

1. **No valid admin login** - Script can't find admin credentials
2. **No delete endpoint** - Can't auto-cleanup users

## ✅ **Solution: Simple 3-Step Process**

---

### **STEP 1: Create/Find Admin Account**

Copy and paste this in your terminal:

```bash
curl -X POST http://localhost:3000/api/system/register-first-admin -H "Content-Type: application/json" -d "{\"phone_number\":\"1111111111\",\"password\":\"Admin@123\",\"full_name\":\"Test Admin\",\"email\":\"admin@test.com\"}"
```

**If you get "admin already exists"**, that's OK! It means you have an admin. Try this login:

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"phone_number\":\"1111111111\",\"password\":\"Admin@123\"}"
```

**Save the token from the response!**

---

### **STEP 2: Manual Testing (Copy-Paste These)**

#### A. Login as Teacher (CREATE NEW)

```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"phone_number\":\"8888000001\",\"password\":\"Teacher@123\",\"full_name\":\"Test Teacher\",\"role\":\"teacher\",\"email\":\"teacher.test@test.com\"}"
```

**Copy the token and user ID!**

```bash
# Save like this:
TEACHER_TOKEN="paste-token-here"
TEACHER_ID="paste-user-id-here"
```

#### B. Login as Parent (CREATE NEW)

```bash
curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"phone_number\":\"7777000001\",\"password\":\"Parent@123\",\"full_name\":\"Test Parent\",\"role\":\"parent\",\"email\":\"parent.test@test.com\"}"
```

**Copy the token and user ID!**

```bash
# Save like this:
PARENT_TOKEN="paste-token-here"
PARENT_ID="paste-user-id-here"
```

#### C. Teacher Sends Message to Parent

```bash
curl -X POST http://localhost:3000/api/chat/start-conversation -H "Authorization: Bearer PASTE_TEACHER_TOKEN" -H "Content-Type: application/json" -d "{\"participants\":[\"PASTE_PARENT_ID\"],\"message_content\":\"Hello parent!\",\"thread_type\":\"direct\"}"
```

**Look for:** `"approval_status": "pending"` ✅

**Copy thread_id and message_id from response!**

#### D. Parent Tries to View (Before Approval)

```bash
curl -X GET "http://localhost:3000/api/chat/messages?thread_id=PASTE_THREAD_ID" -H "Authorization: Bearer PASTE_PARENT_TOKEN"
```

**Expected:** `messages: []` (empty) ✅

#### E. Admin Views Pending

```bash
curl -X GET "http://localhost:3000/api/chat/messages/pending" -H "Authorization: Bearer PASTE_ADMIN_TOKEN"
```

**Expected:** See 1 pending message ✅

#### F. Admin Approves Message

```bash
curl -X POST "http://localhost:3000/api/chat/messages/PASTE_MESSAGE_ID/approve" -H "Authorization: Bearer PASTE_ADMIN_TOKEN"
```

**Expected:** `"approval_status": "approved"` ✅

#### G. Parent Views Again (After Approval)

```bash
curl -X GET "http://localhost:3000/api/chat/messages?thread_id=PASTE_THREAD_ID" -H "Authorization: Bearer PASTE_PARENT_TOKEN"
```

**Expected:** See 1 message, `is_read: true`, `read_count: 1` ✅

#### H. Check Read Receipts

```bash
curl -X GET "http://localhost:3000/api/chat/messages/PASTE_MESSAGE_ID/read-by" -H "Authorization: Bearer PASTE_TEACHER_TOKEN"
```

**Expected:** Shows parent read the message ✅

#### I. Parent Sends Reply

```bash
curl -X POST http://localhost:3000/api/chat/messages -H "Authorization: Bearer PASTE_PARENT_TOKEN" -H "Content-Type: application/json" -d "{\"thread_id\":\"PASTE_THREAD_ID\",\"content\":\"Thank you!\",\"message_type\":\"text\"}"
```

**Expected:** `"approval_status": "approved"` (instant!) ✅

---

### **STEP 3: Cleanup Test Users**

After testing, run this SQL in your Supabase SQL Editor:

```sql
-- Delete test users
DELETE FROM users
WHERE phone_number IN ('8888000001', '7777000001')
   OR phone_number LIKE '8888%'
   OR phone_number LIKE '7777%';

-- Verify
SELECT COUNT(*) FROM users WHERE phone_number LIKE '8888%' OR phone_number LIKE '7777%';
```

---

## 📊 What You Should See

| Test                   | Expected                                  |
| ---------------------- | ----------------------------------------- |
| Teacher→Parent message | `"approval_status": "pending"`            |
| Parent view (before)   | No messages                               |
| Admin view pending     | 1 pending message                         |
| Admin approve          | `"approval_status": "approved"`           |
| Parent view (after)    | 1 message, `is_read: true`                |
| Read receipts          | Parent in read_by list                    |
| Parent→Teacher reply   | `"approval_status": "approved"` instantly |

---

## 🎯 Even Simpler - Just Try Login

Before anything, try to login with common admin credentials:

```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"phone_number\":\"1111111111\",\"password\":\"Admin@123\"}"
```

If this works ✅ → Use this phone/password for tests  
If this fails ❌ → Create new admin with first command above

---

## 💡 Quick Fix

Just run these 3 commands:

```bash
# 1. Create admin (if doesn't exist)
curl -X POST http://localhost:3000/api/system/register-first-admin -H "Content-Type: application/json" -d "{\"phone_number\":\"1111111111\",\"password\":\"Admin@123\",\"full_name\":\"Test Admin\",\"email\":\"admin@test.com\"}"

# 2. Run test with this admin
ADMIN_PHONE="1111111111" ADMIN_PASSWORD="Admin@123" node test_complete_chat_system_v2.js

# 3. After tests, cleanup in Supabase SQL Editor (use exact IDs!):
# See SAFE_CLEANUP_GUIDE.md for safe deletion methods
# DELETE FROM users WHERE id IN ('exact-user-id-1', 'exact-user-id-2');
```

That's it! 🎉
