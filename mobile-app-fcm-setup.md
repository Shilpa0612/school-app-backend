# Mobile App FCM Token Registration

## Flutter Implementation

### 1. Add Firebase Messaging Dependency

```yaml
# pubspec.yaml
dependencies:
  firebase_messaging: ^14.7.9
  firebase_core: ^2.24.2
```

### 2. Initialize Firebase and Get Token

```dart
// main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class FCMService {
  static FirebaseMessaging messaging = FirebaseMessaging.instance;

  // Initialize FCM and get token
  static Future<void> initializeFCM() async {
    // Request permission
    NotificationSettings settings = await messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('User granted permission');

      // Get FCM token
      String? token = await messaging.getToken();
      if (token != null) {
        print('FCM Token: $token');

        // Send token to your backend
        await registerTokenWithBackend(token);
      }
    }
  }

  // Register token with your backend
  static Future<void> registerTokenWithBackend(String token) async {
    try {
      final response = await http.post(
        Uri.parse('http://your-backend-url/api/device-tokens/register'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_JWT_TOKEN', // Replace with real JWT
        },
        body: json.encode({
          'device_token': token,
          'platform': Platform.isAndroid ? 'android' : 'ios',
          'device_info': {
            'model': 'device_model',
            'os_version': 'os_version',
          }
        }),
      );

      if (response.statusCode == 200) {
        print('Token registered successfully');
      } else {
        print('Failed to register token: ${response.body}');
      }
    } catch (e) {
      print('Error registering token: $e');
    }
  }
}

// In your main function
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Initialize FCM
  await FCMService.initializeFCM();

  runApp(MyApp());
}
```

### 3. Handle Background Messages

```dart
// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Handling a background message: ${message.messageId}');

  // Handle the background notification
  // You can show local notification here
}

// In your main function
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Set background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(MyApp());
}
```

### 4. Handle Foreground Messages

```dart
// In your app initialization
void setupForegroundMessageHandling() {
  FirebaseMessaging.onMessage.listen((RemoteMessage message) {
    print('Got a message whilst in the foreground!');
    print('Message data: ${message.data}');

    if (message.notification != null) {
      print('Message also contained a notification: ${message.notification}');
      // Show local notification or update UI
    }
  });
}
```

## Android Configuration

### 1. Add to android/app/src/main/AndroidManifest.xml

```xml
<application>
    <!-- Add this service for background message handling -->
    <service
        android:name=".java.MyFirebaseMessagingService"
        android:exported="false">
        <intent-filter>
            <action android:name="com.google.firebase.MESSAGING_EVENT" />
        </intent-filter>
    </service>

    <!-- Notification channel (Android 8.0+) -->
    <meta-data
        android:name="com.google.firebase.messaging.default_notification_channel_id"
        android:value="school_notifications" />
</application>
```

### 2. Create MyFirebaseMessagingService.java

```java
// android/app/src/main/java/com/yourpackage/MyFirebaseMessagingService.java
package com.yourpackage;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class MyFirebaseMessagingService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        // Handle background message
        if (remoteMessage.getNotification() != null) {
            showNotification(
                remoteMessage.getNotification().getTitle(),
                remoteMessage.getNotification().getBody()
            );
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);

        // Send token to your backend
        sendTokenToBackend(token);
    }

    private void showNotification(String title, String body) {
        NotificationManager notificationManager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

        String channelId = "school_notifications";

        // Create notification channel (Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId,
                "School Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            notificationManager.createNotificationChannel(channel);
        }

        // Create notification
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_notification)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH);

        notificationManager.notify(0, builder.build());
    }

    private void sendTokenToBackend(String token) {
        // Implement API call to register token with your backend
    }
}
```

## iOS Configuration

### 1. Add to ios/Runner/AppDelegate.swift

```swift
import UIKit
import Flutter
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
      completionHandler: {_, _ in })

    application.registerForRemoteNotifications()

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

## Testing Real Tokens

Once you implement this in your mobile app:

1. **Run your mobile app**
2. **Check console logs** for the real FCM token
3. **Register the real token** with your backend
4. **Test notifications** with the real token

The real FCM token will look something like:

```
fGxV8Z9mQ_6:APA91bF7Z2Q3K8mN5pL1xY4wR6tE9sA2dF3gH8jK0mN2pQ4rT6uI8oL1xY4wR6tE9sA2dF3gH8jK0mN2pQ4rT6uI8oL1xY4wR6tE9sA2dF3gH8jK0mN2pQ
```
