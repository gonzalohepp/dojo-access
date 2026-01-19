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

        console.log('[Custom Notification] Request received:', { target, customUserId, title, url })

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
            // Target only regular members for "TODOS" to avoid spamming admins/teachers
            const { data, error } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('role', 'member')

            console.log('[Custom Notification] "all" query (members only) result:', { count: data?.length, error })
            targetUserIds = (data || []).map(p => p.user_id)
        } else if (target === 'active') {
            // Get active members (exclude admins/teachers to avoid spamming them with member news)
            const { data } = await supabase
                .from('members_with_status')
                .select('user_id')
                .eq('status', 'activo')
                .eq('role', 'member')
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

        // 3. Send Notifications using Web-Push
        const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
        const SUBS_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@beleza-dojo.com'

        if (!PUBLIC_KEY || !PRIVATE_KEY) {
            return NextResponse.json({ error: 'Push service not configured' }, { status: 500 })
        }

        webpush.setVapidDetails(SUBS_SUBJECT, PUBLIC_KEY, PRIVATE_KEY)

        let devicesReached = 0
        const usersReached = new Set<string>()

        const results = await Promise.all(targetUserIds.map(async (uid) => {
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', uid)

            if (!subs || subs.length === 0) return 0

            let userDevices = 0
            const payload = JSON.stringify({
                title,
                body: message,
                url: url || '/'
            })

            for (const s of subs) {
                try {
                    await webpush.sendNotification(s.subscription as any, payload)
                    userDevices++
                    devicesReached++
                    usersReached.add(uid)
                } catch (e: any) {
                    console.error(`Error sending to ${uid}:`, e)
                    if (e.statusCode === 410 || e.statusCode === 404) {
                        await supabase.from('push_subscriptions').delete().match({ subscription: s.subscription })
                    }
                }
            }
            return userDevices
        }))

        // Save to History
        try {
            await supabase.from('notification_history').insert({
                title,
                message,
                target,
                status: 'sent',
                count: usersReached.size // We log unique users in history
            })
        } catch (err) {
            console.error('Error saving history:', err)
        }

        return NextResponse.json({
            success: true,
            userCount: usersReached.size,
            deviceCount: devicesReached,
            count: usersReached.size // fallback for existing UI
        })

    } catch (e: any) {
        console.error('[Custom Notification] Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
