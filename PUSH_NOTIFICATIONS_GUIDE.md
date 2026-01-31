# 📱 دليل تفعيل الإشعارات الحقيقية (Push Notifications)

## ⚠️ الوضع الحالي
الإشعارات الحالية هي **إشعارات محلية** تعمل فقط عند فتح التطبيق.

## ✅ لتفعيل الإشعارات الحقيقية (في قفل الشاشة)

### 1. إنشاء مفاتيح VAPID

```bash
# تثبيت web-push
npm install -g web-push

# توليد مفاتيح VAPID
web-push generate-vapid-keys
```

سيعطيك:
- **Public Key**: ضعه في `js/notifications.js` في متغير `vapidPublicKey`
- **Private Key**: احفظه في Backend Server (لا تشاركه أبدًا)

### 2. تحديث js/notifications.js

```javascript
class NotificationManager {
    constructor() {
        // ضع المفتاح العام هنا
        this.vapidPublicKey = 'YOUR_ACTUAL_VAPID_PUBLIC_KEY_HERE';
        this.subscription = null;
    }
    // ... باقي الكود
}
```

### 3. إنشاء Backend Server (Node.js مثال)

```javascript
const webpush = require('web-push');
const express = require('express');
const app = express();

// إعداد VAPID
webpush.setVapidDetails(
  'mailto:your-email@example.com',
  'YOUR_PUBLIC_VAPID_KEY',
  'YOUR_PRIVATE_VAPID_KEY'
);

// حفظ الاشتراكات
const subscriptions = [];

// استقبال اشتراك جديد
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({});
});

// إرسال إشعار
app.post('/api/send-notification', (req, res) => {
  const notificationPayload = {
    title: req.body.title,
    body: req.body.body,
    icon: '/icon-192.png',
    data: req.body.data
  };

  const promises = subscriptions.map(subscription =>
    webpush.sendNotification(subscription, JSON.stringify(notificationPayload))
  );

  Promise.all(promises)
    .then(() => res.status(200).json({ message: 'Notifications sent' }))
    .catch(err => res.status(500).json({ error: err.message }));
});

app.listen(3000);
```

### 4. تحديث Supabase لحفظ الاشتراكات

#### إنشاء جدول push_subscriptions:

```sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### تحديث js/notifications.js:

```javascript
async saveSubscription(subscription) {
    try {
        const keys = subscription.toJSON().keys;
        const subscriptionData = {
            endpoint: subscription.endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            user_type: this.getUserType()
        };

        // حفظ في Supabase
        const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(subscriptionData)
        });

        if (response.ok) {
            console.log('تم حفظ الاشتراك في قاعدة البيانات');
        }
    } catch (error) {
        console.error('خطأ في حفظ الاشتراك:', error);
    }
}
```

### 5. إرسال الإشعارات من Backend

عند الموافقة على حجز، استدعي Backend API:

```javascript
async function sendPushNotification(bookingData) {
    await fetch('https://your-backend.com/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: 'حجز جديد!',
            body: `حجز من ${bookingData.customer_name}`,
            data: { bookingId: bookingData.id }
        })
    });
}
```

### 6. استخدام Firebase Cloud Messaging (البديل الأسهل)

#### الخطوات:
1. إنشاء مشروع في [Firebase Console](https://console.firebase.google.com)
2. تفعيل Cloud Messaging
3. الحصول على Server Key
4. استخدام Firebase SDK

```javascript
// في HTML
<script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging.js"></script>

// في JavaScript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  projectId: "YOUR_PROJECT_ID",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// طلب الإذن
messaging.requestPermission()
  .then(() => messaging.getToken())
  .then(token => {
    // حفظ token في قاعدة البيانات
    console.log('FCM Token:', token);
  });

// استقبال الإشعارات
messaging.onMessage(payload => {
  console.log('Notification received:', payload);
});
```

## 📊 الدعم حسب المنصة

| المنصة | PWA Push | ملاحظات |
|--------|----------|---------|
| **Android Chrome** | ✅ نعم | يحتاج VAPID/FCM |
| **Android Firefox** | ✅ نعم | يحتاج VAPID/FCM |
| **iOS Safari** | ❌ لا | غير مدعوم نهائيًا |
| **iOS Chrome** | ❌ لا | يستخدم Safari engine |
| **Desktop Chrome** | ✅ نعم | يعمل بشكل ممتاز |
| **Desktop Firefox** | ✅ نعم | يعمل بشكل ممتاز |

## 🎯 التوصية النهائية

### للاستخدام الفوري (بدون Backend):
- ✅ الإشعارات المحلية الحالية تعمل عند فتح التطبيق
- ✅ مناسبة للموظفين الذين يفتحون التطبيق بانتظام

### للإشعارات الحقيقية (في قفل الشاشة):
1. **Android فقط**: استخدم Firebase Cloud Messaging
2. **iOS**: يجب تطوير تطبيق أصلي (Swift/React Native/Flutter)

### الحل الهجين الأفضل:
- **PWA للويب وAndroid** (مع FCM)
- **Native App لـ iOS** (من App Store)
- مشاركة نفس قاعدة البيانات (Supabase)

## 📞 هل تريد المساعدة؟

إذا كنت تريد تفعيل الإشعارات الحقيقية:
1. أخبرني إذا كنت تريد استخدام Firebase أو VAPID
2. سأساعدك في إعداد Backend Server
3. سأحدث الكود ليدعم الإشعارات الحقيقية

**الخلاصة:** الكود الحالي جيد للبداية، لكن للإشعارات في قفل الشاشة تحتاج Backend Server + Firebase/VAPID.
