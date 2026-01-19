'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  QrCode,
  Users,
  DollarSign,
  LayoutDashboard,
  ClipboardList,
  GraduationCap,
  LogOut,
  ChartLine,
  User as UserIcon,
  Building2,
  Bell,
  AlertTriangle,
  ShieldAlert,
  UserPlus,
  ArrowRight,
  Check,
  Wifi,
  WifiOff
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import ThemeToggle from '../components/ThemeToggle'
import { motion, AnimatePresence } from 'framer-motion'
import { usePushNotifications } from '@/hooks/usePushNotifications'

type Notification = {
  id: string
  type: 'access_denied' | 'fraud' | 'pending_user'
  title: string
  description: string
  timestamp: string
  link?: string
  read: boolean
}

type Role = 'admin' | 'member'
type Profile = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  role: Role | null
  avatar_url: string | null
}

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/qr', label: 'QR de Acceso', icon: QrCode },
  { href: '/profile', label: 'Mi Perfil', icon: UserIcon },
  { href: '/members', label: 'Miembros', icon: Users },
  { href: '/admin/academies', label: 'Academias', icon: Building2 },
  { href: '/classes', label: 'Clases', icon: GraduationCap },
  { href: '/payments', label: 'Pagos', icon: DollarSign },
  { href: '/metricas', label: 'Metricas', icon: ChartLine },
  { href: '/reportes', label: 'Reportes de Ausencia', icon: ClipboardList },
  { href: '/access-log', label: 'Historial de Accesos', icon: ClipboardList },
]

const userNav = [
  { href: '/validate', label: 'Validar Acceso', icon: QrCode },
  { href: '/profile', label: 'Mi Perfil', icon: UserIcon },
]

export default function AdminLayout({ children, active }: { children: React.ReactNode, active?: string }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const { isSupported, subscription, subscribeUser, unsubscribeUser } = usePushNotifications()
  const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BMXQvrbtBZdniuZrLMYD87T0E-742Lo72ktJWrjzB5mcbKYrrCh5X6cAo7z0d09QqOygrZsNFVEz_IBgTWqUp6o'

  const handleTogglePush = async () => {
    if (subscription) {
      const success = await unsubscribeUser()
      if (success) toast.info('Notificaciones desactivadas')
    } else {
      const sub = await subscribeUser(VAPID_PUBLIC_KEY)
      if (sub) {
        toast.success('¡Notificaciones activadas!')
      } else {
        toast.error('No se pudo activar las notificaciones.')
      }
    }
  }

  const fetchInitialNotifs = async () => {
    const dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]')

    // 1. Fetch Denied Access Logs
    const { data: logs } = await supabase
      .from('access_logs')
      .select('id, result, reason, scanned_at, profiles(first_name, last_name)')
      .eq('result', 'denegado')
      .order('scanned_at', { ascending: false })
      .limit(20) // Fetch more to account for dismissed

    // 2. Fetch Pending Users
    const { data: pending } = await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email, created_at')
      .eq('role', 'pending')
      .order('created_at', { ascending: false })
      .limit(10)

    const mappedLogs: Notification[] = (logs || [])
      .filter(l => !dismissed.includes(l.id.toString()))
      .map(l => ({
        id: l.id.toString(),
        type: 'access_denied',
        title: 'Acceso Denegado',
        description: `${(l.profiles as any)?.first_name || 'Usuario'} ${(l.profiles as any)?.last_name || ''}: ${l.reason || ''}`,
        timestamp: l.scanned_at,
        read: true
      }))

    const mappedPending: Notification[] = (pending || [])
      .filter(p => !dismissed.includes(p.user_id))
      .map(p => ({
        id: p.user_id,
        type: 'pending_user',
        title: 'Nuevo Registro',
        description: `${p.first_name || ''} ${p.last_name || ''} (${p.email}) pendiente de aprobación.`,
        timestamp: p.created_at || new Date().toISOString(),
        link: `/members?new_id=${p.user_id}&new_email=${p.email}&new_name=${encodeURIComponent(`${p.first_name || ''} ${p.last_name || ''}`.trim())}`,
        read: true
      }))

    const combined = [...mappedLogs, ...mappedPending]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 15)

    setNotifications(combined)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,email,first_name,last_name,role,avatar_url')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) {
        setProfile(data as Profile)
      } else {
        setProfile({
          user_id: user.id,
          email: user.email ?? null,
          first_name: null,
          last_name: null,
          role: 'member',
          avatar_url: user.user_metadata?.avatar_url ?? null
        })
      }
      setLoading(false)
      if (data?.role === 'admin') {
        fetchInitialNotifs()
      }
    }
    load()
  }, [router])

  // ========= Real-time Security Alerts =========
  useEffect(() => {
    if (!profile || profile.role !== 'admin') return

    console.log('[AdminLayout] Subscribing to security alerts...')
    const channel = supabase
      .channel('security_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'access_logs' },
        async (payload) => {
          const newLog = payload.new as any
          if (newLog.result === 'denegado') {
            console.log('[Security] Access Denied detected:', newLog)

            let name = 'Usuario desconocido'
            if (newLog.user_id) {
              const { data: p } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', newLog.user_id)
                .maybeSingle()
              if (p) name = `${p.first_name} ${p.last_name}`
            }

            const newNotif: Notification = {
              id: newLog.id.toString(),
              type: 'access_denied',
              title: 'Acceso Denegado',
              description: `${name}: ${newLog.reason}`,
              timestamp: newLog.scanned_at,
              read: false
            }

            setNotifications(prev => [newNotif, ...prev].slice(0, 15))

            // Sonido de alerta (opcional, muy sutil)
            try {
              const audio = new Audio('/alert.mp3')
              audio.volume = 0.3
              audio.play().catch(() => { })
            } catch { }

            toast.error(`¡Alerta de Acceso!`, {
              description: `${name}: ${newLog.reason}`,
              duration: 8000,
              icon: <ShieldAlert className="w-5 h-5 text-red-500" />
            })

            // Detección de fraude (múltiples intentos)
            if (newLog.user_id) {
              const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
              const { count } = await supabase
                .from('access_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', newLog.user_id)
                .eq('result', 'denegado')
                .gt('scanned_at', fiveMinsAgo)

              if (count && count >= 3) {
                const fraudNotif: Notification = {
                  id: `fraud-${newLog.user_id}-${Date.now()}`,
                  type: 'fraud',
                  title: 'Posible Fraude',
                  description: `${name} falló ${count} intentos en 5 minutos.`,
                  timestamp: new Date().toISOString(),
                  read: false
                }
                setNotifications(prev => [fraudNotif, ...prev].slice(0, 15))

                toast.warning('Posible Intento de Fraude', {
                  description: `${name} ha fallado ${count} intentos en 5 minutos.`,
                  duration: 12000,
                  icon: <AlertTriangle className="w-5 h-5 text-amber-500" />
                })
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        (payload) => {
          const p = payload.new as any
          if (p.role === 'pending') {
            const newNotif: Notification = {
              id: p.user_id,
              type: 'pending_user',
              title: 'Solicitud de Registro',
              description: `${p.first_name || ''} ${p.last_name || ''} pendiente de aprobación.`,
              timestamp: p.created_at || new Date().toISOString(),
              link: `/members?new_id=${p.user_id}&new_email=${p.email}&new_name=${encodeURIComponent(`${p.first_name || ''} ${p.last_name || ''}`.trim())}`,
              read: false
            }
            setNotifications(prev => [newNotif, ...prev].slice(0, 15))
            toast.info('Nueva Solicitud', {
              description: `${p.email} se ha logueado.`,
              duration: 8000
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile])

  const logout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4">
            <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain animate-pulse" />
          </div>
          <p className="text-muted-foreground animate-pulse font-medium tracking-widest uppercase text-[10px]">Cargando…</p>
        </div>
      </div>
    )
  }

  /* State for mobile sidebar */
  // Moved to top


  const isAdmin = profile?.role === 'admin'
  const nav = isAdmin ? adminNav : userNav

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    'Usuario'

  return (
    <div className="min-h-screen flex w-full bg-background transition-colors duration-300 relative">

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-border flex flex-col transition-transform duration-300 md:translate-x-0 md:static md:inset-auto md:flex
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="border-b border-border p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h2 className="font-black text-lg text-foreground tracking-tight leading-tight">Beleza <span className="text-blue-600">Dojo</span></h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                {isAdmin ? 'Admin Panel' : 'Member Portal'}
              </p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
        </div>

        {/* Menu */}
        <div className="p-3 flex-1 overflow-y-auto">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-3 py-4">
            {isAdmin ? 'Principal' : 'Menú'}
          </div>
          <nav className="space-y-1">
            {nav.map((item) => {
              const isActive = active === item.href || pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)} // Close on navigate
                  className={[
                    'flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group',
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/20'
                      : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/5 hover:text-foreground',
                  ].join(' ')}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'}`} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer profile section */}
        <div className="p-4 border-t border-border">
          <div className="px-3 py-3 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center gap-3 mb-3 border border-border shadow-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UserIcon className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate leading-none">{profile?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="group w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-border text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-500/10 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Background glow effects */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-background transition-colors duration-300">
          <div className="absolute top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] dark:bg-blue-600/10" />
          <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-purple-600/5 blur-[120px] dark:bg-purple-600/10" />
        </div>

        {/* Desktop & Mobile Top Bar */}
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-border px-6 py-4 sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-foreground hover:bg-slate-100 dark:hover:bg-white/10 md:hidden"
            >
              {/* Hamburger Icon */}
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black text-foreground tracking-tight leading-none">
                {pathname === '/admin' ? 'Dashboard' :
                  pathname === '/members' ? 'Gestión de Miembros' :
                    pathname === '/profile' ? 'Mi Perfil' :
                      'Beleza Dojo'}
              </h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 hidden md:block">
                Bienvenido, {profile?.first_name || 'Alunmo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowNotifs(!showNotifs)
                    if (!showNotifs) setNotifications(prev => prev.map(n => ({ ...n, read: true })))
                  }}
                  className="p-2.5 rounded-xl text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative group"
                >
                  <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {notifications.some(n => !n.read) && (
                    <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                  )}
                </button>

                {profile?.role === 'admin' && isSupported && (
                  <button
                    onClick={handleTogglePush}
                    className={`p-2.5 rounded-xl transition-colors relative group ${subscription
                      ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                      : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    title={subscription ? 'Notificaciones activas' : 'Activar notificaciones push'}
                  >
                    {subscription ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                  </button>
                )}

                <AnimatePresence>
                  {showNotifs && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
                        className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-2xl z-50 overflow-hidden"
                      >
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-500">Notificaciones</h3>
                          <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">
                            {notifications.length}
                          </span>
                        </div>
                        <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center">
                              <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell className="w-6 h-6 text-slate-200 dark:text-slate-700" />
                              </div>
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Sin noticias</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-50 dark:divide-slate-800/30">
                              {notifications.map(n => (
                                <div key={n.id} className="p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-default">
                                  <div className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110 ${n.type === 'access_denied' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:border-red-500/20' :
                                      n.type === 'fraud' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20' :
                                        'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20'
                                      }`}>
                                      {n.type === 'access_denied' ? <ShieldAlert className="w-5 h-5" /> :
                                        n.type === 'fraud' ? <AlertTriangle className="w-5 h-5" /> :
                                          <UserPlus className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black text-slate-900 dark:text-white leading-tight mb-1 uppercase tracking-tight">{n.title}</p>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 font-medium">{n.description}</p>
                                      <div className="flex items-center justify-between mt-3">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                          {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {n.link && (
                                          <button
                                            onClick={() => {
                                              router.push(n.link!)
                                              setShowNotifs(false)
                                            }}
                                            className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em] flex items-center gap-1.5 hover:gap-2.5 transition-all"
                                          >
                                            Ver Ficha <ArrowRight className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {notifications.length > 0 && (
                          <div className="p-4 bg-slate-50/50 dark:bg-white/2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => {
                                const dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]')
                                const newDismissed = [...new Set([...dismissed, ...notifications.map(n => n.id)])]
                                localStorage.setItem('dismissed_notifs', JSON.stringify(newDismissed))
                                setNotifications([])
                              }}
                              className="w-full py-2.5 text-[10px] font-black text-slate-400 hover:text-rose-500 uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2"
                            >
                              Limpiar Panel
                            </button>
                          </div>
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-auto custom-scrollbar relative p-6">
          {children}
        </div>
        <Toaster position="top-right" richColors closeButton />
      </main>
    </div>
  )
}
