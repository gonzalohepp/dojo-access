import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const url = new URL(req.url)
        const topic = url.searchParams.get('topic') || url.searchParams.get('type')
        const id = url.searchParams.get('id') || url.searchParams.get('data.id')

        // Solo procesamos si es un pago
        if (topic !== 'payment' && topic !== 'payment_intent') {
            return NextResponse.json({ received: true })
        }

        const accessToken = process.env.MP_ACCESS_TOKEN
        if (!accessToken) throw new Error('MP_ACCESS_TOKEN missing')

        const client = new MercadoPagoConfig({ accessToken })
        const payment = new Payment(client)

        // Obtener detalles del pago
        const paymentData = await payment.get({ id: String(id) })
        const { status, external_reference } = paymentData

        if (status === 'approved' && external_reference) {
            const { user_id, principal_id, additional_ids } = JSON.parse(external_reference)

            if (!user_id) throw new Error('No user_id in external_reference')

            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            )

            // 1. Calcular nueva fecha de vencimiento (Mes Calendario, igual que en /payments)
            // Replicamos la lógica de PaymentModal.tsx: lastDayOfMonth(addMonths(today, 0))
            const today = new Date();
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Último día del mes actual

            const fromStr = today.toISOString().slice(0, 10);
            const toStr = lastDay.toISOString().slice(0, 10);

            // 2. Actualizar Membresía
            const { error: memErr } = await supabase
                .from('memberships')
                .upsert({
                    member_id: user_id,
                    type: 'monthly',
                    end_date: toStr,
                    last_payment_date: fromStr,
                    notes: `Pago automático via MP (ID: ${id})`
                }, { onConflict: 'member_id' })

            if (memErr) throw memErr

            // 3. Registrar el pago en la tabla 'payments' para auditoría (con periodos)
            await supabase.from('payments').insert({
                user_id: user_id,
                amount: paymentData.transaction_amount,
                method: 'mercadopago',
                paid_at: fromStr,
                period_from: fromStr,
                period_to: toStr,
                notes: `Pago automático via Webhook (MP: ${id})`
            })

            // 3. Actualizar Clases (Inscripciones)
            // Primero borramos las actuales
            await supabase.from('class_enrollments').delete().eq('user_id', user_id)

            // Insertamos las nuevas
            const enrollments = []
            if (principal_id) {
                enrollments.push({ user_id, class_id: principal_id, is_principal: true })
            }
            if (additional_ids && Array.isArray(additional_ids)) {
                additional_ids.forEach(id => {
                    if (id !== principal_id) {
                        enrollments.push({ user_id, class_id: id, is_principal: false })
                    }
                })
            }

            if (enrollments.length > 0) {
                const { error: enrollErr } = await supabase
                    .from('class_enrollments')
                    .insert(enrollments)
                if (enrollErr) throw enrollErr
            }

            console.log(`Payment processed for user ${user_id}. New due: ${toStr}`)
        }

        return NextResponse.json({ received: true })
    } catch (error: any) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
