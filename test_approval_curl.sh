#!/bin/bash

echo "🧪 Testing Chat Message Approval Notifications"
echo "=============================================="

BASE_URL="https://ajws-school-ba8ae5e3f955.herokuapp.com/api"

echo ""
echo "1. Logging in as Principal..."
PRINCIPAL_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "1234567891",
    "password": "password123"
  }')

echo "Principal login response: $PRINCIPAL_RESPONSE"

# Extract token (this is a simplified approach)
PRINCIPAL_TOKEN=$(echo $PRINCIPAL_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Principal token: $PRINCIPAL_TOKEN"

if [ -z "$PRINCIPAL_TOKEN" ]; then
    echo "❌ Failed to get principal token"
    exit 1
fi

echo ""
echo "2. Getting pending messages..."
PENDING_RESPONSE=$(curl -s -X GET "$BASE_URL/chat/messages/pending" \
  -H "Authorization: Bearer $PRINCIPAL_TOKEN")

echo "Pending messages response: $PENDING_RESPONSE"

# Extract first message ID (simplified)
MESSAGE_ID=$(echo $PENDING_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
THREAD_ID=$(echo $PENDING_RESPONSE | grep -o '"thread_id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "First message ID: $MESSAGE_ID"
echo "Thread ID: $THREAD_ID"

if [ -z "$MESSAGE_ID" ]; then
    echo "❌ No pending messages found"
    exit 1
fi

echo ""
echo "3. Approving message: $MESSAGE_ID"
APPROVE_RESPONSE=$(curl -s -X POST "$BASE_URL/chat/messages/$MESSAGE_ID/approve" \
  -H "Authorization: Bearer $PRINCIPAL_TOKEN" \
  -H "Content-Type: application/json")

echo "Approve response: $APPROVE_RESPONSE"

echo ""
echo "4. Logging in as Parent..."
PARENT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "9923149457",
    "password": "Temp@1234"
  }')

echo "Parent login response: $PARENT_RESPONSE"

PARENT_TOKEN=$(echo $PARENT_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Parent token: $PARENT_TOKEN"

if [ -z "$PARENT_TOKEN" ]; then
    echo "❌ Failed to get parent token"
    exit 1
fi

echo ""
echo "5. Checking if parent can see approved message..."
THREAD_RESPONSE=$(curl -s -X GET "$BASE_URL/chat/messages?thread_id=$THREAD_ID" \
  -H "Authorization: Bearer $PARENT_TOKEN")

echo "Thread messages response: $THREAD_RESPONSE"

echo ""
echo "🎯 NOTIFICATION TEST COMPLETE!"
echo "📋 Check the server logs for notification activity:"
echo "   - '💬 sendChatMessageApprovalNotifications called'"
echo "   - '📨 Sending message approval notification to parent'"
echo "   - '📡 Broadcasting approved message'"
echo "   - '✅ Message approval notification result'"
echo ""
echo "📱 If notifications are working, parent should have received:"
echo "   - WebSocket notification (if connected)"
echo "   - Firebase push notification"
echo "   - In-app notification record"
