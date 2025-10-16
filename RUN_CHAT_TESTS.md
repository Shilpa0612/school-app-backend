# 🚀 Run Chat System Tests - Simple Guide

## Step-by-Step Instructions

### **STEP 1: Find Your Admin Credentials**

```bash
node find_admin_credentials.js
```

This will show you:

- Phone numbers of all admin accounts
- Which one to use for testing

**Example Output:**

```
✅ Found 1 admin user(s):

1. System Admin
   User ID: abc-123...
   Phone: 1234567890
   Email: admin@school.com
   Created: 2024-10-15...

📌 To run tests with this admin:
   ADMIN_PHONE="1234567890" ADMIN_PASSWORD="YourPassword" node test_complete_chat_system_v2.js
```

---

### **STEP 2: Run the Tests**

```bash
# Replace with YOUR admin credentials from Step 1
ADMIN_PHONE="1234567890" ADMIN_PASSWORD="YourAdminPassword" node test_complete_chat_system_v2.js
```

**Or if your admin credentials are 1111111111 / Admin@123:**

```bash
# Just run directly
node test_complete_chat_system_v2.js
```

---

### **STEP 3: Cleanup Test Users**

After tests complete, you'll see:

```
🧹 CLEANUP INSTRUCTIONS
================================================================================

Test users created with these phone numbers:
   Teacher: 8888123456
   Parent: 7777123456

📋 Option 1: Run SQL cleanup script (RECOMMENDED)
   psql -h <host> -U <user> -d <database> -f cleanup_test_users.sql

📋 Option 2: Manual SQL cleanup
   Run this SQL in your database:

   DELETE FROM users WHERE phone_number IN ('8888123456', '7777123456');
```

**Run the cleanup:**

```bash
# Option 1: Use SQL script
psql -h your-host -U your-user -d your-database -f cleanup_test_users.sql

# Option 2: Use Supabase SQL Editor
# Copy the DELETE command and run it in Supabase dashboard
```

---

## ❓ Don't Know Your Admin Password?

### **Option A: Create a New Admin for Testing**

```bash
curl -X POST http://localhost:3000/api/system/register-first-admin \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "1111111111",
    "password": "Admin@123",
    "full_name": "Test Admin",
    "email": "testadmin@school.com"
  }'
```

### **Option B: Reset Existing Admin Password (SQL)**

```sql
-- Update admin password to known value (bcrypt hash of "Admin@123")
-- Run this in your database
UPDATE users
SET password_hash = '$2b$10$rqK5YqJKGKJv8qJKGKJKGOqRQ4xGXYZ...'  -- Hash of "Admin@123"
WHERE role = 'admin'
AND phone_number = 'your-admin-phone';
```

---

## 🎯 Quick Troubleshooting

### Issue: "Admin login required to test approval system"

**Fix:**

1. Run `node find_admin_credentials.js`
2. Use the phone number shown
3. If you don't know password, create new admin (see above)

### Issue: Test users still in database after testing

**Fix:**

```bash
# Run cleanup script
psql -h <host> -U <user> -d <database> -f cleanup_test_users.sql
```

### Issue: "Migrations not run" errors

**Fix:**

```bash
# Run migrations first
psql -h <host> -U <user> -d <database> -f migrations/add_approval_to_chat_messages.sql
psql -h <host> -U <user> -d <database> -f migrations/add_read_receipts_to_chat.sql
```

---

## ✅ Success Checklist

After running tests, you should see:

```
🎉 ALL TESTS PASSED!

✅ Test Summary:
   ✅ Teacher→Parent message requires approval
   ✅ Pending messages hidden from parent
   ✅ Admin can view and approve messages
   ✅ Approved messages visible to parent
   ✅ Messages auto-marked as read
   ✅ Read receipts tracked
   ✅ Parent→Teacher messages auto-approved
   ✅ Unread counts working

🎊 Your chat system is working perfectly!
```

---

## 📚 Files Created

1. **`test_complete_chat_system_v2.js`** - Simplified test script
2. **`find_admin_credentials.js`** - Find admin in database
3. **`cleanup_test_users.sql`** - SQL cleanup script
4. **`RUN_CHAT_TESTS.md`** - This guide

---

## 🚀 TL;DR - Just Run These Commands

```bash
# 1. Find admin credentials
node find_admin_credentials.js

# 2. Run tests (use your admin credentials)
ADMIN_PHONE="your-phone" ADMIN_PASSWORD="your-password" node test_complete_chat_system_v2.js

# 3. Cleanup test users
psql -h <host> -U <user> -d <database> -f cleanup_test_users.sql
```

That's it! 🎉
