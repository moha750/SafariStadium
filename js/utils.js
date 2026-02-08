/**
 * دوال مساعدة عامة
 */

/**
 * عرض رسالة توست
 * @param {string} message - نص الرسالة
 * @param {string} type - نوع الرسالة (success/error)
 */
export function showToast(message, type = 'success') {
    const toastId = type === 'success' ? 'successMessage' : 'errorMessage';
    const toast = document.getElementById(toastId);
    const textElement = toast.querySelector('.toast-text');
    
    textElement.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

/**
 * التحقق من صحة رقم الهاتف السعودي
 * @param {string} phone - رقم الهاتف
 * @returns {boolean} - true إذا كان صحيحاً
 */
export function validatePhone(phone) {
    // صيغة الأرقام السعودية: 05XXXXXXXX (10 أرقام تبدأ بـ 05)
    const phoneRegex = /^05\d{8}$/;
    return phoneRegex.test(phone);
}

/**
 * تنسيق التاريخ للعرض
 * @param {string} dateString - التاريخ بصيغة ISO
 * @returns {string} - التاريخ المنسق
 */
export function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    return date.toLocaleDateString('ar-SA', options);
}

/**
 * تنسيق الوقت للعرض
 * @param {string} timeString - الوقت بصيغة HH:MM
 * @returns {string} - الوقت المنسق
 */
export function formatTime(timeString) {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'مساءً' : 'صباحاً';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    
    return `${displayHour}:${minutes} ${period}`;
}

/**
 * تنسيق التاريخ والوقت معاً
 * @param {string} dateTimeString - التاريخ والوقت بصيغة ISO
 * @returns {string} - التاريخ والوقت المنسق
 */
export function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    const dateOptions = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
    };
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit'
    };
    
    const dateStr = date.toLocaleDateString('ar-SA', dateOptions);
    const timeStr = date.toLocaleTimeString('ar-SA', timeOptions);
    
    return `${dateStr} - ${timeStr}`;
}

/**
 * التحقق من أن التاريخ في المستقبل
 * @param {string} dateString - التاريخ
 * @returns {boolean} - true إذا كان في المستقبل
 */
export function isFutureDate(dateString) {
    const selectedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return selectedDate >= today;
}

/**
 * حساب المدة بين وقتين بالساعات
 * @param {string} startTime - وقت البداية
 * @param {string} endTime - وقت النهاية
 * @returns {number} - المدة بالساعات
 */
export function calculateDuration(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return (end - start) / (1000 * 60 * 60);
}

/**
 * تنظيف رقم الهاتف (إزالة المسافات والرموز غير الضرورية)
 * @param {string} phone - رقم الهاتف
 * @returns {string} - رقم الهاتف المنظف
 */
export function cleanPhone(phone) {
    return phone.replace(/[^\d]/g, '');
}

export function formatTimeAmPmStrict(timeString) {
    if (!timeString) return '';

    const parts = String(timeString).split(':');
    const hours24 = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (Number.isNaN(hours24) || Number.isNaN(minutes)) {
        return '';
    }

    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12Raw = hours24 % 12;
    const hours12 = hours12Raw === 0 ? 12 : hours12Raw;
    const minutesPadded = String(minutes).padStart(2, '0');

    return `${hours12}:${minutesPadded} ${period}`;
}
