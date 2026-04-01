'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Calendar, CheckCircle, Shield, Award, MapPin,
    BookOpen, Activity, History, QrCode
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { todayAR } from '@/lib/dateUtils'
import { toast } from 'sonner'
import MemberGrades from '@/app/components/profile/MemberGrades'

type StudentProfile = {
    user_id: string
    first_name: string
    last_name: string
    avatar_url: string | null
    membership_type: string | null
    next_payment_due: string | null
}

export default function StudentDashboard({ user }: { user: any }) {
    const [profile, setProfile] = useState<StudentProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeClasses, setActiveClasses] = useState<any[]>([])
    const [myLog, setMyLog] = useState<any[]>([])
    const [checkingIn, setCheckingIn] = useState<number | null>(null)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            // 1. Profile
            const { data: prof } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .single()
            if (prof) {
                // Get membership status
                const { data: memb } = await supabase
                    .from('memberships')
                    .select('*')
                    .eq('member_id', user.id)
                    .maybeSingle()

                setProfile({
                    ...prof,
                    membership_type: memb?.type,
                    next_payment_due: memb?.end_date
                })
            }

            // 2. Load Attendance History
            const { data: logs } = await supabase
                .from('class_attendance')
                .select('date, classes(name, start_time)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10)
            setMyLog(logs || [])

            setLoading(false)
        }
        load()
    }, [user.id])

    // Load active classes in current time slot (or all for demo)
    useEffect(() => {
        const loadClasses = async () => {
            const now = new Date()
            const dayMap = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
            const dayName = dayMap[now.getDay()]

            // In a real scenario, filter strictly by time. 
            // For now, let's show classes happening "today".
            // Ideally we check if current time is within start_time - 15m and end_time

            const { data } = await supabase
                .from('classes')
                .select('*')
                .filter('days', 'cs', `{"${dayName}"}`) // Contains day

            // Filter client-side for better time logic if needed
            // For now, show all classes of TODAY that the user is enrolled in?
            // User requested: "indique cuando ingresa a que clase viene"
            // So we show ALL classes of TODAY and let them pick.
            setActiveClasses(data || [])
        }
        loadClasses()
    }, [])

    const handleCheckIn = async (classId: number) => {
        setCheckingIn(classId)
        try {
            // 1. Check if already checked in today
            const today = todayAR() // YYYY-MM-DD forzado Argentina
            const { data: existing } = await supabase
                .from('class_attendance')
                .select('*')
                .eq('user_id', user.id)
                .eq('class_id', classId)
                .eq('date', today)
                .maybeSingle()

            if (existing) {
                toast.error('Ya registraste tu asistencia hoy.')
                setCheckingIn(null)
                return
            }

            // 2. Insert check-in
            const { error } = await supabase
                .from('class_attendance')
                .insert({
                    user_id: user.id,
                    class_id: classId,
                    date: today
                })

            if (error) throw error

            toast.success('¡Asistencia registrada!')

            // Refresh logs
            const { data: logs } = await supabase
                .from('class_attendance')
                .select('date, classes(name, start_time)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(10)
            setMyLog(logs || [])

        } catch (error: any) {
            toast.error('Error al registrar: ' + error.message)
        } finally {
            setCheckingIn(null)
        }
    }

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Header Mobile */}
            <div className="relative bg-slate-900 pt-12 pb-24 px-6 rounded-b-[40px] overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20" />

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 p-[2px] mb-4 shadow-xl shadow-blue-500/20">
                        <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden relative">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl">
                                    {profile?.first_name?.[0]}
                                </div>
                            )}
                        </div>
                    </div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                        Hola, {profile?.first_name}
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-bold text-blue-300 uppercase tracking-widest">
                            {profile?.membership_type || 'Membresía'}
                        </span>
                        <span className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Activo
                        </span>
                    </div>
                </div>
            </div>

            <div className="px-4 -mt-16 relative z-20 space-y-6">

                {/* 1. CHECK-IN CARD */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Registrar Ingreso</h2>
                            <p className="text-xs font-medium text-slate-500">Clases disponibles hoy</p>
                        </div>
                    </div>

                    {activeClasses.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-sm font-bold text-slate-400">No hay clases activas en este momento</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {activeClasses.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => handleCheckIn(c.id)}
                                    disabled={!!checkingIn}
                                    className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50 dark:bg-slate-950 hover:bg-white dark:hover:bg-slate-900 transition-all group active:scale-95"
                                >
                                    <div className="text-left">
                                        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{c.name}</p>
                                        <p className="text-xs font-bold text-slate-500 flex items-center gap-1 mt-1">
                                            <Activity className="w-3 h-3 text-emerald-500" />
                                            {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                        {checkingIn === c.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* 2. HISTORY CARD */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Mis Entrenamientos</h2>
                            <p className="text-xs font-medium text-slate-500">Últimas asistencias</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {myLog.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-4">Aún no tienes registros</p>
                        ) : (
                            myLog.map((log, i) => (
                                <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                    <div className="flex flex-col items-center w-12 text-center">
                                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase">
                                            {new Date(log.date).toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3)}
                                        </span>
                                        <span className="text-lg font-black text-blue-600 leading-none">
                                            {new Date(log.date).getDate()}
                                        </span>
                                    </div>
                                    <div className="flex-1 pl-4 border-l-2 border-blue-500/20">
                                        <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">{log.classes?.name || 'Clase'}</p>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asistencia Confirmada</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </motion.div>

                {/* 3. GRADES CARD */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                            <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Mi Camino</h2>
                            <p className="text-xs font-medium text-slate-500">Historial de graduaciones</p>
                        </div>
                    </div>

                    {/* Reuse MemberGrades? It has delete/add buttons which we SHOULD HIDE for student */}
                    {/* We can pass a readonly prop or create a simpler view here. 
                        Reusing but hiding controls via CSS or Prop is cleaner.
                        However, MemberGrades was built for admin. Let's make a read-only variant or adapt it.
                        Actually, let's just create a simplified read-only list here for better UI fit.
                    */}
                    <ReadOnlyGrades userId={user.id} />
                </motion.div>

            </div>
        </div>
    )
}

function ReadOnlyGrades({ userId }: { userId: string }) {
    const [grades, setGrades] = useState<any[]>([])

    useEffect(() => {
        supabase.from('member_grades')
            .select('grade, awarded_at, notes')
            .eq('user_id', userId)
            .order('awarded_at', { ascending: false })
            .then(({ data }) => setGrades(data || []))
    }, [userId])

    if (grades.length === 0) return (
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-400">Aún no tienes graduaciones registradas</p>
        </div>
    )

    return (
        <div className="space-y-6 relative ml-2">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-slate-800" />
            {grades.map((g, i) => (
                <div key={i} className="relative pl-8">
                    <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900 bg-orange-500 ring-1 ring-orange-100" />
                    <div>
                        <h4 className="text-base font-black text-slate-900 dark:text-white">{g.grade}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                            {new Date(g.awarded_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </p>
                        {g.notes && <p className="text-sm text-slate-600 dark:text-slate-400 italic">"{g.notes}"</p>}
                    </div>
                </div>
            ))}
        </div>
    )
}
