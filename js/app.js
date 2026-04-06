/**
 * التطبيق الرئيسي - صفحة الحجز
 * يدير واجهة المستخدم ونموذج الحجز
 */

import supabaseClient from './supabase-client.js';
import { showToast, formatDate, formatTime } from './utils.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

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
     * من 2:30 عصراً إلى 5:30 فجراً، كل فترة ساعة ونصف
     */
    generateTimeSlots() {
        const slots = [];

        // كل فترة ساعة ونصف (90 دقيقة)
        const slotDuration = 90; // دقيقة

        // الفترات من 2:30 عصراً حتى 11:30 مساءً (آخر فترة تبدأ 11:30 م وتنتهي 1:00 ص)
        let currentTime = 14 * 60 + 30; // 14:30 بالدقائق
        const endOfDay = 23 * 60 + 30; // 23:30 بالدقائق (آخر فترة تبدأ 11:30 م)

        while (currentTime <= endOfDay) {
            const startHour = Math.floor(currentTime / 60);
            const startMinute = currentTime % 60;
            const startTime = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;

            const endTimeMinutes = currentTime + slotDuration;
            // معالجة الأوقات التي تتجاوز منتصف الليل
            const endHour = Math.floor(endTimeMinutes / 60) % 24;
            const endMinute = endTimeMinutes % 60;
            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

            slots.push({ startTime, endTime });
            currentTime += slotDuration;
        }

        // الفترات من 1:00 بعد منتصف الليل حتى 5:30 فجراً
        currentTime = 1 * 60; // 01:00
        const endOfNight = 4 * 60; // 04:00 (آخر فترة تبدأ 4:00 ص وتنتهي 5:30 ص)

        while (currentTime <= endOfNight) {
            const startHour = Math.floor(currentTime / 60);
            const startMinute = currentTime % 60;
            const startTime = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;

            const endTimeMinutes = currentTime + slotDuration;
            const endHour = Math.floor(endTimeMinutes / 60);
            const endMinute = endTimeMinutes % 60;
            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

            slots.push({ startTime, endTime });
            currentTime += slotDuration;
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
            // جلب الفترات المتاحة لهذا اليوم (ثابتة أو مستثناة)
            const availableSlotsResult = await supabaseClient.getAvailableSlots({
                field_name: this.selectedField,
                date: selectedDate
            });
            
            if (!availableSlotsResult.success || !availableSlotsResult.slots) {
                container.innerHTML = '<p class="loading-slots">حدث خطأ في تحميل الفترات</p>';
                return;
            }
            
            const availableSlots = availableSlotsResult.slots;

            // جلب الحجوزات الموجودة لهذا التاريخ والملعب
            const bookedSlots = await this.getBookedSlots(selectedDate);

            // عرض الفترات
            container.innerHTML = '';
            availableSlots.forEach(slot => {
                const slotObj = {
                    startTime: slot.start,
                    endTime: slot.end
                };

                // كشف التداخل: الفترة محجوزة إذا تتداخل مع أي حجز موجود
                // (يدعم الحجوزات القديمة بأوقات مختلفة عن الجدول الجديد)
                const isBooked = bookedSlots.some(booked => {
                    const dbStartTime = booked.start_time.substring(0, 5);
                    const dbEndTime = booked.end_time.substring(0, 5);
                    return this.timeRangesOverlap(slot.start, slot.end, dbStartTime, dbEndTime);
                });

                const slotElement = this.createTimeSlotElement(slotObj, isBooked);
                container.appendChild(slotElement);
            });
        } catch (error) {
            console.error('خطأ في تحميل الفترات:', error);
            container.innerHTML = '<p class="loading-slots">حدث خطأ في تحميل الفترات</p>';
        }
    }

    /**
     * تحويل وقت بصيغة HH:MM إلى دقائق منذ بداية اليوم
     * مع معالجة الأوقات بعد منتصف الليل (تُضاف لها 24 ساعة لتكون متتابعة)
     */
    timeToMinutes(time) {
        const [h, m] = time.split(':').map(Number);
        let minutes = h * 60 + m;
        // الأوقات قبل الظهر تعتبر بعد منتصف الليل (نفس يوم الحجز المسائي)
        if (h < 12) {
            minutes += 24 * 60;
        }
        return minutes;
    }

    /**
     * التحقق من تداخل فترتين زمنيتين
     * يدعم الفترات التي تعبر منتصف الليل
     */
    timeRangesOverlap(start1, end1, start2, end2) {
        const s1 = this.timeToMinutes(start1);
        let e1 = this.timeToMinutes(end1);
        const s2 = this.timeToMinutes(start2);
        let e2 = this.timeToMinutes(end2);

        // إذا كان وقت النهاية أقل من البداية، فالفترة تعبر منتصف الليل
        if (e1 <= s1) e1 += 24 * 60;
        if (e2 <= s2) e2 += 24 * 60;

        return s1 < e2 && s2 < e1;
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
        
        // تحديد الفترة (صباحاً أم مساءً)
        // من 0-11 صباحاً (ص)، من 12-23 مساءً (م)
        const period = hour < 12 ? 'ص' : 'م';
        
        // تحويل الساعة إلى نظام 12 ساعة
        let displayHour;
        if (hour === 0) {
            displayHour = 12; // منتصف الليل
        } else if (hour > 12) {
            displayHour = hour - 12; // بعد الظهر/المساء
        } else {
            displayHour = hour; // صباحاً أو الظهر
        }
        
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
     * تنسيق إدخال رقم الهاتف
     */
    formatPhoneInput(input) {
        let value = input.value.replace(/\D/g, '');
        
        if (value.length > 10) {
            value = value.substring(0, 10);
        }
        
        input.value = value;
    }

    /**
     * التحقق من صحة بيانات النموذج
     */
    validateForm() {
        const data = {
            fieldName: document.getElementById('fieldName').value,
            customerName: document.getElementById('customerName').value,
            phone: document.getElementById('phone').value,
            bookingDate: document.getElementById('bookingDate').value
        };

        // التحقق من الاسم
        if (!data.customerName || data.customerName.trim().length < 3) {
            return { valid: false, message: 'يرجى إدخال اسم صحيح (3 أحرف على الأقل)' };
        }

        // التحقق من رقم الهاتف
        const phoneRegex = /^05\d{8}$/;
        if (!phoneRegex.test(data.phone)) {
            return { valid: false, message: 'يرجى إدخال رقم جوال صحيح يبدأ بـ 05 ويتكون من 10 أرقام' };
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
     * إرسال إشعار Push للمدير عند طلب حجز جديد
     */
    async notifyAdminNewBooking(bookingData) {
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
                        title: '🔔 طلب حجز جديد!',
                        body: `طلب حجز من ${bookingData.customer_name} للملعب ${bookingData.field_name} - ${bookingData.start_time}`,
                        icon: '/icon-192.png',
                        userType: 'admin',
                        data: {
                            customerName: bookingData.customer_name,
                            fieldName: bookingData.field_name,
                            bookingDate: bookingData.booking_date,
                            startTime: bookingData.start_time,
                            endTime: bookingData.end_time,
                            phone: bookingData.phone,
                            url: '/admin.html'
                        }
                    })
                }
            );
            
            if (response.ok) {
                console.log('تم إرسال إشعار للمدير بنجاح');
            } else {
                console.error('فشل إرسال الإشعار للمدير');
            }
        } catch (error) {
            console.error('خطأ في إرسال الإشعار للمدير:', error);
        }
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
                
                // إرسال إشعار للمدير عن الحجز الجديد
                await this.notifyAdminNewBooking({
                    customer_name: formData.customerName.trim(),
                    field_name: formData.fieldName,
                    booking_date: formData.bookingDate,
                    start_time: this.selectedSlot.startTime,
                    end_time: this.selectedSlot.endTime,
                    phone: formData.phone
                });
                
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
