/**
 * التطبيق الرئيسي - صفحة الحجز
 * يدير واجهة المستخدم ونموذج الحجز
 */

import supabaseClient from './supabase-client.js';
import { showToast, validatePhone, formatDate, formatTime } from './utils.js';

class BookingApp {
    constructor() {
        this.modal = document.getElementById('bookingModal');
        this.form = document.getElementById('bookingForm');
        this.selectedField = null;
        
        this.init();
    }

    /**
     * تهيئة التطبيق
     */
    init() {
        this.setupEventListeners();
        this.setMinDate();
    }

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        // أزرار الحجز
        const bookButtons = document.querySelectorAll('.book-btn');
        bookButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldName = e.target.dataset.field;
                this.openBookingModal(fieldName);
            });
        });

        // زر إغلاق النافذة
        const closeBtn = document.getElementById('closeModal');
        closeBtn.addEventListener('click', () => this.closeModal());

        // زر الإلغاء
        const cancelBtn = document.getElementById('cancelBtn');
        cancelBtn.addEventListener('click', () => this.closeModal());

        // إغلاق عند النقر خارج النافذة
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // إرسال النموذج
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // التحقق من رقم الهاتف أثناء الكتابة
        const phoneInput = document.getElementById('phone');
        phoneInput.addEventListener('input', (e) => {
            this.formatPhoneInput(e.target);
        });
    }

    /**
     * تعيين الحد الأدنى للتاريخ (اليوم)
     */
    setMinDate() {
        const dateInput = document.getElementById('bookingDate');
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }

    /**
     * فتح نافذة الحجز
     * @param {string} fieldName - اسم الملعب
     */
    openBookingModal(fieldName) {
        this.selectedField = fieldName;
        document.getElementById('fieldName').value = fieldName;
        this.modal.classList.add('active');
        
        // تحديث عنوان النافذة
        const modalTitle = document.querySelector('.modal-title');
        modalTitle.textContent = `حجز ${fieldName}`;
        
        // إعادة تعيين النموذج
        this.form.reset();
        this.setMinDate();
    }

    /**
     * إغلاق النافذة
     */
    closeModal() {
        this.modal.classList.remove('active');
        this.form.reset();
        this.selectedField = null;
    }

    /**
     * تنسيق رقم الهاتف أثناء الإدخال
     * @param {HTMLInputElement} input - حقل الإدخال
     */
    formatPhoneInput(input) {
        let value = input.value.replace(/[^\d+]/g, '');
        
        // إضافة + تلقائياً إذا لم تكن موجودة
        if (value && !value.startsWith('+')) {
            value = '+' + value;
        }
        
        input.value = value;
    }

    /**
     * التحقق من صحة النموذج
     * @returns {Object} - نتيجة التحقق
     */
    validateForm() {
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData);

        // التحقق من الاسم
        if (!data.customerName || data.customerName.trim().length < 3) {
            return { valid: false, message: 'يرجى إدخال اسم صحيح (3 أحرف على الأقل)' };
        }

        // التحقق من رقم الهاتف
        if (!validatePhone(data.phone)) {
            return { valid: false, message: 'يرجى إدخال رقم جوال صحيح بصيغة دولية (مثال: +966501234567)' };
        }

        // التحقق من التاريخ
        const selectedDate = new Date(data.bookingDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return { valid: false, message: 'لا يمكن الحجز في تاريخ سابق' };
        }

        // التحقق من الأوقات
        if (!data.startTime || !data.endTime) {
            return { valid: false, message: 'يرجى تحديد وقت البداية والنهاية' };
        }

        if (data.startTime >= data.endTime) {
            return { valid: false, message: 'وقت النهاية يجب أن يكون بعد وقت البداية' };
        }

        // التحقق من مدة الحجز (ساعة واحدة على الأقل)
        const start = new Date(`2000-01-01T${data.startTime}`);
        const end = new Date(`2000-01-01T${data.endTime}`);
        const duration = (end - start) / (1000 * 60 * 60); // بالساعات

        if (duration < 1) {
            return { valid: false, message: 'الحد الأدنى لمدة الحجز ساعة واحدة' };
        }

        if (duration > 4) {
            return { valid: false, message: 'الحد الأقصى لمدة الحجز 4 ساعات' };
        }

        return { valid: true, data };
    }

    /**
     * معالجة إرسال النموذج
     */
    async handleSubmit() {
        // التحقق من صحة البيانات
        const validation = this.validateForm();
        
        if (!validation.valid) {
            showToast(validation.message, 'error');
            return;
        }

        const formData = validation.data;

        // تعطيل زر الإرسال
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحجز...';

        try {
            // التحقق من التوفر
            const isAvailable = await supabaseClient.checkAvailability({
                field_name: formData.fieldName,
                booking_date: formData.bookingDate,
                start_time: formData.startTime,
                end_time: formData.endTime
            });

            if (!isAvailable) {
                showToast('عذراً، الملعب محجوز في هذا الوقت. يرجى اختيار وقت آخر', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }

            // إنشاء الحجز
            const result = await supabaseClient.createBooking({
                field_name: formData.fieldName,
                customer_name: formData.customerName.trim(),
                phone: formData.phone,
                booking_date: formData.bookingDate,
                start_time: formData.startTime,
                end_time: formData.endTime
            });

            if (result.success) {
                showToast('تم إرسال طلب الحجز بنجاح! سيتم التواصل معك قريباً', 'success');
                this.closeModal();
            } else {
                showToast('حدث خطأ أثناء الحجز. يرجى المحاولة مرة أخرى', 'error');
            }
        } catch (error) {
            console.error('خطأ في الحجز:', error);
            showToast('حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    new BookingApp();
});
