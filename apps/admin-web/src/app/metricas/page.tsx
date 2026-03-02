'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'
import Link from 'next/link'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, BarChart, Bar
} from 'recharts'
import {
  TrendingUp, Users, DollarSign, Wallet, AlertTriangle,
  Activity, Receipt, ArrowUpRight, ArrowDownRight, Info, FileDown, Download, ArrowRight
} from 'lucide-react'
import { exportToExcel } from '@/lib/excelExport'

/* =============== helpers fecha / número =============== */
const tzDate = (v: string | Date) => new Date(v)
const fmtMoney = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1)
const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0)
const shortDay = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
const monthLabel = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })

/* =============== tipos =============== */
type Payment = {
  user_id: string
  amount: number
  method: string | null
  paid_at: string | null
  period_from: string | null
  period_to: string | null
}

type Membership = {
  member_id: string
  start_date: string | null
  end_date: string | null
  type: string | null
}

type Access = { user_id: string; scanned_at: string; result: string }

type ClassRow = { id: number; name: string }
type EnrollmentRow = { user_id: string; class_id: number }

type LandingEvent = {
  event_type: string
  created_at: string
  metadata?: {
    ip?: string
    [key: string]: any
  }
}

type AccessWithProfile = {
  user_id: string
  scanned_at: string
  result: string
  profiles: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }[] | null
}

/* =============== página =============== */
export default function MetricasPage() {
  const [loading, setLoading] = useState(true)

  const [payments, setPayments] = useState<Payment[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set())
  const [accessLogsToday, setAccessLogsToday] = useState<number>(0)
  const [recentAccesses, setRecentAccesses] = useState<AccessWithProfile[]>([])
  const [landingEvents, setLandingEvents] = useState<LandingEvent[]>([])

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])

  const [selectedClass, setSelectedClass] = useState<number | 'general'>('general')
  const [landingWindow, setLandingWindow] = useState<'24h' | '7d' | 'month'>('24h')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const { data: viewData } = await supabase
        .from('members_with_status')
        .select('user_id, status, role')

      const allViewRows = (viewData || [])
      setTotalMembers(allViewRows.filter(r => r.role !== 'admin').length)
      const activeIds = allViewRows.filter(r => r.status === 'activo' && r.role !== 'admin').map(r => r.user_id)
      setActiveMembers(activeIds.length)
      setActiveUserIds(new Set(activeIds))


      const sixMonthsAgo = startOfMonth(addDays(today(), -180))
      const { data: memb } = await supabase
        .from('memberships')
        .select('member_id,start_date,end_date,type')
        .gte('start_date', sixMonthsAgo.toISOString().slice(0, 10))
      setMemberships((memb || []) as Membership[])

      const ninetyDaysAgo = addDays(today(), -90)
      const { data: pays } = await supabase
        .from('payments')
        .select('user_id,amount,method,paid_at,period_from,period_to')
        .gte('paid_at', ninetyDaysAgo.toISOString())
        .order('paid_at', { ascending: true })
      setPayments((pays || []) as Payment[])

      const start = today().toISOString()
      const { count: accCount } = await supabase
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .gte('scanned_at', start)
      setAccessLogsToday(accCount || 0)

      const { data: recentAcc } = await supabase
        .from('access_logs')
        .select(`
          user_id,
          scanned_at,
          result,
          profiles:user_id (
            first_name,
            last_name,
            avatar_url
          )
        `)
        .gte('scanned_at', addDays(today(), -30).toISOString())
      setRecentAccesses((recentAcc || []) as AccessWithProfile[])

      const { data: cls } = await supabase
        .from('classes')
        .select('id,name')
        .order('name', { ascending: true })
      setClasses((cls ?? []) as ClassRow[])

      const { data: enr } = await supabase
        .from('class_enrollments')
        .select('user_id,class_id')
      setEnrollments((enr ?? []) as EnrollmentRow[])

      const { data: lnd } = await supabase
        .from('landing_events')
        .select('event_type,created_at,metadata')
        .gte('created_at', ninetyDaysAgo.toISOString())
      setLandingEvents((lnd ?? []) as LandingEvent[])

      setLoading(false)
    }

    fetchData()
  }, [])

  /* ================= KPIs ================= */


  const expiring7d = useMemo(() => {
    const start = today()
    const end = addDays(start, 7)
    const seen = new Set<string>()
    memberships.forEach(m => {
      if (!m.end_date) return
      const d = tzDate(m.end_date)
      if (d >= start && d <= end) seen.add(m.member_id)
    })
    return seen.size
  }, [memberships])

  const revenueThisMonth = useMemo(() => {
    const s = startOfMonth()
    const e = addDays(endOfMonth(), 1)
    return payments
      .filter(p => p.paid_at && tzDate(p.paid_at) >= s && tzDate(p.paid_at) < e)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  }, [payments])

  const revenuePrevMonth = useMemo(() => {
    const base = startOfMonth()
    const s = startOfMonth(new Date(base.getFullYear(), base.getMonth() - 1, 1))
    const e = startOfMonth(base)
    return payments
      .filter(p => p.paid_at && tzDate(p.paid_at) >= s && tzDate(p.paid_at) < e)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
  }, [payments])

  const growth = useMemo(() => {
    if (!revenuePrevMonth) return revenueThisMonth ? 100 : 0
    return ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100
  }, [revenueThisMonth, revenuePrevMonth])

  const averagePerMember = useMemo(() => {
    if (!activeMembers) return 0
    return revenueThisMonth / activeMembers
  }, [revenueThisMonth, activeMembers])

  /* ================= Gráficos Avanzados ================= */

  const peakHours = useMemo(() => {
    const hours = Array(24).fill(0)
    recentAccesses.forEach(a => {
      const h = new Date(a.scanned_at).getHours()
      hours[h]++
    })
    return hours.map((count, hour) => ({
      hour: `${hour}:00`,
      count
    })).filter(h => h.count > 0)
  }, [recentAccesses])

  const filteredUsersForRanking = useMemo(() => {
    if (selectedClass === 'general') return recentAccesses
    const classStudentIds = new Set(enrollments.filter(e => e.class_id === selectedClass).map(e => e.user_id))
    return recentAccesses.filter(a => classStudentIds.has(a.user_id))
  }, [recentAccesses, enrollments, selectedClass])

  const topUsers = useMemo(() => {
    const counts: Record<string, { count: number, name: string, avatar: string | null }> = {}
    filteredUsersForRanking.forEach(a => {
      if (!a.user_id) return
      if (!counts[a.user_id]) {
        const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
        const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : 'Ficticio'
        counts[a.user_id] = { count: 0, name: name || a.user_id.slice(0, 8), avatar: p?.avatar_url || null }
      }
      counts[a.user_id].count++
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([id, data]) => ({ id, ...data }))
  }, [filteredUsersForRanking])

  const rejectionRate = useMemo(() => {
    if (!recentAccesses.length) return 0
    const rejections = recentAccesses.filter(a => a.result !== 'autorizado').length
    return ((rejections / recentAccesses.length) * 100).toFixed(1)
  }, [recentAccesses])

  const membersAtRisk = useMemo(() => {
    const activeArr = Array.from(activeUserIds)
    const accessSet = new Set(recentAccesses.map(a => a.user_id))
    return activeArr.filter(id => !accessSet.has(id)).length
  }, [activeUserIds, recentAccesses])

  /* ================= Gráficos ================= */

  const revenueTrend = useMemo(() => {
    const start = addDays(today(), -30)
    const map = new Map<string, number>()
    for (let i = 0; i <= 30; i++) {
      const d = addDays(start, i)
      map.set(d.toISOString().slice(0, 10), 0)
    }
    payments.forEach(p => {
      if (!p.paid_at) return
      const key = tzDate(p.paid_at).toISOString().slice(0, 10)
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + (Number(p.amount) || 0))
      }
    })
    return Array.from(map.entries()).map(([k, v]) => ({
      date: shortDay(new Date(k + 'T00:00:00')),
      amount: v,
    }))
  }, [payments])

  const attendanceByClass = useMemo(() => {
    const actives: Record<number, number> = {}
    enrollments.forEach(e => {
      if (activeUserIds.has(e.user_id)) {
        actives[e.class_id] = (actives[e.class_id] ?? 0) + 1
      }
    })
    return classes.map(c => ({
      className: c.name,
      count: actives[c.id] ?? 0,
    })).filter(c => c.count > 0)
  }, [classes, enrollments, activeUserIds])

  const studentsByClass = useMemo(() => {
    const actives: Record<number, number> = {}
    enrollments.forEach(e => {
      if (activeUserIds.has(e.user_id)) {
        actives[e.class_id] = (actives[e.class_id] ?? 0) + 1
      }
    })
    return classes.map(c => ({
      name: c.name,
      value: actives[c.id] ?? 0,
    })).filter(c => c.value > 0)
  }, [classes, enrollments, activeUserIds])

  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']

  return (
    <AdminLayout active="/metricas">
      <div className="relative isolate min-h-screen bg-[#FDFDFD] dark:bg-[#0a0a0a] overflow-hidden transition-colors duration-500">
        {/* Background Elements */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] opacity-50 dark:opacity-20" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] opacity-50 dark:opacity-20" />
        </div>

        <div className="relative mx-auto max-w-7xl p-6 md:p-8">
          {/* Header Section */}
          <header className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 ring-1 ring-inset ring-indigo-600/20 dark:ring-indigo-400/20">
                  Analytics
                </span>
              </div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">
                Dashboard de <span className="text-indigo-600 dark:text-indigo-400">Métricas</span>
              </h1>
              <p className="max-w-md text-slate-500 dark:text-slate-400 font-medium italic">
                "Lo que no se mide, no se puede mejorar."
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3"
            >
              <div className="flex gap-2">
                <button
                  onClick={() => exportToExcel(payments, `Pagos_${new Date().toISOString().slice(0, 10)}`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Pagos
                </button>
                <button
                  onClick={() => exportToExcel(recentAccesses, `Asistencia_${new Date().toISOString().slice(0, 10)}`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all"
                >
                  <FileDown className="w-4 h-4" />
                  Asistencia
                </button>
              </div>
              <div className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  En tiempo real
                </span>
              </div>
            </motion.div>
          </header>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            <KpiCard
              label="Socios Activos"
              value={activeMembers}
              icon={<Users />}
              color="indigo"
              loading={loading}
            />
            <KpiCard
              label="Recaudación Mes"
              value={fmtMoney(revenueThisMonth)}
              icon={<DollarSign />}
              loading={loading}
              color="emerald"
              trend={growth}
            />
            <KpiCard
              label="Tasa de Rechazo"
              value={`${rejectionRate}%`}
              icon={<AlertTriangle />}
              loading={loading}
              color={Number(rejectionRate) > 10 ? 'rose' : 'emerald'}
              description="Accesos denegados"
            />
          </div>

          {/* Payment Timing Link Card */}
          <Link href="/metricas/payment-timing">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              className="mb-10 p-8 rounded-[32px] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-2xl cursor-pointer border-2 border-emerald-400/50 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-6 h-6" />
                    <span className="text-xs font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Nuevo</span>
                  </div>
                  <h3 className="text-2xl font-black mb-2">Análisis de Puntualidad de Pagos</h3>
                  <p className="text-emerald-50 font-medium">Ver usuarios por categoría: A Término, Con Recargo, Fuera de Término</p>
                </div>
                <ArrowRight className="w-12 h-12 opacity-70 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
              </div>
            </motion.div>
          </Link>

          {/* New Advanced Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Peak Hours Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-[32px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl"
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  <Activity className="w-5 h-5" />
                </span>
                Horarios Pico (Histórico 30d)
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={peakHours}>
                    <defs>
                      <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#f97316" fillOpacity={1} fill="url(#colorPeak)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Top Users List */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-[32px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">
                    <Users className="w-5 h-5" />
                  </span>
                  Top 5 Alumnos (Más Asistencia)
                </h3>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                  <button
                    onClick={() => setSelectedClass('general')}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedClass === 'general' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >General</button>
                  {classes.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClass(c.id)}
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedClass === c.id ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >{c.name.split(' ')[0]}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {topUsers.map((u, i) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">
                          {u.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">#{u.id.slice(0, 5)}</span>
                      </div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black">
                      {u.count} ingresos
                    </div>
                  </div>
                ))}
                {topUsers.length === 0 && <p className="text-center text-slate-400 text-sm py-10 italic">Sin datos suficientes en este periodo</p>}
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Class Attendance Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-8 rounded-[32px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl"
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="w-5 h-5" />
                </span>
                Asistencia por Clase (Últimos 30 días)
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceByClass}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                    <XAxis
                      dataKey="className"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                      barSize={40}
                    >
                      {attendanceByClass.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#6366F1', '#8B5CF6', '#EC4899'][index % 3]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Revenue Trend Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-8 rounded-[32px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl"
            >
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </span>
                Ingresos vs Mes Anterior
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrend}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10B981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
          {/* Distribution Pie */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[32px] border border-slate-200 bg-white/80 backdrop-blur-xl p-8 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Alumnos x Clase</h3>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-1">Sólo Socios Activos</p>
              </div>
            </div>
            <div className="h-72 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentsByClass}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {studentsByClass.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Secondary Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Landing Metrics (Nuevo) */}
          <LandingMetricsCard
            events={landingEvents}
            loading={loading}
            activeWindow={landingWindow}
            onWindowChange={(val) => setLandingWindow(val)}
          />

          {/* Quick Stats Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-[32px] bg-slate-900 p-8 shadow-2xl overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Receipt className="w-48 h-48 text-white rotate-12" />
            </div>

            <div className="relative z-10">
              <h3 className="text-xl font-black text-white uppercase tracking-tight mb-8">Estado de Cobros</h3>

              <div className="space-y-6">
                <StatLine label="Vencimientos Próximos 7 días" value={expiring7d} icon={<ClockIcon />} />
                <StatLine label="Accesos Registrados Hoy" value={accessLogsToday} icon={<ZapIcon />} />
                <StatLine label="Total Alumnos Histórico" value={totalMembers} icon={<UsersIcon />} />
              </div>

              <div className="mt-10 pt-8 border-t border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Crecimiento Mensual</p>
                  <p className="text-2xl font-black text-emerald-400">{growth > 0 ? '+' : ''}{growth.toFixed(1)}%</p>
                </div>
                <button className="h-12 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest transition-all">
                  Detalles
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  )
}

/* ======================== Components ======================== */

function KpiCard({ label, value, icon, color, loading, trend, description }: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'indigo' | 'emerald' | 'rose'
  loading?: boolean
  trend?: number
  description?: string
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-500/10 dark:bg-indigo-900/30 dark:text-indigo-400 dark:ring-indigo-500/30',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-500/10 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30',
    rose: 'bg-rose-50 text-rose-600 ring-rose-500/10 dark:bg-rose-900/30 dark:text-rose-400 dark:ring-rose-500/30'
  }

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="group relative overflow-hidden rounded-[32px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm transition-all hover:shadow-2xl"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-4 rounded-2xl ${colors[color]} ring-1 ring-inset transition-colors`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2 py-1 rounded-full ${trend > 0
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
            }`}>
            {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{label}</p>
        <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {loading ? <div className="h-10 w-32 bg-slate-100 dark:bg-slate-700 animate-pulse rounded-xl" /> : value}
        </div>
        {description && (
          <p className="mt-2 text-xs font-bold text-slate-400 flex items-center gap-1">
            <Info className="w-3 h-3" />
            {description}
          </p>
        )}
      </div>
    </motion.div>
  )
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: any[]
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl">
        <p className="opacity-50 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-lg">
          {typeof payload[0].value === 'number' && payload[0].value > 1000
            ? fmtMoney(payload[0].value)
            : payload[0].value}
        </p>
      </div>
    )
  }
  return null
}

function LandingMetricsCard({ events, loading, activeWindow, onWindowChange }: {
  events: LandingEvent[]
  loading: boolean
  activeWindow: '24h' | '7d' | 'month'
  onWindowChange: (val: '24h' | '7d' | 'month') => void
}) {
  if (loading) return (
    <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-[32px]" />
  )

  // Fix timezone ART (UTC-3) for reset check
  const getARTDate = (d = new Date()) => {
    return new Date(d.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  }

  const artNow = getARTDate()
  const nowTs = artNow.getTime()

  const h24 = new Date(nowTs - 24 * 60 * 60 * 1000)
  const d7 = new Date(nowTs - 7 * 24 * 60 * 60 * 1000)
  const startMonth = new Date(artNow.getFullYear(), artNow.getMonth(), 1)

  const getFilteredData = (window: string) => {
    let cutoff = h24
    if (window === '7d') cutoff = d7
    if (window === 'month') cutoff = startMonth

    const filtered = events.filter((e: any) => new Date(e.created_at) >= cutoff)
    const visits = filtered.filter((e: any) => e.event_type === 'page_view').length
    const clicks = filtered.filter((e: any) => e.event_type !== 'page_view').length
    return { visits, clicks, conversion: visits > 0 ? ((clicks / visits) * 100).toFixed(1) : 0 }
  }

  const currentData = getFilteredData(activeWindow || '24h')

  const clicksWsp = events.filter((e: any) => e.event_type === 'click_whatsapp' && new Date(e.created_at) >= (activeWindow === '24h' ? h24 : activeWindow === '7d' ? d7 : startMonth)).length
  const clicksInsta = events.filter((e: any) => e.event_type === 'click_instagram' && new Date(e.created_at) >= (activeWindow === '24h' ? h24 : activeWindow === '7d' ? d7 : startMonth)).length

  const recentIPs = Array.from(new Set(events
    .filter((e: any) => e.metadata?.ip && e.event_type === 'page_view')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((e: any) => e.metadata.ip)
  )).slice(0, 5)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-8 text-white shadow-2xl transition-all duration-500"
    >
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Activity className="w-64 h-64" />
      </div>

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-widest border border-white/10">
                Marketing
              </span>
            </div>
            <h3 className="text-2xl font-black tracking-tight mb-1">Landing Page Performance</h3>
            <p className="text-slate-400 font-medium text-sm">Métricas de conversión y tráfico (ART)</p>
          </div>

          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-sm">
            {[
              { id: '24h', label: '24h' },
              { id: '7d', label: '7d' },
              { id: 'month', label: 'Mes' }
            ].map((win) => (
              <button
                key={win.id}
                onClick={() => onWindowChange(win.id as '24h' | '7d' | 'month')}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeWindow === win.id ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-white'
                  }`}
              >
                {win.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/5 rounded-[24px] p-6 border border-white/5">
            <p className="text-[10px] uppercase font-black text-slate-400 mb-2">Visitas Únicas</p>
            <p className="text-4xl font-black text-white">{currentData.visits}</p>
          </div>
          <div className="bg-white/5 rounded-[24px] p-6 border border-white/5">
            <p className="text-[10px] uppercase font-black text-slate-400 mb-2">Total Clicks</p>
            <p className="text-4xl font-black text-white">{currentData.clicks}</p>
          </div>
          <div className="bg-blue-500/20 rounded-[24px] p-6 border border-blue-500/30">
            <p className="text-[10px] uppercase font-black text-blue-300 mb-2">Tasa de C.</p>
            <p className="text-4xl font-black text-blue-400">{currentData.conversion}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-emerald-500/60">WhatsApp</p>
              <p className="text-xl font-black">{clicksWsp}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-purple-500/60">Instagram</p>
              <p className="text-xl font-black">{clicksInsta}</p>
            </div>
          </div>
        </div>

        {activeWindow === '24h' && recentIPs.length > 0 && (
          <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
            <p className="text-[10px] uppercase font-black text-slate-500 mb-3">Últimas IPs detectadas</p>
            <div className="flex flex-wrap gap-2">
              {recentIPs.map((ip) => (
                <span key={ip} className="px-2 py-1 bg-white/5 rounded-lg text-[10px] font-mono text-slate-400 border border-white/5">
                  {ip}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function StatLine({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between group cursor-default">
      <div className="flex items-center gap-3">
        <div className="text-white/40 group-hover:text-white transition-colors">
          {icon}
        </div>
        <p className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{label}</p>
      </div>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  )
}

function ClockIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function ZapIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> }
function UsersIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> }
