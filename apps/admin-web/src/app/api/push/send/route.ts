import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const bodyData = await req.json()

        // Support either direct call or Supabase Webhook payload
        const payload_data = bodyData.record ? bodyData.record : bodyData
        const { user_id, title, body, url } = payload_data

        if (!user_id) {
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
        }

        // Fetch subscriptions for the user
        const { data: subs, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', user_id)

        if (subError) throw subError
        if (!subs || subs.length === 0) {
            return NextResponse.json({ message: 'No subscriptions found for this user' })
        }

        // Configure VAPID
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@beleza-dojo.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
        )

        const payload = JSON.stringify({ title, body, url: url || '/' })

        const sendPromises = subs.map((s: any) =>
            webpush.sendNotification(s.subscription, payload)
                .catch(async (err) => {
                    console.error('Error sending notification:', err)
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Cleanup expired subscription
                        await supabase
                            .from('push_subscriptions')
                            .delete()
                            .match({ subscription: s.subscription })
                    }
                })
        )

        await Promise.all(sendPromises)

        return NextResponse.json({ success: true, count: subs.length })
    } catch (error: any) {
        console.error('Push Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
