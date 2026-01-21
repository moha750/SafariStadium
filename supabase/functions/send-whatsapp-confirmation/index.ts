/**
 * Edge Function: إرسال رسالة واتساب عند تأكيد الحجز
 * 
 * يتم استدعاء هذه الدالة تلقائياً عند تحديث حالة الحجز إلى "approved"
 * باستخدام Database Webhook أو Database Trigger
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// واجهة بيانات الحجز
interface Booking {
  id: string;
  field_name: string;
  customer_name: string;
  phone: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
}

// إعدادات WhatsApp Cloud API (مباشرة)
const WHATSAPP_PHONE_NUMBER_ID = '857529983748164';
const WHATSAPP_ACCESS_TOKEN = 'EAAMRuJyhB1EBQhU4VQPbB8TJ4KfB25GbORTUZAiPKGNt64DdfuZCjzGCjJ3eWpeDvRo5QHMyQOOZB4vyq7MhFg57sJZCvAXnPB7kprout1eROr73RizDeSc6GegWrjUdDZAkiT7vtP99NH9vI4cMsySA5iodguyj1kqdctZCjZB7MpOvzNBCT1YQ4ZCoeZCeMuUHU0i683abeVmp8EmwK3pHZCTqEWla1iVSylqIaf';

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
    
    console.log('Sending WhatsApp message to:', to);
    console.log('Using Phone Number ID:', WHATSAPP_PHONE_NUMBER_ID);
    
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
      console.error('Response statusText:', response.statusText);
      return false;
    }

    const result = await response.json();
    console.log('WhatsApp message sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

/**
 * تنسيق رسالة التأكيد
 */
function formatConfirmationMessage(booking: Booking): string {
  const date = new Date(booking.booking_date);
  const dateStr = date.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
✅ *تأكيد حجز ملعب سفاري*

مرحباً ${booking.customer_name}،

تم تأكيد حجزك بنجاح! 🎉

📍 *الملعب:* ${booking.field_name}
📅 *التاريخ:* ${dateStr}
⏰ *الوقت:* من ${booking.start_time} إلى ${booking.end_time}

نتطلع لرؤيتك! ⚽

---
ملاعب سفاري
للاستفسار: اتصل بنا
  `.trim();
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
  // التحقق من طريقة الطلب
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { type, record } = await req.json();
    const booking: Booking = record;

    console.log('Processing webhook:', { type, bookingId: booking.id, status: booking.status });

    // التحقق من نوع الحدث
    if (type === 'INSERT' || type === 'UPDATE') {
      // إرسال رسالة تأكيد عند الموافقة على الحجز
      if (booking.status === 'approved') {
        const message = formatConfirmationMessage(booking);
        const sent = await sendWhatsAppMessage(booking.phone, message);

        return new Response(
          JSON.stringify({
            success: sent,
            message: sent ? 'Confirmation sent successfully' : 'Failed to send confirmation',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            status: sent ? 200 : 500,
          }
        );
      }
    }

    // إرسال رسالة تذكير (يتم استدعاؤها من CRON)
    if (type === 'REMINDER') {
      const message = formatReminderMessage(booking);
      const sent = await sendWhatsAppMessage(booking.phone, message);

      return new Response(
        JSON.stringify({
          success: sent,
          message: sent ? 'Reminder sent successfully' : 'Failed to send reminder',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          status: sent ? 200 : 500,
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'No action needed' }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 500,
      }
    );
  }
});
