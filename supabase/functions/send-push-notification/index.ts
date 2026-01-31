import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.6'

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
    console.log('📨 Received notification request')
    const { title, body, icon, data, userType } = await req.json() as NotificationPayload
    console.log(`📋 Title: ${title}, UserType: ${userType}`)

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
    console.log(`🔍 Found ${subscriptions?.length || 0} subscriptions`)

    if (error) {
      console.error('❌ Database error:', error)
      throw error
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ No subscriptions found')
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', userType }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // إعداد VAPID
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('❌ VAPID keys not configured')
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    webpush.setVapidDetails(
      'mailto:admin@safaristadium.com',
      vapidPublicKey,
      vapidPrivateKey
    )

    // إرسال الإشعارات لكل اشتراك
    const notifications = subscriptions.map(async (sub) => {
      try {
        console.log(`📤 Sending to: ${sub.endpoint.substring(0, 50)}...`)
        
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

        await webpush.sendNotification(pushSubscription, payload)
        console.log(`✅ Sent successfully to ${sub.user_type}`)
        
        return { 
          success: true,
          endpoint: sub.endpoint.substring(0, 50) + '...',
          userType: sub.user_type
        }
      } catch (error: any) {
        console.error(`❌ Error sending to ${sub.user_type}:`, error.message)
        return { 
          success: false, 
          error: error.message, 
          endpoint: sub.endpoint.substring(0, 50) + '...',
          userType: sub.user_type
        }
      }
    })

    const results = await Promise.all(notifications)
    const successCount = results.filter(r => r.success).length

    console.log(`✅ Sent ${successCount}/${results.length} notifications`)

    return new Response(
      JSON.stringify({ 
        message: `Sent ${successCount} out of ${results.length} notifications`,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('❌ Function error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
