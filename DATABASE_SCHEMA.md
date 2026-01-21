# 🗄 توثيق قاعدة البيانات - نظام حجز ملاعب سفاري

## 📊 نظرة عامة

قاعدة البيانات مصممة على **PostgreSQL** عبر **Supabase** مع تركيز على:
- الأداء العالي
- الأمان (Row Level Security)
- سهولة الصيانة
- قابلية التوسع

---

## 📋 الجداول

### جدول `bookings` - الحجوزات

الجدول الرئيسي لتخزين جميع حجوزات الملاعب.

#### الأعمدة

| العمود | النوع | القيود | الوصف |
|--------|------|--------|-------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | معرف فريد للحجز |
| `field_name` | VARCHAR(50) | NOT NULL | اسم الملعب (Safari 1 أو Safari 2) |
| `customer_name` | VARCHAR(255) | NOT NULL | اسم العميل الكامل |
| `phone` | VARCHAR(20) | NOT NULL | رقم الجوال بصيغة E.164 |
| `booking_date` | DATE | NOT NULL | تاريخ الحجز |
| `start_time` | TIME | NOT NULL | وقت بداية الحجز |
| `end_time` | TIME | NOT NULL | وقت نهاية الحجز |
| `status` | VARCHAR(20) | DEFAULT 'pending', CHECK | حالة الحجز |
| `reminder_time` | TIMESTAMP WITH TIME ZONE | NULL | وقت إرسال التذكير |
| `reminder_sent` | BOOLEAN | DEFAULT FALSE | هل تم إرسال التذكير؟ |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | تاريخ إنشاء السجل |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | تاريخ آخر تحديث |

#### القيود (Constraints)

```sql
-- قيد على حالة الحجز
CHECK (status IN ('pending', 'approved', 'rejected'))
```

#### القيم المسموحة

**status**:
- `pending` - قيد الانتظار (الافتراضي)
- `approved` - مؤكد
- `rejected` - مرفوض

**field_name**:
- `Safari 1`
- `Safari 2`

**phone**:
- صيغة E.164: `+[country code][number]`
- مثال: `+966501234567`

---

## 🔍 الفهارس (Indexes)

تم إنشاء فهارس محسّنة لتحسين أداء الاستعلامات:

### 1. فهرس الحالة
```sql
CREATE INDEX idx_bookings_status ON bookings(status);
```
**الاستخدام**: تصفية الحجوزات حسب الحالة في لوحة التحكم

### 2. فهرس اسم الملعب
```sql
CREATE INDEX idx_bookings_field_name ON bookings(field_name);
```
**الاستخدام**: تصفية الحجوزات حسب الملعب

### 3. فهرس التاريخ
```sql
CREATE INDEX idx_bookings_date ON bookings(booking_date);
```
**الاستخدام**: البحث عن حجوزات في تاريخ معين

### 4. فهرس مركب للتوفر
```sql
CREATE INDEX idx_bookings_availability 
ON bookings(field_name, booking_date, start_time, end_time);
```
**الاستخدام**: التحقق السريع من توفر الملعب

### 5. فهرس التذكيرات
```sql
CREATE INDEX idx_bookings_reminder 
ON bookings(reminder_time, reminder_sent) 
WHERE reminder_sent = FALSE;
```
**الاستخدام**: البحث عن الحجوزات التي تحتاج تذكير

---

## ⚡ Triggers

### Trigger: تحديث `updated_at` تلقائياً

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**الوظيفة**: تحديث `updated_at` تلقائياً عند أي تعديل على السجل.

---

## 🔒 Row Level Security (RLS)

### السياسات المطبقة

#### 1. سياسة القراءة
```sql
CREATE POLICY "Enable read access for all users" 
ON bookings FOR SELECT 
USING (true);
```
**الوصف**: السماح لجميع المستخدمين بقراءة الحجوزات

#### 2. سياسة الإدراج
```sql
CREATE POLICY "Enable insert access for all users" 
ON bookings FOR INSERT 
WITH CHECK (true);
```
**الوصف**: السماح لجميع المستخدمين بإنشاء حجوزات جديدة

#### 3. سياسة التحديث
```sql
CREATE POLICY "Enable update access for all users" 
ON bookings FOR UPDATE 
USING (true) 
WITH CHECK (true);
```
**الوصف**: السماح بالتحديث (يُنصح بتقييدها للمسؤولين في الإنتاج)

### ⚠️ ملاحظة أمنية

في بيئة الإنتاج، يجب تعديل سياسة التحديث لتقتصر على المسؤولين فقط:

```sql
-- حذف السياسة الحالية
DROP POLICY "Enable update access for all users" ON bookings;

-- إنشاء سياسة محدودة (مثال)
CREATE POLICY "Enable update for admins only" 
ON bookings FOR UPDATE 
USING (auth.role() = 'admin')
WITH CHECK (auth.role() = 'admin');
```

---

## 📈 استعلامات شائعة

### 1. جلب جميع الحجوزات قيد الانتظار

```sql
SELECT * FROM bookings 
WHERE status = 'pending' 
ORDER BY created_at DESC;
```

### 2. التحقق من توفر ملعب

```sql
SELECT COUNT(*) FROM bookings 
WHERE field_name = 'Safari 1' 
  AND booking_date = '2024-01-20'
  AND status != 'rejected'
  AND (
    (start_time >= '16:00' AND start_time < '18:00') OR
    (end_time > '16:00' AND end_time <= '18:00') OR
    (start_time <= '16:00' AND end_time >= '18:00')
  );
```

### 3. الحجوزات التي تحتاج تذكير

```sql
SELECT * FROM bookings 
WHERE status = 'approved' 
  AND reminder_sent = FALSE 
  AND reminder_time <= NOW()
ORDER BY reminder_time ASC;
```

### 4. إحصائيات الحجوزات

```sql
SELECT 
  status,
  COUNT(*) as count,
  field_name
FROM bookings 
GROUP BY status, field_name
ORDER BY field_name, status;
```

### 5. الحجوزات القادمة

```sql
SELECT * FROM bookings 
WHERE booking_date >= CURRENT_DATE 
  AND status = 'approved'
ORDER BY booking_date ASC, start_time ASC;
```

---

## 🔄 العمليات الشائعة

### إنشاء حجز جديد

```sql
INSERT INTO bookings (
  field_name, 
  customer_name, 
  phone, 
  booking_date, 
  start_time, 
  end_time,
  reminder_time
) VALUES (
  'Safari 1',
  'أحمد محمد',
  '+966501234567',
  '2024-01-20',
  '16:00',
  '18:00',
  '2024-01-20 14:00:00+00'  -- قبل ساعتين
);
```

### تحديث حالة الحجز

```sql
UPDATE bookings 
SET status = 'approved' 
WHERE id = 'uuid-here';
```

### تحديد التذكير كمُرسل

```sql
UPDATE bookings 
SET reminder_sent = TRUE 
WHERE id = 'uuid-here';
```

### حذف حجز (غير موصى به)

```sql
-- بدلاً من الحذف، استخدم الرفض
UPDATE bookings 
SET status = 'rejected' 
WHERE id = 'uuid-here';
```

---

## 📊 تحليل الأداء

### تحليل استعلام

```sql
EXPLAIN ANALYZE
SELECT * FROM bookings 
WHERE field_name = 'Safari 1' 
  AND booking_date = '2024-01-20';
```

### إحصائيات الجدول

```sql
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables 
WHERE tablename = 'bookings';
```

---

## 🧹 الصيانة

### تنظيف الجدول

```sql
VACUUM ANALYZE bookings;
```

### إعادة بناء الفهارس

```sql
REINDEX TABLE bookings;
```

### حذف الحجوزات القديمة (اختياري)

```sql
-- حذف الحجوزات المرفوضة الأقدم من 6 أشهر
DELETE FROM bookings 
WHERE status = 'rejected' 
  AND created_at < NOW() - INTERVAL '6 months';
```

---

## 📦 النسخ الاحتياطي

### تصدير البيانات

```bash
# باستخدام Supabase CLI
supabase db dump -f backup.sql

# أو من Dashboard: Database > Backups
```

### استيراد البيانات

```bash
supabase db push backup.sql
```

---

## 🔮 التوسعات المستقبلية

### أفكار لتطوير قاعدة البيانات:

1. **جدول الملاعب** (`fields`)
   - معلومات تفصيلية عن كل ملعب
   - الأسعار
   - المرافق المتاحة

2. **جدول العملاء** (`customers`)
   - تاريخ الحجوزات
   - نقاط الولاء
   - التفضيلات

3. **جدول الدفع** (`payments`)
   - تتبع المدفوعات
   - الفواتير
   - الخصومات

4. **جدول التقييمات** (`reviews`)
   - تقييمات العملاء
   - التعليقات
   - التحسينات

---

## 📝 ملاحظات مهمة

1. ✅ جميع الأوقات مخزنة بـ UTC
2. ✅ استخدم `reminder_time` بدلاً من حساب الوقت في التطبيق
3. ✅ لا تحذف السجلات - استخدم `status = 'rejected'`
4. ✅ راجع الفهارس بانتظام للتأكد من الأداء
5. ✅ فعّل النسخ الاحتياطي التلقائي في Supabase

---

**آخر تحديث**: 2024
**الإصدار**: 1.0
