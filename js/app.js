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
        this.selectedSlot = null;
        this.timeSlots = this.generateTimeSlots();
        
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
     * توليد الفترات الزمنية المتاحة
     * من 3:30 عصراً إلى 5:00 فجراً، كل فترة ساعة ونصف
     */
    generateTimeSlots() {
        const slots = [];
        const startHour = 15; // 3:30 PM
        const startMinute = 30;
        
        // الفترات من 3:30 عصراً حتى 11:30 مساءً
        for (let hour = startHour; hour <= 23; hour++) {
            const minute = (hour === startHour) ? startMinute : 0;
            if (hour === 23 && minute > 30) break;
            
            const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            const endHour = minute === 30 ? hour + 2 : hour + 1;
            const endMinute = minute === 30 ? 0 : 30;
            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
            
            slots.push({ startTime, endTime });
        }
        
        // الفترات من 12:00 منتصف الليل حتى 5:00 فجراً
        for (let hour = 0; hour <= 3; hour++) {
            for (let minute = 0; minute <= 30; minute += 30) {
                if (hour === 3 && minute > 30) break;
                
                const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const endHour = minute === 30 ? hour + 2 : hour + 1;
                const endMinute = minute === 30 ? 0 : 30;
                const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
                
                slots.push({ startTime, endTime });
            }
        }
        
        return slots;
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

        // تحديث الفترات عند تغيير التاريخ
        const dateInput = document.getElementById('bookingDate');
        dateInput.addEventListener('change', () => {
            this.loadTimeSlots();
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
        document.getElementById('selectedTimeSlot').value = '';
        
        // إعادة تعيين النموذج
        this.form.reset();
        document.getElementById('fieldName').value = fieldName;
        
        // مسح الفترات الزمنية
        document.getElementById('timeSlotsContainer').innerHTML = '<p class="loading-slots">اختر التاريخ أولاً</p>';
        
        // منع التمرير
        document.body.classList.add('modal-open');
        
        // عرض النافذة
        this.modal.classList.add('active');
    }

    /**
     * إغلاق النافذة
     */
    closeModal() {
        this.modal.classList.remove('active');
        this.form.reset();
        this.selectedField = null;
        this.selectedSlot = null;
        
        // السماح بالتمرير مرة أخرى
        document.body.classList.remove('modal-open');
    }

    /**
     * تحميل وعرض الفترات الزمنية
     */
    async loadTimeSlots() {
        const dateInput = document.getElementById('bookingDate');
        const selectedDate = dateInput.value;
        
        if (!selectedDate) {
            return;
        }
        
        const container = document.getElementById('timeSlotsContainer');
        container.innerHTML = '<p class="loading-slots">جاري تحميل الفترات المتاحة...</p>';
        
        try {
            // جلب الحجوزات الموجودة لهذا التاريخ والملعب
            const bookedSlots = await this.getBookedSlots(selectedDate);
            
            // عرض الفترات
            container.innerHTML = '';
            this.timeSlots.forEach(slot => {
                const isBooked = bookedSlots.some(booked => {
                    // إزالة الثواني من الوقت القادم من قاعدة البيانات
                    const dbStartTime = booked.start_time.substring(0, 5); // "16:00:00" -> "16:00"
                    const dbEndTime = booked.end_time.substring(0, 5);
                    const match = dbStartTime === slot.startTime && dbEndTime === slot.endTime;
                    if (match) {
                        console.log('فترة محجوزة:', slot.startTime, '-', slot.endTime);
                    }
                    return match;
                });
                
                const slotElement = this.createTimeSlotElement(slot, isBooked);
                container.appendChild(slotElement);
            });
        } catch (error) {
            console.error('خطأ في تحميل الفترات:', error);
            container.innerHTML = '<p class="loading-slots">حدث خطأ في تحميل الفترات</p>';
        }
    }

    /**
     * جلب الفترات المحجوزة
     */
    async getBookedSlots(date) {
        try {
            const result = await supabaseClient.getBookingsByDate(this.selectedField, date);
            console.log('الحجوزات المحجوزة:', result.data);
            return result.success ? result.data : [];
        } catch (error) {
            console.error('خطأ في جلب الحجوزات:', error);
            return [];
        }
    }

    /**
     * إنشاء عنصر فترة زمنية
     */
    createTimeSlotElement(slot, isBooked) {
        const div = document.createElement('div');
        div.className = `time-slot ${isBooked ? 'disabled' : ''}`;
        div.dataset.startTime = slot.startTime;
        div.dataset.endTime = slot.endTime;
        
        const timeText = `${this.formatTimeDisplay(slot.startTime)} - ${this.formatTimeDisplay(slot.endTime)}`;
        
        div.innerHTML = `
            <div class="time-slot-time">${timeText}</div>
            <div class="time-slot-duration">${isBooked ? 'محجوز' : 'متاح'}</div>
        `;
        
        if (!isBooked) {
            div.addEventListener('click', () => this.selectTimeSlot(div, slot));
        }
        
        return div;
    }

    /**
     * تنسيق عرض الوقت
     */
    formatTimeDisplay(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const period = hour >= 12 ? 'م' : 'ص';
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        return `${displayHour}:${minutes} ${period}`;
    }

    /**
     * اختيار فترة زمنية
     */
    selectTimeSlot(element, slot) {
        // إزالة التحديد من الفترات الأخرى
        document.querySelectorAll('.time-slot').forEach(el => {
            el.classList.remove('selected');
        });
        
        // تحديد الفترة الحالية
        element.classList.add('selected');
        this.selectedSlot = slot;
        
        // تحديث الحقل المخفي
        document.getElementById('selectedTimeSlot').value = JSON.stringify(slot);
    }

    /**
     * تنسيق رقم الهاتف أثناء الإدخال
     * @param {HTMLInputElement} input - حقل الإدخال
     */
    formatPhoneInput(input) {
        // إزالة أي شيء غير الأرقام
        let value = input.value.replace(/[^\d]/g, '');
        
        // التأكد من أن الرقم لا يتجاوز 10 أرقام
        if (value.length > 10) {
            value = value.substring(0, 10);
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
            return { valid: false, message: 'يرجى إدخال رقم جوال صحيح يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0501234567)' };
        }

        // التحقق من التاريخ
        const selectedDate = new Date(data.bookingDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            return { valid: false, message: 'لا يمكن الحجز في تاريخ سابق' };
        }

        // التحقق من اختيار الفترة الزمنية
        if (!this.selectedSlot) {
            return { valid: false, message: 'يرجى اختيار فترة زمنية' };
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
                start_time: this.selectedSlot.startTime,
                end_time: this.selectedSlot.endTime
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
                start_time: this.selectedSlot.startTime,
                end_time: this.selectedSlot.endTime
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
