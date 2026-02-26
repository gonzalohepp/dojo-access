import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
    try {
        const { user_id, principal_id, additional_ids, amount } = await req.json()

        if (!user_id) throw new Error('user_id is required')

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 1. Calcular nueva fecha de vencimiento (Mes Calendario)
        const today = new Date();
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const fromStr = today.toISOString().slice(0, 10);
        const toStr = lastDay.toISOString().slice(0, 10);

        console.log(`[TEST] Processing for user ${user_id}. New due: ${toStr}`)

        // 2. Actualizar Membresía
        const { error: memErr } = await supabase
            .from('memberships')
            .upsert({
                member_id: user_id,
                type: 'monthly',
                end_date: toStr,
                last_payment_date: fromStr,
                notes: `TEST - Pago automático simulado`
            }, { onConflict: 'member_id' })

        if (memErr) throw memErr

        // 3. Registrar el pago
        await supabase.from('payments').insert({
            user_id: user_id,
            amount: amount || 0,
            method: 'mercadopago',
            paid_at: fromStr,
            period_from: fromStr,
            period_to: toStr,
            notes: `TEST - Pago simulado via test-webhook`
        })

        // 4. Actualizar Clases
        await supabase.from('class_enrollments').delete().eq('user_id', user_id)

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

        return NextResponse.json({ success: true, message: 'Database logic test passed', new_due: toStr })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
