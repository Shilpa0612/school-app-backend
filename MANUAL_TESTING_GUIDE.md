# 🧪 Manual Testing Guide for Firebase Notifications

## Quick Start Testing

### 1. **Start Your Server**

```bash
npm start
```

### 2. **Test Server Health**

```bash
curl http://localhost:3000/api/health
```

**Expected Response:**

```json
{
  "status": "success",
  "message": "Server is running",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 3. **Test Device Token Registration**

```bash
curl -X POST http://localhost:3000/api/device-tokens/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "device_token": "test_device_token_12345",
    "platform": "android",
    "device_info": {
      "model": "Test Device",
      "os_version": "Android 13",
      "app_version": "1.0.0"
    }
  }'
```

### 4. **Test Notification Endpoints**

```bash
# Get all notifications
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/notifications

# Get unread count
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/notifications/unread-count

# Get notification types
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/notifications/types
```

### 5. **Test Push Notification Sending**

```bash
curl -X POST http://localhost:3000/api/device-tokens/test-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test push notification!",
    "data": {
      "type": "test",
      "id": "test-123"
    }
  }'
```

### 6. **Test WebSocket Connection**

```javascript
// In browser console or Node.js
const ws = new WebSocket("ws://localhost:3000?token=YOUR_JWT_TOKEN");

ws.onopen = () => {
  console.log("WebSocket connected!");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};

ws.onclose = () => {
  console.log("WebSocket disconnected");
};
```

## 🔥 Firebase-Specific Tests

### 1. **Check Firebase Configuration**

```bash
node test_firebase_simple.js
```

### 2. **Test Firebase Admin SDK**

```javascript
// Create test-firebase.js
const admin = require("firebase-admin");

const serviceAccount = {
  type: "service_account",
  project_id: "school-app-notifications-c86ab",
  private_key_id: "8d9941730f785325d49cc201ead5f94cc04e458f",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+5X/TinP+MgkO\nLiY2pT2zN3x6VmsxL4taeH/YxjwJUZdf9NE4Qcuc+8ASIQAT/286/ckkXb7gYAvO\nUsbRVhOO6HjiSFPeMbd8AEJcsUGONS9yAZVrMU5KFGsulMaJewzTB08dMihh17qt\nc4bKCzDPFrE8tgL3i0lkNCjIcpEk9whe+/6JmOKJmKv2ADV7aDuDh9pl7p8OUnvp\n1oDscFDJqyWg48KuDvSyomDUBo6D2O3DgsAGOMxjGMzpRfjnuyyPQrZfCHmduVsG\nZZ3TglDAV76/32r22734xIcp3tngXA8yNa67KSJhrpODRgArNy5Lxhn26E0FYgx1\n4Z8QBi+3AgMBAAECggEAJBbzUaTtRPNkrt+erdoTjhxBVkecQFJCwDnjwbHIi+J3\nAdcg7sfRnL4jk8nVX/J8ruRn8I4glf7SfJE9sTnavLvKjs0pveocTD8oTKneQOph\nK+aMvxU1PeAaW1YZKsiupf7NwDFJXSYRztT2eKAg/CXIIDgw22fj2iPaSfsO4bPW\ntPQzGUBYPEWfirsLOIdNvBnM9yxwxhuJlL0fLkOSu3dA9YyOkdHy6LmIaVk8Sp23\n32ClHFOgY8BgJbCVticZpEivWi3PHsmF/1CAcO+chF01lMm2uK6OP2gdtj2PK7eq\n/XtWwHW9sh5fVWzP5vgwdfU0na5RU3WV/pGTDynp8QKBgQDdLCbsxiw5QkbcMOji\ndVNS/MdDnxum69Wp0s8/IiDm+3ckd6DXzn4DblYQ1wLdZ+FcDdzeatlw/hJoCgHi\nnGt+CpMbwcF8P271F9B/ZX2OHkFg5Ci3ZG4VGu/WCwoUvPmv44fETOFA+VRMzjxX\nxQarZsUgAhKG97Q7N/vLcPbPhQKBgQDc9N6SnzHzcRnH1BRZmmGkEL3W7qGMGnbg\nYdnYDkWj7Sej1faB8dyh3sG7FL3SK9XMM4JVNd3K5hAbcEv+BZ9wyyLSYikV/CI3\nIuNO6f0LR9eY3lTmBR3NmqGNKVene5fKBccTt569VcFubGNC6a3wutG7SpqJOska\nLMHh/JjBCwKBgF8eMutXWwORDlp6Kl3iKWCiV6wsTD8gY7ZydDDpo47TDO1BCYpm\nQumE1TzOy2ue1lu5loiNGVCv5AicbS0hKlV9hMDGNkkSGs0LXd68LiAlwOZDmYMt\njO5EtGqwOriqgRN03hm9Go7P68JQW8E/edvTCen3GjKzau6g6AgZX/vlAoGBAM72\nJgxcRONryuQbyDvtmQueCtNpjbO3jiW6QdxX8e8L0hdp8I3ix/BuwDPFx8828/lj\nPe8ml2rXd7rbwrJa/e8etq0s+KL5GetfKF7gWP7Z+h3cEtWpcTMGZc/dK5da8uBt\n7PyQ/4UE8DvIFmm0jBJySsUNqhZkE74KskhE26flAoGATedH2Yo08htemjewSqRG\nG01fRw0nj2/Js/ClyiIf2Z+AbIOmgyGzBB3DAqfGNBb6l+QwE7JFwfCgBHBHn62l\ndawJB8eb+sj/eNYOLSGzhl0xFp+X/irIS92ZyCLclmEYA12PGm4La7TWi43BHhBY\n0JNs7Pm3+e8Ipe2SzTwIA7M=\n-----END PRIVATE KEY-----\n",
  client_email:
    "firebase-adminsdk-fbsvc@school-app-notifications-c86ab.iam.gserviceaccount.com",
  client_id: "118128845168150254613",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40school-app-notifications-c86ab.iam.gserviceaccount.com",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "school-app-notifications-c86ab",
});

console.log("Firebase Admin SDK initialized successfully!");
```

### 3. **Test Push Notification Sending**

```javascript
// Add to test-firebase.js
const message = {
  token: "test_token_12345", // This will fail, but tests the service
  notification: {
    title: "Test Notification",
    body: "This is a test push notification!",
  },
  data: {
    type: "test",
    id: "test-" + Date.now(),
  },
};

admin
  .messaging()
  .send(message)
  .then((response) => {
    console.log("Successfully sent message:", response);
  })
  .catch((error) => {
    console.log("Error sending message:", error);
    if (error.code === "messaging/invalid-registration-token") {
      console.log(
        "✅ Firebase service is working (expected error for fake token)"
      );
    }
  });
```

## 📱 Mobile App Testing

### 1. **Android Testing**

- Install your Android app
- Login and get JWT token
- Register device token
- Send test notifications
- Check if notifications appear

### 2. **iOS Testing**

- Install your iOS app
- Login and get JWT token
- Register device token
- Send test notifications
- Check if notifications appear

### 3. **Web Testing**

- Open your web app
- Login and get JWT token
- Register device token
- Send test notifications
- Check if notifications appear

## 🔍 Troubleshooting

### Common Issues:

1. **"Firebase Admin SDK not installed"**

   ```bash
   npm install firebase-admin
   ```

2. **"Invalid registration token"**
   - This is expected for fake tokens
   - Use real device tokens from mobile apps

3. **"WebSocket connection failed"**
   - Check if server is running
   - Check if JWT token is valid
   - Check if WebSocket port is open

4. **"Device token registration failed"**
   - Check if JWT token is valid
   - Check if user has proper permissions
   - Check if database is connected

5. **"Push notification failed"**
   - Check Firebase configuration
   - Check if device token is valid
   - Check if Firebase project is active

## ✅ Success Indicators

- ✅ Server starts without errors
- ✅ Device token registration returns success
- ✅ Notification endpoints return data
- ✅ WebSocket connects successfully
- ✅ Push notification service initializes
- ✅ Test notifications are sent (even if they fail due to fake tokens)

## 🚀 Next Steps

1. **Test with real mobile devices**
2. **Test with real JWT tokens**
3. **Test notification delivery in different scenarios**
4. **Test notification persistence and read status**
5. **Test notification filtering and pagination**
