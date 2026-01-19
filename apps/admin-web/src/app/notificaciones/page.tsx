'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AdminLayout from '../layouts/AdminLayout'
import { Bell, Send, Users, Calendar, CheckCircle, AlertCircle, Smartphone, History, Info, Search, Trash2, Clock, Check } from 'lucide-react'
import { toast } from 'sonner'
import UserSearch from '../components/notifications/UserSearch'

interface NotificationHistoryItem {
    id: string
    title: string
    message: string
    target: string
    sent_at: string
    status: 'sent' | 'failed'
    count: number
}

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'send' | 'history'>('send')
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [form, setForm] = useState({
        target: 'all' as 'all' | 'active' | 'expiring' | 'custom',
        title: '',
        message: '',
        url: '/'
    })

    // Mock history - in a real app this would come from the DB
    const [history, setHistory] = useState<NotificationHistoryItem[]>([])

    useEffect(() => {
        const fetchHistory = async () => {
            const { supabase } = await import('@/lib/supabaseClient')
            const { data, error } = await supabase
                .from('notification_history')
                .select('*')
                .order('sent_at', { ascending: false })
                .limit(20)

            if (!error && data) {
                setHistory(data)
            }
        }
        if (activeTab === 'history') {
            fetchHistory()
        }
    }, [activeTab])

    const handleSend = async () => {
        if (!form.title || !form.message) {
            toast.error('Debes completar título y mensaje')
            return
        }

        if (form.target === 'custom' && !selectedUser) {
            toast.error('Debes seleccionar un usuario')
            return
        }

        setLoading(true)
        const loadingToast = toast.loading('Enviando notificación...')

        try {
            const res = await fetch('/api/notifications/send-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: form.target,
                    customUserId: selectedUser?.user_id,
                    title: form.title,
                    message: form.message,
                    url: form.url
                })
            })

            const data = await res.json()

            if (res.ok) {
                toast.success(`Notificación enviada a ${data.count || 0} usuarios`, { id: loadingToast })

                // Add to local history for visual feedback
                const newHistoryItem: NotificationHistoryItem = {
                    id: Math.random().toString(36).substr(2, 9),
                    title: form.title,
                    message: form.message,
                    target: form.target === 'all' ? 'Todos' : form.target === 'active' ? 'Activos' : form.target === 'expiring' ? 'A vencer' : `${selectedUser?.first_name} ${selectedUser?.last_name}`,
                    sent_at: new Date().toISOString(),
                    status: 'sent',
                    count: data.count || 1
                }
                setHistory([newHistoryItem, ...history])

                // Clear form
                setForm({ target: 'all', title: '', message: '', url: '/' })
                setSelectedUser(null)
            } else {
                toast.error(data.error || 'Error al enviar', { id: loadingToast })
            }
        } catch (e) {
            toast.error('Error de conexión', { id: loadingToast })
        } finally {
            setLoading(false)
        }
    }

    const handleTestReminders = async () => {
        const loadingToast = toast.loading('Verificando recordatorios...')
        try {
            const res = await fetch('/api/notifications/reminders', { method: 'POST' })
            const data = await res.json()
            if (data.success) {
                if (data.notifications_sent > 0) {
                    toast.success(`Se enviaron ${data.notifications_sent} recordatorios`, { id: loadingToast })
                } else {
                    toast.info('No hay recordatorios pendientes para hoy', { id: loadingToast })
                }
            } else {
                toast.info(data.message || 'Sin acciones para hoy', { id: loadingToast })
            }
        } catch (e) {
            toast.error('Error al verificar recordatorios', { id: loadingToast })
        }
    }

    return (
        <AdminLayout active="/notificaciones">
            <div className="relative min-h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
                {/* Background Blobs */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

                <div className="relative max-w-7xl mx-auto p-4 md:p-8">
                    {/* Header */}
                    <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                                    Communications Hub
                                </span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                                Centro de <span className="text-blue-600 dark:text-blue-400">Notificaciones</span>
                            </h1>
                        </div>

                        {/* Tabs */}
                        <div className="flex p-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            <button
                                onClick={() => setActiveTab('send')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'send'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Enviar
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                Historial
                            </button>
                        </div>
                    </header>

                    <AnimatePresence mode="wait">
                        {activeTab === 'send' ? (
                            <motion.div
                                key="send-tab"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
                            >
                                {/* Form Section */}
                                <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Configuration Card */}
                                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl p-8 overflow-hidden relative">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Destinatarios</h3>
                                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">¿A quién enviamos?</p>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Segmento</label>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {[
                                                            { id: 'all', label: 'Todos', icon: Users },
                                                            { id: 'active', label: 'Activos', icon: CheckCircle },
                                                            { id: 'expiring', label: 'Vencen pronto', icon: Clock },
                                                            { id: 'custom', label: 'Manual', icon: Search }
                                                        ].map((opt) => (
                                                            <button
                                                                key={opt.id}
                                                                onClick={() => setForm({ ...form, target: opt.id as any })}
                                                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${form.target === opt.id
                                                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400'}`}
                                                            >
                                                                <opt.icon className="w-5 h-5" />
                                                                <span className="text-xs font-black uppercase tracking-tighter leading-none">{opt.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <AnimatePresence>
                                                    {form.target === 'custom' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                        >
                                                            <UserSearch onSelect={setSelectedUser} selectedUser={selectedUser} />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>

                                        {/* Content Card */}
                                        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl p-8">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
                                                    <Send className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Mensaje</h3>
                                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Contenido de la notificación</p>
                                                </div>
                                            </div>

                                            <div className="space-y-5">
                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Título</label>
                                                    <input
                                                        type="text"
                                                        value={form.title}
                                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                                        placeholder="Ej: Nueva clase disponible"
                                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Mensaje</label>
                                                    <textarea
                                                        value={form.message}
                                                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                                                        placeholder="Escribe el mensaje..."
                                                        rows={3}
                                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">URL Acción</label>
                                                    <input
                                                        type="text"
                                                        value={form.url}
                                                        onChange={(e) => setForm({ ...form, url: e.target.value })}
                                                        placeholder="/profile"
                                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Banner */}
                                    <div className="p-8 bg-blue-600 rounded-[2rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-blue-500/20">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                                                <Bell className="w-7 h-7" />
                                            </div>
                                            <div className="text-center md:text-left">
                                                <h4 className="text-lg font-black tracking-tight leading-none mb-1 text-white">¿Todo listo para enviar?</h4>
                                                <p className="text-blue-100 text-sm font-medium">Revisa la previsualización antes del envío masivo.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSend}
                                            disabled={loading}
                                            className="w-full md:w-auto h-14 px-10 bg-white text-blue-600 hover:bg-slate-100 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            {loading ? (
                                                <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    Lanzar Notificación
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Preview Section */}
                                <div className="lg:col-span-12 xl:col-span-4 sticky top-24">
                                    <div className="relative mx-auto w-[280px] h-[580px] bg-slate-900 rounded-[3rem] border-[8px] border-slate-800 shadow-2xl overflow-hidden p-2">
                                        {/* Camera Notch */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-slate-800 rounded-b-2xl z-20" />

                                        {/* Screen */}
                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-950 rounded-[2.2rem] overflow-hidden relative">
                                            {/* Wallpaper */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-600 opacity-20" />

                                            <div className="relative p-4 h-full flex flex-col pt-12">
                                                <div className="mb-4 text-center">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lunes, 19 de enero</p>
                                                    <p className="text-4xl font-black text-slate-900 dark:text-white mt-1">16:09</p>
                                                </div>

                                                {/* Notification Banner */}
                                                <motion.div
                                                    animate={{ opacity: [0, 1], y: [-20, 0] }}
                                                    className="w-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl p-4 shadow-xl border border-white/20"
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
                                                            <img src="/logo.png" className="w-4 h-4 invert brightness-0" alt="" />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex-1">Beleza Dojo</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">Ahora</span>
                                                    </div>
                                                    <h5 className="text-xs font-black text-slate-900 dark:text-white mb-1 leading-tight">
                                                        {form.title || 'Título de la Notificación'}
                                                    </h5>
                                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal line-clamp-3">
                                                        {form.message || 'Escribe un mensaje para ver cómo se verá en el teléfono de los usuarios.'}
                                                    </p>
                                                </motion.div>

                                                <div className="mt-auto mb-6 flex justify-center">
                                                    <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                                                        <Smartphone className="w-5 h-5 text-white/40" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-center mt-6 text-xs font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                        <Info className="w-4 h-4" /> Previsualización Real-Time
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="history-tab"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="max-w-4xl"
                            >
                                <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
                                    <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                                                <History className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 dark:text-white">Registro de Envíos</h3>
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Historial de las últimas notificaciones</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {history.length === 0 ? (
                                            <div className="p-20 text-center">
                                                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                                                    <Bell className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                                                </div>
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No se han enviado notificaciones aún</p>
                                            </div>
                                        ) : (
                                            history.map((item) => (
                                                <div key={item.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
                                                    <div className="flex flex-col md:flex-row md:items-start gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md">
                                                                    Para: {item.target}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400">
                                                                    {new Date(item.sent_at).toLocaleDateString()} {new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">{item.title}</h4>
                                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{item.message}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                                            <Users className="w-4 h-4 text-slate-400" />
                                                            <span className="text-sm font-black text-slate-700 dark:text-slate-300">{item.count}</span>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase">Impactos</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer Info Area */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Auto Rule Mock 1 */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h5 className="font-black text-slate-900 dark:text-white text-sm">Recordatorio Día 10</h5>
                                <p className="text-xs text-slate-500 mt-1">Automatizado: Mensaje de "Evita recargo" los días 8, 9 y 10.</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Estado: Activo</span>
                                </div>
                            </div>
                        </div>

                        {/* Auto Rule Mock 2 */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <h5 className="font-black text-slate-900 dark:text-white text-sm">Alerta Vencimiento</h5>
                                <p className="text-xs text-slate-500 mt-1">Automatizado: Mensaje de "Abono vencido" del 18 al 20.</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Estado: Activo</span>
                                </div>
                            </div>
                        </div>

                        {/* Control Area */}
                        <button
                            onClick={handleTestReminders}
                            className="bg-slate-900 dark:bg-slate-700 rounded-3xl p-6 text-white hover:bg-slate-800 transition-all text-left flex items-start gap-4 group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                                <Bell className="w-5 h-5 group-hover:animate-bounce" />
                            </div>
                            <div className="flex-1">
                                <h5 className="font-black text-white text-sm">Diagnóstico Manual</h5>
                                <p className="text-white/60 text-xs mt-1">Forzar verificación de reglas automáticas para hoy.</p>
                                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-400">
                                    Ejecutar ahora <Send className="w-3 h-3 ml-1" />
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
