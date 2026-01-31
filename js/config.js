/**
 * ملف التكوين - إعدادات Supabase
 * 
 * تنبيه أمني: لا تقم برفع هذا الملف إلى GitHub
 * استخدم متغيرات البيئة في الإنتاج
 */

const SUPABASE_CONFIG = {
    // URL مشروع Supabase الخاص بك
    // مثال: https://xxxxxxxxxxx.supabase.co
    url: 'https://dekpvervphhafucivgtu.supabase.co',
    
    // مفتاح API العام (anon key)
    // يمكن استخدامه في الواجهة الأمامية بأمان
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRla3B2ZXJ2cGhoYWZ1Y2l2Z3R1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4OTc3MjUsImV4cCI6MjA4NDQ3MzcyNX0.mu0cKujPqCUzzOGcOuSaW8pIZuvWTe7wyVD05UGWPFo'
};

// تصدير الإعدادات
export default SUPABASE_CONFIG;

// تصدير المتغيرات بشكل مباشر للاستخدام السهل
export const SUPABASE_URL = SUPABASE_CONFIG.url;
export const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;
