import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const url = new URL(req.url)
        let topic = url.searchParams.get('topic') || url.searchParams.get('type')
        let id = url.searchParams.get('id') || url.searchParams.get('data.id')

        try {
            const body = await req.json()
            if (!id) id = body.data?.id || body.id
            if (!topic) topic = body.type || body.topic || body.action
        } catch {
            // No hay body JSON, seguimos con URL params
        }

        console.log(`Webhook received: topic=${topic}, id=${id}`)

        if (topic !== 'payment' && topic !== 'payment_intent' && !String(topic).includes('payment')) {
            return NextResponse.json({ received: true })
        }

        if (!id || id === '123456') {
            console.log('Test notification or missing ID — ignoring.')
            return NextResponse.json({ received: true, message: 'Test ignore' })
        }

        const accessToken = process.env.MP_ACCESS_TOKEN
        if (!accessToken) throw new Error('MP_ACCESS_TOKEN missing')

        const client = new MercadoPagoConfig({ accessToken })
        const payment = new Payment(client)

        let paymentData
        try {
            paymentData = await payment.get({ id: String(id) })
        } catch (err) {
            console.error('Error fetching payment from MP:', err)
            return NextResponse.json({ received: true, error: 'Payment not found' })
        }

        const { status, external_reference } = paymentData

        if (status === 'approved' && external_reference) {
            const { user_id, principal_id, additional_ids } = JSON.parse(external_reference)

            if (!user_id) throw new Error('No user_id in external_reference')

            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            // ── IDEMPOTENCIA ──────────────────────────────────────────────
            // MP puede enviar el mismo webhook varias veces. Evitamos duplicados.
            const { data: existing } = await supabase
                .from('payments')
                .select('id')
                .eq('mp_payment_id', String(id))
                .maybeSingle()

            if (existing) {
                console.log(`Payment ${id} already processed — skipping.`)
                return NextResponse.json({ received: true, message: 'Already processed' })
            }

            // ── FECHA EN ART ──────────────────────────────────────────────
            // Calculamos la fecha actual en ART (UTC-3) para evitar que
            // un pago hecho a las 22hs ART se registre como día siguiente en UTC.
            const nowART = new Date(
                new Date().toLocaleString('en-US', {
                    timeZone: 'America/Argentina/Buenos_Aires',
                })
            )

            // Fecha de pago en ART: usamos date_approved de MP si está disponible,
            // sino usamos nowART.
            const mpApprovedAt = paymentData.date_approved
                ? new Date(
                    new Date(paymentData.date_approved).toLocaleString('en-US', {
                        timeZone: 'America/Argentina/Buenos_Aires',
                    })
                )
                : nowART

            // Strings de fecha en ART (YYYY-MM-DD) — sin riesgo de flip de día por UTC
            const paidDateStr = [
                mpApprovedAt.getFullYear(),
                String(mpApprovedAt.getMonth() + 1).padStart(2, '0'),
                String(mpApprovedAt.getDate()).padStart(2, '0'),
            ].join('-')

            // Último día del mes en ART
            const lastDayART = new Date(
                mpApprovedAt.getFullYear(),
                mpApprovedAt.getMonth() + 1,
                0
            )
            const periodToStr = [
                lastDayART.getFullYear(),
                String(lastDayART.getMonth() + 1).padStart(2, '0'),
                String(lastDayART.getDate()).padStart(2, '0'),
            ].join('-')

            console.log(`Processing payment ${id} for user ${user_id}. ART date: ${paidDateStr}, period_to: ${periodToStr}`)

            // ── ACTUALIZAR MEMBRESÍA ──────────────────────────────────────
            const { error: memErr } = await supabase
                .from('memberships')
                .upsert(
                    {
                        member_id: user_id,
                        type: 'monthly',
                        end_date: periodToStr,
                        last_payment_date: paidDateStr,
                        notes: `Pago automático via MP (ID: ${id})`,
                    },
                    { onConflict: 'member_id' }
                )

            if (memErr) throw memErr

            // ── REGISTRAR PAGO ────────────────────────────────────────────
            // paid_at usa la fecha ART como timestamp de medianoche para que
            // los EXTRACT(month) en la view SQL den el mes correcto.
            // mp_payment_id se usa para la idempotencia.
            const { error: payErr } = await supabase.from('payments').insert({
                user_id,
                amount: paymentData.transaction_amount,
                method: 'mercadopago',
                paid_at: paidDateStr,          // fecha ART como date string → mes correcto en la view
                period_from: paidDateStr,
                period_to: periodToStr,
                mp_payment_id: String(id),      // ← campo para idempotencia (ver nota abajo)
                notes: `Pago automático via Webhook (MP: ${id})`,
            })

            if (payErr) throw payErr

            // ── ACTUALIZAR INSCRIPCIONES ──────────────────────────────────
            // Solo actualizamos si el pago trae clases definidas.
            // Si no hay principal_id, mantenemos las inscripciones existentes
            // para no dejar al miembro sin clases por un error de datos.
            if (principal_id) {
                await supabase.from('class_enrollments').delete().eq('user_id', user_id)

                const enrollments: { user_id: string; class_id: number; is_principal: boolean }[] = [
                    { user_id, class_id: principal_id, is_principal: true },
                ]

                if (Array.isArray(additional_ids)) {
                    additional_ids.forEach((classId: number) => {
                        if (classId !== principal_id) {
                            enrollments.push({ user_id, class_id: classId, is_principal: false })
                        }
                    })
                }

                const { error: enrollErr } = await supabase
                    .from('class_enrollments')
                    .insert(enrollments)

                if (enrollErr) throw enrollErr
            } else {
                console.warn(`Payment ${id}: no principal_id in external_reference — class enrollments unchanged.`)
            }

            console.log(`Payment ${id} processed. User: ${user_id}, period: ${paidDateStr} → ${periodToStr}`)
        }

        return NextResponse.json({ received: true })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        console.error('Webhook error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
