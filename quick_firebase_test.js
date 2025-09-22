#!/usr/bin/env node

console.log('🔥 Quick Firebase Test...\n');

(async () => {
    try {
        // Test Firebase Admin SDK import
        const admin = await import('firebase-admin');
        console.log('✅ Firebase Admin SDK imported successfully');

        // Test Firebase initialization
        const serviceAccount = {
            type: "service_account",
            project_id: "school-app-notifications-c86ab",
            private_key_id: "8d9941730f785325d49cc201ead5f94cc04e458f",
            private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+5X/TinP+MgkO\nLiY2pT2zN3x6VmsxL4taeH/YxjwJUZdf9NE4Qcuc+8ASIQAT/286/ckkXb7gYAvO\nUsbRVhOO6HjiSFPeMbd8AEJcsUGONS9yAZVrMU5KFGsulMaJewzTB08dMihh17qt\nc4bKCzDPFrE8tgL3i0lkNCjIcpEk9whe+/6JmOKJmKv2ADV7aDuDh9pl7p8OUnvp\n1oDscFDJqyWg48KuDvSyomDUBo6D2O3DgsAGOMxjGMzpRfjnuyyPQrZfCHmduVsG\nZZ3TglDAV76/32r22734xIcp3tngXA8yNa67KSJhrpODRgArNy5Lxhn26E0FYgx1\n4Z8QBi+3AgMBAAECggEAJBbzUaTtRPNkrt+erdoTjhxBVkecQFJCwDnjwbHIi+J3\nAdcg7sfRnL4jk8nVX/J8ruRn8I4glf7SfJE9sTnavLvKjs0pveocTD8oTKneQOph\nK+aMvxU1PeAaW1YZKsiupf7NwDFJXSYRztT2eKAg/CXIIDgw22fj2iPaSfsO4bPW\ntPQzGUBYPEWfirsLOIdNvBnM9yxwxhuJlL0fLkOSu3dA9YyOkdHy6LmIaVk8Sp23\n32ClHFOgY8BgJbCVticZpEivWi3PHsmF/1CAcO+chF01lMm2uK6OP2gdtj2PK7eq\n/XtWwHW9sh5fVWzP5vgwdfU0na5RU3WV/pGTDynp8QKBgQDdLCbsxiw5QkbcMOji\ndVNS/MdDnxum69Wp0s8/IiDm+3ckd6DXzn4DblYQ1wLdZ+FcDdzeatlw/hJoCgHi\nnGt+CpMbwcF8P271F9B/ZX2OHkFg5Ci3ZG4VGu/WCwoUvPmv44fETOFA+VRMzjxX\nxQarZsUgAhKG97Q7N/vLcPbPhQKBgQDc9N6SnzHzcRnH1BRZmmGkEL3W7qGMGnbg\nYdnYDkWj7Sej1faB8dyh3sG7FL3SK9XMM4JVNd3K5hAbcEv+BZ9wyyLSYikV/CI3\nIuNO6f0LR9eY3lTmBR3NmqGNKVene5fKBccTt569VcFubGNC6a3wutG7SpqJOska\nLMHh/JjBCwKBgF8eMutXWwORDlp6Kl3iKWCiV6wsTD8gY7ZydDDpo47TDO1BCYpm\nQumE1TzOy2ue1lu5loiNGVCv5AicbS0hKlV9hMDGNkkSGs0LXd68LiAlwOZDmYMt\njO5EtGqwOriqgRN03hm9Go7P68JQW8E/edvTCen3GjKzau6g6AgZX/vlAoGBAM72\nJgxcRONryuQbyDvtmQueCtNpjbO3jiW6QdxX8e8L0hdp8I3ix/BuwDPFx8828/lj\nPe8ml2rXd7rbwrJa/e8etq0s+KL5GetfKF7gWP7Z+h3cEtWpcTMGZc/dK5da8uBt\n7PyQ/4UE8DvIFmm0jBJySsUNqhZkE74KskhE26flAoGATedH2Yo08htemjewSqRG\nG01fRw0nj2/Js/ClyiIf2Z+AbIOmgyGzBB3DAqfGNBb6l+QwE7JFwfCgBHBHn62l\ndawJB8eb+sj/eNYOLSGzhl0xFp+X/irIS92ZyCLclmEYA12PGm4La7TWi43BHhBY\n0JNs7Pm3+e8Ipe2SzTwIA7M=\n-----END PRIVATE KEY-----\n",
            client_email: "firebase-adminsdk-fbsvc@school-app-notifications-c86ab.iam.gserviceaccount.com",
            client_id: "118128845168150254613",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40school-app-notifications-c86ab.iam.gserviceaccount.com"
        };

        if (!admin.default.apps.length) {
            admin.default.initializeApp({
                credential: admin.default.credential.cert(serviceAccount),
                projectId: "school-app-notifications-c86ab"
            });
        }

        console.log('✅ Firebase initialized successfully');
        console.log('📱 Project ID: school-app-notifications-c86ab');
        console.log('📧 Service Account: firebase-adminsdk-fbsvc@school-app-notifications-c86ab.iam.gserviceaccount.com');

        // Test sending a message (this will fail with fake token, but tests the service)
        const message = {
            token: 'test_token_12345',
            notification: {
                title: 'Test Notification',
                body: 'This is a test push notification!'
            }
        };

        admin.default.messaging().send(message)
            .then((response) => {
                console.log('✅ Push notification sent successfully:', response);
            })
            .catch((error) => {
                if (error.code === 'messaging/invalid-registration-token') {
                    console.log('✅ Firebase service is working (expected error for fake token)');
                    console.log('📝 Error:', error.message);
                } else {
                    console.log('❌ Unexpected error:', error.message);
                }
            });

    } catch (error) {
        console.log('❌ Error:', error.message);
    }
})();
