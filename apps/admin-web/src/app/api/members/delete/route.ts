import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { user_id } = body ?? {}

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Borrar inscripciones a clases
    await supabase.from('class_enrollments').delete().eq('user_id', user_id)

    // 2. Borrar membresías
    await supabase.from('memberships').delete().eq('member_id', user_id)

    // 3. Borrar pagos
    await supabase.from('payments').delete().eq('user_id', user_id)

    // 4. Borrar logs de acceso
    await supabase.from('access_logs').delete().eq('user_id', user_id)

    // 5. Borrar tokens de QR si existen
    await supabase.from('qr_tokens').delete().eq('user_id', user_id)

    // 6. Borrar perfil
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', user_id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // 7. Borrar usuario de Auth (usando Service Role)
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id)
    if (authError) {
      console.warn('[Delete API] Auth user deletion failed or user not found:', authError.message)
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
