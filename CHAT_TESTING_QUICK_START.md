# Chat System Testing - Quick Start

## 🚀 Run Tests in 30 Seconds

### Option 1: Automated Test (Recommended)

```bash
# Make sure server is running
npm start

# In another terminal, run the test
node test_complete_chat_system.js
```

**That's it!** The script will:

1. ✅ Create unique test users (teacher, parent)
2. ✅ Use existing admin (or prompt you)
3. ✅ Run all chat system tests
4. ✅ **Auto-delete test users** when done
5. ✅ Show detailed pass/fail results

---

## 📊 What You'll See

```
🚀 Starting Complete Chat System Test
Base URL: http://localhost:3000
Mode: Auto-cleanup after testing

📝 STEP 1: Setting up test users
   ✅ admin already exists (using existing user)
   ✅ teacher created successfully
   ✅ parent created successfully
   ℹ️  Created 2 test user(s) - will be cleaned up after tests

📝 STEP 2: Teacher creates thread and sends message to Parent
   ✅ Thread created
   ✅ Message sent
   ✅ PASS: Teacher→Parent message requires approval

📝 STEP 3: Parent tries to view messages (before approval)
   ✅ Messages visible to parent: 0
   ✅ PASS: Pending messages are hidden from parent

📝 STEP 4: Admin views pending messages
   ✅ Pending messages count: 1
   ✅ PASS: Admin can see pending messages

📝 STEP 5: Admin approves the message
   ✅ Message approved
   ✅ PASS: Message successfully approved

📝 STEP 6: Parent views messages (after approval)
   ✅ Messages visible to parent: 1
   ✅ PASS: Approved messages are now visible to parent
   ✅ PASS: Message auto-marked as read when fetched

📝 STEP 7: Teacher checks read receipts
   ✅ Message read by 1 user(s)
   ✅ PASS: Read receipts tracked

📝 STEP 8: Parent sends reply (no approval needed)
   ✅ Reply sent
   ✅ PASS: Parent→Teacher message auto-approved

📝 STEP 9: Check unread counts
   ✅ Teacher total unread: 1
   ✅ Parent total unread: 0

🎉 ALL TESTS COMPLETED SUCCESSFULLY!

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

🧹 CLEANUP: Deleting test users
   ✅ teacher deleted successfully
   ✅ parent deleted successfully
   ✅ Cleanup completed
```

---

## 🔧 Options

### Keep Users for Manual Testing

```bash
# Test users will NOT be deleted
node test_complete_chat_system.js --keep-users
```

You'll get credentials to use for manual testing:

```
📌 KEEPING TEST USERS (--keep-users flag set)

You can use these credentials for manual testing:

TEACHER:
   Phone: 8888123456
   Password: Teacher@123
   User ID: abc-123...

PARENT:
   Phone: 7777123456
   Password: Parent@123
   User ID: def-456...
```

### Test Deployed App

```bash
# Test your Heroku/production deployment
BASE_URL="https://your-app.herokuapp.com" node test_complete_chat_system.js
```

---

## ❓ If Admin Login Fails

The script tries to use an existing admin. If you get an error like:

```
❌ Could not login to existing admin. Please provide valid admin credentials.
```

**Fix:**

1. Create an admin first:

   ```bash
   curl -X POST http://localhost:3000/api/system/register-first-admin \
     -H "Content-Type: application/json" \
     -d '{
       "phone_number": "1111111111",
       "password": "Admin@123",
       "full_name": "Test Admin",
       "email": "admin@test.com"
     }'
   ```

2. Or update the admin credentials in `test_complete_chat_system.js`:
   ```javascript
   admin: {
       phone_number: 'YOUR_ADMIN_PHONE',
       password: 'YOUR_ADMIN_PASSWORD',
       ...
   }
   ```

---

## 🐛 Troubleshooting

### Test users not being cleaned up?

**Check:** Do you have a DELETE endpoint for users?

The script attempts to delete via:

```
DELETE /api/users/:user_id
```

If you don't have this endpoint, test users will remain in your database.

**Manual cleanup:**

```sql
-- Delete test users (run in your database)
DELETE FROM users WHERE phone_number LIKE '8888%' OR phone_number LIKE '7777%';
```

### Tests failing?

**Check:**

1. ✅ Server is running (`npm start`)
2. ✅ Migrations are applied
3. ✅ Database is accessible
4. ✅ No firewall blocking connections

**Debug mode:**

```javascript
// Add to test_complete_chat_system.js
console.log("Response:", JSON.stringify(data, null, 2));
```

---

## 📝 What Gets Tested

| Feature                | Test                                        |
| ---------------------- | ------------------------------------------- |
| **Approval System**    | Teacher→Parent requires approval            |
| **Message Visibility** | Pending messages hidden from recipients     |
| **Admin Workflow**     | Admin can view and approve pending messages |
| **Auto-Approval**      | Parent→Teacher messages auto-approved       |
| **Read Receipts**      | Messages auto-marked as read when viewed    |
| **Read-By List**       | Shows who read each message                 |
| **Unread Counts**      | Accurate unread message counts              |
| **WebSocket**          | _(Optional - not included in this test)_    |

---

## ✅ Success Criteria

All tests should show:

- ✅ `approval_status: "pending"` for Teacher→Parent
- ✅ 0 messages visible to parent before approval
- ✅ Admin can see 1+ pending messages
- ✅ `approval_status: "approved"` after admin approval
- ✅ 1+ messages visible to parent after approval
- ✅ `is_read: true` and `read_count: 1` after parent views
- ✅ `approval_status: "approved"` instantly for Parent→Teacher
- ✅ Read receipts show correct user and timestamp
- ✅ Unread counts are accurate

---

## 🎉 Next Steps

After tests pass:

1. **Deploy to Production**

   ```bash
   git add .
   git commit -m "Add chat system with approval and read receipts"
   git push heroku main
   ```

2. **Test on Production**

   ```bash
   BASE_URL="https://your-app.herokuapp.com" node test_complete_chat_system.js
   ```

3. **Integrate with Frontend**
   - See `CHAT_AUTO_READ_RECEIPTS_GUIDE.md` for frontend examples
   - See `CHAT_MESSAGE_APPROVAL_SYSTEM.md` for API docs

---

## 📚 Related Documentation

- `test_complete_chat_system.js` - The automated test script
- `CHAT_SYSTEM_TESTING_GUIDE.md` - Complete manual testing guide
- `CHAT_AUTO_READ_RECEIPTS_GUIDE.md` - Auto-marking documentation
- `CHAT_READ_RECEIPTS_SYSTEM.md` - Read receipts API docs
- `CHAT_MESSAGE_APPROVAL_SYSTEM.md` - Approval system API docs

---

## 🎊 That's It!

Your chat system is now fully tested and ready for production! 🚀
