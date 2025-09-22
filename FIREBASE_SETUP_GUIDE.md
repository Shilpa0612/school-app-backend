# Firebase Setup Guide for Push Notifications

## 🔥 **Step-by-Step Firebase Configuration**

### **Step 1: Create Firebase Project**

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Click "Create a project"** or "Add project"
3. **Enter project name**: `school-app-notifications` (or your preferred name)
4. **Enable Google Analytics** (optional but recommended)
5. **Click "Create project"**

### **Step 2: Enable Cloud Messaging**

1. **In your Firebase project dashboard**
2. **Go to "Build" → "Authentication"**
3. **Click "Get started"** (if not already enabled)
4. **Go to "Build" → "Cloud Messaging"**
5. **Click "Get started"** (this enables FCM)

### **Step 3: Generate Service Account Key**

1. **Go to Project Settings** (gear icon in left sidebar)
2. **Click "Service accounts" tab**
3. **Click "Generate new private key"**
4. **Click "Generate key"** - This downloads a JSON file
5. **Save the JSON file securely** (don't commit to git!)

### **Step 4: Extract Credentials from JSON**

Open the downloaded JSON file and extract these values:

```json
{
  "type": "service_account",
  "project_id": "your-project-id-here",
  "private_key_id": "your-private-key-id-here",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "your-client-id-here",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"
}
```

### **Step 5: Add to Your .env File**

```bash
# Add these to your .env file
FIREBASE_PROJECT_ID=your-project-id-here
FIREBASE_PRIVATE_KEY_ID=your-private-key-id-here
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id-here
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com
```

### **Step 6: Install Firebase Admin SDK**

```bash
npm install firebase-admin
```

### **Step 7: Test the Configuration**

```bash
# Test push notifications
node test_push_notifications.js

# Test device registration
curl -X POST http://localhost:3000/api/device-tokens/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "device_token": "test_token_12345",
    "platform": "android",
    "device_info": {"model": "Test Device"}
  }'
```

## 🔒 **Security Best Practices**

### **Environment Variables**

- ✅ Store credentials in `.env` file
- ✅ Never commit `.env` to version control
- ✅ Use different credentials for development/production
- ✅ Rotate keys regularly

### **Firebase Project Settings**

- ✅ Enable App Check for production
- ✅ Set up proper IAM roles
- ✅ Monitor usage and costs
- ✅ Set up alerts for unusual activity

## 🧪 **Testing Your Setup**

### **1. Test Device Registration**

```bash
curl -X POST http://localhost:3000/api/device-tokens/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "device_token": "test_device_token_12345",
    "platform": "android",
    "device_info": {
      "model": "Test Device",
      "os_version": "Android 12",
      "app_version": "1.0.0"
    }
  }'
```

### **2. Send Test Notification**

```bash
curl -X POST http://localhost:3000/api/device-tokens/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Notification",
    "message": "This is a test push notification from your school app!"
  }'
```

### **3. Check Device Tokens**

```bash
curl -X GET http://localhost:3000/api/device-tokens/my-tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📱 **Client-Side Setup**

### **For Mobile Apps (Android/iOS)**

1. Download `google-services.json` (Android) or `GoogleService-Info.plist` (iOS)
2. Add to your mobile app project
3. Implement FCM token generation
4. Register token with your backend

### **For Web Apps**

1. Get Firebase config from project settings
2. Add to your web app
3. Request notification permissions
4. Register token with your backend

## 🚨 **Troubleshooting**

### **Common Issues**

1. **"Firebase project not found"**
   - Check `FIREBASE_PROJECT_ID` in your `.env`
   - Ensure project exists in Firebase Console

2. **"Invalid private key"**
   - Check `FIREBASE_PRIVATE_KEY` format
   - Ensure newlines are properly escaped (`\n`)

3. **"Permission denied"**
   - Check service account permissions
   - Ensure Cloud Messaging API is enabled

4. **"Device token not found"**
   - Check if device is registered
   - Verify token format and platform

### **Debug Commands**

```bash
# Check environment variables
node -e "console.log(process.env.FIREBASE_PROJECT_ID)"

# Test Firebase connection
node -e "
const admin = require('firebase-admin');
try {
  admin.initializeApp();
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization failed:', error.message);
}
"

# Check database connection
curl http://localhost:3000/test-db
```

## 📊 **Monitoring & Analytics**

### **Firebase Console**

- Monitor message delivery rates
- Track token registration
- View error logs
- Monitor usage and costs

### **Backend Logs**

- Check notification delivery logs
- Monitor WebSocket connections
- Track device token registrations
- Monitor error rates

## 🎉 **Success Indicators**

- ✅ Firebase project created and configured
- ✅ Service account key generated and added to `.env`
- ✅ Device tokens can be registered via API
- ✅ Test notifications can be sent
- ✅ WebSocket connections work for real-time notifications
- ✅ Push notifications work when app is closed

Once you complete these steps, your push notification system will be fully functional! 🚀
