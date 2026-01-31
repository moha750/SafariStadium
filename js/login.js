/**
 * صفحة تسجيل الدخول
 * نظام تسجيل دخول بسيط مربوط بالواجهة فقط
 */

class LoginPage {
    constructor() {
        this.form = document.getElementById('loginForm');
        this.credentials = {
            username: 'ملاعب سفاري',
            password: '123456'
        };
        
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
    }

    /**
     * التحقق من حالة تسجيل الدخول
     */
    checkAuth() {
        const isLoggedIn = sessionStorage.getItem('adminLoggedIn');
        if (isLoggedIn === 'true') {
            window.location.href = 'admin.html';
        }
    }

    /**
     * إعداد مستمعي الأحداث
     */
    setupEventListeners() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    /**
     * معالجة تسجيل الدخول
     */
    handleLogin() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        // إزالة رسالة الخطأ السابقة
        this.hideError();

        // التحقق من بيانات الاعتماد
        if (username === this.credentials.username && password === this.credentials.password) {
            // تسجيل الدخول بنجاح
            sessionStorage.setItem('adminLoggedIn', 'true');
            
            // تعطيل الزر وعرض رسالة التحميل
            const submitBtn = this.form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'جاري تسجيل الدخول...';
            
            // الانتقال إلى لوحة التحكم
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 500);
        } else {
            // بيانات خاطئة
            this.showError('اسم المستخدم أو الرقم السري غير صحيح');
            
            // مسح حقل الرقم السري
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    }

    /**
     * عرض رسالة خطأ
     */
    showError(message) {
        let errorDiv = document.querySelector('.error-message');
        
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            this.form.insertBefore(errorDiv, this.form.firstChild);
        }
        
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
    }

    /**
     * إخفاء رسالة الخطأ
     */
    hideError() {
        const errorDiv = document.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.classList.remove('show');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new LoginPage();
});
