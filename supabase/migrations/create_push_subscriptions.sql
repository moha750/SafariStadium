-- إنشاء جدول لحفظ اشتراكات الإشعارات
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_type TEXT CHECK (user_type IN ('admin', 'staff', 'customer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إنشاء index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_type ON push_subscriptions(user_type);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- تفعيل Row Level Security
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بإضافة اشتراكات
CREATE POLICY "Allow insert for all users" ON push_subscriptions
  FOR INSERT WITH CHECK (true);

-- السماح للجميع بقراءة اشتراكاتهم
CREATE POLICY "Allow select for all users" ON push_subscriptions
  FOR SELECT USING (true);

-- السماح بحذف الاشتراكات
CREATE POLICY "Allow delete for all users" ON push_subscriptions
  FOR DELETE USING (true);

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger لتحديث updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
