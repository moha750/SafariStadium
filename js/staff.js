/**
 * صفحة عرض الحجوزات للموظفين
 * عرض الحجوزات المؤكدة فقط (قراءة فقط)
 */

import supabaseClient from './supabase-client.js';
import { showToast, formatDate, formatTime, formatDateTime } from './utils.js';
import notificationManager from './notifications.js';

class StaffPage {
    constructor() {
        this.bookings = [];
        this.filters = {
            field_name: 'all',
            date: 'all'
        };
        
        this.init();
    }

    /**
     * تهيئة الصفحة
     */
    init() {
        this.setupEventListeners();
        this.loadBookings();
        
        // تحديث تلقائي كل دقيقة
        setInterval(() => {
            this.loadBookings();
        }, 60000);
    }

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        // فلتر الملعب
        const fieldFilter = document.getElementById('fieldFilter');
        if (fieldFilter) {
            fieldFilter.addEventListener('change', (e) => {
                this.filters.field_name = e.target.value;
                this.filterBookings();
            });
        }

        // فلتر التاريخ
        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.filters.date = e.target.value;
                this.filterBookings();
            });
        }

        // زر التحديث
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadBookings();
            });
        }

        // زر تفعيل الإشعارات
        const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
        if (enableNotificationsBtn) {
            enableNotificationsBtn.addEventListener('click', async () => {
                await this.enableNotifications();
            });
        }

        // زر اختبار الإشعارات
        const testNotificationBtn = document.getElementById('testNotificationBtn');
        if (testNotificationBtn) {
            testNotificationBtn.addEventListener('click', async () => {
                await this.testNotification();
            });
        }

        // زر تثبيت التطبيق
        const installAppBtn = document.getElementById('installAppBtn');
        if (installAppBtn) {
            installAppBtn.addEventListener('click', () => {
                this.installApp();
            });
        }

        // إغلاق نافذة التفاصيل
        const closeCustomerBtn = document.getElementById('closeCustomerModal');
        if (closeCustomerBtn) {
            closeCustomerBtn.addEventListener('click', () => {
                this.closeCustomerModal();
            });
        }

        // إغلاق عند النقر خارج النافذة
        const customerModal = document.getElementById('customerModal');
        if (customerModal) {
            customerModal.addEventListener('click', (e) => {
                if (e.target === customerModal) {
                    this.closeCustomerModal();
                }
            });
        }
    }

    /**
     * تحميل الحجوزات المؤكدة
     */
    async loadBookings() {
        this.showLoading();

        try {
            const result = await supabaseClient.getBookings({ status: 'approved' });
            
            if (result.success) {
                this.bookings = result.data;
                this.updateStats();
                this.filterBookings();
            } else {
                showToast('فشل في تحميل الحجوزات', 'error');
                this.showEmptyState();
            }
        } catch (error) {
            console.error('خطأ في تحميل الحجوزات:', error);
            showToast('حدث خطأ أثناء تحميل البيانات', 'error');
            this.showEmptyState();
        }
    }

    /**
     * تصفية الحجوزات
     */
    filterBookings() {
        let filtered = [...this.bookings];

        // تصفية حسب الملعب
        if (this.filters.field_name !== 'all') {
            filtered = filtered.filter(b => b.field_name === this.filters.field_name);
        }

        // تصفية حسب التاريخ
        if (this.filters.date !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (this.filters.date === 'today') {
                filtered = filtered.filter(b => {
                    const bookingDate = new Date(b.booking_date);
                    bookingDate.setHours(0, 0, 0, 0);
                    return bookingDate.getTime() === today.getTime();
                });
            } else if (this.filters.date === 'tomorrow') {
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                filtered = filtered.filter(b => {
                    const bookingDate = new Date(b.booking_date);
                    bookingDate.setHours(0, 0, 0, 0);
                    return bookingDate.getTime() === tomorrow.getTime();
                });
            } else if (this.filters.date === 'week') {
                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() + 7);
                filtered = filtered.filter(b => {
                    const bookingDate = new Date(b.booking_date);
                    return bookingDate >= today && bookingDate <= weekEnd;
                });
            }
        }

        // ترتيب حسب التاريخ والوقت
        filtered.sort((a, b) => {
            const dateCompare = new Date(a.booking_date) - new Date(b.booking_date);
            if (dateCompare !== 0) return dateCompare;
            return a.start_time.localeCompare(b.start_time);
        });

        this.renderBookings(filtered);
    }

    /**
     * تحديث الإحصائيات
     */
    updateStats() {
        const total = this.bookings.length;
        const active = this.bookings.filter(b => this.isActiveBooking(b)).length;
        const upcoming = this.bookings.filter(b => this.isUpcomingBooking(b)).length;

        document.getElementById('totalBookings').textContent = total;
        document.getElementById('activeBookings').textContent = active;
        document.getElementById('upcomingBookings').textContent = upcoming;
    }

    /**
     * التحقق من أن الحجز جاري الآن
     */
    isActiveBooking(booking) {
        const now = new Date();
        const bookingDate = new Date(booking.booking_date);
        
        if (bookingDate.toDateString() !== now.toDateString()) {
            return false;
        }
        
        const [startHour, startMinute] = booking.start_time.split(':').map(Number);
        const [endHour, endMinute] = booking.end_time.split(':').map(Number);
        
        const startTime = new Date(now);
        startTime.setHours(startHour, startMinute, 0, 0);
        
        const endTime = new Date(now);
        endTime.setHours(endHour, endMinute, 0, 0);
        
        return now >= startTime && now <= endTime;
    }

    /**
     * التحقق من أن الحجز قادم
     */
    isUpcomingBooking(booking) {
        const now = new Date();
        const bookingDate = new Date(booking.booking_date);
        
        const [startHour, startMinute] = booking.start_time.split(':').map(Number);
        const bookingDateTime = new Date(bookingDate);
        bookingDateTime.setHours(startHour, startMinute, 0, 0);
        
        return bookingDateTime > now;
    }

    /**
     * عرض مؤشر التحميل
     */
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('bookingsGrid').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
    }

    /**
     * عرض حالة فارغة
     */
    showEmptyState() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('bookingsGrid').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
    }

    /**
     * عرض الحجوزات
     */
    renderBookings(bookings) {
        const grid = document.getElementById('bookingsGrid');
        
        if (bookings.length === 0) {
            this.showEmptyState();
            return;
        }

        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('bookingsGrid').style.display = 'grid';
        document.getElementById('emptyState').style.display = 'none';

        grid.innerHTML = bookings.map(booking => this.createBookingCard(booking)).join('');

        // إضافة مستمعي الأحداث
        this.attachCardListeners();
    }

    /**
     * إنشاء كارد الحجز
     */
    createBookingCard(booking) {
        const isActive = this.isActiveBooking(booking);
        const activeClass = isActive ? 'active-booking' : '';

        return `
            <div class="booking-card-staff ${activeClass}" data-booking-id="${booking.id}">
                <div class="booking-card-header-staff">
                    <div class="booking-field-name">${booking.field_name}</div>
                    <div class="booking-time-display">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
                </div>
                <div class="booking-card-body-staff">
                    <div class="customer-info-row">
                        <div class="customer-info-icon">📅</div>
                        <div class="customer-info-content">
                            <div class="customer-info-label">التاريخ</div>
                            <div class="customer-info-value">${formatDate(booking.booking_date)}</div>
                        </div>
                    </div>
                    <div class="customer-info-row">
                        <div class="customer-info-icon">👤</div>
                        <div class="customer-info-content">
                            <div class="customer-info-label">اسم العميل</div>
                            <div class="customer-info-value">${booking.customer_name}</div>
                        </div>
                    </div>
                    <div class="customer-info-row">
                        <div class="customer-info-icon">📞</div>
                        <div class="customer-info-content">
                            <div class="customer-info-label">رقم الجوال</div>
                            <div class="customer-phone-row">
                                <div class="customer-info-value" dir="ltr">${booking.phone}</div>
                                <button class="copy-phone-btn-staff" data-phone="${booking.phone}">📋 نسخ</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="booking-card-footer-staff">
                    <button class="btn-view-customer" data-id="${booking.id}">
                        📋 عرض التفاصيل الكاملة
                    </button>
                    <button class="btn-whatsapp-staff" data-phone="${booking.phone}" data-name="${booking.customer_name}" data-field="${booking.field_name}" data-date="${booking.booking_date}" data-time="${booking.start_time}">
                        📱 واتساب
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * ربط مستمعي الأحداث للكاردات
     */
    attachCardListeners() {
        // أزرار نسخ رقم الجوال
        const copyButtons = document.querySelectorAll('.copy-phone-btn-staff');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const phone = e.target.dataset.phone;
                this.copyToClipboard(phone);
            });
        });

        // أزرار واتساب
        const whatsappButtons = document.querySelectorAll('.btn-whatsapp-staff');
        whatsappButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const phone = e.target.dataset.phone;
                const name = e.target.dataset.name;
                const field = e.target.dataset.field;
                const date = e.target.dataset.date;
                const time = e.target.dataset.time;
                this.sendWhatsApp(phone, name, field, date, time);
            });
        });

        // أزرار عرض التفاصيل
        const viewButtons = document.querySelectorAll('.btn-view-customer');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                this.showCustomerDetails(bookingId);
            });
        });
    }

    /**
     * عرض تفاصيل العميل
     */
    showCustomerDetails(bookingId) {
        const booking = this.bookings.find(b => b.id === bookingId);
        if (!booking) return;

        // منع التمرير
        document.body.classList.add('modal-open');

        const isActive = this.isActiveBooking(booking);
        const modalBody = document.getElementById('customerModalBody');
        
        modalBody.innerHTML = `
            <div class="customer-details-grid">
                <div class="customer-detail-item">
                    <div class="customer-detail-icon">⚽</div>
                    <div class="customer-detail-content">
                        <div class="customer-detail-label">الملعب</div>
                        <div class="customer-detail-value">${booking.field_name}</div>
                    </div>
                </div>
                <div class="customer-detail-item">
                    <div class="customer-detail-icon">👤</div>
                    <div class="customer-detail-content">
                        <div class="customer-detail-label">اسم العميل</div>
                        <div class="customer-detail-value">${booking.customer_name}</div>
                    </div>
                </div>
                <div class="customer-detail-item">
                    <div class="customer-detail-icon">📞</div>
                    <div class="customer-detail-content">
                        <div class="customer-detail-label">رقم الجوال</div>
                        <div class="customer-detail-value" dir="ltr">${booking.phone}</div>
                        <div class="customer-phone-actions">
                            <a href="tel:${booking.phone}" class="btn-call-customer">
                                📞 اتصال
                            </a>
                            <button class="copy-phone-btn-staff" data-phone="${booking.phone}">📋 نسخ</button>
                        </div>
                    </div>
                </div>
                <div class="customer-detail-item">
                    <div class="customer-detail-icon">📅</div>
                    <div class="customer-detail-content">
                        <div class="customer-detail-label">تاريخ الحجز</div>
                        <div class="customer-detail-value">${formatDate(booking.booking_date)}</div>
                    </div>
                </div>
                <div class="customer-detail-item">
                    <div class="customer-detail-icon">⏰</div>
                    <div class="customer-detail-content">
                        <div class="customer-detail-label">وقت الحجز</div>
                        <div class="customer-detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
                        ${isActive ? '<div style="color: var(--warning-color); font-weight: 700; margin-top: 0.5rem;">🎮 جاري الآن</div>' : ''}
                    </div>
                </div>
                <div class="customer-detail-item">
                    <div class="customer-detail-icon">📄</div>
                    <div class="customer-detail-content">
                        <div class="customer-detail-label">تاريخ الطلب</div>
                        <div class="customer-detail-value">${formatDateTime(booking.created_at)}</div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('customerModal').classList.add('active');
        
        // إعادة ربط أزرار النسخ
        setTimeout(() => this.attachCardListeners(), 100);
    }

    /**
     * إغلاق نافذة التفاصيل
     */
    closeCustomerModal() {
        document.getElementById('customerModal').classList.remove('active');
        // السماح بالتمرير مرة أخرى
        document.body.classList.remove('modal-open');
    }

// أزرار عرض التفاصيل
const viewButtons = document.querySelectorAll('.btn-view-customer');
viewButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const bookingId = e.target.dataset.id;
        this.showCustomerDetails(bookingId);
    });
});
}

/**
 * عرض تفاصيل العميل
 */
showCustomerDetails(bookingId) {
const booking = this.bookings.find(b => b.id === bookingId);
if (!booking) return;

// منع التمرير
document.body.classList.add('modal-open');

const isActive = this.isActiveBooking(booking);
const modalBody = document.getElementById('customerModalBody');
        
modalBody.innerHTML = `
    <div class="customer-details-grid">
        <div class="customer-detail-item">
            <div class="customer-detail-icon">⚽</div>
            <div class="customer-detail-content">
                <div class="customer-detail-label">الملعب</div>
                <div class="customer-detail-value">${booking.field_name}</div>
            </div>
        </div>
        <div class="customer-detail-item">
            <div class="customer-detail-icon">👤</div>
            <div class="customer-detail-content">
                <div class="customer-detail-label">اسم العميل</div>
                <div class="customer-detail-value">${booking.customer_name}</div>
            </div>
        </div>
        <div class="customer-detail-item">
            <div class="customer-detail-icon">📞</div>
            <div class="customer-detail-content">
                <div class="customer-detail-label">رقم الجوال</div>
                <div class="customer-detail-value" dir="ltr">${booking.phone}</div>
                <div class="customer-phone-actions">
                    <a href="tel:${booking.phone}" class="btn-call-customer">
                        📞 اتصال
                    </a>
                    <button class="copy-phone-btn-staff" data-phone="${booking.phone}">📋 نسخ</button>
                </div>
            </div>
        </div>
        <div class="customer-detail-item">
            <div class="customer-detail-icon">📅</div>
            <div class="customer-detail-content">
                <div class="customer-detail-label">تاريخ الحجز</div>
                <div class="customer-detail-value">${formatDate(booking.booking_date)}</div>
            </div>
        </div>
        <div class="customer-detail-item">
            <div class="customer-detail-icon">⏰</div>
            <div class="customer-detail-content">
                <div class="customer-detail-label">وقت الحجز</div>
                <div class="customer-detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
                ${isActive ? '<div style="color: var(--warning-color); font-weight: 700; margin-top: 0.5rem;">🎮 جاري الآن</div>' : ''}
            </div>
        </div>
        <div class="customer-detail-item">
            <div class="customer-detail-icon">📄</div>
            <div class="customer-detail-content">
                <div class="customer-detail-label">تاريخ الطلب</div>
                <div class="customer-detail-value">${formatDateTime(booking.created_at)}</div>
            </div>
        </div>
    </div>
`;

document.getElementById('customerModal').classList.add('active');
        
// إعادة ربط أزرار النسخ
setTimeout(() => this.attachCardListeners(), 100);
}

/**
 * إغلاق نافذة التفاصيل
 */
closeCustomerModal() {
document.getElementById('customerModal').classList.remove('active');
// السماح بالتمرير مرة أخرى
document.body.classList.remove('modal-open');
}

/**
 * تفعيل الإشعارات
 */
async enableNotifications() {
try {
    // التحقق من دعم الإشعارات
    if (!notificationManager.isSupported()) {
        showToast('⚠️ الإشعارات غير مدعومة في هذا المتصفح. استخدم Chrome على Android أو Safari على iOS', 'error');
        return;
    }

    // التحقق من HTTPS
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        showToast('⚠️ الإشعارات تتطلب HTTPS. يرجى استخدام رابط آمن (https://)', 'error');
        return;
    }

    const hasPermission = await notificationManager.requestPermission();
            
    if (hasPermission) {
        const subscription = await notificationManager.subscribe();
                
        if (subscription) {
            showToast('✅ تم تفعيل الإشعارات بنجاح! ستصلك إشعارات عند وجود حجوزات جديدة', 'success');
                    
            // تحديث نص الزر
            const btn = document.getElementById('enableNotificationsBtn');
            if (btn) {
                btn.innerHTML = '🔔 الإشعارات مفعلة';
                btn.disabled = true;
            }
        } else {
            showToast('❌ فشل في الاشتراك. تحقق من Console للتفاصيل', 'error');
        }
    } else {
        showToast('⚠️ يرجى السماح بالإشعارات من إعدادات المتصفح', 'error');
    }
} catch (error) {
    console.error('خطأ في تفعيل الإشعارات:', error);
    showToast(`❌ خطأ: ${error.message}`, 'error');
}
}

/**
 * اختبار الإشعارات
 */
async testNotification() {
const results = [];
    async testNotification() {
        const results = [];
        
        try {
            if (!notificationManager.isSupported()) {
                results.push('❌ الإشعارات غير مدعومة في هذا المتصفح');
                this.showTestResults(results);
                return;
            }
            results.push('✅ الإشعارات مدعومة في المتصفح');
            
            const permission = Notification.permission;
            results.push(`📋 حالة الإذن: ${permission}`);
            
            if (permission === 'denied') {
                results.push('❌ الإذن مرفوض - يجب السماح من إعدادات المتصفح');
                this.showTestResults(results);
                return;
            }
            
            if (permission === 'default') {
                results.push('⚠️ لم يتم طلب الإذن بعد - اضغط "تفعيل الإشعارات" أولاً');
                this.showTestResults(results);
                return;
            }
            
            results.push('✅ الإذن ممنوح');
            
            if ('serviceWorker' in navigator) {
                await navigator.serviceWorker.ready;
                results.push('✅ Service Worker جاهز');
            }
            
            results.push('🧪 جاري إرسال إشعار تجريبي...');
            
            await notificationManager.sendLocalNotification('🧪 اختبار الإشعارات', {
                body: 'إذا رأيت هذا الإشعار، فالنظام يعمل بشكل صحيح! ✅',
                tag: 'test-notification'
            });
            
            results.push('✅ تم إرسال الإشعار التجريبي!');
            results.push('');
            results.push('📱 للاختبار على الجوال:');
            results.push('1. ثبّت التطبيق');
            results.push('2. أغلق التطبيق تماماً');
            results.push('3. أقفل الشاشة');
            results.push('4. من جهاز آخر، وافق على حجز');
            results.push('5. يجب أن يصل إشعار في قفل الشاشة!');
            
        } catch (error) {
            results.push(`❌ خطأ: ${error.message}`);
            console.error('Test error:', error);
        }
        
        this.showTestResults(results);
    }

    showTestResults(results) {
        const message = results.join('\n');
        console.log('🧪 نتائج الاختبار:\n' + message);
        alert('🧪 نتائج اختبار الإشعارات:\n\n' + message);
        showToast('تم إجراء الاختبار - راجع التفاصيل', 'success');
    }

    /**
     * تثبيت التطبيق كـ PWA
     */
    installApp() {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            window.deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    showToast('تم تثبيت التطبيق بنجاح!', 'success');
                }
                window.deferredPrompt = null;
            });
        } else {
            showToast('التطبيق مثبت بالفعل أو غير متاح للتثبيت', 'error');
        }
    }

    /**
     * إرسال رسالة واتساب
     */
    sendWhatsApp(phone, name, field, date, time) {
        const message = `مرحباً ${name}،\n\nتأكيد حجزك في ملاعب سفاري:\n📍 الملعب: ${field}\n📅 التاريخ: ${date}\n⏰ الوقت: ${time}\n\nنتمنى لك تجربة ممتعة! ⚽`;
        const whatsappUrl = `https://wa.me/${phone.replace(/^0/, '966')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }

    /**
     * نسخ رقم الجوال
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('تم نسخ رقم الجوال بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في النسخ:', error);
            showToast('فشل في نسخ رقم الجوال', 'error');
        }
    }
}

// تهيئة الصفحة عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    new StaffPage();
});
