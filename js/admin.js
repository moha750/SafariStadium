/**
 * لوحة التحكم الإدارية
 * إدارة الحجوزات والموافقة/الرفض
 */

import supabaseClient from './supabase-client.js';
import { showToast, formatDate, formatTime, formatDateTime, formatTimeAmPmStrict } from './utils.js';
import notificationManager from './notifications.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

class AdminDashboard {
    constructor() {
        this.bookings = [];
        this.filters = {
            status: 'all',
            field_name: 'all'
        };
        this.currentTab = 'all';
        
        this.init();
    }

    /**
     * تهيئة لوحة التحكم
     */
    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.loadBookings();
    }

    /**
     * التحقق من تسجيل الدخول
     */
    checkAuth() {
        const isLoggedIn = localStorage.getItem('adminLoggedIn');
        if (isLoggedIn !== 'true') {
            window.location.href = 'login.html';
            return;
        }
    }

    /**
     * تسجيل الخروج
     */
    logout() {
        localStorage.removeItem('adminLoggedIn');
        window.location.href = 'login.html';
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

        // زر التحديث
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadBookings();
            });
        }

        // زر تسجيل الخروج
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                    this.logout();
                }
            });
        }

        // زر نسخ رابط staff
        const copyStaffLinkBtn = document.getElementById('copyStaffLinkBtn');
        if (copyStaffLinkBtn) {
            copyStaffLinkBtn.addEventListener('click', () => {
                this.copyStaffLink();
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

        // زر فتح صفحة الحجوزات
        const openStaffPageBtn = document.getElementById('openStaffPageBtn');
        if (openStaffPageBtn) {
            openStaffPageBtn.addEventListener('click', () => {
                window.open('staff.html', '_blank');
            });
        }

        // زر تثبيت التطبيق
        const installAppBtn = document.getElementById('installAppBtn');
        if (installAppBtn) {
            installAppBtn.addEventListener('click', () => {
                this.installApp();
            });
        }

        // التبويبات
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    /**
     * معالجة تسجيل الخروج
     */
    handleLogout() {
        sessionStorage.removeItem('isLoggedIn');
        window.location.href = 'login.html';
    }

    /**
     * نسخ رابط صفحة staff
     */
    async copyStaffLink() {
        try {
            const staffUrl = window.location.origin + window.location.pathname.replace('admin.html', 'staff.html');
            await navigator.clipboard.writeText(staffUrl);
            showToast('تم نسخ رابط صفحة الحجوزات بنجاح', 'success');
        } catch (error) {
            console.error('خطأ في النسخ:', error);
            showToast('فشل في نسخ الرابط', 'error');
        }
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
     * اختبار الإشعارات - يعرض معلومات تفصيلية للتشخيص
     */
    async testNotification() {
        const results = [];
        
        try {
            // 1. التحقق من دعم الإشعارات
            if (!notificationManager.isSupported()) {
                results.push('❌ الإشعارات غير مدعومة في هذا المتصفح');
                this.showTestResults(results);
                return;
            }
            results.push('✅ الإشعارات مدعومة في المتصفح');
            
            // 2. التحقق من الإذن
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
            
            // 3. التحقق من Service Worker
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                results.push('✅ Service Worker جاهز');
                results.push(`📋 Scope: ${registration.scope}`);
            } else {
                results.push('❌ Service Worker غير مدعوم');
            }
            
            // 4. التحقق من الاشتراك
            const subscription = localStorage.getItem('push_subscription');
            if (subscription) {
                results.push('✅ الاشتراك محفوظ في localStorage');
                const subData = JSON.parse(subscription);
                results.push(`📋 Endpoint: ${subData.endpoint.substring(0, 50)}...`);
            } else {
                results.push('⚠️ لا يوجد اشتراك محفوظ');
            }
            
            // 5. إرسال إشعار تجريبي
            results.push('🧪 جاري إرسال إشعار تجريبي...');
            
            await notificationManager.sendLocalNotification('🧪 اختبار الإشعارات', {
                body: 'إذا رأيت هذا الإشعار، فالنظام يعمل بشكل صحيح! ✅',
                tag: 'test-notification',
                requireInteraction: false,
                data: { test: true }
            });
            
            results.push('✅ تم إرسال الإشعار التجريبي بنجاح!');
            results.push('');
            results.push('📱 للاختبار على الجوال:');
            results.push('1. ثبّت التطبيق (📱 تثبيت التطبيق)');
            results.push('2. أغلق التطبيق تماماً');
            results.push('3. أقفل الشاشة');
            results.push('4. من جهاز آخر، وافق على حجز');
            results.push('5. يجب أن يصل إشعار في قفل الشاشة!');
            
        } catch (error) {
            results.push(`❌ خطأ: ${error.message}`);
            console.error('Test notification error:', error);
        }
        
        this.showTestResults(results);
    }

    /**
     * عرض نتائج اختبار الإشعارات
     */
    showTestResults(results) {
        const message = results.join('\n');
        
        // عرض في console
        console.log('🧪 نتائج اختبار الإشعارات:\n' + message);
        
        // عرض في alert للجوال
        alert('🧪 نتائج اختبار الإشعارات:\n\n' + message);
        
        // عرض toast
        showToast('تم إجراء الاختبار - راجع التفاصيل في النافذة المنبثقة', 'success');
    }

    /**
     * تثبيت التطبيق كـ PWA
     */
    installApp() {
        // التحقق من وجود حدث التثبيت
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
     * إرسال إشعار Push عبر Supabase Edge Function
     */
    async sendPushNotification(bookingData, userType = 'staff') {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/send-push-notification`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: 'حجز جديد! 📋',
                        body: `حجز من ${bookingData.customer_name} للملعب ${bookingData.field_name}`,
                        icon: '/icon-192.png',
                        userType: userType,
                        data: {
                            bookingId: bookingData.id,
                            url: '/staff.html'
                        }
                    })
                }
            );
            
            if (response.ok) {
                const result = await response.json();
                console.log('تم إرسال الإشعارات:', result);
            }
        } catch (error) {
            console.error('خطأ في إرسال الإشعارات:', error);
        }
    }

    /**
     * تحميل الحجوزات من قاعدة البيانات
     */
    async loadBookings() {
        this.showLoading();

        try {
            const result = await supabaseClient.getBookings();
            
            if (result.success) {
                this.bookings = result.data;
                this.updateStats();
                this.renderBookings(this.bookings);
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
     * التبديل بين التبويبات
     */
    switchTab(tab) {
        this.currentTab = tab;
        
        // تحديث أزرار التبويبات
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // تطبيق التصفية
        this.filterBookings();
    }

    /**
     * تصفية الحجوزات
     */
    filterBookings() {
        let filtered = [...this.bookings];

        // تصفية حسب التبويب
        if (this.currentTab === 'pending') {
            filtered = filtered.filter(b => b.status === 'pending');
        } else if (this.currentTab === 'approved') {
            filtered = filtered.filter(b => b.status === 'approved' && !this.isActiveBooking(b));
        } else if (this.currentTab === 'rejected') {
            filtered = filtered.filter(b => b.status === 'rejected');
        } else if (this.currentTab === 'active') {
            filtered = filtered.filter(b => b.status === 'approved' && this.isActiveBooking(b));
        }

        // تصفية حسب الملعب
        if (this.filters.field_name !== 'all') {
            filtered = filtered.filter(b => b.field_name === this.filters.field_name);
        }

        this.renderBookings(filtered);
    }

    /**
     * التحقق من أن الحجز جاري (في وقت اللعب الحالي)
     */
    isActiveBooking(booking) {
        if (booking.status !== 'approved') return false;
        
        const now = new Date();
        const bookingDate = new Date(booking.booking_date);
        
        // التحقق من أن التاريخ هو اليوم
        if (bookingDate.toDateString() !== now.toDateString()) {
            return false;
        }
        
        // التحقق من أن الوقت الحالي بين وقت البداية والنهاية
        const [startHour, startMinute] = booking.start_time.split(':').map(Number);
        const [endHour, endMinute] = booking.end_time.split(':').map(Number);
        
        const startTime = new Date(now);
        startTime.setHours(startHour, startMinute, 0, 0);
        
        const endTime = new Date(now);
        endTime.setHours(endHour, endMinute, 0, 0);
        
        return now >= startTime && now <= endTime;
    }

    /**
     * تحديث الإحصائيات
     */
    updateStats() {
        const pending = this.bookings.filter(b => b.status === 'pending').length;
        const approved = this.bookings.filter(b => b.status === 'approved').length;
        const rejected = this.bookings.filter(b => b.status === 'rejected').length;
        const active = this.bookings.filter(b => this.isActiveBooking(b)).length;
        const total = this.bookings.length;

        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('approvedCount').textContent = approved;
        document.getElementById('rejectedCount').textContent = rejected;
        document.getElementById('totalCount').textContent = total;
        
        // تحديث عدادات التبويبات
        document.getElementById('allCount').textContent = total;
        document.getElementById('pendingTabCount').textContent = pending;
        document.getElementById('approvedTabCount').textContent = approved - active;
        document.getElementById('rejectedTabCount').textContent = rejected;
        document.getElementById('activeTabCount').textContent = active;
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
     * عرض الحجوزات في الكاردات
     * @param {Array} bookings - قائمة الحجوزات
     */
    renderBookings(bookings) {
        const grid = document.getElementById('bookingsGrid');
        const filterBar = document.querySelector('.bookings-filter-bar');
        
        if (bookings.length === 0) {
            this.showEmptyState();
            if (filterBar) filterBar.style.display = 'none';
            return;
        }

        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('bookingsGrid').style.display = 'grid';
        document.getElementById('emptyState').style.display = 'none';
        if (filterBar) filterBar.style.display = 'flex';

        grid.innerHTML = bookings.map(booking => this.createBookingCard(booking)).join('');

        // إضافة مستمعي الأحداث لأزرار الإجراعات
        this.attachActionListeners();
    }

    /**
     * إنشاء كارد للحجز
     * @param {Object} booking - بيانات الحجز
     * @returns {string} - HTML للكارد
     */
    createBookingCard(booking) {
        const statusClass = `status-${booking.status}`;
        const statusText = this.getStatusText(booking.status);
        const actionButtons = this.getActionButtons(booking);
        const isActive = this.isActiveBooking(booking);

        return `
            <div class="booking-card" data-booking-id="${booking.id}">
                <div class="booking-card-header">
                    <span class="booking-card-field">${booking.field_name}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="booking-card-body">
                    <div class="booking-info-row">
                        <div class="booking-info-icon">👤</div>
                        <div class="booking-info-content">
                            <div class="booking-info-label">العميل</div>
                            <div class="booking-info-value">${booking.customer_name}</div>
                        </div>
                    </div>
                    <div class="booking-info-row">
                        <div class="booking-info-icon">📞</div>
                        <div class="booking-info-content">
                            <div class="booking-info-label">رقم الجوال</div>
                            <div class="booking-phone-row">
                                <div class="booking-info-value" dir="ltr">${booking.phone}</div>
                                <button class="copy-phone-btn" data-phone="${booking.phone}">📋 نسخ</button>
                            </div>
                        </div>
                    </div>
                    <div class="booking-info-row">
                        <div class="booking-info-icon">📅</div>
                        <div class="booking-info-content">
                            <div class="booking-info-label">التاريخ والوقت</div>
                            <div class="booking-info-value">${formatDate(booking.booking_date)}</div>
                            <div class="booking-info-value">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
                        </div>
                    </div>
                    ${isActive ? '<div class="booking-info-row"><div class="booking-info-icon">🎮</div><div class="booking-info-content"><div class="booking-info-value" style="color: var(--success-color);">جاري الآن</div></div></div>' : ''}
                </div>
                <div class="booking-card-footer">
                    <button class="btn btn-details view-details-btn" data-id="${booking.id}">
                        🔍 عرض التفاصيل
                    </button>
                    ${actionButtons}
                </div>
            </div>
        `;
    }

    /**
     * الحصول على نص الحالة بالعربية
     * @param {string} status - الحالة
     * @returns {string} - النص بالعربية
     */
    getStatusText(status) {
        const statusMap = {
            'pending': 'قيد الانتظار',
            'approved': 'مؤكدة',
            'rejected': 'مرفوضة'
        };
        return statusMap[status] || status;
    }

    /**
     * الحصول على أزرار الإجراءات حسب الحالة
     * @param {Object} booking - بيانات الحجز
     * @returns {string} - HTML للأزرار
     */
    getActionButtons(booking) {
        const whatsappBtn = `
            <button class="btn btn-secondary whatsapp-btn" data-phone="${booking.phone}" data-name="${booking.customer_name}" data-field="${booking.field_name}" data-date="${booking.booking_date}" data-time="${booking.start_time}">
                📱 واتساب
            </button>
        `;
        
        if (booking.status === 'pending') {
            return `
                <button class="btn btn-success approve-btn" data-id="${booking.id}">
                    ✓ موافقة
                </button>
                <button class="btn btn-danger reject-btn" data-id="${booking.id}">
                    ✗ رفض
                </button>
                ${whatsappBtn}
            `;
        } else if (booking.status === 'approved') {
            return `
                <button class="btn btn-danger reject-btn" data-id="${booking.id}">
                    ✗ إلغاء
                </button>
                ${whatsappBtn}
            `;
        } else {
            return `
                <button class="btn btn-success approve-btn" data-id="${booking.id}">
                    ✓ موافقة
                </button>
                ${whatsappBtn}
            `;
        }
    }

    /**
     * ربط مستمعي الأحداث لأزرار الإجراءات
     */
    attachActionListeners() {
        // أزرار الموافقة
        const approveButtons = document.querySelectorAll('.approve-btn');
        approveButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                this.handleApprove(bookingId);
            });
        });

        // أزرار الرفض
        const rejectButtons = document.querySelectorAll('.reject-btn');
        rejectButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                this.handleReject(bookingId);
            });
        });

        // أزرار واتساب
        const whatsappButtons = document.querySelectorAll('.whatsapp-btn');
        whatsappButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const phone = e.target.dataset.phone;
                const name = e.target.dataset.name;
                const field = e.target.dataset.field;
                const date = e.target.dataset.date;
                const time = e.target.dataset.time;
                this.sendWhatsApp(phone, name, field, date, time);
            });
        });

        // أزرار عرض التفاصيل
        const detailsButtons = document.querySelectorAll('.view-details-btn');
        detailsButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bookingId = e.target.dataset.id;
                this.showBookingDetails(bookingId);
            });
        });

        // أزرار نسخ رقم الجوال
        const copyButtons = document.querySelectorAll('.copy-phone-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const phone = e.target.dataset.phone;
                this.copyToClipboard(phone);
            });
        });

        // إغلاق نافذة التفاصيل
        const closeDetailsBtn = document.getElementById('closeDetailsModal');
        if (closeDetailsBtn) {
            closeDetailsBtn.addEventListener('click', () => {
                this.closeDetailsModal();
            });
        }

        // إغلاق عند النقر خارج النافذة
        const detailsModal = document.getElementById('detailsModal');
        if (detailsModal) {
            detailsModal.addEventListener('click', (e) => {
                if (e.target === detailsModal) {
                    this.closeDetailsModal();
                }
            });
        }
    }

    /**
     * عرض تفاصيل الحجز
     */
    showBookingDetails(bookingId) {
        const booking = this.bookings.find(b => b.id === bookingId);
        if (!booking) return;

        const statusClass = `status-${booking.status}`;
        const statusText = this.getStatusText(booking.status);
        const isActive = this.isActiveBooking(booking);
        const actionButtons = this.getActionButtons(booking);

        // منع التمرير
        document.body.classList.add('modal-open');

        const modalBody = document.getElementById('detailsModalBody');
        modalBody.innerHTML = `
            <div class="details-grid">
                <div class="detail-item">
                    <div class="detail-icon">⚽</div>
                    <div class="detail-content">
                        <div class="detail-label">الملعب</div>
                        <div class="detail-value">${booking.field_name}</div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-icon">👤</div>
                    <div class="detail-content">
                        <div class="detail-label">اسم العميل</div>
                        <div class="detail-value">${booking.customer_name}</div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-icon">📞</div>
                    <div class="detail-content">
                        <div class="detail-label">رقم الجوال</div>
                        <div class="detail-phone">
                            <div class="detail-value" dir="ltr">${booking.phone}</div>
                            <button class="copy-phone-btn" data-phone="${booking.phone}">📋 نسخ</button>
                        </div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-icon">📅</div>
                    <div class="detail-content">
                        <div class="detail-label">تاريخ الحجز</div>
                        <div class="detail-value">${formatDate(booking.booking_date)}</div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-icon">⏰</div>
                    <div class="detail-content">
                        <div class="detail-label">وقت الحجز</div>
                        <div class="detail-value">${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-icon">📊</div>
                    <div class="detail-content">
                        <div class="detail-label">الحالة</div>
                        <div class="detail-value">
                            <span class="status-badge ${statusClass}">${statusText}</span>
                            ${isActive ? '<span style="color: var(--success-color); margin-right: 0.5rem;">• جاري الآن</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-icon">📄</div>
                    <div class="detail-content">
                        <div class="detail-label">تاريخ الطلب</div>
                        <div class="detail-value">${formatDateTime(booking.created_at)}</div>
                    </div>
                </div>
            </div>
            <div class="detail-actions">
                ${actionButtons}
            </div>
        `;

        document.getElementById('detailsModal').classList.add('active');
        
        // إعادة ربط الأزرار
        setTimeout(() => this.attachActionListeners(), 100);
    }

    /**
     * إغلاق نافذة التفاصيل
     */
    closeDetailsModal() {
        document.getElementById('detailsModal').classList.remove('active');
        // السماح بالتمرير مرة أخرى
        document.body.classList.remove('modal-open');
    }

    /**
     * إرسال رسالة واتساب
     */
    sendWhatsApp(phone, name, field, date, time) {
        const formattedTime = formatTimeAmPmStrict(time);
        const fieldDisplayName = (field === 'Safari 1')
            ? 'ملعب سفاري'
            : (field === 'Safari 2')
                ? 'ملعب الكأس'
                : field;
        const message = `مرحباً ${name}،\n\nتأكيد حجزك:\n📍 الملعب: ${fieldDisplayName}\n📅 التاريخ: ${date}\n⏰ الوقت: ${formattedTime}\n\nنتمنى لك تجربة ممتعة! ⚽`;
        const whatsappUrl = `https://wa.me/${phone.replace(/^0/, '966')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }

    /**
     * نسخ رقم الجوال إلى الحافظة
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

    /**
     * معالجة الموافقة على الحجز
     * @param {string} bookingId - معرف الحجز
     */
    async handleApprove(bookingId) {
        if (!confirm('هل أنت متأكد من الموافقة على هذا الحجز؟')) {
            return;
        }

        try {
            const result = await supabaseClient.updateBookingStatus(bookingId, 'approved');
            
            if (result.success) {
                showToast('تم تأكيد الحجز بنجاح!', 'success');
                
                const booking = this.bookings.find(b => b.id === bookingId);
                if (booking) {
                    // إرسال إشعار محلي
                    await notificationManager.notifyBookingApproved(booking);
                    
                    // إرسال إشعار Push للموظفين (سيعمل في قفل الشاشة)
                    await this.sendPushNotification(booking, 'staff');
                }
                
                await this.loadBookings();
            } else {
                showToast('فشل في تحديث الحجز', 'error');
            }
        } catch (error) {
            console.error('خطأ في الموافقة:', error);
            showToast('حدث خطأ غير متوقع', 'error');
        }
    }

    /**
     * معالجة رفض الحجز
     * @param {string} bookingId - معرف الحجز
     */
    async handleReject(bookingId) {
        if (!confirm('هل أنت متأكد من رفض هذا الحجز؟')) {
            return;
        }

        try {
            const result = await supabaseClient.updateBookingStatus(bookingId, 'rejected');
            
            if (result.success) {
                showToast('تم رفض الحجز', 'success');
                await this.loadBookings();
            } else {
                showToast('فشل في تحديث الحجز', 'error');
            }
        } catch (error) {
            console.error('خطأ في الرفض:', error);
            showToast('حدث خطأ غير متوقع', 'error');
        }
    }
}

// تهيئة لوحة التحكم عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    new AdminDashboard();
});
