# WebSocket Chat Issues - Complete Fix Guide

## 🔍 **Issues Identified**

### 1. **Database Schema Issues**
- Missing `message_type` column in `messages` table
- Infinite recursion in `chat_participants` RLS policies

### 2. **Authentication Issues**
- JWT token expiration
- Invalid token signatures

### 3. **Connection Issues**
- WebSocket handshake failures
- Policy recursion preventing data access

## 🛠️ **Step-by-Step Fixes**

### **Step 1: Fix Database Schema**

#### 1.1 Add Missing Column to Messages Table
```sql
-- Add message_type column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';

-- Update existing messages to have message_type
UPDATE messages 
SET message_type = 'text' 
WHERE message_type IS NULL;
```

#### 1.2 Fix Chat Participants RLS Policies
```sql
-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view their own chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can insert their own chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can update their own chat participations" ON chat_participants;
DROP POLICY IF EXISTS "Users can delete their own chat participations" ON chat_participants;

-- Create simplified policies
CREATE POLICY "Users can view their own chat participations" ON chat_participants
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat participations" ON chat_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat participations" ON chat_participants
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat participations" ON chat_participants
    FOR DELETE USING (auth.uid() = user_id);
```

### **Step 2: Get Fresh JWT Token**

#### 2.1 Login to Get New Token
```bash
# Use your login endpoint to get a fresh token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "your_phone_number",
    "password": "your_password"
  }'
```

#### 2.2 Extract Token from Response
The response will contain a fresh JWT token that hasn't expired.

### **Step 3: Test WebSocket Connection**

#### 3.1 Updated Test Script
```javascript
// test_websocket_fresh.js
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import { config } from 'dotenv';

config();

async function testWebSocketWithFreshToken() {
    try {
        // Get fresh token from login (replace with actual login call)
        const freshToken = await getFreshToken(); // Your login function
        
        console.log('Testing WebSocket with fresh token...');
        
        const ws = new WebSocket(`ws://localhost:3000?token=${encodeURIComponent(freshToken)}`);
        
        ws.on('open', () => {
            console.log('✅ WebSocket connected successfully!');
            
            // Subscribe to a thread
            ws.send(JSON.stringify({
                type: 'subscribe_thread',
                thread_id: '5ab97a62-440d-45d8-96dd-fdb8648c89da'
            }));
            
            // Send a test message
            setTimeout(() => {
                ws.send(JSON.stringify({
                    type: 'send_message',
                    thread_id: '5ab97a62-440d-45d8-96dd-fdb8648c89da',
                    content: 'Hello from WebSocket!',
                    message_type: 'text'
                }));
            }, 1000);
        });
        
        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            console.log('📨 Received:', message);
        });
        
        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error.message);
        });
        
        ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testWebSocketWithFreshToken();
```

## 🔄 **Complete Flow to Run WebSocket Chat**

### **Phase 1: Database Setup**
```bash
# 1. Connect to your database and run the schema fixes
psql -d your_database -f database_fixes.sql

# 2. Verify the fixes
psql -d your_database -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'message_type';"
```

### **Phase 2: Server Setup**
```bash
# 1. Start the server
npm start

# 2. Verify server is running
curl http://localhost:3000/health
```

### **Phase 3: Authentication**
```bash
# 1. Login to get fresh token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "your_phone_number",
    "password": "your_password"
  }'

# 2. Extract token from response
# Copy the "token" field from the JSON response
```

### **Phase 4: WebSocket Connection**
```javascript
// In your browser console or client application
const freshToken = 'your_fresh_token_from_login';

const ws = new WebSocket(`ws://localhost:3000?token=${encodeURIComponent(freshToken)}`);

ws.onopen = () => {
    console.log('✅ Connected to WebSocket!');
    
    // Subscribe to thread
    ws.send(JSON.stringify({
        type: 'subscribe_thread',
        thread_id: '5ab97a62-440d-45d8-96dd-fdb8648c89da'
    }));
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('📨 Received:', message);
};

ws.onerror = (error) => {
    console.error('❌ Error:', error);
};

ws.onclose = (event) => {
    console.log('🔌 Closed:', event.code, event.reason);
};
```

### **Phase 5: Send Messages**
```javascript
// Send a text message
ws.send(JSON.stringify({
    type: 'send_message',
    thread_id: '5ab97a62-440d-45d8-96dd-fdb8648c89da',
    content: 'Hello, this is a test message!',
    message_type: 'text'
}));

// Send an image message
ws.send(JSON.stringify({
    type: 'send_message',
    thread_id: '5ab97a62-440d-45d8-96dd-fdb8648c89da',
    content: 'https://example.com/image.jpg',
    message_type: 'image'
}));
```

## 🚨 **Critical Issues to Fix**

### **Issue 1: Missing Database Column**
The `messages` table is missing the `message_type` column that the WebSocket service expects.

**Fix**: Run the ALTER TABLE command above.

### **Issue 2: RLS Policy Recursion**
The chat_participants table has policies causing infinite recursion.

**Fix**: Replace the policies with simplified versions.

### **Issue 3: Token Expiration**
Your JWT token has expired and needs to be refreshed.

**Fix**: Login again to get a fresh token.

## 📋 **Quick Fix Checklist**

- [ ] Run database schema fixes
- [ ] Restart the server
- [ ] Login to get fresh JWT token
- [ ] Test WebSocket connection with fresh token
- [ ] Verify message sending works
- [ ] Check real-time message delivery

## 🔧 **Troubleshooting Commands**

```bash
# Check server status
netstat -ano | findstr :3000

# Check database connection
curl http://localhost:3000/test-db

# Check environment variables
node -e "console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set')"

# View server logs
tail -f combined.log
```

## 🎯 **Expected Results**

After applying these fixes:

1. **Database**: `message_type` column exists in messages table
2. **Policies**: No more infinite recursion errors
3. **Authentication**: Fresh JWT tokens work properly
4. **WebSocket**: Connection established successfully
5. **Messages**: Real-time sending and receiving works

The WebSocket chat system will be fully functional! 🎉
