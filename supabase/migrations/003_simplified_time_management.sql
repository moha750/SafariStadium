-- ========================================
-- نظام إدارة الوقت المبسط
-- ========================================

-- حذف الجدول القديم إن وجد
DROP TABLE IF EXISTS time_slots CASCADE;

-- إنشاء جدول الاستثناءات اليومية
CREATE TABLE IF NOT EXISTS daily_exceptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_name VARCHAR(50) NOT NULL,
    exception_date DATE NOT NULL,
    custom_slots JSONB NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(field_name, exception_date)
);

-- ========================================
-- الفهارس
-- ========================================

CREATE INDEX idx_daily_exceptions_field ON daily_exceptions(field_name);
CREATE INDEX idx_daily_exceptions_date ON daily_exceptions(exception_date);
CREATE INDEX idx_daily_exceptions_search ON daily_exceptions(field_name, exception_date);

-- ========================================
-- Trigger للتحديث التلقائي
-- ========================================

CREATE TRIGGER update_daily_exceptions_updated_at
    BEFORE UPDATE ON daily_exceptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- سياسات الأمان
-- ========================================

ALTER TABLE daily_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON daily_exceptions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON daily_exceptions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON daily_exceptions
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for all users" ON daily_exceptions
    FOR DELETE USING (true);

-- ========================================
-- دالة للحصول على الفترات المتاحة ليوم معين
-- ========================================

CREATE OR REPLACE FUNCTION get_available_slots(
    p_field_name VARCHAR,
    p_date DATE
)
RETURNS JSONB AS $$
DECLARE
    v_exception RECORD;
    v_default_slots JSONB;
BEGIN
    -- الفترات الثابتة الافتراضية
    v_default_slots := '[
        {"start": "15:30", "end": "17:00", "label": "3:30 م - 5:00 م"},
        {"start": "17:00", "end": "18:30", "label": "5:00 م - 6:30 م"},
        {"start": "18:30", "end": "20:00", "label": "6:30 م - 8:00 م"},
        {"start": "20:00", "end": "21:30", "label": "8:00 م - 9:30 م"},
        {"start": "21:30", "end": "23:00", "label": "9:30 م - 11:00 م"},
        {"start": "23:00", "end": "00:30", "label": "11:00 م - 12:30 ص"},
        {"start": "00:30", "end": "02:00", "label": "12:30 ص - 2:00 ص"},
        {"start": "02:00", "end": "03:30", "label": "2:00 ص - 3:30 ص"},
        {"start": "03:30", "end": "05:00", "label": "3:30 ص - 5:00 ص"}
    ]'::JSONB;
    
    -- البحث عن استثناء لهذا اليوم
    SELECT * INTO v_exception
    FROM daily_exceptions
    WHERE field_name = p_field_name
    AND exception_date = p_date;
    
    -- إذا وجد استثناء، إرجاع الفترات المخصصة
    IF FOUND THEN
        RETURN v_exception.custom_slots;
    ELSE
        -- إرجاع الفترات الافتراضية
        RETURN v_default_slots;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- دالة لإضافة/تحديث استثناء يومي
-- ========================================

CREATE OR REPLACE FUNCTION set_daily_exception(
    p_field_name VARCHAR,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_custom_slots JSONB;
    v_current_time TIME;
    v_slots JSONB := '[]'::JSONB;
    v_slot JSONB;
BEGIN
    -- بناء الفترات المخصصة من الوقت المحدد
    v_current_time := p_start_time;
    
    WHILE v_current_time < p_end_time LOOP
        v_slot := jsonb_build_object(
            'start', v_current_time::TEXT,
            'end', (v_current_time + INTERVAL '1.5 hours')::TIME::TEXT,
            'label', 'فترة مخصصة'
        );
        
        -- التأكد من عدم تجاوز وقت النهاية
        IF (v_current_time + INTERVAL '1.5 hours')::TIME > p_end_time THEN
            v_slot := jsonb_set(v_slot, '{end}', to_jsonb(p_end_time::TEXT));
        END IF;
        
        v_slots := v_slots || v_slot;
        v_current_time := v_current_time + INTERVAL '1.5 hours';
    END LOOP;
    
    -- إدراج أو تحديث الاستثناء
    INSERT INTO daily_exceptions (field_name, exception_date, custom_slots, notes)
    VALUES (p_field_name, p_date, v_slots, p_notes)
    ON CONFLICT (field_name, exception_date)
    DO UPDATE SET 
        custom_slots = EXCLUDED.custom_slots,
        notes = EXCLUDED.notes,
        updated_at = NOW();
    
    RETURN v_slots;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- دالة لإضافة استثناء لنطاق تواريخ
-- ========================================

CREATE OR REPLACE FUNCTION set_date_range_exception(
    p_field_name VARCHAR,
    p_start_date DATE,
    p_end_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_current_date DATE;
    v_count INTEGER := 0;
    v_custom_slots JSONB;
    v_current_time TIME;
    v_slots JSONB := '[]'::JSONB;
    v_slot JSONB;
BEGIN
    -- بناء الفترات المخصصة
    v_current_time := p_start_time;
    
    WHILE v_current_time < p_end_time LOOP
        v_slot := jsonb_build_object(
            'start', v_current_time::TEXT,
            'end', (v_current_time + INTERVAL '1.5 hours')::TIME::TEXT,
            'label', 'فترة مخصصة'
        );
        
        IF (v_current_time + INTERVAL '1.5 hours')::TIME > p_end_time THEN
            v_slot := jsonb_set(v_slot, '{end}', to_jsonb(p_end_time::TEXT));
        END IF;
        
        v_slots := v_slots || v_slot;
        v_current_time := v_current_time + INTERVAL '1.5 hours';
    END LOOP;
    
    -- تطبيق الاستثناء على كل يوم في النطاق
    v_current_date := p_start_date;
    
    WHILE v_current_date <= p_end_date LOOP
        INSERT INTO daily_exceptions (field_name, exception_date, custom_slots, notes)
        VALUES (p_field_name, v_current_date, v_slots, p_notes)
        ON CONFLICT (field_name, exception_date)
        DO UPDATE SET 
            custom_slots = EXCLUDED.custom_slots,
            notes = EXCLUDED.notes,
            updated_at = NOW();
        
        v_count := v_count + 1;
        v_current_date := v_current_date + INTERVAL '1 day';
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- دالة لإضافة فترات مخصصة يدوياً (فترات متعددة غير متصلة)
-- ========================================

CREATE OR REPLACE FUNCTION set_custom_slots(
    p_field_name VARCHAR,
    p_date DATE,
    p_custom_slots JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
    -- إدراج أو تحديث الاستثناء بالفترات المخصصة
    INSERT INTO daily_exceptions (field_name, exception_date, custom_slots, notes)
    VALUES (p_field_name, p_date, p_custom_slots, p_notes)
    ON CONFLICT (field_name, exception_date)
    DO UPDATE SET 
        custom_slots = EXCLUDED.custom_slots,
        notes = EXCLUDED.notes,
        updated_at = NOW();
    
    RETURN p_custom_slots;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- دالة لحذف استثناء (العودة للفترات الثابتة)
-- ========================================

CREATE OR REPLACE FUNCTION remove_daily_exception(
    p_field_name VARCHAR,
    p_date DATE
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM daily_exceptions
    WHERE field_name = p_field_name 
    AND exception_date = p_date;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ملاحظات
-- ========================================
-- النظام الجديد:
-- 1. الفترات الثابتة موجودة دائماً (لا حاجة لإنشائها)
-- 2. يمكن إضافة استثناءات لأيام معينة
-- 3. الاستثناء يستبدل الفترات الثابتة لذلك اليوم
-- 4. يمكن حذف الاستثناء للعودة للفترات الثابتة
