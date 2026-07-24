import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/requireAdmin'

export async function POST(req: Request) {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    try {
        const body = await req.json()
        const {
            first_name,
            last_name,
            email,
            phone,
            emergency_phone,
            notes,
            access_code,
            last_payment_date,
            next_payment_due,
            classes,
            role
        } = body

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        let userId: string

        const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { first_name, last_name }
        })

        if (createError) {
            if (createError.message.includes('already has been registered') || createError.status === 422) {
                const { data: listData } = await supabase.auth.admin.listUsers()
                const found = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
                if (found) {
                    userId = found.id
                } else {
                    throw new Error('User exists but could not be found via admin list')
                }
            } else {
                throw createError
            }
        } else {
            userId = createdUser.user.id
        }

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                user_id: userId,
                role: role || 'member',
                first_name,
                last_name,
                email,
                phone: phone ?? null,
                emergency_phone: emergency_phone ?? null,
                notes: notes ?? null,
                access_code: access_code
            }, { onConflict: 'user_id' })

        if (profileError) {
            throw new Error('Error creating profile: ' + profileError.message)
        }

        const { error: memErr } = await supabase
            .from('memberships')
            .upsert({
                member_id: userId,
                type: 'monthly',
                start_date: last_payment_date ?? new Date().toISOString().slice(0, 10),
                end_date: next_payment_due ?? null
            },
                { onConflict: 'member_id' }
            )

        if (memErr) throw new Error('Error creating membership: ' + memErr.message)

        if (classes && classes.length > 0) {
            const { error: classErr } = await supabase
                .from('class_enrollments')
                .insert(classes.map((c: { class_id: number; is_principal: boolean }) => ({
                    user_id: userId,
                    class_id: c.class_id,
                    is_principal: c.is_principal
                })))

            if (classErr) throw new Error('Error enrolling classes: ' + classErr.message)
        }

        return NextResponse.json({ ok: true, userId })
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error'
        console.error('Create Member Error:', e)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
