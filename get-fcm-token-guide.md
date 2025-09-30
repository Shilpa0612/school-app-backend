# How to Get FCM Token in Development

## Flutter App - Quick Setup

### 1. Add Dependencies

```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
  flutter_local_notifications: ^16.3.0
```

### 2. Create Token Display Page

```dart
// lib/pages/fcm_token_page.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class FCMTokenPage extends StatefulWidget {
  @override
  _FCMTokenPageState createState() => _FCMTokenPageState();
}

class _FCMTokenPageState extends State<FCMTokenPage> {
  String? fcmToken;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    getFCMToken();
  }

  Future<void> getFCMToken() async {
    try {
      // Initialize Firebase
      await Firebase.initializeApp();

      // Get FCM token
      FirebaseMessaging messaging = FirebaseMessaging.instance;
      String? token = await messaging.getToken();

      setState(() {
        fcmToken = token;
        isLoading = false;
      });

      print('FCM Token: $token'); // Also print to console

    } catch (e) {
      setState(() {
        fcmToken = 'Error: $e';
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('FCM Token'),
        backgroundColor: Colors.blue,
      ),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'FCM Registration Token:',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            if (isLoading)
              Center(child: CircularProgressIndicator())
            else
              Container(
                width: double.infinity,
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SelectableText(
                  fcmToken ?? 'No token available',
                  style: TextStyle(fontSize: 12, fontFamily: 'monospace'),
                ),
              ),
            SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: fcmToken != null ? () {
                      Clipboard.setData(ClipboardData(text: fcmToken!));
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Token copied to clipboard!')),
                      );
                    } : null,
                    icon: Icon(Icons.copy),
                    label: Text('Copy Token'),
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: getFCMToken,
                    icon: Icon(Icons.refresh),
                    label: Text('Refresh'),
                  ),
                ),
              ],
            ),
            SizedBox(height: 20),
            Text(
              'Instructions:',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text('1. Copy the token above'),
            Text('2. Paste it in test-with-real-token.js'),
            Text('3. Run: node test-with-real-token.js'),
            Text('4. Check your device for notifications'),
          ],
        ),
      ),
    );
  }
}
```

### 3. Add to Your App

```dart
// In your main app, add a button to navigate to this page
ElevatedButton(
  onPressed: () {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => FCMTokenPage()),
    );
  },
  child: Text('Get FCM Token'),
),
```

## Android Native - Quick Setup

### 1. Add to MainActivity.java

```java
// android/app/src/main/java/com/yourpackage/MainActivity.java
import com.google.firebase.messaging.FirebaseMessaging;
import android.widget.Toast;
import android.util.Log;

public class MainActivity extends FlutterActivity {
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Get FCM token
        FirebaseMessaging.getInstance().getToken()
            .addOnCompleteListener(new OnCompleteListener<String>() {
                @Override
                public void onComplete(@NonNull Task<String> task) {
                    if (!task.isSuccessful()) {
                        Log.w(TAG, "Fetching FCM registration token failed", task.getException());
                        return;
                    }

                    String token = task.getResult();
                    Log.d(TAG, "FCM Token: " + token);

                    // Show in Toast
                    Toast.makeText(MainActivity.this,
                        "FCM Token: " + token.substring(0, 50) + "...",
                        Toast.LENGTH_LONG).show();
                }
            });
    }
}
```

## Testing Your Token

### 1. Get Token from Your App

- Run your app in development mode
- Navigate to the FCM token page
- Copy the token

### 2. Test with Backend

```bash
# Edit test-with-real-token.js and paste your token
node test-with-real-token.js
```

### 3. Expected Result

You should see:

```
✅ SUCCESS! Real FCM token test passed!
📱 Check your mobile device notification panel
```

## Important Notes

1. **Development vs Production**: FCM tokens work the same in development and production
2. **Token Format**: Real tokens look like: `fGxV8Z9mQ_6:APA91bF7Z2Q3K8mN5pL1xY4wR6tE9sA2dF3gH8jK0mN2pQ4rT6uI8oL1xY4wR6tE9sA2dF3gH8jK0mN2pQ`
3. **Token Refresh**: Tokens can change, so get a fresh one if testing fails
4. **Firebase Project**: Make sure your app is connected to the same Firebase project as your backend

## Troubleshooting

### If you get "Invalid token" error:

1. Make sure you're using the correct Firebase project
2. Check that your app's `google-services.json` (Android) or `GoogleService-Info.plist` (iOS) matches your backend Firebase project
3. Try getting a fresh token
4. Make sure your app has internet connection when getting the token
