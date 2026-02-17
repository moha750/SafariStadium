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
            { start: '15:30', end: '17:00', label: '3:30 م - 5:00 م' },
            { start: '17:00', end: '18:30', label: '5:00 م - 6:30 م' },
            { start: '18:30', end: '20:00', label: '6:30 م - 8:00 م' },
            { start: '20:00', end: '21:30', label: '8:00 م - 9:30 م' },
            { start: '21:30', end: '23:00', label: '9:30 م - 11:00 م' },
            { start: '23:00', end: '00:30', label: '11:00 م - 12:30 ص' },
            { start: '00:30', end: '02:00', label: '12:30 ص - 2:00 ص' },
            { start: '02:00', end: '03:30', label: '2:00 ص - 3:30 ص' },
            { start: '03:30', end: '05:00', label: '3:30 ص - 5:00 ص' }
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
        // زر إضافة استثناء
        const addExceptionBtn = document.getElementById('addExceptionBtn');
        if (addExceptionBtn) {
            addExceptionBtn.addEventListener('click', () => this.handleAddException());
        }

        // زر عرض الاستثناءات
        const viewExceptionsBtn = document.getElementById('viewExceptionsBtn');
        if (viewExceptionsBtn) {
            viewExceptionsBtn.addEventListener('click', () => this.loadExceptions());
        }
    }

    /**
     * إضافة استثناء يومي
     */
    async handleAddException() {
        const fieldName = document.getElementById('exceptionFieldName').value;
        const date = document.getElementById('exceptionDate').value;
        const startTime = document.getElementById('exceptionStartTime').value;
        const endTime = document.getElementById('exceptionEndTime').value;
        const notes = document.getElementById('exceptionNotes').value;

        if (!fieldName || !date || !startTime || !endTime) {
            showToast('الرجاء ملء جميع الحقول المطلوبة', 'error');
            return;
        }

        if (startTime >= endTime) {
            showToast('وقت البداية يجب أن يكون قبل وقت النهاية', 'error');
            return;
        }

        const addBtn = document.getElementById('addExceptionBtn');
        const originalText = addBtn.textContent;
        addBtn.disabled = true;
        addBtn.textContent = 'جاري الإضافة...';

        try {
            const result = await supabaseClient.setDailyException({
                field_name: fieldName,
                date: date,
                start_time: startTime,
                end_time: endTime,
                notes: notes
            });

            if (result.success) {
                showToast(`تم إضافة الاستثناء بنجاح! سيعمل الملعب من ${startTime} إلى ${endTime}`, 'success');
                document.getElementById('exceptionDate').value = '';
                document.getElementById('exceptionStartTime').value = '';
                document.getElementById('exceptionEndTime').value = '';
                document.getElementById('exceptionNotes').value = '';
                this.loadExceptions();
            } else {
                showToast('فشل في إضافة الاستثناء', 'error');
            }
        } catch (error) {
            console.error('خطأ في إضافة الاستثناء:', error);
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
