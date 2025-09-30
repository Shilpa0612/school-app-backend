# Android Background Notification Setup

## 🔧 **Critical Android Configuration for Background Notifications**

### **1. Android Manifest Configuration**

Add these permissions and services to your `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Required permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<application>
    <!-- Firebase Messaging Service -->
    <service
        android:name=".MyFirebaseMessagingService"
        android:exported="false">
        <intent-filter>
            <action android:name="com.google.firebase.MESSAGING_EVENT" />
        </intent-filter>
    </service>

    <!-- Background notification receiver -->
    <receiver
        android:name=".NotificationReceiver"
        android:exported="false">
        <intent-filter>
            <action android:name="com.google.firebase.MESSAGING_EVENT" />
        </intent-filter>
    </receiver>

    <!-- Boot receiver to restart services -->
    <receiver
        android:name=".BootReceiver"
        android:enabled="true"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.BOOT_COMPLETED" />
            <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            <action android:name="android.intent.action.PACKAGE_REPLACED" />
            <data android:scheme="package" />
        </intent-filter>
    </receiver>
</application>
```

### **2. Firebase Messaging Service (Java)**

Create `android/app/src/main/java/com/yourapp/MyFirebaseMessagingService.java`:

```java
package com.yourapp;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "FCMService";
    private static final String CHANNEL_ID = "school_notifications";
    private static final String CHANNEL_NAME = "School Notifications";
    private static final String CHANNEL_DESCRIPTION = "Notifications from school app";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Log.d(TAG, "From: " + remoteMessage.getFrom());
        Log.d(TAG, "Message data payload: " + remoteMessage.getData());

        // Handle notification
        if (remoteMessage.getNotification() != null) {
            Log.d(TAG, "Message Notification Body: " + remoteMessage.getNotification().getBody());
            showNotification(
                remoteMessage.getNotification().getTitle(),
                remoteMessage.getNotification().getBody(),
                remoteMessage.getData()
            );
        } else if (!remoteMessage.getData().isEmpty()) {
            // Handle data-only message
            Log.d(TAG, "Data-only message received");
            handleDataMessage(remoteMessage.getData());
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "Refreshed token: " + token);

        // Send token to your backend
        sendTokenToServer(token);
    }

    private void showNotification(String title, String body, Map<String, String> data) {
        createNotificationChannel();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        // Add data to intent
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE);

        // Add action buttons if needed
        if (data.containsKey("type")) {
            Intent actionIntent = new Intent(this, MainActivity.class);
            actionIntent.putExtra("action", "view");
            actionIntent.putExtra("type", data.get("type"));
            actionIntent.putExtra("id", data.get("id"));

            PendingIntent actionPendingIntent = PendingIntent.getActivity(
                this, 1, actionIntent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
            );

            builder.addAction(R.drawable.ic_view, "View", actionPendingIntent);
        }

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(0, builder.build());
    }

    private void handleDataMessage(Map<String, String> data) {
        // Handle data-only messages for background processing
        Log.d(TAG, "Handling data message: " + data.toString());

        // You can trigger background tasks here
        // For example, sync data, update local storage, etc.
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESCRIPTION);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    private void sendTokenToServer(String token) {
        // Send token to your backend API
        // This should be implemented in your Flutter/Dart code
        Log.d(TAG, "Token should be sent to server: " + token);
    }
}
```

### **3. Flutter/Dart Implementation**

Update your Flutter push notification service:

```dart
// lib/services/push_notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';

class PushNotificationService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  static String? _fcmToken;

  static Future<void> initialize() async {
    // Initialize local notifications
    await _initializeLocalNotifications();

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

    // Handle notification tap when app is in background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Notification tapped: ${message.notification?.title}');
      _handleNotificationTap(message);
    });

    // Handle notification tap when app is terminated
    RemoteMessage? initialMessage = await _firebaseMessaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }
  }

  static Future<void> _initializeLocalNotifications() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const InitializationSettings initializationSettings =
        InitializationSettings(android: initializationSettingsAndroid);

    await _localNotifications.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Handle notification tap
        print('Notification tapped: ${response.payload}');
      },
    );

    // Create notification channel for Android
    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'school_notifications',
      'School Notifications',
      description: 'Notifications from school app',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  static Future<void> _requestPermission() async {
    // Request notification permission
    final status = await Permission.notification.request();
    if (status.isDenied) {
      print('Notification permission denied');
    }

    // Request Firebase messaging permission
    final settings = await _firebaseMessaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    print('User granted permission: ${settings.authorizationStatus}');
  }

  static Future<void> _sendTokenToBackend(String token) async {
    try {
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
    // Show local notification when app is in foreground
    _showLocalNotification(message);
  }

  static void _showLocalNotification(RemoteMessage message) {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'school_notifications',
      'School Notifications',
      channelDescription: 'Notifications from school app',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
    );

    const NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidPlatformChannelSpecifics);

    _localNotifications.show(
      message.hashCode,
      message.notification?.title,
      message.notification?.body,
      platformChannelSpecifics,
      payload: message.data.toString(),
    );
  }

  static void _handleNotificationTap(RemoteMessage message) {
    // Navigate to specific screen based on notification data
    final data = message.data;
    if (data['type'] == 'announcement') {
      // Navigate to announcements screen
      print('Navigate to announcement: ${data['id']}');
    } else if (data['type'] == 'homework') {
      // Navigate to homework screen
      print('Navigate to homework: ${data['id']}');
    }
  }
}

// Background message handler (must be top-level function)
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  print('Handling background message: ${message.messageId}');

  // Initialize Firebase if not already done
  await Firebase.initializeApp();

  // Handle background notification
  // You can perform background tasks here
  // Note: This function has limited execution time
}
```

### **4. Critical Settings for Background Notifications**

#### **Android App Settings:**

1. **Battery Optimization**: Disable battery optimization for your app
2. **Background App Refresh**: Enable background app refresh
3. **Notification Permissions**: Ensure all notification permissions are granted

#### **Firebase Console Settings:**

1. **Cloud Messaging API**: Enable in Google Cloud Console
2. **Service Account**: Ensure proper permissions
3. **Project Settings**: Verify sender ID and server key

### **5. Testing Background Notifications**

```bash
# Test with curl
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "DEVICE_TOKEN",
    "notification": {
      "title": "Test Background Notification",
      "body": "This should appear even when app is closed"
    },
    "data": {
      "type": "test",
      "id": "123"
    },
    "android": {
      "priority": "high",
      "notification": {
        "channelId": "school_notifications",
        "priority": "high"
      }
    }
  }'
```

### **6. Common Issues and Solutions**

1. **Notifications not showing when app is closed:**
   - Check notification channel configuration
   - Verify battery optimization settings
   - Ensure proper notification permissions

2. **Data-only messages not received:**
   - Implement proper background message handler
   - Check app lifecycle management
   - Verify service worker (for web)

3. **Token registration fails:**
   - Check Firebase configuration
   - Verify network connectivity
   - Review authentication tokens

This setup ensures that your notifications work properly even when the app is closed or in the background! 🚀
