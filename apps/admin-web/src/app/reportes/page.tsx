'use client'

import { useEffect, useState, useMemo } from 'react'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import {
    Users,
    UserX,
    Calendar,
    MessageSquare,
    Search,
    ArrowRight,
    TrendingDown,
    FileDown,
    Layers,
    Clock,
    Filter
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { exportToExcel } from '@/lib/excelExport'

/* ================= Tipos ================= */

type Member = {
    user_id: string
    first_name: string
    last_name: string
    email: string
    phone: string | null
    status: string
    last_access?: string
}

type AttendanceRecord = {
    id: number
    date: string
    created_at: string
    user_id: string
    class_id: number
    class_name: string
    member_name: string
    member_email: string
}

/* ================= Página Principal ================= */

export default function ReportesPage() {
    const [activeTab, setActiveTab] = useState<'asistencia' | 'ausencia'>('asistencia')

    return (
        <AdminLayout active="/reportes">
            <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <TrendingDown className="w-4 h-4" />
                            Centro de Reportes
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-white">
                            Panel de <span className="text-blue-500">Reportes</span>
                        </h1>
                        <p className="text-slate-400 font-medium italic">
                            {activeTab === 'asistencia' ? 'Historial detallado de asistencia por clase y alumno.' : 'Análisis de miembros activos que no han asistido recientemente.'}
                        </p>
                    </div>

                    <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/10 backdrop-blur-sm self-start md:self-center">
                        <button
                            onClick={() => setActiveTab('asistencia')}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'asistencia'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Asistencia
                        </button>
                        <button
                            onClick={() => setActiveTab('ausencia')}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'ausencia'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            Ausencias
                        </button>
                    </div>
                </header>

                <AnimatePresence mode="wait">
                    {activeTab === 'asistencia' ? (
                        <motion.div
                            key="asistencia"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <AsistenciaReport />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="ausencia"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <AusenciaReport />
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </AdminLayout>
    )
}

/* ================= Componente Reporte Asistencia ================= */

function AsistenciaReport() {
    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [classes, setClasses] = useState<{ id: number, name: string }[]>([])

    // Filters
    const [filterClass, setFilterClass] = useState<string>('')
    const [filterSearch, setFilterSearch] = useState('')
    const [filterMonth, setFilterMonth] = useState('')

    useEffect(() => {
        async function loadInitial() {
            setLoading(true)
            const { data: cls } = await supabase.from('classes').select('id, name').order('name')
            setClasses(cls || [])

            const { data: att, error } = await supabase
                .from('class_attendance')
                .select(`
                    id,
                    date,
                    created_at,
                    user_id,
                    class_id,
                    classes (name),
                    profiles:user_id (first_name, last_name, email)
                `)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })

            if (!error) {
                const mapped = (att as any[]).map(r => ({
                    id: r.id,
                    date: r.date,
                    created_at: r.created_at,
                    user_id: r.user_id,
                    class_id: r.class_id,
                    class_name: r.classes?.name || 'N/A',
                    member_name: `${r.profiles?.first_name || ''} ${r.profiles?.last_name || ''}`.trim() || 'Desconocido',
                    member_email: r.profiles?.email || ''
                }))
                setRecords(mapped)
            }
            setLoading(false)
        }
        loadInitial()
    }, [])

    const monthOptions = useMemo(() => {
        const months = new Set<string>()
        records.forEach(r => { months.add(r.date.slice(0, 7)) })
        return Array.from(months).sort().reverse()
    }, [records])

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const matchesClass = !filterClass || r.class_id === Number(filterClass)
            const matchesMonth = !filterMonth || r.date.startsWith(filterMonth)
            const searchLower = filterSearch.toLowerCase()
            return matchesClass && matchesMonth && (!filterSearch ||
                r.member_name.toLowerCase().includes(searchLower) ||
                r.member_email.toLowerCase().includes(searchLower) ||
                r.class_name.toLowerCase().includes(searchLower))
        })
    }, [records, filterClass, filterMonth, filterSearch])

    const handleExport = () => {
        const dataToExport = filteredRecords.map(r => ({
            Fecha: r.date,
            Hora: new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            Alumno: r.member_name,
            Email: r.member_email,
            Clase: r.class_name
        }))
        exportToExcel(dataToExport, `Reporte_Asistencia_${new Date().toISOString().slice(0, 10)}`)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button
                    onClick={handleExport}
                    disabled={filteredRecords.length === 0}
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-6 py-6 font-bold text-xs uppercase tracking-widest transition-all gap-2 shadow-xl shadow-blue-500/20 disabled:opacity-50"
                >
                    <FileDown className="w-5 h-5" />
                    Exportar Excel
                </Button>
            </div>

            <Card className="bg-slate-900 border-white/10 overflow-hidden">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative group">
                            <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors z-10" />
                            <select
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none font-bold text-sm"
                            >
                                <option value="">Todas las Clases</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="relative group">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors z-10" />
                            <select
                                value={filterMonth}
                                onChange={(e) => setFilterMonth(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none font-bold text-sm"
                            >
                                <option value="">Todos los Meses</option>
                                {monthOptions.map(m => {
                                    const [y, mm] = m.split('-')
                                    const date = new Date(Number(y), Number(mm) - 1, 1)
                                    const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                                    return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
                                })}
                            </select>
                        </div>
                        <div className="md:col-span-2 relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors z-10" />
                            <input
                                type="text"
                                placeholder="Buscar alumno, email o clase..."
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-slate-900 border-white/10 overflow-hidden">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-20 text-center space-y-4">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full mx-auto" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando registros...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/5">
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Fecha / Hora</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Alumno</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Clase</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Sesión</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredRecords.map((r, i) => (
                                        <motion.tr key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i < 20 ? i * 0.03 : 0 }} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold">{new Date(r.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                    <span className="text-[10px] text-slate-500 flex items-center gap-1 font-bold italic">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-500 text-xs uppercase">{r.member_name?.[0]}</div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white uppercase tracking-tight text-sm">{r.member_name}</span>
                                                        <span className="text-[10px] text-slate-500 font-medium">{r.member_email}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-white/5">{r.class_name}</span>
                                            </td>
                                            <td className="px-6 py-5 text-right"><span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">Ok</span></td>
                                        </motion.tr>
                                    ))}
                                    {filteredRecords.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-20 text-center">
                                                <Filter className="w-16 h-16 text-slate-800 mx-auto mb-4" />
                                                <h3 className="text-xl font-bold text-white mb-1">Sin resultados</h3>
                                                <p className="text-slate-500">No hay registros de asistencia que coincidan.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

/* ================= Componente Reporte Ausencia ================= */

function AusenciaReport() {
    const [members, setMembers] = useState<Member[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [now] = useState(() => Date.now())

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data: membersData } = await supabase
                .from('members_with_status')
                .select('user_id, first_name, last_name, email, phone, status')
                .eq('status', 'activo')

            if (!membersData) return

            const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
            const { data: logs } = await supabase
                .from('access_logs')
                .select('user_id, scanned_at')
                .eq('result', 'autorizado')
                .gt('scanned_at', thirtyDaysAgo)
                .order('scanned_at', { ascending: false })

            const lastAccessMap: Record<string, string> = {}
            logs?.forEach(log => {
                if (log.user_id && !lastAccessMap[log.user_id]) {
                    lastAccessMap[log.user_id] = log.scanned_at
                }
            })

            const enrichedMembers = (membersData as Member[]).map(m => ({
                ...m,
                last_access: lastAccessMap[m.user_id]
            }))

            setMembers(enrichedMembers)
            setLoading(false)
        }
        fetchData()
    }, [now])

    const absentMembers = useMemo(() => {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
        return members
            .filter(m => {
                if (!m.last_access) return true
                return new Date(m.last_access).getTime() < sevenDaysAgo
            })
            .filter(m =>
                (m.first_name + ' ' + m.last_name).toLowerCase().includes(search.toLowerCase()) ||
                m.email.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => {
                if (!a.last_access) return -1
                if (!b.last_access) return 1
                return new Date(a.last_access).getTime() - new Date(b.last_access).getTime()
            })
    }, [members, search, now])

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                    onClick={() => exportToExcel(absentMembers, `Ausencias_${new Date().toISOString().slice(0, 10)}`)}
                    className="bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl px-6 py-6 font-bold text-xs uppercase tracking-widest transition-all gap-2"
                >
                    <FileDown className="w-5 h-5 text-blue-500" />
                    Exportar .xlsx
                </Button>

                <div className="relative group min-w-[300px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-white/10 rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-medium"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-slate-900 border-white/10 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <UserX className="w-16 h-16 text-red-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-400 text-xs font-bold uppercase tracking-widest">Total Ausentes (+7 días)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-white">{absentMembers.length}</div>
                        <p className="text-[10px] text-red-500 font-bold mt-1">Requieren seguimiento inmediato</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-white/10 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <Users className="w-16 h-16 text-blue-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ratio de Ausencia</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-white">
                            {members.length > 0 ? Math.round((absentMembers.length / members.length) * 100) : 0}%
                        </div>
                        <p className="text-[10px] text-blue-500 font-bold mt-1">Sobre el total de miembros activos</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900 border-white/10 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <Calendar className="w-16 h-16 text-emerald-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-slate-400 text-xs font-bold uppercase tracking-widest">Periodo de Análisis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-white">7+</div>
                        <p className="text-[10px] text-emerald-500 font-bold mt-1">Días sin registros de acceso</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-900 border-white/10">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-12 text-center space-y-4">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full mx-auto" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Analizando registros de asistencia...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/5 bg-white/5">
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Alumno</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Última Asistencia</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {absentMembers.map((m, i) => (
                                        <motion.tr key={m.user_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-blue-500 group-hover:scale-110 transition-transform">{m.first_name?.[0]}{m.last_name?.[0]}</div>
                                                    <div>
                                                        <div className="font-bold text-white text-lg leading-tight uppercase tracking-tight">{m.first_name} {m.last_name}</div>
                                                        <div className="text-slate-500 text-xs font-medium">{m.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                {m.last_access ? (
                                                    <div className="space-y-1">
                                                        <div className="text-white font-bold text-sm">{new Date(m.last_access).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                                        <div className="text-[10px] text-red-500 font-black uppercase tracking-widest">Hace {Math.floor((now - new Date(m.last_access).getTime()) / (1000 * 60 * 60 * 24))} días</div>
                                                    </div>
                                                ) : (
                                                    <div className="text-red-500 font-black text-xs uppercase tracking-widest">Sin registros recientes</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-6 text-right">
                                                <Button
                                                    variant="ghost"
                                                    className="bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white border border-blue-500/20 rounded-xl px-6 py-5 font-bold text-xs uppercase tracking-widest transition-all gap-2"
                                                    onClick={() => {
                                                        const msg = encodeURIComponent(`Hola ${m.first_name}, te extrañamos en Beleza Dojo! 🥋 Notamos que hace unos días no vienes a entrenar. ¿Todo bien?`)
                                                        const phone = m.phone?.replace(/\D/g, '') || ''
                                                        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
                                                    }}
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                    Contactar
                                                </Button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                    {absentMembers.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-12 text-center">
                                                <Users className="w-16 h-16 text-slate-800 mx-auto mb-4" />
                                                <h3 className="text-xl font-bold text-white mb-1">¡Sin ausencias críticas!</h3>
                                                <p className="text-slate-500">Todos tus alumnos activos han asistido en la última semana.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
