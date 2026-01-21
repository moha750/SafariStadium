/**
 * Edge Function: إرسال تذكيرات الحجز
 * 
 * يتم تشغيل هذه الدالة بواسطة CRON كل 15 دقيقة
 * للبحث عن الحجوزات التي تحتاج إلى تذكير وإرسال رسائل واتساب
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// واجهة بيانات الحجز
interface Booking {
  id: string;
  field_name: string;
  customer_name: string;
  phone: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  reminder_time: string;
  reminder_sent: boolean;
}

// إعدادات WhatsApp Cloud API (مباشرة)
const WHATSAPP_PHONE_NUMBER_ID = '857529983748164';
const WHATSAPP_ACCESS_TOKEN = 'EAAMRuJyhB1EBQhU4VQPbB8TJ4KfB25GbORTUZAiPKGNt64DdfuZCjzGCjJ3eWpeDvRo5QHMyQOOZB4vyq7MhFg57sJZCvAXnPB7kprout1eROr73RizDeSc6GegWrjUdDZAkiT7vtP99NH9vI4cMsySA5iodguyj1kqdctZCjZB7MpOvzNBCT1YQ4ZCoeZCeMuUHU0i683abeVmp8EmwK3pHZCTqEWla1iVSylqIaf';

// إعدادات Supabase
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

/**
 * إرسال رسالة واتساب
 */
async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    // التحقق من المتغيرات
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error('WhatsApp credentials not configured');
      return false;
    }

    // بناء URL الصحيح
    const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    
    console.log('Sending WhatsApp reminder to:', to);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'text',
        text: {
          body: message,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('WhatsApp API Error:', error);
      console.error('Response status:', response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

/**
 * تنسيق رسالة التذكير
 */
function formatReminderMessage(booking: Booking): string {
  const date = new Date(booking.booking_date);
  const dateStr = date.toLocaleDateString('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return `
⏰ *تذكير بموعد الحجز*

مرحباً ${booking.customer_name}،

نذكرك بأن لديك حجز بعد ساعتين:

📍 *الملعب:* ${booking.field_name}
📅 *التاريخ:* ${dateStr}
⏰ *الوقت:* ${booking.start_time}

نراك قريباً! ⚽

---
ملاعب سفاري
  `.trim();
}

/**
 * معالج الطلبات الرئيسي
 */
serve(async (req) => {
  try {
    console.log('Starting reminder check...');

    // إنشاء عميل Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // البحث عن الحجوزات التي تحتاج إلى تذكير
    const now = new Date().toISOString();
    
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('status', 'approved')
      .eq('reminder_sent', false)
      .lte('reminder_time', now)
      .order('reminder_time', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log(`Found ${bookings?.length || 0} bookings needing reminders`);

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No reminders to send',
          count: 0,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // إرسال التذكيرات
    const results = await Promise.all(
      bookings.map(async (booking: Booking) => {
        try {
          const message = formatReminderMessage(booking);
          const sent = await sendWhatsAppMessage(booking.phone, message);

          if (sent) {
            // تحديث حالة التذكير في قاعدة البيانات
            await supabase
              .from('bookings')
              .update({ reminder_sent: true })
              .eq('id', booking.id);

            console.log(`Reminder sent successfully for booking ${booking.id}`);
            return { id: booking.id, success: true };
          } else {
            console.error(`Failed to send reminder for booking ${booking.id}`);
            return { id: booking.id, success: false };
          }
        } catch (error) {
          console.error(`Error processing booking ${booking.id}:`, error);
          return { id: booking.id, success: false, error: error.message };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} reminders`,
        successCount,
        failureCount,
        results,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in reminder function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
