/**
 * نظام إدارة الوقت المبسط
 * الفترات الثابتة موجودة دائماً - يمكن استثناء أيام معينة
 */

import supabaseClient from './supabase-client.js';
import { showToast, formatDate, formatTime } from './utils.js';

class TimeManagement {
    constructor() {
        this.exceptions = [];
        this.defaultSlots = [
            { start: '14:30', end: '16:00', label: '2:30 م - 4:00 م' },
            { start: '16:00', end: '17:30', label: '4:00 م - 5:30 م' },
            { start: '17:30', end: '19:00', label: '5:30 م - 7:00 م' },
            { start: '19:00', end: '20:30', label: '7:00 م - 8:30 م' },
            { start: '20:30', end: '22:00', label: '8:30 م - 10:00 م' },
            { start: '22:00', end: '23:30', label: '10:00 م - 11:30 م' },
            { start: '23:30', end: '01:00', label: '11:30 م - 1:00 ص' },
            { start: '01:00', end: '02:30', label: '1:00 ص - 2:30 ص' },
            { start: '02:30', end: '04:00', label: '2:30 ص - 4:00 ص' },
            { start: '04:00', end: '05:30', label: '4:00 ص - 5:30 ص' }
        ];
        
        this.init();
    }

    /**
     * تهيئة نظام إدارة الوقت
     */
    init() {
        this.setupEventListeners();
        this.loadExceptions();
    }

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        const addEventListener = (elementId, handler) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener('click', handler);
            }
        };

        addEventListener('addExceptionBtn', () => this.handleAddException());
        addEventListener('addSlotBtn', () => this.addCustomSlot());

        // مستمع حذف الفترات
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-slot-btn')) {
                this.removeCustomSlot(e.target);
            }
        });

        // زر عرض الاستثناءات
        const viewExceptionsBtn = document.getElementById('viewExceptionsBtn');
        if (viewExceptionsBtn) {
            viewExceptionsBtn.addEventListener('click', () => this.loadExceptions());
        }
    }

    /**
     * إضافة فترة مخصصة جديدة
     */
    addCustomSlot() {
        const container = document.getElementById('customSlotsContainer');
        const currentSlots = container.querySelectorAll('.custom-slot-item');
        const newIndex = currentSlots.length;

        const slotHTML = `
            <div class="custom-slot-item" data-slot-index="${newIndex}">
                <div class="form-grid" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div class="form-group">
                        <label>من الساعة <span style="color: red;">*</span></label>
                        <input type="time" class="slot-start-time" placeholder="مثال: 19:00">
                    </div>
                    <div class="form-group">
                        <label>إلى الساعة <span style="color: red;">*</span></label>
                        <input type="time" class="slot-end-time" placeholder="مثال: 21:00">
                    </div>
                    <div class="form-group" style="display: flex; align-items: flex-end;">
                        <button type="button" class="btn btn-danger remove-slot-btn" style="width: 100%;">
                            🗑️ حذف
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', slotHTML);
        this.updateRemoveButtons();
    }

    /**
     * حذف فترة مخصصة
     */
    removeCustomSlot(button) {
        const slotItem = button.closest('.custom-slot-item');
        slotItem.remove();
        this.updateRemoveButtons();
    }

    /**
     * تحديث أزرار الحذف (إخفاء زر الحذف إذا كانت فترة واحدة فقط)
     */
    updateRemoveButtons() {
        const container = document.getElementById('customSlotsContainer');
        const slots = container.querySelectorAll('.custom-slot-item');
        const removeButtons = container.querySelectorAll('.remove-slot-btn');

        removeButtons.forEach((btn, index) => {
            if (slots.length === 1) {
                btn.style.display = 'none';
            } else {
                btn.style.display = 'block';
            }
        });
    }

    /**
     * تقسيم فترة واحدة إلى فترات فرعية كل 1.5 ساعة
     */
    splitSlotIntoSubSlots(startTime, endTime) {
        const subSlots = [];
        const slotDuration = 90; // 1.5 ساعة بالدقائق
        
        // تحويل الوقت إلى دقائق
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        
        let startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;
        
        // معالجة الأوقات التي تتجاوز منتصف الليل
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60; // إضافة 24 ساعة
        }
        
        let currentMinutes = startMinutes;
        
        while (currentMinutes < endMinutes) {
            const nextMinutes = Math.min(currentMinutes + slotDuration, endMinutes);
            
            // تحويل الدقائق إلى صيغة HH:MM
            const currentHour = Math.floor(currentMinutes / 60) % 24;
            const currentMin = currentMinutes % 60;
            const nextHour = Math.floor(nextMinutes / 60) % 24;
            const nextMin = nextMinutes % 60;
            
            const start = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
            const end = `${String(nextHour).padStart(2, '0')}:${String(nextMin).padStart(2, '0')}`;
            
            subSlots.push({
                start: start,
                end: end,
                label: 'فترة مخصصة'
            });
            
            currentMinutes = nextMinutes;
        }
        
        return subSlots;
    }

    /**
     * إضافة استثناء موحد (يدعم نطاق تواريخ وفترات متعددة)
     */
    async handleAddException() {
        const fieldName = document.getElementById('exceptionFieldName').value;
        const startDate = document.getElementById('exceptionStartDate').value;
        const endDate = document.getElementById('exceptionEndDate').value;
        const notes = document.getElementById('exceptionNotes').value;

        if (!fieldName || !startDate || !endDate) {
            showToast('الرجاء ملء الملعب والتواريخ', 'error');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            showToast('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية', 'error');
            return;
        }

        // جمع الفترات المخصصة وتقسيمها
        const container = document.getElementById('customSlotsContainer');
        const slotItems = container.querySelectorAll('.custom-slot-item');
        const slots = [];

        for (let item of slotItems) {
            const startTime = item.querySelector('.slot-start-time').value;
            const endTime = item.querySelector('.slot-end-time').value;

            if (!startTime || !endTime) {
                showToast('الرجاء ملء جميع الأوقات', 'error');
                return;
            }

            if (startTime >= endTime) {
                showToast('وقت البداية يجب أن يكون قبل وقت النهاية في كل فترة', 'error');
                return;
            }

            // تقسيم الفترة إلى فترات فرعية كل 1.5 ساعة
            const subSlots = this.splitSlotIntoSubSlots(startTime, endTime);
            slots.push(...subSlots);
        }

        const addBtn = document.getElementById('addExceptionBtn');
        const originalText = addBtn.textContent;
        addBtn.disabled = true;
        addBtn.textContent = 'جاري الحفظ...';

        try {
            // حساب عدد الأيام
            const start = new Date(startDate);
            const end = new Date(endDate);
            const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            // استخدام دالة موحدة لحفظ الفترات المخصصة
            let successCount = 0;
            let currentDate = new Date(startDate);
            const endDateObj = new Date(endDate);

            while (currentDate <= endDateObj) {
                const dateStr = currentDate.toISOString().split('T')[0];
                
                const result = await supabaseClient.setCustomSlots({
                    field_name: fieldName,
                    date: dateStr,
                    slots: slots,
                    notes: notes
                });

                if (result.success) {
                    successCount++;
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (successCount > 0) {
                const daysText = daysDiff === 1 ? 'يوم واحد' : `${daysDiff} أيام`;
                const slotsText = slots.length === 1 ? 'فترة واحدة' : `${slots.length} فترات`;
                showToast(`تم حفظ الاستثناء بنجاح لـ ${daysText} مع ${slotsText}!`, 'success');
                
                // إعادة تعيين النموذج
                document.getElementById('exceptionStartDate').value = '';
                document.getElementById('exceptionEndDate').value = '';
                document.getElementById('exceptionNotes').value = '';
                
                // إعادة تعيين الفترات
                container.innerHTML = `
                    <h4 style="margin-bottom: 1rem; font-size: 1rem; color: #374151;">⏰ الفترات الزمنية</h4>
                    <div class="custom-slot-item" data-slot-index="0">
                        <div class="form-grid" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                            <div class="form-group">
                                <label>من الساعة <span style="color: red;">*</span></label>
                                <input type="time" class="slot-start-time" placeholder="مثال: 13:00">
                            </div>
                            <div class="form-group">
                                <label>إلى الساعة <span style="color: red;">*</span></label>
                                <input type="time" class="slot-end-time" placeholder="مثال: 16:00">
                            </div>
                            <div class="form-group" style="display: flex; align-items: flex-end;">
                                <button type="button" class="btn btn-danger remove-slot-btn" style="width: 100%; display: none;">
                                    🗑️ حذف
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                this.loadExceptions();
            } else {
                showToast('فشل في حفظ الاستثناء', 'error');
            }
        } catch (error) {
            console.error('خطأ في حفظ الاستثناء:', error);
            showToast('حدث خطأ غير متوقع', 'error');
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = originalText;
        }
    }

    /**
     * تحميل الاستثناءات
     */
    async loadExceptions() {
        const container = document.getElementById('exceptionsContainer');
        const loadingSpinner = document.getElementById('tmLoadingSpinner');
        const emptyState = document.getElementById('tmEmptyState');

        if (loadingSpinner) loadingSpinner.style.display = 'block';
        if (container) container.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';

        try {
            const result = await supabaseClient.getDailyExceptions();

            if (result.success && result.data.length > 0) {
                this.exceptions = result.data;
                this.renderExceptions();
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                if (container) container.style.display = 'block';
            } else {
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
            }
        } catch (error) {
            console.error('خطأ في تحميل الاستثناءات:', error);
            showToast('حدث خطأ أثناء تحميل البيانات', 'error');
            if (loadingSpinner) loadingSpinner.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
        }
    }

    /**
     * عرض الاستثناءات
     */
    renderExceptions() {
        const container = document.getElementById('exceptionsContainer');
        if (!container) return;

        container.innerHTML = this.exceptions.map(exception => {
            const slots = exception.custom_slots;
            const slotsCount = slots.length;
            
            return `
                <div class="exception-card">
                    <div class="exception-header">
                        <div>
                            <h3>📅 ${formatDate(exception.exception_date)}</h3>
                            <p class="exception-field">⚽ ${exception.field_name}</p>
                        </div>
                        <button class="btn-exception-delete" data-field="${exception.field_name}" data-date="${exception.exception_date}">
                            🗑️ حذف الاستثناء
                        </button>
                    </div>
                    <div class="exception-body">
                        <div class="exception-info">
                            <span class="exception-label">عدد الفترات:</span>
                            <span class="exception-value">${slotsCount} فترة</span>
                        </div>
                        ${exception.notes ? `
                            <div class="exception-notes">
                                <span class="exception-label">ملاحظات:</span>
                                <p>${exception.notes}</p>
                            </div>
                        ` : ''}
                        <div class="exception-slots">
                            ${slots.map(slot => `
                                <div class="exception-slot">
                                    ⏰ ${formatTime(slot.start)} - ${formatTime(slot.end)}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.attachExceptionListeners();
    }

    /**
     * ربط مستمعي الأحداث للاستثناءات
     */
    attachExceptionListeners() {
        const deleteButtons = document.querySelectorAll('.btn-exception-delete');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const fieldName = e.target.dataset.field;
                const date = e.target.dataset.date;
                this.handleRemoveException(fieldName, date);
            });
        });
    }

    /**
     * حذف استثناء (العودة للفترات الثابتة)
     */
    async handleRemoveException(fieldName, date) {
        if (!confirm(`هل أنت متأكد من حذف هذا الاستثناء؟\n\nسيعود الملعب للعمل بالفترات الثابتة في ${formatDate(date)}`)) {
            return;
        }

        try {
            const result = await supabaseClient.removeDailyException({
                field_name: fieldName,
                date: date
            });

            if (result.success) {
                showToast('تم حذف الاستثناء بنجاح! الملعب سيعمل بالفترات الثابتة', 'success');
                this.loadExceptions();
            } else {
                showToast('فشل في حذف الاستثناء', 'error');
            }
        } catch (error) {
            console.error('خطأ في حذف الاستثناء:', error);
            showToast('حدث خطأ غير متوقع', 'error');
        }
    }
}

export default TimeManagement;
