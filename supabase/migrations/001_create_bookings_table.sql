-- ========================================
-- إنشاء جدول الحجوزات
-- ========================================

-- إنشاء الجدول
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_name VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reminder_time TIMESTAMP WITH TIME ZONE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- إنشاء الفهارس لتحسين الأداء
-- ========================================

-- فهرس على حالة الحجز
CREATE INDEX idx_bookings_status ON bookings(status);

-- فهرس على اسم الملعب
CREATE INDEX idx_bookings_field_name ON bookings(field_name);

-- فهرس على تاريخ الحجز
CREATE INDEX idx_bookings_date ON bookings(booking_date);

-- فهرس مركب للبحث عن التعارضات
CREATE INDEX idx_bookings_availability ON bookings(field_name, booking_date, start_time, end_time);

-- فهرس على وقت التذكير للحجوزات التي لم يتم إرسال تذكير لها
CREATE INDEX idx_bookings_reminder ON bookings(reminder_time, reminder_sent) WHERE reminder_sent = FALSE;

-- ========================================
-- دالة تحديث updated_at تلقائياً
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- إنشاء Trigger لتحديث updated_at
-- ========================================

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- سياسات الأمان (Row Level Security)
-- ========================================

-- تفعيل RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة للجميع (للواجهة العامة)
CREATE POLICY "Enable read access for all users" ON bookings
    FOR SELECT
    USING (true);

-- السماح بالإدراج للجميع (للحجوزات الجديدة)
CREATE POLICY "Enable insert access for all users" ON bookings
    FOR INSERT
    WITH CHECK (true);

-- السماح بالتحديث للجميع (للوحة التحكم)
-- في الإنتاج، يجب تقييد هذا للمسؤولين فقط
CREATE POLICY "Enable update access for all users" ON bookings
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ========================================
-- بيانات تجريبية (اختياري)
-- ========================================

-- يمكن إضافة بعض البيانات التجريبية للاختبار
-- INSERT INTO bookings (field_name, customer_name, phone, booking_date, start_time, end_time, status)
-- VALUES 
--     ('Safari 1', 'أحمد محمد', '+966501234567', CURRENT_DATE + 1, '16:00', '18:00', 'pending'),
--     ('Safari 2', 'خالد علي', '+966509876543', CURRENT_DATE + 2, '19:00', '21:00', 'approved');
