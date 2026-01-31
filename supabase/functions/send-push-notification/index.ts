import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  data?: any
  userType?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, body, icon, data, userType } = await req.json() as NotificationPayload

    // إنشاء عميل Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // جلب الاشتراكات حسب نوع المستخدم
    let query = supabaseClient.from('push_subscriptions').select('*')
    
    if (userType) {
      query = query.eq('user_type', userType)
    }

    const { data: subscriptions, error } = await query

    if (error) {
      throw error
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // إرسال الإشعارات لكل اشتراك
    const notifications = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }

        const payload = JSON.stringify({
          title: title || 'ملاعب سفاري',
          body: body || 'لديك إشعار جديد',
          icon: icon || '/icon-192.png',
          data: data || {}
        })

        // استخدام Web Push API
        // ملاحظة: يجب إعداد VAPID keys في متغيرات البيئة
        const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
        const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

        if (!vapidPublicKey || !vapidPrivateKey) {
          console.error('VAPID keys not configured')
          return { success: false, error: 'VAPID keys not configured' }
        }

        // هنا يمكنك استخدام مكتبة web-push
        // لكن في Deno Edge Functions، نستخدم طريقة مختلفة
        
        // للتبسيط، نستخدم fetch مباشرة
        const response = await fetch(pushSubscription.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400'
          },
          body: payload
        })

        return { 
          success: response.ok, 
          status: response.status,
          endpoint: sub.endpoint 
        }
      } catch (error) {
        console.error('Error sending notification:', error)
        return { success: false, error: error.message, endpoint: sub.endpoint }
      }
    })

    const results = await Promise.all(notifications)
    const successCount = results.filter(r => r.success).length

    return new Response(
      JSON.stringify({ 
        message: `Sent ${successCount} out of ${results.length} notifications`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
