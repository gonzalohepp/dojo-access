import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const body = await req.json()
        const { target, customUserId, title, message, url } = body

        if (!title || !message) {
            return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
        }

        // 1. Determine target user IDs based on selection
        let targetUserIds: string[] = []

        if (target === 'custom') {
            if (!customUserId) {
                return NextResponse.json({ error: 'User ID required for custom target' }, { status: 400 })
            }
            targetUserIds = [customUserId]
        } else if (target === 'all') {
            const { data, error } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('role', 'member')

            console.log('[Custom Notification] "all" query result:', { count: data?.length, error })
            targetUserIds = (data || []).map(p => p.user_id)
        } else if (target === 'active') {
            const { data } = await supabase
                .from('members_with_status')
                .select('user_id')
                .eq('status', 'activo')
            targetUserIds = (data || []).map(p => p.user_id)
        } else if (target === 'expiring') {
            const today = new Date().toISOString().slice(0, 10)
            const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

            const { data } = await supabase
                .from('memberships')
                .select('member_id')
                .gte('end_date', today)
                .lte('end_date', sevenDaysLater)

            targetUserIds = (data || []).map(m => m.member_id)
        }

        console.log(`[Custom Notification] Targeting ${targetUserIds.length} users for target="${target}"`)

        if (targetUserIds.length === 0) {
            return NextResponse.json({
                message: 'No users found for this target',
                count: 0,
                target,
                debug: target === 'all' ? 'Try checking if users have role="member" in profiles table' : ''
            })
        }

        // 2. Setup VAPID
        const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
        const SUBS_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@beleza-dojo.com'

        if (!PUBLIC_KEY || !PRIVATE_KEY) {
            return NextResponse.json({ error: 'VAPID keys missing' }, { status: 500 })
        }

        webpush.setVapidDetails(SUBS_SUBJECT, PUBLIC_KEY, PRIVATE_KEY)

        // 3. Send to all target users
        let sentCount = 0

        const results = await Promise.all(targetUserIds.map(async (userId) => {
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', userId)

            if (!subs || subs.length === 0) return 0

            const payload = JSON.stringify({
                title,
                body: message,
                url: url || '/'
            })

            let userSent = 0
            for (const s of subs) {
                try {
                    await webpush.sendNotification(s.subscription as any, payload)
                    userSent++
                } catch (e: any) {
                    console.error(`Failed to send to ${userId}:`, e)
                    if (e.statusCode === 410 || e.statusCode === 404) {
                        await supabase.from('push_subscriptions').delete().match({ subscription: s.subscription })
                    }
                }
            }
            return userSent
        }))

        const totalSent = results.reduce((a, b) => a + b, 0)

        // 4. Record in history (graceful fail if table doesn't exist)
        try {
            await supabase.from('notification_history').insert({
                title,
                message,
                target,
                url: url || '/',
                count: totalSent,
                status: 'sent'
            })
        } catch (e) {
            console.error('[Custom Notification] Could not save to history:', e)
        }

        return NextResponse.json({
            success: true,
            target,
            target_users: targetUserIds.length,
            count: totalSent
        })

    } catch (e: any) {
        console.error('[Custom Notification] Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
