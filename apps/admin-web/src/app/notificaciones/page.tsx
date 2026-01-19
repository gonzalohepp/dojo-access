'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import AdminLayout from '../layouts/AdminLayout'
import { Bell, Send, Users, Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        target: 'all' as 'all' | 'active' | 'expiring' | 'custom',
        customUserId: '',
        title: '',
        message: '',
        url: '/'
    })

    const handleSend = async () => {
        if (!form.title || !form.message) {
            toast.error('Debes completar título y mensaje')
            return
        }

        setLoading(true)
        const loadingToast = toast.loading('Enviando notificación...')

        try {
            // TODO: Create endpoint to send ad-hoc notifications
            const res = await fetch('/api/notifications/send-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target: form.target,
                    customUserId: form.customUserId,
                    title: form.title,
                    message: form.message,
                    url: form.url
                })
            })

            const data = await res.json()

            if (res.ok) {
                toast.success(`Notificación enviada a ${data.count || 0} usuarios`, { id: loadingToast })
                setForm({ target: 'all', customUserId: '', title: '', message: '', url: '/' })
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
            <div className="relative min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 p-6 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <header className="mb-10">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                                Push Notifications
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-none mb-3">
                            Centro de <span className="text-blue-600 dark:text-blue-400">Notificaciones</span>
                        </h1>
                        <p className="text-slate-500 text-lg font-medium">
                            Envía notificaciones personalizadas y gestiona alertas automáticas
                        </p>
                    </header>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Ad-hoc Notification Sender */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl p-8"
                        >
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                    <Send className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Enviar Notificación</h3>
                                    <p className="text-xs text-slate-500">Mensaje personalizado ad-hoc</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                {/* Target Selector */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Destinatarios</label>
                                    <select
                                        value={form.target}
                                        onChange={(e) => setForm({ ...form, target: e.target.value as any })}
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">Todos los usuarios</option>
                                        <option value="active">Solo activos</option>
                                        <option value="expiring">Próximos a vencer (7 días)</option>
                                        <option value="custom">Usuario específico</option>
                                    </select>
                                </div>

                                {form.target === 'custom' && (
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">User ID</label>
                                        <input
                                            type="text"
                                            value={form.customUserId}
                                            onChange={(e) => setForm({ ...form, customUserId: e.target.value })}
                                            placeholder="UUID del usuario"
                                            className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Title */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Título</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="Ej: Recordatorio de pago"
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Mensaje</label>
                                    <textarea
                                        value={form.message}
                                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                                        placeholder="Escribe el contenido de la notificación..."
                                        rows={4}
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>

                                {/* URL */}
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">URL (Opcional)</label>
                                    <input
                                        type="text"
                                        value={form.url}
                                        onChange={(e) => setForm({ ...form, url: e.target.value })}
                                        placeholder="/profile"
                                        className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Send Button */}
                                <button
                                    onClick={handleSend}
                                    disabled={loading}
                                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Enviar Notificación
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>

                        {/* Automated Notifications */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="space-y-6"
                        >
                            {/* Rules Card */}
                            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                                        <Calendar className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 dark:text-white">Notificaciones Automáticas</h3>
                                        <p className="text-xs text-slate-500">Configuradas actualmente</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Rule 1 */}
                                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                                                <span className="font-black text-slate-900 dark:text-white">Recordatorio Sin Recargo</span>
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full">Activo</span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                            Días 8, 9, 10 de cada mes
                                        </p>
                                        <p className="text-xs text-slate-500 italic">
                                            "Evita recargos - Abona antes del día 10"
                                        </p>
                                    </div>

                                    {/* Rule 2 */}
                                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="w-5 h-5 text-orange-500" />
                                                <span className="font-black text-slate-900 dark:text-white">Alerta de Vencimiento</span>
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-widest bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full">Activo</span>
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                            Días 18, 19, 20 de cada mes
                                        </p>
                                        <p className="text-xs text-slate-500 italic">
                                            "Últimos días - Evita bloqueo de acceso"
                                        </p>
                                    </div>

                                    {/* Test Button */}
                                    <button
                                        onClick={handleTestReminders}
                                        className="w-full h-12 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-700 dark:text-slate-300 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Bell className="w-4 h-4" />
                                        Verificar Recordatorios Ahora
                                    </button>
                                </div>
                            </div>

                            {/* Info Card */}
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-6 text-white">
                                <div className="flex items-start gap-3">
                                    <Users className="w-6 h-6 opacity-80" />
                                    <div>
                                        <h4 className="font-black mb-1">Sistema de Notificaciones Push</h4>
                                        <p className="text-sm text-blue-50 leading-relaxed">
                                            Las notificaciones se envían únicamente a usuarios que han habilitado las notificaciones en su navegador.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    )
}
