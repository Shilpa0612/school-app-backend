# Manual Chat Message Approval Test

## Step 1: Login as Principal
```bash
curl -X POST https://ajws-school-ba8ae5e3f955.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "1234567891",
    "password": "password123"
  }'
```

## Step 2: Get Pending Messages
```bash
curl -X GET https://ajws-school-ba8ae5e3f955.herokuapp.com/api/chat/messages/pending \
  -H "Authorization: Bearer <PRINCIPAL_TOKEN>"
```

## Step 3: Approve a Message
Based on your previous response, use these message IDs:

### Approve "hh" message:
```bash
curl -X POST https://ajws-school-ba8ae5e3f955.herokuapp.com/api/chat/messages/e314dd4a-cf9f-4377-84da-85a72b0635a8/approve \
  -H "Authorization: Bearer <PRINCIPAL_TOKEN>" \
  -H "Content-Type: application/json"
```

### Reject "bb" message:
```bash
curl -X POST https://ajws-school-ba8ae5e3f955.herokuapp.com/api/chat/messages/e9fd7508-3455-497d-b106-ef17e869ef4d/reject \
  -H "Authorization: Bearer <PRINCIPAL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "rejection_reason": "Inappropriate content for school communication"
  }'
```

## Step 4: Login as Parent
```bash
curl -X POST https://ajws-school-ba8ae5e3f955.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "9923149457",
    "password": "Temp@1234"
  }'
```

## Step 5: Check if Parent Can See Approved Message
```bash
curl -X GET "https://ajws-school-ba8ae5e3f955.herokuapp.com/api/chat/messages?thread_id=66344b6e-22f6-4719-81af-744b872a92ae" \
  -H "Authorization: Bearer <PARENT_TOKEN>"
```

## Expected Server Logs
When you approve a message, you should see these logs in the server:

```
💬 sendChatMessageApprovalNotifications called for message: <message_id>
📊 Found X parent participants for message approval notification
📨 Sending message approval notification to parent <parent_id>
✅ Message approval notification result for parent <parent_id>: SUCCESS
📡 Broadcasting approved message to thread participants: <thread_id>
📤 Broadcasted approved message to user <user_id>
```

## Debugging Steps

1. **Check if notification service is imported correctly**
2. **Verify the approval endpoint is calling the notification functions**
3. **Check if parent-student mappings exist**
4. **Verify WebSocket service is working**
5. **Check Firebase push notification service**

## Common Issues

1. **No parent-student mapping**: The notification system needs parent-student relationships
2. **WebSocket not connected**: Real-time notifications require active WebSocket connections
3. **Firebase configuration**: Push notifications need proper Firebase setup
4. **Database permissions**: Notification service needs proper database access

## Test Results

After running the approval, check:
- [ ] Message status changed to "approved"
- [ ] Parent can see the message in chat
- [ ] Server logs show notification activity
- [ ] Parent received WebSocket notification (if connected)
- [ ] Parent received Firebase push notification
- [ ] Notification record created in database
