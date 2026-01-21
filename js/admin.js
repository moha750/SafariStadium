/**
 * لوحة التحكم الإدارية
 * إدارة الحجوزات والموافقة/الرفض
 */

import supabaseClient from './supabase-client.js';
import { showToast, formatDate, formatTime, formatDateTime } from './utils.js';

class AdminDashboard {
    constructor() {
        this.bookings = [];
        this.filters = {
            status: 'all',
            field_name: 'all'
        };
        
        this.init();
    }

    /**
     * تهيئة لوحة التحكم
     */
    init() {
        this.setupEventListeners();
        this.loadBookings();
    }

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        // فلتر الحالة
        const statusFilter = document.getElementById('statusFilter');
        statusFilter.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.filterBookings();
        });

        // فلتر الملعب
        const fieldFilter = document.getElementById('fieldFilter');
        fieldFilter.addEventListener('change', (e) => {
            this.filters.field_name = e.target.value;
            this.filterBookings();
        });

        // زر التحديث
        const refreshBtn = document.getElementById('refreshBtn');
        refreshBtn.addEventListener('click', () => {
            this.loadBookings();
        });
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
     * تصفية الحجوزات
     */
    filterBookings() {
        let filtered = [...this.bookings];

        // تصفية حسب الحالة
        if (this.filters.status !== 'all') {
            filtered = filtered.filter(b => b.status === this.filters.status);
        }

        // تصفية حسب الملعب
        if (this.filters.field_name !== 'all') {
            filtered = filtered.filter(b => b.field_name === this.filters.field_name);
        }

        this.renderBookings(filtered);
    }

    /**
     * تحديث الإحصائيات
     */
    updateStats() {
        const pending = this.bookings.filter(b => b.status === 'pending').length;
        const approved = this.bookings.filter(b => b.status === 'approved').length;
        const rejected = this.bookings.filter(b => b.status === 'rejected').length;
        const total = this.bookings.length;

        document.getElementById('pendingCount').textContent = pending;
        document.getElementById('approvedCount').textContent = approved;
        document.getElementById('rejectedCount').textContent = rejected;
        document.getElementById('totalCount').textContent = total;
    }

    /**
     * عرض مؤشر التحميل
     */
    showLoading() {
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('bookingsTable').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
    }

    /**
     * عرض حالة فارغة
     */
    showEmptyState() {
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('bookingsTable').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
    }

    /**
     * عرض الحجوزات في الجدول
     * @param {Array} bookings - قائمة الحجوزات
     */
    renderBookings(bookings) {
        const tbody = document.getElementById('bookingsTableBody');
        
        if (bookings.length === 0) {
            this.showEmptyState();
            return;
        }

        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('bookingsTable').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';

        tbody.innerHTML = bookings.map(booking => this.createBookingRow(booking)).join('');

        // إضافة مستمعي الأحداث لأزرار الإجراءات
        this.attachActionListeners();
    }

    /**
     * إنشاء صف جدول للحجز
     * @param {Object} booking - بيانات الحجز
     * @returns {string} - HTML للصف
     */
    createBookingRow(booking) {
        const statusClass = `status-${booking.status}`;
        const statusText = this.getStatusText(booking.status);
        const actionButtons = this.getActionButtons(booking);

        return `
            <tr data-booking-id="${booking.id}">
                <td>
                    <span class="field-badge-table">${booking.field_name}</span>
                </td>
                <td>${booking.customer_name}</td>
                <td dir="ltr" style="text-align: right;">${booking.phone}</td>
                <td>${formatDate(booking.booking_date)}</td>
                <td>${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}</td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
                <td>${formatDateTime(booking.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
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
        if (booking.status === 'pending') {
            return `
                <button class="btn btn-success approve-btn" data-id="${booking.id}">
                    ✓ موافقة
                </button>
                <button class="btn btn-danger reject-btn" data-id="${booking.id}">
                    ✗ رفض
                </button>
            `;
        } else if (booking.status === 'approved') {
            return `
                <button class="btn btn-danger reject-btn" data-id="${booking.id}">
                    ✗ إلغاء
                </button>
            `;
        } else {
            return `
                <button class="btn btn-success approve-btn" data-id="${booking.id}">
                    ✓ موافقة
                </button>
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
                showToast('تم تأكيد الحجز بنجاح! سيتم إرسال رسالة واتساب للعميل', 'success');
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
