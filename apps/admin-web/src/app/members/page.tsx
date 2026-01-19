'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminLayout from '../layouts/AdminLayout'
import { Plus, Search, Check, Users, UserPlus, Filter, X, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

import MemberFilters from '../components/members/MemberFilters'
import MemberList from '../components/members/MemberList'
import MemberModal from '../components/members/MemberModal'

import { MemberRow as Row, ClassRow, MemberPayload } from '@/types/member'

function SuccessToast({ message, onClose }: { message: string, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-xl"
    >
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
        <Check className="w-5 h-5" />
      </div>
      <p className="font-bold text-sm tracking-tight">{message}</p>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white transition-colors">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

function MembersContent() {
  const searchParams = useSearchParams()
  const [members, setMembers] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    status: 'todos' as 'todos' | 'activo' | 'vencido',
    membership: 'todos' as 'todos' | 'monthly' | 'quarterly' | 'semiannual' | 'annual',
    className: 'todas' as 'todas' | string
  })
  const [q, setQ] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // --- CARGA ---
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('members_with_status')
      .select('*')
      .order('last_name', { ascending: true, nullsFirst: true })

    if (error) console.error('[members] load error:', error)
    setMembers((data ?? []) as Row[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const loadClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('id,name')
        .order('name')
      setClasses((data ?? []) as ClassRow[])
    }
    loadClasses()
  }, [])

  // --- DETECTAR REQUISICIÓN DE NUEVO MIEMBRO (desde Dashboard) ---
  useEffect(() => {
    const newId = searchParams.get('new_id')
    const newEmail = searchParams.get('new_email')
    const newName = searchParams.get('new_name')

    if (newId && newEmail) {
      const [first, ...rest] = (newName || '').split(' ')
      const last = rest.join(' ')

      setEditing(null)
      // Pasamos un objeto que MemberModal pueda interpretar para pre-rellenar
      // Aunque editing sea null, podemos pasar valores iniciales si quisiéramos, 
      // pero el Modal usa `member` prop para rellenar campos.
      // Si member es null, están vacíos.
      // Mejor pasamos un objeto "mock" para que el modal lo tome como punto de partida.
      setEditing({
        user_id: newId,
        email: newEmail,
        first_name: first || null,
        last_name: last || null,
        phone: null,
        emergency_phone: null,
        notes: 'Registro pendiente desde login',
        access_code: null,
        membership_type: null,
        next_payment_due: null
      })
      setOpen(true)
    }
  }, [searchParams])

  // --- FILTROS + SEARCH ---
  const filtered = useMemo(() => {
    return members.filter((m) => {
      const full = [m.first_name, m.last_name].filter(Boolean).join(' ').trim()
      const derived = m.status || 'vencido'
      const statusOk = filters.status === 'todos' || filters.status === derived
      const membOk =
        filters.membership === 'todos' || m.membership_type === filters.membership
      const classOk =
        filters.className === 'todas' ||
        (m.class_names ?? []).some((n) => n === filters.className)
      const qOk =
        !q ||
        full.toLowerCase().includes(q.toLowerCase()) ||
        (m.email ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (m.phone ?? '').includes(q) ||
        (m.access_code ?? '').toLowerCase().includes(q.toLowerCase())
      return statusOk && membOk && classOk && qOk
    })
  }, [members, filters, q])

  // --- ACCIONES ---
  const onCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const onEdit = (m: Row) => {
    setEditing(m)
    setOpen(true)
  }

  /** Paso 4.1: eliminar con API */
  const onDelete = async (user_id: string) => {
    console.log('[Members] onDelete triggered for:', user_id)
    setConfirmingId(user_id)
  }

  const actuallyDelete = async () => {
    if (!confirmingId) return
    const user_id = confirmingId

    try {
      setDeletingId(user_id)
      console.log('[Members] Calling delete API...')
      const res = await fetch('/api/members/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id })
      })

      const data = await res.json()
      console.log('[Members] Delete API response:', data)

      if (!res.ok) {
        throw new Error(data.error || 'Error desconocido')
      }

      setConfirmingId(null)
      await load()
      setSuccessMsg('Miembro eliminado correctamente')
    } catch (error: any) {
      console.error('[Members] onDelete error:', error)
      alert('Error eliminando miembro: ' + error.message)
    } finally {
      setDeletingId(null)
    }
  }

  // genera access_code único
  const generateAccessCode = async (full_name: string) => {
    const parts = full_name.trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (!parts.length) return ''
    const base = parts[0][0] + parts.slice(1).join('')
    const baseCode = base.replace(/[^a-z0-9]/g, '')
    const { data } = await supabase
      .from('profiles')
      .select('access_code')
      .not('access_code', 'is', null)
    const used = new Set((data ?? []).map((d) => (d.access_code as string).toLowerCase()))
    if (!used.has(baseCode)) return baseCode
    let i = 2
    while (used.has(baseCode + i)) i++
    return baseCode + i
  }

  /** Paso 4.2: upsert de membresía con onConflict: 'member_id' */
  const onSubmit = async (payload: MemberPayload) => {
    const typeMap: Record<string, 'monthly' | 'quarterly' | 'semiannual' | 'annual'> = {
      mensual: 'monthly',
      trimestral: 'quarterly',
      semestral: 'semiannual',
      anual: 'annual'
    }

    const [first_name, ...rest] = payload.full_name.trim().split(/\s+/)
    const last_name = rest.join(' ')
    const access_code =
      payload.access_code?.trim() || (await generateAccessCode(payload.full_name))

    // EDITAR (o actualizar usuario existente)
    // Importante: si editing.status es undefined es que es un "nuevo" via pending
    // Pero en el modal actual, si pasamos `editing` con datos, se comporta como editar.
    // Usaremos el endpoint de creación para todo lo que no sea una edición de un Miembro ya Activo/Inactivo
    if (editing && editing.status) {
      const userId = editing.user_id

      // perfiles
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          first_name,
          last_name,
          email: payload.email,
          phone: payload.phone ?? null,
          emergency_phone: payload.emergency_contact ?? null,
          notes: payload.notes ?? null,
          access_code: payload.access_code?.trim() || null,
          role: 'member' // Aseguramos que sea member
        })
        .eq('user_id', userId)
      if (upErr) {
        alert('Error actualizando perfil: ' + upErr.message)
        return
      }

      // membresía (upsert 1 por member_id)
      const { error: memErr } = await supabase
        .from('memberships')
        .upsert(
          {
            member_id: userId,
            type: typeMap[payload.membership_type],
            start_date:
              payload.last_payment_date ?? new Date().toISOString().slice(0, 10),
            end_date: payload.next_payment_due ?? null
          },
          { onConflict: 'member_id' }
        )
      if (memErr) {
        alert('Error actualizando membresía: ' + memErr.message)
        return
      }

      // clases: simple (borrar e insertar)
      await supabase.from('class_enrollments').delete().eq('user_id', userId)
      if (payload.classes?.length) {
        await supabase
          .from('class_enrollments')
          .insert(payload.classes.map((c) => ({
            user_id: userId,
            class_id: c.class_id,
            is_principal: c.is_principal
          })))
      }

      setOpen(false)
      await load()
      setSuccessMsg('Cambios guardados')
      return
    }

    // CREAR (incluyendo los que vienen de 'pending')
    try {
      const res = await fetch('/api/members/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name,
          last_name,
          email: payload.email,
          phone: payload.phone ?? null,
          emergency_phone: payload.emergency_contact ?? null,
          notes: payload.notes ?? null,
          access_code,
          membership_type: payload.membership_type,
          last_payment_date: payload.last_payment_date,
          next_payment_due: payload.next_payment_due,
          classes: payload.classes
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error desconocido')
      }

      setOpen(false)
      await load()
      setSuccessMsg('Usuario creado correctamente')
    } catch (error: any) {
      alert('Error creando miembro: ' + error.message)
    }

    setOpen(false)
    await load()
  }

  return (
    <AdminLayout>
      <div className="relative min-h-screen">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 p-6 md:p-8">
          <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-widest uppercase mb-4">
                <Users className="w-3 h-3" />
                ADMINISTRACIÓN
              </div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight md:text-5xl">
                Gestión de <span className="text-blue-600 dark:text-blue-400">Miembros</span>
              </h1>
              <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
                Visualiza, filtra y gestiona todos los alumnos del Dojo al instante.
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCreate}
              className="group relative overflow-hidden rounded-2xl bg-blue-600 px-8 py-4 text-white shadow-xl shadow-blue-500/30 transition-all hover:bg-blue-700"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
              <span className="relative flex items-center justify-center gap-3 font-black uppercase tracking-wider text-sm">
                <UserPlus className="h-5 w-5" />
                Nuevo Alumno
              </span>
            </motion.button>
          </header>

          {/* Buscador y Filtros */}
          <div className="mb-8 space-y-4">
            <div className="group relative">
              <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl group-focus-within:bg-blue-500/10 transition-colors" />
              <div className="relative flex items-center bg-white/70 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-sm focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/5 transition-all">
                <Search className="ml-4 h-6 w-6 text-slate-400" />
                <input
                  placeholder="Buscar por nombre, email, teléfono o código…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-12 w-full bg-transparent border-none px-4 focus:ring-0 text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
                />
                {q && (
                  <button onClick={() => setQ('')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-400 transition-colors mr-2">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-2 custom-scrollbar">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400">
                <Filter className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Filtros</span>
              </div>
              <MemberFilters value={filters} onChange={setFilters} classes={classes} />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MemberList members={filtered} loading={loading} onEdit={onEdit} onDelete={onDelete} />
          </motion.div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmingId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deletingId && setConfirmingId(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center text-red-600 mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2 uppercase">¿Estás seguro?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8">
                Esta acción eliminará permanentemente al miembro, sus inscripciones y su historial. Esta acción no se puede deshacer.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={actuallyDelete}
                  disabled={deletingId !== null}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-red-500/30 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {deletingId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ELIMINANDO...
                    </>
                  ) : (
                    'SÍ, ELIMINAR MIEMBRO'
                  )}
                </button>
                <button
                  onClick={() => setConfirmingId(null)}
                  disabled={deletingId !== null}
                  className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                >
                  CANCELAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MemberModal
        open={open}
        onClose={() => setOpen(false)}
        member={editing}
        onSubmit={onSubmit}
      />

      <AnimatePresence>
        {successMsg && (
          <SuccessToast message={successMsg} onClose={() => setSuccessMsg(null)} />
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}

export default function MembersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <MembersContent />
    </Suspense>
  )
}
