'use client'

import { useEffect, useState, useMemo } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import {
    Users,
    Clock,
    User as UserIcon,
    CheckCircle,
    Activity,
    Zap,
    Calendar,
    AlertCircle,
    RefreshCw,
    Dumbbell,
    Swords,
    Shirt,
    Target
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'

type ClassRow = {
    id: number
    name: string
    instructor: string | null
    start_time: string | null
    end_time: string | null
    days: string[] | null
    color: string | null
}

type AttendanceRecord = {
    user_id: string
    class_id: number
    profiles: {
        first_name: string | null
        last_name: string | null
        email: string | null
    }
}

const DAY_MAP = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sáb']

function getClassIcon(name: string) {
    const n = name.toLowerCase()
    if (n.includes('fisico') || n.includes('acondicionamiento')) return Dumbbell
    if (n.includes('mma') || n.includes('muay thai') || n.includes('grappling')) return Swords
    if (n.includes('bjj') || n.includes('jiu-jitsu') || n.includes('kids')) return Shirt
    return Activity
}

export default function AsistenciaVivoPage() {
    const [classes, setClasses] = useState<ClassRow[]>([])
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [expandedClasses, setExpandedClasses] = useState<number[]>([])

    const toggleExpand = (id: number) => {
        setExpandedClasses(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    // Actualizar la hora cada minuto
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            // 1. Fetch de todas las clases
            const { data: clsData } = await supabase
                .from('classes')
                .select('*')
                .order('start_time')

            setClasses(clsData || [])

            // 2. Fetch de asistencia de HOY
            const today = new Date().toISOString().slice(0, 10)
            const { data: attData } = await supabase
                .from('class_attendance')
                .select(`
          user_id,
          class_id,
          profiles:user_id (first_name, last_name, email)
        `)
                .eq('date', today)

            setAttendance((attData as any) || [])
        } catch (error) {
            console.error('Error fetching live data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()

        // Suscribirse a cambios en tiempo real
        const channel = supabase
            .channel('live_attendance')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'class_attendance' }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const activeClasses = useMemo(() => {
        const dayName = DAY_MAP[currentTime.getDay()]
        const h = currentTime.getHours()
        const m = currentTime.getMinutes()
        const currentMinutes = h * 60 + m

        return classes.filter(c => {
            if (!c.days?.includes(dayName) || !c.start_time || !c.end_time) return false

            const [sH, sM] = c.start_time.split(':').map(Number)
            const [eH, eM] = c.end_time.split(':').map(Number)

            const startMinutes = sH * 60 + sM - 10 // 10 min antes
            const endMinutes = eH * 60 + eM + 15   // 15 min despues

            return currentMinutes >= startMinutes && currentMinutes <= endMinutes
        })
    }, [classes, currentTime])

    const futureClasses = useMemo(() => {
        const dayName = DAY_MAP[currentTime.getDay()]
        const h = currentTime.getHours()
        const m = currentTime.getMinutes()
        const currentMinutes = h * 60 + m

        return classes.filter(c => {
            if (!c.days?.includes(dayName) || !c.start_time) return false
            const [sH, sM] = c.start_time.split(':').map(Number)
            const startMinutes = sH * 60 + sM
            return startMinutes > currentMinutes + 10
        })
    }, [classes, currentTime])

    return (
        <AdminLayout active="/asistencia-vivo">
            <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-0">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <Activity className="w-4 h-4 animate-pulse" />
                            Monitor en Tiempo Real
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">
                            Asistencia <span className="text-blue-500 text-glow">en Vivo</span>
                        </h1>
                        <p className="text-slate-400 font-medium italic">
                            Control de alumnos presentes por clase en este momento.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl">
                            <Clock className="w-5 h-5 text-blue-500" />
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Hora Actual</p>
                                <p className="text-xl font-black text-white leading-none">
                                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={fetchData}
                            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </header>

                {loading && classes.length === 0 ? (
                    <div className="min-h-[40vh] flex items-center justify-center">
                        <div className="text-center space-y-4">
                            <Zap className="w-12 h-12 text-blue-500 animate-pulse mx-auto" />
                            <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Sincronizando dojo...</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-8">

                        {/* Clases Activas (Main Column) */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                                <h2 className="text-lg font-black text-white uppercase tracking-tight">Clases en Curso</h2>
                            </div>

                            {activeClasses.length === 0 ? (
                                <div className="p-12 text-center rounded-[2.5rem] border-2 border-dashed border-white/5 bg-white/2 backdrop-blur-sm">
                                    <AlertCircle className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm italic">No hay clases programadas para este momento</p>
                                    <p className="text-slate-600 text-[10px] mt-2 font-black uppercase tracking-tight">Monitorizando el siguiente horario...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {activeClasses.map((cl) => {
                                        const attendees = attendance.filter(a => a.class_id === cl.id)
                                        const isExpanded = expandedClasses.includes(cl.id)
                                        const Icon = getClassIcon(cl.name)
                                        return (
                                            <motion.div
                                                key={cl.id}
                                                layout
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="bg-slate-900/50 border border-white/10 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-xl"
                                            >
                                                {/* Header / Trigger */}
                                                <button
                                                    onClick={() => toggleExpand(cl.id)}
                                                    className="w-full text-left p-6 flex items-center justify-between gap-4 hover:bg-white/5 transition-all"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div
                                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                                                            style={{ backgroundColor: cl.color || '#3b82f6' }}
                                                        >
                                                            <Icon className="w-5 h-5 fill-current" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-xl font-black text-white tracking-tight uppercase italic truncate">{cl.name}</h3>
                                                                {(() => {
                                                                    const [sH, sM] = (cl.start_time || '00:00').split(':').map(Number)
                                                                    const startMins = sH * 60 + sM
                                                                    const currMins = currentTime.getHours() * 60 + currentTime.getMinutes()
                                                                    if (currMins < startMins) {
                                                                        return (
                                                                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">
                                                                                Por Iniciar
                                                                            </span>
                                                                        )
                                                                    }
                                                                    return null
                                                                })()}
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <p className="text-slate-500 font-bold flex items-center gap-1 text-[9px] uppercase tracking-widest">
                                                                    <UserIcon className="w-2.5 h-2.5" />
                                                                    {cl.instructor || 'Sin Instructor'}
                                                                </p>
                                                                <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                                <p className="text-blue-500 font-bold flex items-center gap-1 text-[9px] uppercase tracking-widest">
                                                                    <Clock className="w-2.5 h-2.5" />
                                                                    {cl.start_time?.slice(0, 5)} - {cl.end_time?.slice(0, 5)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4 shrink-0">
                                                        <div className="flex flex-col items-center justify-center bg-white/5 w-14 h-14 rounded-2xl border border-white/5">
                                                            <span className="text-lg font-black text-white leading-none">{attendees.length}</span>
                                                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Pres.</span>
                                                        </div>
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border border-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-white/10' : ''}`}>
                                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                                        </div>
                                                    </div>
                                                </button>

                                                {/* Expanded Content */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="p-6 pt-0 bg-black/20 border-t border-white/5">
                                                                <div className="pt-6 space-y-4">
                                                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                                                                        <CheckCircle className="w-3 h-3 text-green-500" />
                                                                        Listado de Usuarios
                                                                    </p>

                                                                    {attendees.length === 0 ? (
                                                                        <p className="text-slate-600 font-bold italic text-sm py-4">Aún no hay ingresos para esta clase.</p>
                                                                    ) : (
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {attendees.map((a, idx) => (
                                                                                <motion.div
                                                                                    key={idx}
                                                                                    initial={{ opacity: 0, x: -5 }}
                                                                                    animate={{ opacity: 1, x: 0 }}
                                                                                    transition={{ delay: idx * 0.05 }}
                                                                                    className="flex items-center gap-3 p-3 bg-white/2 rounded-xl border border-white/5"
                                                                                >
                                                                                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center font-black text-blue-500 text-[9px] uppercase border border-blue-500/20">
                                                                                        {a.profiles?.first_name?.[0] || '?'}{a.profiles?.last_name?.[0] || ''}
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <p className="text-xs font-bold text-white uppercase tracking-tight truncate">
                                                                                            {a.profiles?.first_name} {a.profiles?.last_name}
                                                                                        </p>
                                                                                        <p className="text-[9px] text-slate-500 truncate">{a.profiles?.email}</p>
                                                                                    </div>
                                                                                </motion.div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Next Classes (Sidebar) */}
                        <aside className="space-y-6">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-500" />
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">Próximas Clases</h2>
                            </div>

                            <div className="space-y-3">
                                {futureClasses.length === 0 ? (
                                    <p className="text-slate-600 text-xs font-bold italic">No hay más clases por hoy.</p>
                                ) : (
                                    futureClasses.map((fcl) => {
                                        const FutureIcon = getClassIcon(fcl.name)
                                        return (
                                            <div
                                                key={fcl.id}
                                                className="p-5 rounded-3xl bg-slate-900/30 border border-white/5 flex items-center gap-4 group hover:bg-white/5 transition-all"
                                            >
                                                <div
                                                    className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white shrink-0 group-hover:bg-white/10 transition-colors"
                                                    style={{ color: fcl.color || '#3b82f6' }}
                                                >
                                                    <FutureIcon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-black text-white uppercase tracking-tight truncate">{fcl.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                                                        <Clock className="w-3 h-3" />
                                                        {fcl.start_time?.slice(0, 5)}
                                                    </p>
                                                </div>
                                                <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-blue-500 transition-colors">Hoy</div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>

                            <div className="p-8 rounded-[2rem] bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
                                    <Users className="w-24 h-24" />
                                </div>
                                <h3 className="text-lg font-black uppercase italic leading-none mb-2 relative z-10">Control Total</h3>
                                <p className="text-blue-100 text-xs font-bold leading-relaxed relative z-10">Este panel se actualiza automáticamente cuando un alumno valida su acceso en la entrada.</p>
                            </div>
                        </aside>

                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
