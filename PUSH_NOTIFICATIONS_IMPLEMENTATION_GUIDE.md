# Push Notifications Implementation Guide

## 🎯 Overview

This guide explains how to implement push notifications for both mobile and web applications to receive notifications even when the app is closed or in the background.

## 🔄 **Hybrid Notification System**

### **How It Works**

1. **App Open**: WebSocket provides real-time notifications
2. **App Backgrounded/Closed**: Push notifications ensure delivery
3. **Offline**: Notifications stored in database for later delivery
4. **Reconnection**: WebSocket reconnects and syncs missed notifications

## 📱 **Mobile App Implementation**

### **1. Android Setup**

#### **Add Firebase to Android Project**

1. **Add to `android/app/build.gradle`:**

```gradle
dependencies {
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    implementation 'com.google.firebase:firebase-analytics:21.5.0'
}
```

2. **Add to `android/build.gradle`:**

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

3. **Apply plugin in `android/app/build.gradle`:**

```gradle
apply plugin: 'com.google.gms.google-services'
```

#### **Android Manifest Configuration**

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<application>
    <!-- Firebase Messaging Service -->
    <service
        android:name=".MyFirebaseMessagingService"
        android:exported="false">
        <intent-filter>
            <action android:name="com.google.firebase.MESSAGING_EVENT" />
        </intent-filter>
    </service>
</application>
```

#### **Firebase Messaging Service**

```java
// android/app/src/main/java/com/yourapp/MyFirebaseMessagingService.java
package com.yourapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "school_notifications";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Handle notification
        if (remoteMessage.getNotification() != null) {
            showNotification(
                remoteMessage.getNotification().getTitle(),
                remoteMessage.getNotification().getBody(),
                remoteMessage.getData()
            );
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Send token to your backend
        sendTokenToServer(token);
    }

    private void showNotification(String title, String body, Map<String, String> data) {
        createNotificationChannel();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_ONE_SHOT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH);

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(0, builder.build());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "School Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications from school app");

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private void sendTokenToServer(String token) {
        // Send token to your backend API
        // POST /api/device-tokens/register
    }
}
```

### **2. iOS Setup**

#### **Add Firebase to iOS Project**

1. **Add to `ios/Podfile`:**

```ruby
pod 'Firebase/Messaging'
pod 'Firebase/Analytics'
```

2. **Run:**

```bash
cd ios && pod install
```

#### **iOS App Delegate Configuration**

```swift
// ios/Runner/AppDelegate.swift
import UIKit
import Firebase
import UserNotifications

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    FirebaseApp.configure()

    // Request notification permissions
    UNUserNotificationCenter.current().delegate = self
    let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
    UNUserNotificationCenter.current().requestAuthorization(
      options: authOptions,
      completionHandler: { _, _ in }
    )

    application.registerForRemoteNotifications()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    Messaging.messaging().apnsToken = deviceToken
  }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
  func userNotificationCenter(_ center: UNUserNotificationCenter,
                            willPresent notification: UNNotification,
                            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([[.alert, .sound]])
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter,
                            didReceive response: UNNotificationResponse,
                            withCompletionHandler completionHandler: @escaping () -> Void) {
    completionHandler()
  }
}
```

### **3. Flutter/Dart Implementation**

#### **Add Dependencies to `pubspec.yaml`:**

```yaml
dependencies:
  firebase_messaging: ^14.7.10
  firebase_core: ^2.24.2
  permission_handler: ^11.1.0
```

#### **Flutter Push Notification Service**

```dart
// lib/services/push_notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

class PushNotificationService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  static String? _fcmToken;

  static Future<void> initialize() async {
    // Request permission
    await _requestPermission();

    // Get FCM token
    _fcmToken = await _firebaseMessaging.getToken();
    print('FCM Token: $_fcmToken');

    // Send token to backend
    if (_fcmToken != null) {
      await _sendTokenToBackend(_fcmToken!);
    }

    // Listen for token refresh
    _firebaseMessaging.onTokenRefresh.listen((token) {
      _fcmToken = token;
      _sendTokenToBackend(token);
    });

    // Handle background messages
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Received foreground message: ${message.notification?.title}');
      _handleForegroundMessage(message);
    });

    // Handle notification tap
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Notification tapped: ${message.notification?.title}');
      _handleNotificationTap(message);
    });
  }

  static Future<void> _requestPermission() async {
    final status = await Permission.notification.request();
    if (status.isDenied) {
      print('Notification permission denied');
    }
  }

  static Future<void> _sendTokenToBackend(String token) async {
    try {
      // Send token to your backend
      final response = await http.post(
        Uri.parse('$baseUrl/api/device-tokens/register'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $userToken',
        },
        body: jsonEncode({
          'device_token': token,
          'platform': defaultTargetPlatform.name,
          'device_info': {
            'app_version': '1.0.0',
            'os_version': Platform.operatingSystemVersion,
          }
        }),
      );

      if (response.statusCode == 200) {
        print('Token sent to backend successfully');
      }
    } catch (e) {
      print('Error sending token to backend: $e');
    }
  }

  static void _handleForegroundMessage(RemoteMessage message) {
    // Show in-app notification or update UI
    // You can use a package like flutter_local_notifications
  }

  static void _handleNotificationTap(RemoteMessage message) {
    // Navigate to specific screen based on notification data
    final data = message.data;
    if (data['type'] == 'announcement') {
      // Navigate to announcements screen
    } else if (data['type'] == 'homework') {
      // Navigate to homework screen
    }
  }
}

// Background message handler (must be top-level function)
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print('Handling background message: ${message.messageId}');
  // Handle background notification
}
```

## 🌐 **Web App Implementation**

### **1. Web Push Notifications**

#### **Add Firebase to Web Project**

```html
<!-- Add to your HTML -->
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import {
    getMessaging,
    getToken,
    onMessage,
  } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";

  const firebaseConfig = {
    // Your Firebase config
  };

  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  // Request permission and get token
  async function requestPermission() {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      const token = await getToken(messaging, {
        vapidKey: "your-vapid-key",
      });

      // Send token to backend
      await sendTokenToBackend(token);
    }
  }

  // Listen for messages
  onMessage(messaging, (payload) => {
    console.log("Message received:", payload);
    showNotification(payload.notification.title, payload.notification.body);
  });

  requestPermission();
</script>
```

### **2. Service Worker for Web**

```javascript
// public/firebase-messaging-sw.js
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js"
);

const firebaseConfig = {
  // Your Firebase config
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Background message received:", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

## 🔧 **Backend Configuration**

### **1. Environment Variables**

```bash
# Add to .env file
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com
```

### **2. Install Dependencies**

```bash
npm install firebase-admin
```

### **3. Database Setup**

```bash
# Run the device tokens schema
psql -d your_database -f device_tokens_schema.sql
```

## 📱 **Client-Side Integration**

### **1. Register Device Token**

```javascript
// When user logs in
async function registerForPushNotifications() {
  try {
    // Get FCM token
    const token = await messaging().getToken();

    // Send to backend
    const response = await fetch("/api/device-tokens/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        device_token: token,
        platform: "web", // or 'android', 'ios'
        device_info: {
          userAgent: navigator.userAgent,
          app_version: "1.0.0",
        },
      }),
    });

    if (response.ok) {
      console.log("Device registered for push notifications");
    }
  } catch (error) {
    console.error("Error registering for push notifications:", error);
  }
}
```

### **2. Handle Notifications**

```javascript
// Listen for push notifications
messaging().onMessage((payload) => {
  console.log("Message received:", payload);

  // Show notification or update UI
  showInAppNotification(payload.notification);
});

// Handle notification click
messaging().onNotificationOpenedApp((payload) => {
  console.log("Notification clicked:", payload);

  // Navigate to specific screen
  if (payload.data.type === "announcement") {
    navigateToAnnouncements();
  }
});
```

## 🧪 **Testing Push Notifications**

### **1. Test Device Registration**

```bash
# Register device token
curl -X POST http://localhost:3000/api/device-tokens/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "device_token": "test_token_12345",
    "platform": "android",
    "device_info": {"model": "Test Device"}
  }'
```

### **2. Send Test Notification**

```bash
# Send test notification
curl -X POST http://localhost:3000/api/device-tokens/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Test Notification",
    "message": "This is a test push notification"
  }'
```

## 📊 **Notification Delivery Flow**

### **Complete Flow**

1. **Content Created** → Notification stored in database
2. **WebSocket Check** → If user connected, send real-time
3. **Push Notification** → Always send push notification
4. **Device Receives** → Show notification on device
5. **User Taps** → Open app and navigate to content
6. **App Opens** → WebSocket reconnects and syncs

### **Fallback Strategy**

- **Primary**: WebSocket for real-time when app is open
- **Secondary**: Push notifications for when app is closed
- **Tertiary**: Database storage for offline delivery
- **Recovery**: WebSocket reconnection syncs missed notifications

## 🔒 **Security Considerations**

### **Token Management**

- Store device tokens securely
- Implement token rotation
- Clean up inactive tokens
- Validate tokens before sending

### **Privacy**

- Only send notifications to registered devices
- Respect user notification preferences
- Implement unsubscribe functionality
- Handle token expiration gracefully

## 📈 **Monitoring & Analytics**

### **Metrics to Track**

- Device token registration rate
- Push notification delivery rate
- Notification open rate
- Token expiration rate
- Error rates and failures

### **Dashboard Views**

- Active device tokens by platform
- Notification delivery success rate
- User engagement metrics
- Error logs and debugging

## 🚨 **Troubleshooting**

### **Common Issues**

1. **No Push Notifications Received**
   - Check Firebase configuration
   - Verify device token registration
   - Check notification permissions
   - Review Firebase console logs

2. **WebSocket + Push Notifications Conflict**
   - Both systems work together
   - WebSocket for real-time, Push for offline
   - No conflicts, only redundancy

3. **Token Registration Fails**
   - Check API endpoint
   - Verify authentication
   - Check database connection
   - Review error logs

### **Debug Commands**

```bash
# Check registered devices
GET /api/device-tokens/my-tokens

# Test push notification
POST /api/device-tokens/test

# Check notification logs
GET /api/notifications/stats
```

## 🎉 **Benefits of Hybrid System**

1. **Always Connected**: Notifications work even when app is closed
2. **Real-time**: WebSocket provides instant delivery when app is open
3. **Reliable**: Push notifications ensure delivery
4. **Efficient**: WebSocket reduces push notification load
5. **User Experience**: Seamless notification experience across all states

This hybrid approach ensures that parents receive notifications regardless of their app state, providing a complete notification experience for both mobile and web applications! 🚀
