'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Trash, Award, Calendar, User, Save, X } from 'lucide-react'
import { fmtDateShort } from '@/lib/format'

type Grade = {
    id: string
    grade: string
    awarded_at: string
    notes: string | null
    instructor: {
        first_name: string
        last_name: string
    } | null
}

export default function MemberGrades({ userId }: { userId: string }) {
    const [grades, setGrades] = useState<Grade[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)

    // Form state
    const [newGrade, setNewGrade] = useState('')
    const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
    const [newNotes, setNewNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const fetchGrades = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('member_grades')
            .select(`
                id, grade, awarded_at, notes,
                instructor:profiles!member_grades_instructor_id_fkey(first_name, last_name)
            `)
            .eq('user_id', userId)
            .order('awarded_at', { ascending: false })

        if (error) {
            console.error('Error fetching grades:', error)
        } else {
            setGrades(data as any[])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchGrades()
    }, [userId])

    const handleAdd = async () => {
        if (!newGrade) return
        setSubmitting(true)

        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase
            .from('member_grades')
            .insert({
                user_id: userId,
                grade: newGrade,
                awarded_at: newDate,
                notes: newNotes,
                instructor_id: user?.id
            })

        if (!error) {
            setShowAdd(false)
            setNewGrade('')
            setNewNotes('')
            fetchGrades()
        } else {
            alert('Error al guardar graduación')
        }
        setSubmitting(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Borrar esta graduación?')) return
        const { error } = await supabase.from('member_grades').delete().eq('id', id)
        if (!error) fetchGrades()
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-500" />
                    Historial de Graduaciones
                </h3>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Graduación
                </button>
            </div>

            {/* Form */}
            <AnimatePresence>
                {showAdd && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 space-y-4 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Grado / Cinturón</label>
                                    <input
                                        type="text"
                                        value={newGrade}
                                        onChange={e => setNewGrade(e.target.value)}
                                        placeholder="Ej: Cinturón Azul"
                                        className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Fecha de Entrega</label>
                                    <input
                                        type="date"
                                        value={newDate}
                                        onChange={e => setNewDate(e.target.value)}
                                        className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Notas (Opcional)</label>
                                <textarea
                                    value={newNotes}
                                    onChange={e => setNewNotes(e.target.value)}
                                    placeholder="Comentarios sobre el examen o la promoción..."
                                    className="w-full h-20 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowAdd(false)}
                                    className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white font-bold text-xs uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAdd}
                                    disabled={!newGrade || submitting}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
                                >
                                    {submitting ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar</>}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* List */}
            <div className="space-y-3">
                {grades.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">
                        No hay graduaciones registradas.
                    </div>
                ) : (
                    grades.map((g, i) => (
                        <div key={g.id} className="relative pl-8 pb-8 border-l-2 border-slate-100 dark:border-slate-800 last:pb-0">
                            {/* Timeline Dot */}
                            <div className="absolute top-0 left-[-9px] w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/30 border-4 border-white dark:border-slate-900 ring-1 ring-blue-500 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            </div>

                            <div className="bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-4 flex justify-between items-start group">
                                <div>
                                    <h4 className="text-lg font-black text-slate-900 dark:text-white">{g.grade}</h4>
                                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {fmtDateShort(g.awarded_at)}
                                        </span>
                                        {g.instructor && (
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                Por {g.instructor.first_name} {g.instructor.last_name}
                                            </span>
                                        )}
                                    </div>
                                    {g.notes && (
                                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                                            {g.notes}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(g.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"
                                >
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
