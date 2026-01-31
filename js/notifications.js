/**
 * نظام الإشعارات Push Notifications
 * إدارة الاشتراك في الإشعارات وإرسالها
 */

import supabaseClient from './supabase-client.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

class NotificationManager {
    constructor() {
        this.vapidPublicKey = 'BFuiqLBPt6Lm_6CkcBezBzB0viKMNxAum49UkN9xEAdjrbsPmFboGI7DGGZ-bLPfUXMQNS8OhwqB5PtSpdq5PrU'; // سيتم تحديثه لاحقاً
        this.subscription = null;
    }

    /**
     * التحقق من دعم الإشعارات
     */
    isSupported() {
        return 'serviceWorker' in navigator && 
               'PushManager' in window && 
               'Notification' in window;
    }

    /**
     * طلب إذن الإشعارات
     */
    async requestPermission() {
        if (!this.isSupported()) {
            console.log('الإشعارات غير مدعومة في هذا المتصفح');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('خطأ في طلب إذن الإشعارات:', error);
            return false;
        }
    }

    /**
     * الاشتراك في الإشعارات
     */
    async subscribe() {
        if (!this.isSupported()) {
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // التحقق من وجود اشتراك سابق
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // إنشاء اشتراك جديد
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
                });
            }

            this.subscription = subscription;
            
            // حفظ الاشتراك في قاعدة البيانات
            await this.saveSubscription(subscription);
            
            return subscription;
        } catch (error) {
            console.error('خطأ في الاشتراك:', error);
            return null;
        }
    }

    /**
     * إلغاء الاشتراك
     */
    async unsubscribe() {
        if (!this.subscription) {
            return true;
        }

        try {
            await this.subscription.unsubscribe();
            
            // حذف الاشتراك من قاعدة البيانات
            await this.removeSubscription(this.subscription);
            
            this.subscription = null;
            return true;
        } catch (error) {
            console.error('خطأ في إلغاء الاشتراك:', error);
            return false;
        }
    }

    /**
     * حفظ الاشتراك في قاعدة البيانات
     */
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
                console.log('تم حفظ الاشتراك في Supabase بنجاح');
                // حفظ في localStorage كنسخة احتياطية
                localStorage.setItem('push_subscription', JSON.stringify(subscriptionData));
            } else {
                const error = await response.json();
                console.error('خطأ في حفظ الاشتراك:', error);
            }
        } catch (error) {
            console.error('خطأ في حفظ الاشتراك:', error);
        }
    }

    /**
     * حذف الاشتراك من قاعدة البيانات
     */
    async removeSubscription(subscription) {
        try {
            localStorage.removeItem('push_subscription');
            console.log('تم حذف الاشتراك بنجاح');
        } catch (error) {
            console.error('خطأ في حذف الاشتراك:', error);
        }
    }

    /**
     * تحديد نوع المستخدم
     */
    getUserType() {
        const path = window.location.pathname;
        if (path.includes('admin')) return 'admin';
        if (path.includes('staff')) return 'staff';
        return 'customer';
    }

    /**
     * إرسال إشعار محلي (للاختبار)
     */
    async sendLocalNotification(title, options = {}) {
        if (!this.isSupported()) {
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return;
        }

        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
            body: options.body || '',
            icon: options.icon || '/icon-192.png',
            badge: '/badge-72.png',
            vibrate: [200, 100, 200],
            tag: options.tag || 'local-notification',
            requireInteraction: options.requireInteraction || false,
            data: options.data || {}
        });
    }

    /**
     * تحويل VAPID key من Base64 إلى Uint8Array
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * إشعار بحجز جديد (للمدير)
     */
    async notifyNewBooking(bookingData) {
        await this.sendLocalNotification('حجز جديد! 📋', {
            body: `حجز جديد من ${bookingData.customer_name} للملعب ${bookingData.field_name}`,
            tag: 'new-booking',
            requireInteraction: true,
            data: {
                url: '/admin.html',
                bookingId: bookingData.id
            }
        });
    }

    /**
     * إشعار ببدء فترة اللعب (للموظف)
     */
    async notifyGameStarting(bookingData) {
        await this.sendLocalNotification('بدء فترة اللعب! ⚽', {
            body: `${bookingData.customer_name} - ${bookingData.field_name} - ${bookingData.start_time}`,
            tag: 'game-starting',
            requireInteraction: true,
            data: {
                url: '/staff.html',
                bookingId: bookingData.id
            }
        });
    }

    /**
     * إشعار بالموافقة على الحجز (للعميل)
     */
    async notifyBookingApproved(bookingData) {
        await this.sendLocalNotification('تم تأكيد حجزك! ✅', {
            body: `تم تأكيد حجزك في ${bookingData.field_name} يوم ${bookingData.booking_date}`,
            tag: 'booking-approved',
            data: {
                url: '/index.html',
                bookingId: bookingData.id
            }
        });
    }

    /**
     * جدولة إشعار قبل بدء اللعب
     */
    scheduleGameReminder(bookingData) {
        const bookingDateTime = new Date(`${bookingData.booking_date}T${bookingData.start_time}`);
        const reminderTime = new Date(bookingDateTime.getTime() - 30 * 60000); // 30 دقيقة قبل
        const now = new Date();

        if (reminderTime > now) {
            const delay = reminderTime.getTime() - now.getTime();
            setTimeout(() => {
                this.notifyGameStarting(bookingData);
            }, delay);
        }
    }
}

// تصدير نسخة واحدة
export default new NotificationManager();
