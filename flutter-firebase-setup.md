# Flutter Firebase Setup for Your Project

## Your Firebase Project Details:

- **Project ID**: school-app-notifications-c86ab
- **Project Number**: 646958593727
- **Package Name**: com.ajws.mobile
- **App ID**: 1:646958593727:android:17bdca6c24dae6cde5380a

## Step 1: Download google-services.json

1. Go to your Firebase Console: https://console.firebase.google.com/project/school-app-notifications-c86ab
2. Click on your Android app: `com.ajws.mobile`
3. Download the `google-services.json` file
4. Place it in: `android/app/google-services.json`

## Step 2: Add to android/app/build.gradle

```gradle
// android/app/build.gradle
plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"

    // Add this line
    id "com.google.gms.google-services"
}

dependencies {
    // Add Firebase dependencies
    implementation platform('com.google.firebase:firebase-bom:34.3.0')
    implementation 'com.google.firebase:firebase-analytics'
    implementation 'com.google.firebase:firebase-messaging'
}
```

## Step 3: Add to android/build.gradle (Project Level)

```gradle
// android/build.gradle (project level)
buildscript {
    dependencies {
        // Add this line
        classpath 'com.google.gms:google-services:4.4.3'
    }
}
```

## Step 4: Add to pubspec.yaml

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter

  # Add these Firebase dependencies
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0
```

## Step 5: Initialize Firebase in Your Flutter App

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'School App',
      home: MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  String? fcmToken;

  @override
  void initState() {
    super.initState();
    getFCMToken();
  }

  Future<void> getFCMToken() async {
    try {
      FirebaseMessaging messaging = FirebaseMessaging.instance;

      // Request permission
      NotificationSettings settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        // Get FCM token
        String? token = await messaging.getToken();
        setState(() {
          fcmToken = token;
        });

        print('FCM Token: $token'); // This will show in console

        // Send token to your Node.js backend
        await sendTokenToBackend(token!);
      }
    } catch (e) {
      print('Error getting FCM token: $e');
    }
  }

  Future<void> sendTokenToBackend(String token) async {
    try {
      // Replace with your actual backend URL and JWT token
      final response = await http.post(
        Uri.parse('http://your-backend-url/api/device-tokens/register'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_JWT_TOKEN', // Get this from your login
        },
        body: json.encode({
          'device_token': token,
          'platform': 'android',
          'device_info': {
            'model': 'device_model',
            'os_version': 'os_version',
          }
        }),
      );

      if (response.statusCode == 200) {
        print('Token registered successfully with backend');
      } else {
        print('Failed to register token: ${response.body}');
      }
    } catch (e) {
      print('Error sending token to backend: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('School App'),
        backgroundColor: Colors.blue,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'FCM Token:',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 10),
            Container(
              padding: EdgeInsets.all(10),
              child: SelectableText(
                fcmToken ?? 'Loading...',
                style: TextStyle(fontSize: 12),
              ),
            ),
            SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                if (fcmToken != null) {
                  Clipboard.setData(ClipboardData(text: fcmToken!));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Token copied to clipboard!')),
                  );
                }
              },
              child: Text('Copy Token'),
            ),
          ],
        ),
      ),
    );
  }
}
```

## Step 6: Add Background Message Handler

```dart
// Add this to your main.dart
import 'package:flutter/services.dart';

// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Handling a background message: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Set background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(MyApp());
}
```

## Step 7: Test Your Setup

1. **Run your Flutter app**
2. **Check console logs** for FCM token
3. **Copy the token**
4. **Test with your backend** using the scripts I created earlier

## Your Backend (Node.js) is Already Ready!

Your Node.js backend already has:

- ✅ Firebase Admin SDK configured
- ✅ FCM notification service
- ✅ API endpoints for device token registration
- ✅ Correct FCM payload structure

You just need to:

1. **Add Firebase to your Flutter app** (using the steps above)
2. **Get the real FCM token** from your app
3. **Test notifications** with your backend
