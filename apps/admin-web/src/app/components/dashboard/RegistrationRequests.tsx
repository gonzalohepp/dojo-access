'use client'
import { motion } from 'framer-motion'
import { UserPlus, Clock, Mail, User } from 'lucide-react'

type PendingUser = {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    created_at?: string
}

export default function RegistrationRequests({
    users,
    loading,
    onAdd
}: {
    users: PendingUser[]
    loading?: boolean
    onAdd: (user: PendingUser) => void
}) {
    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2].map((i) => (
                    <div key={i} className="h-24 w-full bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-2xl" />
                ))}
            </div>
        )
    }

    if (!users.length) {
        return null
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <UserPlus className="w-5 h-5" />
                Nuevos Registros (Pendientes)
            </h2>

            <div className="grid gap-3">
                {users.map((u, i) => (
                    <motion.div
                        key={u.user_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10 backdrop-blur-xl shadow-sm hover:shadow-md transition-all"
                    >
                        <div className="flex items-center gap-4 mb-4 sm:mb-0">
                            <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                    {u.first_name || u.last_name ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : 'Usuario Nuevo'}
                                </div>
                                <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium lowercase">
                                        <Mail className="w-3 h-3" />
                                        {u.email}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => onAdd(u)}
                            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all w-full sm:w-auto"
                        >
                            <UserPlus className="w-4 h-4" />
                            AGREGAR MIEMBRO
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}
