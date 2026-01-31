/**
 * عميل Supabase
 * يوفر واجهة للتعامل مع قاعدة البيانات
 */

import SUPABASE_CONFIG from './config.js';

class SupabaseClient {
    constructor() {
        this.supabaseUrl = SUPABASE_CONFIG.url;
        this.supabaseKey = SUPABASE_CONFIG.anonKey;
        this.headers = {
            'apikey': this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
    }

    /**
     * إنشاء حجز جديد
     * @param {Object} bookingData - بيانات الحجز
     * @returns {Promise<Object>} - نتيجة العملية
     */
    async createBooking(bookingData) {
        try {
            const payload = {
                field_name: bookingData.field_name,
                customer_name: bookingData.customer_name,
                phone: bookingData.phone,
                booking_date: bookingData.booking_date,
                start_time: bookingData.start_time,
                end_time: bookingData.end_time,
                status: 'pending'
            };

            const response = await fetch(`${this.supabaseUrl}/rest/v1/bookings`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'فشل في إنشاء الحجز');
            }

            const data = await response.json();
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('خطأ في إنشاء الحجز:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب جميع الحجوزات
     * @param {Object} filters - فلاتر اختيارية
     * @returns {Promise<Array>} - قائمة الحجوزات
     */
    async getBookings(filters = {}) {
        try {
            let url = `${this.supabaseUrl}/rest/v1/bookings?order=created_at.desc`;

            // تطبيق الفلاتر
            if (filters.status && filters.status !== 'all') {
                url += `&status=eq.${filters.status}`;
            }
            if (filters.field_name && filters.field_name !== 'all') {
                url += `&field_name=eq.${encodeURIComponent(filters.field_name)}`;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error('فشل في جلب الحجوزات');
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            console.error('خطأ في جلب الحجوزات:', error);
            return { success: false, error: error.message, data: [] };
        }
    }

    /**
     * تحديث حالة الحجز
     * @param {string} bookingId - معرف الحجز
     * @param {string} status - الحالة الجديدة (approved/rejected)
     * @returns {Promise<Object>} - نتيجة العملية
     */
    async updateBookingStatus(bookingId, status) {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}`, {
                method: 'PATCH',
                headers: this.headers,
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error('فشل في تحديث الحجز');
            }

            const data = await response.json();
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('خطأ في تحديث الحجز:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * جلب الحجوزات حسب التاريخ والملعب
     * @param {string} fieldName - اسم الملعب
     * @param {string} date - التاريخ
     * @returns {Promise<Object>} - نتيجة العملية
     */
    async getBookingsByDate(fieldName, date) {
        try {
            const url = `${this.supabaseUrl}/rest/v1/bookings?field_name=eq.${encodeURIComponent(fieldName)}&booking_date=eq.${date}&status=eq.approved`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error('فشل في جلب الحجوزات');
            }

            const data = await response.json();
            console.log('الحجوزات المؤكدة للتاريخ', date, ':', data);
            return { success: true, data };
        } catch (error) {
            console.error('خطأ في جلب الحجوزات:', error);
            return { success: false, error: error.message, data: [] };
        }
    }

    /**
     * التحقق من توفر الملعب في وقت محدد
     * @param {Object} params - معاملات البحث
     * @returns {Promise<boolean>} - true إذا كان متاحاً
     */
    async checkAvailability(params) {
        try {
            const { field_name, booking_date, start_time, end_time } = params;
            
            // البحث عن حجوزات متداخلة
            const url = `${this.supabaseUrl}/rest/v1/bookings?field_name=eq.${encodeURIComponent(field_name)}&booking_date=eq.${booking_date}&status=neq.rejected`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error('فشل في التحقق من التوفر');
            }

            const bookings = await response.json();
            
            // التحقق من التداخل الزمني
            // الحجزان يتداخلان فقط إذا كان هناك تقاطع حقيقي (وليس مجرد نقطة التقاء)
            const hasConflict = bookings.some(booking => {
                // تحويل الأوقات لصيغة موحدة للمقارنة
                const newStart = start_time.substring(0, 5);
                const newEnd = end_time.substring(0, 5);
                const existingStart = booking.start_time.substring(0, 5);
                const existingEnd = booking.end_time.substring(0, 5);
                
                // يوجد تداخل إذا:
                // 1. الحجز الجديد يبدأ قبل انتهاء الحجز الموجود
                // 2. الحجز الجديد ينتهي بعد بداية الحجز الموجود
                // ولكن نسمح بالحجوزات المتتالية (نهاية واحد = بداية الآخر)
                return (newStart < existingEnd && newEnd > existingStart);
            });

            return !hasConflict;
        } catch (error) {
            console.error('خطأ في التحقق من التوفر:', error);
            return false;
        }
    }
}

// تصدير نسخة واحدة من العميل
export default new SupabaseClient();
