'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LogOut,
    Menu,
    X,
    Home,
    User,
    Award,
    Calendar,
    Dumbbell
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Toaster } from 'sonner'
import ThemeToggle from '../components/ThemeToggle'

const studentNav = [
    { href: '/app', label: 'Inicio', icon: Home },
    { href: '/profile', label: 'Mi Perfil', icon: User },
    // { href: '#', label: 'Mis Clases', icon: Calendar }, // Future
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.replace('/login'); return }

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()

            setProfile(data)
            setLoading(false)
        }
        load()
    }, [router])

    const logout = async () => {
        await supabase.auth.signOut()
        router.replace('/login')
    }

    if (loading) return null

    return (
        <div className="min-h-screen flex w-full bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative">

            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar (Desktop & Mobile) */}
            <aside
                className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col transition-transform duration-300 md:translate-x-0 md:static md:inset-auto md:flex
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                            <Dumbbell className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="font-black text-lg text-slate-900 dark:text-white leading-none">Beleza <span className="text-blue-600">Dojo</span></h2>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Portal Alumno</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav */}
                <div className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <p className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Menú</p>
                    {studentNav.map(item => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                                {item.label}
                            </Link>
                        )
                    })}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-3">
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 text-xs font-bold">
                                {profile?.first_name?.[0]}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {profile?.first_name} {profile?.last_name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">{profile?.email}</p>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative min-w-0">
                <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight ml-2 md:ml-0">
                        {studentNav.find(n => n.href === pathname)?.label || 'Beleza Dojo'}
                    </h1>
                    <ThemeToggle />
                </header>

                <div className="flex-1 overflow-auto">
                    {children}
                </div>
            </main>

            <Toaster position="top-right" richColors />
        </div>
    )
}
