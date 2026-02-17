-- ========================================
-- إنشاء جدول الفترات الزمنية
-- ========================================

-- إنشاء الجدول
CREATE TABLE IF NOT EXISTS time_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_name VARCHAR(50) NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(field_name, slot_date, start_time, end_time)
);

-- ========================================
-- إنشاء الفهارس لتحسين الأداء
-- ========================================

-- فهرس على اسم الملعب
CREATE INDEX idx_time_slots_field_name ON time_slots(field_name);

-- فهرس على التاريخ
CREATE INDEX idx_time_slots_date ON time_slots(slot_date);

-- فهرس على التوفر
CREATE INDEX idx_time_slots_availability ON time_slots(is_available);

-- فهرس مركب للبحث السريع
CREATE INDEX idx_time_slots_search ON time_slots(field_name, slot_date, is_available);

-- ========================================
-- دالة تحديث updated_at تلقائياً
-- ========================================

CREATE TRIGGER update_time_slots_updated_at
    BEFORE UPDATE ON time_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- سياسات الأمان (Row Level Security)
-- ========================================

-- تفعيل RLS
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة للجميع
CREATE POLICY "Enable read access for all users" ON time_slots
    FOR SELECT
    USING (true);

-- السماح بالإدراج للجميع
CREATE POLICY "Enable insert access for all users" ON time_slots
    FOR INSERT
    WITH CHECK (true);

-- السماح بالتحديث للجميع
CREATE POLICY "Enable update access for all users" ON time_slots
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- السماح بالحذف للجميع
CREATE POLICY "Enable delete access for all users" ON time_slots
    FOR DELETE
    USING (true);

-- ========================================
-- دالة لإنشاء الفترات الزمنية تلقائياً
-- ========================================

CREATE OR REPLACE FUNCTION generate_time_slots(
    p_field_name VARCHAR,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_current_date DATE;
    v_slots_created INTEGER := 0;
    v_time_slots TIME[] := ARRAY[
        '15:30:00'::TIME, '17:00:00'::TIME,
        '18:30:00'::TIME, '20:00:00'::TIME,
        '21:30:00'::TIME, '23:00:00'::TIME,
        '00:30:00'::TIME, '02:00:00'::TIME,
        '03:30:00'::TIME
    ];
    v_slot_index INTEGER;
BEGIN
    v_current_date := p_start_date;
    
    WHILE v_current_date <= p_end_date LOOP
        FOR v_slot_index IN 1..8 LOOP
            INSERT INTO time_slots (field_name, slot_date, start_time, end_time, is_available)
            VALUES (
                p_field_name,
                v_current_date,
                v_time_slots[v_slot_index],
                v_time_slots[v_slot_index + 1],
                true
            )
            ON CONFLICT (field_name, slot_date, start_time, end_time) DO NOTHING;
            
            v_slots_created := v_slots_created + 1;
        END LOOP;
        
        v_current_date := v_current_date + 1;
    END LOOP;
    
    RETURN v_slots_created;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- دالة لحذف الفترات الزمنية
-- ========================================

CREATE OR REPLACE FUNCTION delete_time_slots(
    p_field_name VARCHAR,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM time_slots
    WHERE field_name = p_field_name
    AND slot_date BETWEEN p_start_date AND p_end_date;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ملاحظات
-- ========================================
-- الفترات الزمنية الثابتة:
-- 3:30 م - 5:00 م (15:30 - 17:00)
-- 5:00 م - 6:30 م (17:00 - 18:30)
-- 6:30 م - 8:00 م (18:30 - 20:00)
-- 8:00 م - 9:30 م (20:00 - 21:30)
-- 9:30 م - 11:00 م (21:30 - 23:00)
-- 11:00 م - 12:30 ص (23:00 - 00:30)
-- 12:30 ص - 2:00 ص (00:30 - 02:00)
-- 2:00 ص - 3:30 ص (02:00 - 03:30)
-- 3:30 ص - 5:00 ص (03:30 - 05:00)
