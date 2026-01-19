import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 1. Get current date details
        const now = new Date()
        const day = now.getDate() // 1-31

        // For testing, we might want to accept an override date? 
        // Let's stick to real date for safety, or check body for "force_day" if admin wants to test.
        const body = await req.json().catch(() => ({}))
        const checkDay = body.force_day || day

        console.log(`[Reminders] Running check for day: ${checkDay}`)

        let title = ''
        let message = ''
        let shouldSend = false

        // Logic A: Days 8, 9, 10 (Surcharge Warning)
        if ([8, 9, 10].includes(checkDay)) {
            title = '📢 ¡Evita Recargos!'
            message = 'Recuerda abonar tu cuota antes del día 10 para evitar el 20% de recargo. ¡Te esperamos en el Dojo!'
            shouldSend = true // Only filter active members unpaid
        }

        // Logic B: Days 18, 19, 20 (Lock Warning)
        if ([18, 19, 20].includes(checkDay)) {
            title = '⚠️ Tu pase está por vencer'
            message = 'Últimos días para regularizar tu cuota. A partir del día 21 el acceso se bloqueará automáticamente.'
            shouldSend = true
        }

        if (!shouldSend) {
            return NextResponse.json({ message: 'No reminders scheduled for today.' })
        }

        // 2. Find Target Audience: Active Members who haven't paid this month
        // logic: status != 'inactivo' (or specific check) AND (last_payment_date < FirstDayOfMonth OR last_payment_date IS NULL)

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

        // Fetch candidates
        const { data: candidates, error } = await supabase
            .from('members_with_status') // Using view for active status convenience
            .select('user_id, first_name')
            .eq('status', 'activo')

        if (error) throw error

        // We need to verify 'last_payment_date' from 'memberships' because view might not have it yet (unless updated)
        // Ideally we JOIN or separate query. For simplicity and robustness:

        const { data: paidMembers } = await supabase
            .from('memberships')
            .select('member_id')
            .gte('last_payment_date', startOfMonth)

        const paidIds = new Set((paidMembers || []).map(m => m.member_id))

        const targets = (candidates || []).filter(c => !paidIds.has(c.user_id))

        console.log(`[Reminders] Found ${targets.length} unpaid active members.`)

        if (targets.length === 0) {
            return NextResponse.json({ message: 'Everyone is up to date!' })
        }

        // 3. Send Notifications using existing Push Logic (Internal)
        // We reuse the VAPID config from env
        const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
        const SUBS_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@beleza-dojo.com'

        if (!PUBLIC_KEY || !PRIVATE_KEY) throw new Error('VAPID Keys missing')

        webpush.setVapidDetails(SUBS_SUBJECT, PUBLIC_KEY, PRIVATE_KEY)

        let sentCount = 0

        // Batch processing
        const results = await Promise.all(targets.map(async (user) => {
            // Get sub
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', user.user_id)

            if (!subs || subs.length === 0) return 0;

            const payload = JSON.stringify({
                title,
                body: message,
                url: '/profile' // Direct them to their profile/payment info
            })

            let userSent = 0
            for (const s of subs) {
                try {
                    await webpush.sendNotification(s.subscription as any, payload)
                    userSent++
                } catch (e: any) {
                    console.error(`Failed to send to ${user.user_id}:`, e)
                    if (e.statusCode === 410 || e.statusCode === 404) {
                        await supabase.from('push_subscriptions').delete().match({ subscription: s.subscription })
                    }
                }
            }
            return userSent
        }))

        const totalSent = results.reduce((a, b) => a + b, 0)

        return NextResponse.json({
            success: true,
            day: checkDay,
            target_users: targets.length,
            notifications_sent: totalSent
        })

    } catch (e: any) {
        console.error('[Reminders] Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
