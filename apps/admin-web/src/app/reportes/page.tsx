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
    TrendingDown
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Member = {
    user_id: string
    first_name: string
    last_name: string
    email: string
    status: string
    last_access?: string
}

export default function ReportesPage() {
    const [members, setMembers] = useState<Member[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            // 1. Obtener todos los miembros activos
            const { data: membersData } = await supabase
                .from('members_with_status')
                .select('user_id, first_name, last_name, email, status')
                .eq('status', 'activo')

            if (!membersData) return

            // 2. Obtener el último acceso de cada uno en los últimos 30 días
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            const { data: logs } = await supabase
                .from('access_logs')
                .select('user_id, scanned_at')
                .eq('result', 'autorizado')
                .gt('scanned_at', thirtyDaysAgo)
                .order('scanned_at', { ascending: false })

            // Procesar para tener el más reciente por usuario
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
    }, [])

    const absentMembers = useMemo(() => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        return members
            .filter(m => {
                if (!m.last_access) return true // Nunca vino en 30 días
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
    }, [members, search])

    return (
        <AdminLayout active="/reportes">
            <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest">
                            <TrendingDown className="w-4 h-4" />
                            Análisis de Retención
                        </div>
                        <h1 className="text-4xl font-black tracking-tight text-white">Alumnos <span className="text-blue-500">Ausentes</span></h1>
                        <p className="text-slate-400 font-medium italic">Miembros activos que no han asistido en la última semana.</p>
                    </div>

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
                </header>

                {/* Stats Grid */}
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

                {/* Members List */}
                <Card className="bg-slate-900 border-white/10">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-12 text-center space-y-4">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                    className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full mx-auto"
                                />
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Analizando registros de asistencia...</p>
                            </div>
                        ) : absentMembers.length === 0 ? (
                            <div className="p-12 text-center">
                                <Users className="w-16 h-16 text-slate-800 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-white mb-1">¡Sin ausencias críticas!</h3>
                                <p className="text-slate-500">Todos tus alumnos activos han asistido en la última semana.</p>
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
                                            <motion.tr
                                                key={m.user_id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="hover:bg-white/5 transition-colors group"
                                            >
                                                <td className="px-6 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-blue-500 group-hover:scale-110 transition-transform">
                                                            {m.first_name?.[0]}{m.last_name?.[0]}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-lg leading-tight uppercase tracking-tight">{m.first_name} {m.last_name}</div>
                                                            <div className="text-slate-500 text-xs font-medium">{m.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6">
                                                    {m.last_access ? (
                                                        <div className="space-y-1">
                                                            <div className="text-white font-bold text-sm">
                                                                {new Date(m.last_access).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </div>
                                                            <div className="text-[10px] text-red-500 font-black uppercase tracking-widest">
                                                                Hace {Math.floor((Date.now() - new Date(m.last_access).getTime()) / (1000 * 60 * 60 * 24))} días
                                                            </div>
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
                                                            const msg = encodeURIComponent(`Hola ${m.first_name}, te extrañamos en Beleza Dojo! Notamos que hace unos días no vienes a entrenar. ¿Todo bien? 🥋`)
                                                            window.open(`https://wa.me/?text=${msg}`, '_blank')
                                                        }}
                                                    >
                                                        <MessageSquare className="w-4 h-4" />
                                                        Contactar
                                                        <ArrowRight className="w-3 h-3 opacity-50" />
                                                    </Button>
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
