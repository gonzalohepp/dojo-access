import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const bodyData = await req.json()
        console.log('[PushAPI] Received Request:', JSON.stringify(bodyData))

        // Support either direct call or Supabase Webhook payload
        const payload_data = bodyData.record ? bodyData.record : bodyData
        const { user_id, title, body, url } = payload_data

        if (!user_id) {
            console.warn('[PushAPI] Missing user_id')
            return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
        }

        // Fetch subscriptions for the user
        const { data: subs, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .eq('user_id', user_id)

        if (subError) {
            console.error('[PushAPI] Supabase Error:', subError)
            throw subError
        }

        console.log(`[PushAPI] Found ${subs?.length || 0} subscriptions for user ${user_id}`)

        if (!subs || subs.length === 0) {
            return NextResponse.json({ message: 'No subscriptions found for this user' })
        }

        // Configure VAPID - Try both with and without NEXT_PUBLIC prefix
        const rawPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const rawPrivateKey = process.env.VAPID_PRIVATE_KEY
        const subject = (process.env.VAPID_SUBJECT || 'mailto:admin@beleza-dojo.com').trim()

        const publicKey = rawPublicKey?.trim()
        const privateKey = rawPrivateKey?.trim()

        console.log('[PushAPI] VAPID Debug:', {
            hasPublic: !!publicKey,
            publicLength: publicKey?.length || 0,
            hasPrivate: !!privateKey,
            privateLength: privateKey?.length || 0,
            subject
        })

        if (!publicKey || !privateKey) {
            return NextResponse.json({ error: 'Server VAPID configuration missing' }, { status: 500 })
        }

        try {
            webpush.setVapidDetails(subject, publicKey, privateKey)
        } catch (setErr: any) {
            console.error('[PushAPI] setVapidDetails failed:', setErr.message)
            throw setErr
        }

        const payload = JSON.stringify({
            title: title || 'Notificación',
            body: body || 'Tienes un nuevo aviso del Dojo.',
            url: url || '/'
        })

        const sendPromises = subs.map((s: any) =>
            webpush.sendNotification(s.subscription, payload)
                .then(() => console.log('[PushAPI] Notification sent successfully'))
                .catch(async (err) => {
                    console.error('[PushAPI] Error sending notification:', err)
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log('[PushAPI] Cleaning up expired subscription')
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
