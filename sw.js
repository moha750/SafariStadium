// Service Worker للتخزين المؤقت والإشعارات
const CACHE_NAME = 'safari-stadium-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/staff.html',
  '/login.html',
  '/css/style.css',
  '/css/admin.css',
  '/css/staff.css',
  '/css/login.css',
  '/js/app.js',
  '/js/admin.js',
  '/js/staff.js',
  '/js/login.js',
  '/js/supabase-client.js',
  '/js/utils.js',
  '/js/config.js'
];

// معالجة الإشعارات Push
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'ملاعب سفاري';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: data.icon || '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'safari-stadium-notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// معالجة النقر على الإشعار
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/admin.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // البحث عن نافذة مفتوحة
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // فتح نافذة جديدة
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// تثبيت Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('فتح التخزين المؤقت');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'})));
      })
      .catch(err => {
        console.log('خطأ في التخزين المؤقت:', err);
      })
  );
  self.skipWaiting();
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('حذف التخزين المؤقت القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// اعتراض الطلبات
self.addEventListener('fetch', event => {
  // تجاهل الطلبات من chrome-extension و devtools
  if (event.request.url.startsWith('chrome-extension://') || 
      event.request.url.startsWith('devtools://')) {
    return;
  }

  // تجاهل الطلبات غير HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إرجاع من التخزين المؤقت إذا وجد
        if (response) {
          return response;
        }

        // محاولة جلب من الشبكة
        return fetch(event.request).then(response => {
          // التحقق من صحة الاستجابة
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // نسخ الاستجابة
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => {
              console.log('خطأ في حفظ التخزين المؤقت:', err);
            });

          return response;
        }).catch(() => {
          // إرجاع صفحة offline إذا فشل الاتصال
          return caches.match('/index.html');
        });
      })
  );
});
