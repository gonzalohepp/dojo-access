import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import webpush from "https://esm.sh/web-push@3.6.7"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const bodyData = await req.json()
        const payload_data = bodyData.record ? bodyData.record : bodyData
        const { user_id, title, body, url } = payload_data

        if (!user_id) throw new Error('user_id is required')

        // Fetch subscriptions for the user
        const { data: subs, error: subError } = await supabaseClient
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', user_id)

        if (subError) throw subError
        if (!subs || subs.length === 0) {
            return new Response(JSON.stringify({ message: 'No subscriptions found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const vapidKeys = {
            publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
            privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
        }

        webpush.setVapidDetails(
            Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@beleza-dojo.com',
            vapidKeys.publicKey,
            vapidKeys.privateKey
        )

        const payload = JSON.stringify({ title, body, url: url || '/' })

        const sendPromises = subs.map((s: any) =>
            webpush.sendNotification(s.subscription, payload)
                .catch((err: any) => {
                    console.error('Error sending notification:', err)
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Subscription expired or no longer valid, we should clean it up
                        // This would require another delete call
                    }
                })
        )

        await Promise.all(sendPromises)

        return new Response(JSON.stringify({ success: true, notificationsSent: subs.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
