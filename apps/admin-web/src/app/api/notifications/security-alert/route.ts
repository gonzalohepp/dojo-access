import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const bodyData = await req.json()
        const record = bodyData.record || bodyData

        // 1. Validate it's a denial
        if (record.result !== 'denegado' && record.result !== 'denied') {
            return NextResponse.json({ message: 'Not a denial, skipping' })
        }

        // 2. Get Member Name and Check for Fraud
        let memberName = 'Usuario'
        let isFraudAttempt = false
        if (record.user_id) {
            const { data: p } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', record.user_id)
                .maybeSingle()
            if (p) memberName = `${p.first_name} ${p.last_name}`

            // Fraud Check: 3 denied logs in 5 minutes
            const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
            const { count } = await supabase
                .from('access_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', record.user_id)
                .eq('result', 'denegado')
                .gt('scanned_at', fiveMinsAgo)

            if (count && count >= 3) {
                isFraudAttempt = true
            }
        }

        // 3. Find ALL Admins
        const { data: admins } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('role', 'admin')

        if (!admins || admins.length === 0) {
            return NextResponse.json({ message: 'No admins found to notify' })
        }

        const adminIds = admins.map(a => a.user_id)

        // 4. Setup VAPID
        const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
        const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:admin@beleza-dojo.com',
            PUBLIC_KEY!,
            PRIVATE_KEY!
        )

        const payload = JSON.stringify({
            title: isFraudAttempt ? '⚠️ ALERTA DE SEGURIDAD' : '🚩 Alerta de Acceso',
            body: isFraudAttempt
                ? `REPETIDAS NEGATIVAS: ${memberName} ha fallado múltiples intentos.`
                : `${memberName}: ${record.reason || 'Acceso denegado'}`,
            url: '/admin'
        })

        // 5. Send to all admins
        let totalSent = 0
        for (const adminId of adminIds) {
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('subscription')
                .eq('user_id', adminId)

            if (subs) {
                for (const s of subs) {
                    try {
                        await webpush.sendNotification(s.subscription as any, payload)
                        totalSent++
                    } catch (e: any) {
                        if (e.statusCode === 410 || e.statusCode === 404) {
                            await supabase.from('push_subscriptions').delete().match({ subscription: s.subscription })
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true, admins_notified: adminIds.length, push_sent: totalSent })

    } catch (e: any) {
        console.error('[Security Alert API] Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
