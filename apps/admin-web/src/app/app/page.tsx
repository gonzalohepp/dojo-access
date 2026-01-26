import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import StudentDashboard from './StudentDashboard'
import StudentLayout from '../layouts/StudentLayout'

export default async function HomePage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 🔹 Primero intentamos por user_id
  let { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('user_id, role, email')
    .eq('user_id', user.id)
    .maybeSingle()

  // 🔹 Si no hay perfil con ese user_id, probamos por email
  if (!profile && !profileErr) {
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('user_id, role, email')
      .ilike('email', user.email ?? '')
      .maybeSingle()

    profile = byEmail
  }

  // 🔹 Si sigue sin haber perfil, lo creamos como 'member'
  if (!profile && !profileErr) {
    const { data: newProfile, error: createErr } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        email: user.email,
        first_name: user.user_metadata?.first_name || '',
        last_name: user.user_metadata?.last_name || '',
        role: 'member',
        access_code: null
      })
      .select('user_id, role, email')
      .single()

    if (createErr) {
      console.error('[app/page] Error creating member profile:', createErr)
    } else {
      profile = newProfile
    }
  }


  // 🔹 Redirección por rol
  const role = profile?.role ?? 'member'
  if (role === 'admin' || role === 'instructor') {
    redirect('/admin')
  } else {
    // Si es member, mostramos el Dashboard de Alumno dentro del Layout
    return (
      <StudentLayout>
        <StudentDashboard user={user} />
      </StudentLayout>
    )
  }
}
