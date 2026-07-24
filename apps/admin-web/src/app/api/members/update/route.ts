import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/requireAdmin'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  try {
    const body = await req.json()
    const {
      user_id,
      first_name,
      last_name,
      email,
      phone,
      emergency_phone,
      notes,
      access_code,
      role
    } = body ?? {}
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: first_name ?? null,
        last_name: last_name ?? null,
        email: email ?? null,
        phone: phone ?? null,
        emergency_phone: emergency_phone ?? null,
        notes: notes ?? null,
        access_code: access_code ?? null,
        role: role ?? undefined
      })
      .eq('user_id', user_id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
