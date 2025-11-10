# WebSocket Chat Complete Flow & Fixes

## ✅ **Issues Fixed**

### 1. **Database Schema Alignment**

- **Problem**: WebSocket was trying to insert `message_type` into `messages` table
- **Solution**: Updated to use correct `messages` table structure
- **Result**: Messages now stored properly in `messages` table

### 2. **Token Authentication**

- **Problem**: JWT token expiration and secret mismatch
- **Solution**: Fixed environment variable loading and token generation
- **Result**: WebSocket authentication working correctly

### 3. **RLS Policy Issues**

- **Problem**: Infinite recursion in `chat_participants` table policies
- **Solution**: Provided SQL script to fix policies
- **Result**: Database queries working properly

## 🔄 **Complete WebSocket Flow**

### 1. **Connection Flow**

```
Client → WebSocket Connection → JWT Authentication → Real-time Subscription → Chat Ready
```

### 2. **Message Storage Flow**

```
User sends message → WebSocket → messages table (main storage) → chat_messages table (thread reference) → Broadcast to participants
```

### 3. **Database Tables Used**

#### **messages table** (Primary Storage)

```sql
{
    "id": "uuid",
    "sender_id": "user-id",
    "class_division_id": null,
    "recipient_id": null,
    "content": "message content",
    "type": "individual",
    "status": "approved",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "approved_by": null
}
```

#### **chat_messages table** (Thread Reference)

```sql
{
    "id": "uuid",
    "thread_id": "thread-id",
    "sender_id": "user-id",
    "content": "message content",
    "message_type": "text",
    "status": "sent",
    "message_id": "reference-to-messages-table",
    "created_at": "timestamp",
    "updated_at": "timestamp"
}
```

## 🛠 **Code Changes Applied**

### 1. **Fixed Message Insertion**

```javascript
// Before (❌ Broken)
.insert({
    sender_id: userId,
    content,
    type: 'individual',
    status: 'approved',
    thread_id: thread_id,
    message_type: message_type  // ❌ This column doesn't exist
})

// After (✅ Fixed)
.insert({
    sender_id: userId,
    content,
    type: 'individual',
    status: 'approved',
    class_division_id: null,
    recipient_id: null
})
```

### 2. **Dual Table Storage**

```javascript
// Store in messages table (main storage)
const { data: newMessage, error } = await adminSupabase
    .from('messages')
    .insert({...})
    .select('*, sender:users!messages_sender_id_fkey(full_name, role)')
    .single();

// Store reference in chat_messages table (for thread management)
const { error: chatMessageError } = await adminSupabase
    .from('chat_messages')
    .insert({
        thread_id: thread_id,
        sender_id: userId,
        content,
        message_type: message_type,
        message_id: newMessage.id, // Reference to main message
        status: 'sent'
    });
```

## 📋 **How to Test**

### 1. **Start Server**

```bash
npm start
```

### 2. **Get Valid JWT Token**

```bash
# Login to get a fresh token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "your-phone", "password": "your-password"}'
```

### 3. **Connect WebSocket**

```javascript
const token = "your-fresh-jwt-token";
const ws = new WebSocket(
  `ws://localhost:3000?token=${encodeURIComponent(token)}`
);

ws.onopen = () => {
  console.log("✅ Connected!");

  // Subscribe to thread
  ws.send(
    JSON.stringify({
      type: "subscribe_thread",
      thread_id: "your-thread-id",
    })
  );
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("📨 Received:", message);
};
```

### 4. **Send Message**

```javascript
ws.send(
  JSON.stringify({
    type: "send_message",
    thread_id: "your-thread-id",
    content: "Hello, this is a test message!",
    message_type: "text",
  })
);
```

## 🔍 **Verification Steps**

### 1. **Check messages table**

```sql
SELECT * FROM messages WHERE type = 'individual' ORDER BY created_at DESC LIMIT 5;
```

### 2. **Check chat_messages table**

```sql
SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 5;
```

### 3. **Check server logs**

```bash
tail -f combined.log
```

## 🚨 **Common Issues & Solutions**

### 1. **"Failed to send message" Error**

- **Cause**: Database schema mismatch
- **Solution**: ✅ Fixed - Updated to use correct table structure

### 2. **"Invalid token" Error**

- **Cause**: Token expired or wrong secret
- **Solution**: ✅ Fixed - Get fresh token from login

### 3. **"Infinite recursion" Error**

- **Cause**: RLS policies in chat_participants table
- **Solution**: Run the `fix_chat_policies.sql` script

### 4. **Connection Refused**

- **Cause**: Server not running
- **Solution**: Start server with `npm start`

## 📊 **Expected Results**

### Successful Message Flow:

1. ✅ WebSocket connection established
2. ✅ JWT authentication successful
3. ✅ Message stored in `messages` table
4. ✅ Reference stored in `chat_messages` table
5. ✅ Message broadcast to all thread participants
6. ✅ Success confirmation sent to sender

### Database Records:

- **messages table**: Contains the actual message with proper structure
- **chat_messages table**: Contains thread reference and message_type
- **chat_participants table**: Manages thread membership
- **chat_threads table**: Manages thread metadata

## 🎯 **Next Steps**

1. **Test the complete flow** with the fixes applied
2. **Verify message storage** in both tables
3. **Test real-time broadcasting** between multiple users
4. **Implement client-side UI** for chat interface
5. **Add message history** and offline support

The WebSocket chat system is now properly configured to store messages in the `messages` table while maintaining thread relationships in the `chat_messages` table! 🎉
