'use client'

import { useEffect, useState, useMemo } from 'react'
import AdminLayout from '../../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import {
    Users,
    Calendar,
    Search,
    FileDown,
    ArrowLeft,
    Filter,
    Layers,
    Clock
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { exportToExcel } from '@/lib/excelExport'
import Link from 'next/link'

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

export default function AttendanceReportPage() {
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

            // 1. Load classes for filter
            const { data: cls } = await supabase.from('classes').select('id, name').order('name')
            setClasses(cls || [])

            // 2. Load attendance records
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

            if (error) {
                console.error('Error loading attendance:', error)
            } else {
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
        records.forEach(r => {
            const m = r.date.slice(0, 7) // YYYY-MM
            months.add(m)
        })
        return Array.from(months).sort().reverse()
    }, [records])

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const matchesClass = !filterClass || r.class_id === Number(filterClass)
            const matchesMonth = !filterMonth || r.date.startsWith(filterMonth)
            const searchLower = filterSearch.toLowerCase()
            const matchesSearch = !filterSearch ||
                r.member_name.toLowerCase().includes(searchLower) ||
                r.member_email.toLowerCase().includes(searchLower) ||
                r.class_name.toLowerCase().includes(searchLower)

            return matchesClass && matchesMonth && matchesSearch
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
        <AdminLayout active="/reportes">
            <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <Link href="/reportes" className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest hover:text-blue-400 transition-colors mb-2">
                            <ArrowLeft className="w-4 h-4" />
                            Volver a Reportes
                        </Link>
                        <h1 className="text-4xl font-black tracking-tight text-white">Reporte de <span className="text-blue-500">Asistencia</span></h1>
                        <p className="text-slate-400 font-medium italic italic">Historial detallado de asistencia por clase y alumno.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            onClick={handleExport}
                            disabled={filteredRecords.length === 0}
                            className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-6 py-6 font-bold text-xs uppercase tracking-widest transition-all gap-2 shadow-xl shadow-blue-500/20 disabled:opacity-50"
                        >
                            <FileDown className="w-5 h-5" />
                            Exportar Excel
                        </Button>
                    </div>
                </header>

                {/* Filters */}
                <Card className="bg-slate-900 border-white/10 overflow-hidden">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Class Filter */}
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

                            {/* Month Filter */}
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

                            {/* Search Filter */}
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

                {/* Table */}
                <Card className="bg-slate-900 border-white/10 overflow-hidden">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-20 text-center space-y-4">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                    className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full mx-auto"
                                />
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Cargando registros...</p>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="p-20 text-center">
                                <Filter className="w-16 h-16 text-slate-800 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-1">Sin resultados</h3>
                                <p className="text-slate-500">No hay registros de asistencia que coincidan con los filtros.</p>
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
                                            <motion.tr
                                                key={r.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i < 20 ? i * 0.03 : 0 }}
                                                className="hover:bg-white/5 transition-colors group"
                                            >
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
                                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-500 text-xs uppercase">
                                                            {r.member_name?.[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-white uppercase tracking-tight text-sm">{r.member_name}</span>
                                                            <span className="text-[10px] text-slate-500 font-medium">{r.member_email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest border border-white/5">
                                                        {r.class_name}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded">Ok</span>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    )
}
