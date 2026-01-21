# 📡 توثيق API - نظام حجز ملاعب سفاري

## نظرة عامة

يستخدم النظام **Supabase REST API** للتفاعل مع قاعدة البيانات. جميع الطلبات تتطلب مفتاح API.

---

## 🔑 المصادقة

### Headers المطلوبة

```javascript
{
  "apikey": "YOUR_SUPABASE_ANON_KEY",
  "Authorization": "Bearer YOUR_SUPABASE_ANON_KEY",
  "Content-Type": "application/json"
}
```

---

## 📋 Endpoints

### 1. إنشاء حجز جديد

**POST** `/rest/v1/bookings`

#### Request Body

```json
{
  "field_name": "Safari 1",
  "customer_name": "أحمد محمد",
  "phone": "+966501234567",
  "booking_date": "2024-01-20",
  "start_time": "16:00",
  "end_time": "18:00",
  "status": "pending"
}
```

#### Response (201 Created)

```json
[
  {
    "id": "uuid-here",
    "field_name": "Safari 1",
    "customer_name": "أحمد محمد",
    "phone": "+966501234567",
    "booking_date": "2024-01-20",
    "start_time": "16:00:00",
    "end_time": "18:00:00",
    "status": "pending",
    "created_at": "2024-01-19T10:30:00+00:00",
    "updated_at": "2024-01-19T10:30:00+00:00"
  }
]
```

#### مثال JavaScript

```javascript
const response = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
  method: 'POST',
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    field_name: 'Safari 1',
    customer_name: 'أحمد محمد',
    phone: '+966501234567',
    booking_date: '2024-01-20',
    start_time: '16:00',
    end_time: '18:00'
  })
});

const data = await response.json();
```

---

### 2. جلب جميع الحجوزات

**GET** `/rest/v1/bookings?order=created_at.desc`

#### Query Parameters

| المعامل | النوع | الوصف | مثال |
|---------|------|-------|------|
| `status` | string | تصفية حسب الحالة | `?status=eq.pending` |
| `field_name` | string | تصفية حسب الملعب | `?field_name=eq.Safari 1` |
| `booking_date` | date | تصفية حسب التاريخ | `?booking_date=eq.2024-01-20` |
| `order` | string | الترتيب | `?order=created_at.desc` |
| `limit` | number | الحد الأقصى | `?limit=50` |

#### Response (200 OK)

```json
[
  {
    "id": "uuid-1",
    "field_name": "Safari 1",
    "customer_name": "أحمد محمد",
    "phone": "+966501234567",
    "booking_date": "2024-01-20",
    "start_time": "16:00:00",
    "end_time": "18:00:00",
    "status": "pending",
    "created_at": "2024-01-19T10:30:00+00:00"
  },
  {
    "id": "uuid-2",
    "field_name": "Safari 2",
    "customer_name": "خالد علي",
    "phone": "+966509876543",
    "booking_date": "2024-01-21",
    "start_time": "19:00:00",
    "end_time": "21:00:00",
    "status": "approved",
    "created_at": "2024-01-19T09:15:00+00:00"
  }
]
```

#### مثال JavaScript

```javascript
// جلب جميع الحجوزات
const response = await fetch(
  `${SUPABASE_URL}/rest/v1/bookings?order=created_at.desc`,
  {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  }
);

// جلب الحجوزات قيد الانتظار فقط
const pendingResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/bookings?status=eq.pending&order=created_at.desc`,
  {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  }
);
```

---

### 3. تحديث حالة الحجز

**PATCH** `/rest/v1/bookings?id=eq.{booking_id}`

#### Request Body

```json
{
  "status": "approved"
}
```

#### Response (200 OK)

```json
[
  {
    "id": "uuid-here",
    "status": "approved",
    "updated_at": "2024-01-19T11:00:00+00:00"
  }
]
```

#### مثال JavaScript

```javascript
const response = await fetch(
  `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,
  {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ status: 'approved' })
  }
);
```

---

### 4. التحقق من التوفر

**GET** `/rest/v1/bookings?field_name=eq.{field}&booking_date=eq.{date}&status=neq.rejected`

#### مثال JavaScript

```javascript
async function checkAvailability(fieldName, date, startTime, endTime) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?field_name=eq.${encodeURIComponent(fieldName)}&booking_date=eq.${date}&status=neq.rejected`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    }
  );
  
  const bookings = await response.json();
  
  // التحقق من التداخل الزمني
  const hasConflict = bookings.some(booking => {
    return (
      (startTime >= booking.start_time && startTime < booking.end_time) ||
      (endTime > booking.start_time && endTime <= booking.end_time) ||
      (startTime <= booking.start_time && endTime >= booking.end_time)
    );
  });
  
  return !hasConflict;
}
```

---

## 🔍 عوامل التصفية المتقدمة

### Operators المتاحة

| Operator | الوصف | مثال |
|----------|-------|------|
| `eq` | يساوي | `?status=eq.pending` |
| `neq` | لا يساوي | `?status=neq.rejected` |
| `gt` | أكبر من | `?booking_date=gt.2024-01-20` |
| `gte` | أكبر من أو يساوي | `?booking_date=gte.2024-01-20` |
| `lt` | أصغر من | `?booking_date=lt.2024-01-30` |
| `lte` | أصغر من أو يساوي | `?booking_date=lte.2024-01-30` |
| `like` | يشبه | `?customer_name=like.*أحمد*` |
| `ilike` | يشبه (غير حساس) | `?customer_name=ilike.*AHMED*` |
| `in` | في القائمة | `?status=in.(pending,approved)` |

### أمثلة متقدمة

```javascript
// الحجوزات المؤكدة بعد تاريخ معين
const url = `${SUPABASE_URL}/rest/v1/bookings?status=eq.approved&booking_date=gte.2024-01-20`;

// الحجوزات لملعب معين في نطاق زمني
const url = `${SUPABASE_URL}/rest/v1/bookings?field_name=eq.Safari 1&booking_date=gte.2024-01-20&booking_date=lte.2024-01-30`;

// البحث عن عميل
const url = `${SUPABASE_URL}/rest/v1/bookings?customer_name=ilike.*أحمد*`;
```

---

## ⚠️ معالجة الأخطاء

### أخطاء شائعة

#### 401 Unauthorized
```json
{
  "message": "Invalid API key"
}
```
**الحل**: تحقق من صحة `apikey` و `Authorization` headers

#### 400 Bad Request
```json
{
  "message": "Invalid input syntax",
  "details": "..."
}
```
**الحل**: تحقق من صحة البيانات المرسلة

#### 409 Conflict
```json
{
  "message": "duplicate key value violates unique constraint"
}
```
**الحل**: السجل موجود مسبقاً

#### 500 Internal Server Error
```json
{
  "message": "Internal server error"
}
```
**الحل**: راجع Supabase logs

---

## 🛡 أفضل الممارسات

### 1. استخدام Try-Catch

```javascript
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  const data = await response.json();
  return { success: true, data };
} catch (error) {
  console.error('API Error:', error);
  return { success: false, error: error.message };
}
```

### 2. التحقق من البيانات قبل الإرسال

```javascript
function validateBooking(data) {
  if (!data.customer_name || data.customer_name.length < 3) {
    throw new Error('اسم غير صحيح');
  }
  
  if (!data.phone.match(/^\+[1-9]\d{1,14}$/)) {
    throw new Error('رقم هاتف غير صحيح');
  }
  
  // المزيد من التحققات...
}
```

### 3. استخدام Debouncing للبحث

```javascript
let searchTimeout;

function searchBookings(query) {
  clearTimeout(searchTimeout);
  
  searchTimeout = setTimeout(async () => {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?customer_name=ilike.*${query}*`
    );
    // معالجة النتائج...
  }, 300);
}
```

---

## 📊 حدود الاستخدام

### Supabase Free Tier

- **Database Size**: 500 MB
- **Bandwidth**: 5 GB/month
- **API Requests**: غير محدود

### توصيات

- استخدم Pagination للبيانات الكبيرة
- قلل عدد الطلبات باستخدام Caching
- استخدم `select` لتحديد الأعمدة المطلوبة فقط

```javascript
// بدلاً من جلب كل الأعمدة
const url = `${SUPABASE_URL}/rest/v1/bookings`;

// حدد الأعمدة المطلوبة
const url = `${SUPABASE_URL}/rest/v1/bookings?select=id,customer_name,status`;
```

---

## 🔗 روابط مفيدة

- [Supabase REST API Docs](https://supabase.com/docs/guides/api)
- [PostgREST Documentation](https://postgrest.org/)

---

**آخر تحديث**: 2024
