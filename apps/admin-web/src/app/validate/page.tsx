'use client'

import { useCallback, useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminLayout from '../layouts/AdminLayout'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle, XCircle, RefreshCw, Camera, ShieldCheck, Zap } from 'lucide-react'
import QRScannerHtml5 from '@/components/QRScannerHtml5'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { MemberRow as BaseMemberRow } from '@/types/member'

export const dynamic = 'force-dynamic'

// Extend the base MemberRow with validate-specific fields
type MemberRow = BaseMemberRow & {
  is_new_member?: boolean
}

type ClassCandidate = {
  id: number
  name: string
  instructor: string | null
  start_time: string | null
  end_time: string | null
  color: string | null
  days: string[] | null
}

const DAY_MAP = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sáb']

function isTimeBefore(current: string, target: string, minusMinutes: number = 0): boolean {
  try {
    const [cHours, cMins] = current.split(':').map(Number)
    const [tHours, tMins] = target.split(':').map(Number)
    const currentTotal = cHours * 60 + cMins
    const targetTotal = tHours * 60 + tMins - minusMinutes
    return currentTotal <= targetTotal
  } catch {
    return false
  }
}

const fullName = (m: MemberRow | null) =>
  m ? [m.first_name ?? '', m.last_name ?? ''].join(' ').trim() || 'Miembro' : 'Miembro'



function ValidateContent() {
  const router = useRouter()
  const qp = useSearchParams()

  // Datos usuario / miembro
  const [member, _setMember] = useState<MemberRow | null>(null)
  const memberRef = useRef<MemberRow | null>(null)
  const setMember = (m: MemberRow | null) => {
    memberRef.current = m
    _setMember(m)
  }

  const [userEmail, setUserEmail] = useState<string | null>(null)

  const multiplier = useMemo(() => {
    if (member?.is_new_member) return 1.0
    const day = new Date().getDate()
    return day > 10 ? 1.2 : 1.0
  }, [member?.is_new_member])

  const [paused, setPaused] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Resultado
  const [openResult, setOpenResult] = useState(false)
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [resultMsg, setResultMsg] = useState('')

  // Multi-Class selection
  const [candidateClasses, setCandidateClasses] = useState<ClassCandidate[]>([])
  const [selectedClassIds, setSelectedClassIds] = useState<Set<number>>(new Set())
  const [showClassSelection, setShowClassSelection] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)

  // Anti-loop
  const processingRef = useRef(false)
  const lastTextRef = useRef<string | null>(null)
  const lastAtRef = useRef<number>(0)

  // ========= Sesión y preload del miembro ========
  useEffect(() => {
    ; (async () => {
      const { data } = await supabase.auth.getUser()
      const email = data.user?.email ?? null
      setUserEmail(email)
      if (!email) {
        router.replace('/login')
        return
      }
      const { data: rows, error } = await supabase
        .from('members_with_status')
        .select('*')
        .ilike('email', email)
        .limit(1)

      if (error) console.error('[validate] preload error', error)
      setMember((rows?.[0] as MemberRow) ?? null)
    })()
  }, [router])
  // ========= Finalizar y Registrar =========
  const finalizeAccess = useCallback(
    async (m: MemberRow, success: boolean, reason: string, selectedIds: number[] = []) => {
      setIsFinalizing(true)
      try {
        // 1) Registrar asistencia a clases si las hay
        if (selectedIds.length > 0) {
          const today = new Date().toISOString().slice(0, 10)
          const { error: attErr } = await supabase.from('class_attendance').insert(
            selectedIds.map((id) => ({
              user_id: m.user_id,
              class_id: id,
              date: today,
            }))
          )
          if (attErr) console.error('[validate] attendance error', attErr)
        }

        // 2) Log de acceso
        await supabase.from('access_logs').insert({
          user_id: m.user_id,
          result: success ? 'autorizado' : 'denegado',
          reason,
          scanned_at: new Date().toISOString(),
        })

        // 3) Mostrar resultado
        setAllowed(success)
        setResultMsg(reason)
        setOpenResult(true)

        if (success) {
          setTimeout(() => router.replace('/profile'), 1500)
        }
      } catch (e) {
        console.error('[validate] finalize error', e)
      } finally {
        setIsFinalizing(false)
        setShowClassSelection(false)
      }
    },
    [router]
  )

  // ========= Validación =========
  const validateAccess = useCallback(
    async (rawText: string) => {
      if (processingRef.current) return
      processingRef.current = true

      try {
        // 1) Validar TOKEN contra la base de datos
        let token = ''
        try {
          const u = new URL(rawText)
          token = u.searchParams.get('t') || ''
        } catch { }

        if (!token) {
          setAllowed(false)
          setResultMsg('QR inválido (Sin token)')
          setOpenResult(true)
          return
        }

        const { data: dbToken, error: tokenErr } = await supabase
          .from('qr_tokens')
          .select('*')
          .eq('token', token)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle()

        if (tokenErr || !dbToken) {
          setAllowed(false)
          setResultMsg('El código QR ha expirado o no es válido. Escanea el de la pantalla nuevamente.')
          setOpenResult(true)
          return
        }

        // 2) Verificación de membresía
        const emailToCheck = userEmail || memberRef.current?.email || undefined

        if (!emailToCheck) {
          setAllowed(false)
          setResultMsg('Sesión inválida')
          setOpenResult(true)
          return
        }

        const { data: row, error } = await supabase
          .from('members_with_status')
          .select('*')
          .ilike('email', emailToCheck)
          .limit(1)
          .maybeSingle()

        if (error) throw error

        const m = (row as MemberRow) ?? null
        if (!m) {
          setAllowed(false)
          setResultMsg('No se encontró el miembro')
          setOpenResult(true)
          return
        }

        setMember(m)

        if (m.status !== 'activo') {
          let reason = 'Cuenta pendiente de aprobación'
          if (m.status === 'suspendido') reason = 'Membresía suspendida'
          else if (m.status === 'vencido' || m.status === 'inactivo') reason = 'Cuota vencida o cuenta inactiva'

          await finalizeAccess(m, false, reason)
          return
        }

        // 3) COOLDOWN CHECK
        const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
        const { data: recentEntries } = await supabase
          .from('access_logs')
          .select('id')
          .eq('user_id', m.user_id)
          .eq('result', 'autorizado')
          .gt('scanned_at', twoMinsAgo)
          .limit(1)

        if (recentEntries && recentEntries.length > 0) {
          setAllowed(false)
          setResultMsg('Acceso ya registrado recientemente. Espera 2 minutos para volver a escanear.')
          setOpenResult(true)
          return
        }

        // 4) BUSCAR CLASES CANDIDATAS (Día y Horario)
        const now = new Date()
        const dayName = DAY_MAP[now.getDay()]
        const currentTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

        // Buscamos clases en las que está inscrito y que son HOY
        const { data: enrollments, error: enrErr } = await supabase
          .from('class_enrollments')
          .select('class_id, classes(*)')
          .eq('user_id', m.user_id)

        if (enrErr) console.error('[validate] error fetching classes', enrErr)

        const candidates = (enrollments || [])
          .map((enr) => enr.classes as unknown as ClassCandidate)
          .filter((cl) => {
            if (!cl || !cl.days || !cl.end_time) return false
            // Filtro de día
            if (!cl.days.includes(dayName)) return false
            // Filtro de horario: visible hasta 20 min antes del fin
            return isTimeBefore(currentTime, cl.end_time, 20)
          })

        if (candidates.length > 0) {
          setCandidateClasses(candidates)
          setSelectedClassIds(new Set())
          setShowClassSelection(true) // Se abre el popup y se pausa el procesamiento
        } else {
          await finalizeAccess(m, true, 'Acceso autorizado - ¡Bienvenido!')
        }
      } catch (e) {
        console.error('[validate] unexpected error', e)
        setAllowed(false)
        setResultMsg('Error interno al validar')
        setOpenResult(true)
      } finally {
        processingRef.current = false
      }
    },
    [userEmail, finalizeAccess]
  )

  // ========= Callback del scanner (con debounce) =========
  const handleDecode = useCallback(
    (text: string) => {
      const now = Date.now()
      if (text === lastTextRef.current && now - lastAtRef.current < 2000) return
      lastTextRef.current = text
      lastAtRef.current = now

      setPaused(true)           // pausa “soft”
      validateAccess(text)
    },
    [validateAccess]
  )

  // ========= Reintentar cámara =========
  const retryCamera = () => {
    setCameraError(null)
    setPaused(false)
  }

  // Si llegó ?t=... por URL, validamos directamente
  useEffect(() => {
    const t = qp.get('t')
    if (t) handleDecode(`${t}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qp])

  return (
    <AdminLayout active="/validate">
      <div className="relative min-h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden">
        {/* Decoración de fondo futurista */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-4 pt-8 pb-12 flex flex-col min-h-full items-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold tracking-widest uppercase mb-4">
              <ShieldCheck className="w-3 h-3" />
              SISTEMA DE ACCESO
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
              Validar <span className="text-blue-500">Acceso</span>
            </h1>
            <p className="text-slate-400">Escanea tu código QR para ingresar al Dojo</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="w-full relative"
          >
            {/* Contenedor del Scanner con brillo perimetral */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-[2rem] blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-slate-900 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                <div className="p-4">
                  {cameraError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-center gap-3"
                    >
                      <XCircle className="w-5 h-5 shrink-0" />
                      {cameraError}
                    </motion.div>
                  )}

                  <div className="flex items-center justify-center gap-3 mb-4">
                    <button
                      onClick={() => setPaused(p => !p)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${paused
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 active:scale-95'
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        }`}
                    >
                      {paused ? <Zap className="w-4 h-4 fill-current" /> : <Camera className="w-4 h-4" />}
                      {paused ? 'Reanudar' : 'Pausar'}
                    </button>
                    <button
                      onClick={retryCamera}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all font-medium text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reintentar
                    </button>
                  </div>

                  <QRScannerHtml5
                    paused={paused}
                    onDecode={handleDecode}
                    onError={(e: unknown) => {
                      const msg = String(e instanceof Error ? e.message : e)
                      if (
                        msg.includes('scanner is not paused') ||
                        msg.includes('scanner is not scanning') ||
                        msg.includes('NotFoundError') ||
                        msg.includes('AbortError')
                      ) return
                      console.error('[QRScannerHtml5] Camera error:', msg)
                      setCameraError('Error de cámara. Por favor reintenta.')
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Footer decorativo */}
          <div className="mt-auto pt-12 text-center opacity-40">
            <p className="text-xs text-slate-500 font-medium tracking-widest uppercase">Beleza dojo</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showClassSelection && (
          <Dialog open={showClassSelection} onOpenChange={(o) => {
            if (!o) {
              setShowClassSelection(false)
              setPaused(false)
            }
          }}>
            <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-white rounded-3xl overflow-hidden p-0">
              <div className="relative p-8">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                    ¿A qué clase vas a ingresar?
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-1 mb-6">
                  <p className="text-slate-400 text-sm font-medium">Hemos detectado estas clases para ti hoy:</p>
                </div>

                <div className="space-y-3 mb-8">
                  {candidateClasses.map((cl) => {
                    const isSelected = selectedClassIds.has(cl.id)
                    return (
                      <button
                        key={cl.id}
                        onClick={() => {
                          const next = new Set(selectedClassIds)
                          if (next.has(cl.id)) next.delete(cl.id)
                          else next.add(cl.id)
                          setSelectedClassIds(next)
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelected
                          ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                          }`}
                      >
                        <div className="text-left">
                          <p className="font-bold text-white uppercase tracking-tight">{cl.name}</p>
                          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                            {cl.start_time?.slice(0, 5)} - {cl.end_time?.slice(0, 5)} {cl.instructor && `• ${cl.instructor}`}
                          </p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-white border-white text-blue-600' : 'border-white/20'
                          }`}>
                          {isSelected && <CheckCircle className="w-4 h-4" />}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <Button
                  onClick={async () => {
                    if (!member) return;

                    // If member is not active, redirect to MP instead of finalizing access
                    if (member.status !== 'activo') {
                      try {
                        setIsFinalizing(true);
                        const basePrice = member.estimated_monthly_fee || 15000;
                        const finalPrice = Math.round(basePrice * multiplier);

                        const res = await fetch('/api/payments/mp/preference', {
                          method: 'POST',
                          body: JSON.stringify({
                            items: [{
                              id: 'cuota_mensual',
                              title: `Cuota Mensual - Beleza Dojo ${multiplier > 1 ? '(Recargo 20%)' : ''}`,
                              price: finalPrice
                            }],
                            payer_email: member.email || userEmail,
                            user_id: member.user_id,
                            principal_id: candidateClasses.find(c => (c as any).is_principal || selectedClassIds.has(c.id))?.id,
                            additional_ids: Array.from(selectedClassIds)
                          })
                        });

                        const data = await res.json();
                        if (data.init_point) {
                          window.location.href = data.init_point;
                        } else if (data.sandbox_init_point) {
                          window.location.href = data.sandbox_init_point;
                        }
                      } catch (e) {
                        console.error('Payment error', e);
                      } finally {
                        setIsFinalizing(false);
                      }
                      return;
                    }

                    finalizeAccess(member, true, 'Acceso autorizado - ¡Bienvenido!', Array.from(selectedClassIds))
                  }}
                  disabled={isFinalizing}
                  className="w-full py-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50"
                >
                  {isFinalizing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    member?.status !== 'activo' ? 'PAGAR Y ENTRAR' : 'CONFIRMAR INGRESO'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openResult && (
          <Dialog open={openResult} onOpenChange={(o) => {
            setOpenResult(o)
            if (!o && allowed === false) setPaused(false)
          }}>
            <DialogContent className="sm:max-w-md bg-slate-900 border-white/10 text-white rounded-3xl overflow-hidden p-0">
              <div className="relative p-8 text-center bg-gradient-to-b from-transparent to-black/40">
                <DialogHeader><DialogTitle className="sr-only">Resultado</DialogTitle></DialogHeader>

                {allowed ? (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30 relative">
                      <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse" />
                      <CheckCircle className="w-14 h-14 text-green-500 relative z-10" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">Acceso Autorizado</h2>
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-slate-200">{fullName(member)}</p>
                      <p className="text-green-500 font-semibold tracking-wide">{resultMsg}</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30 relative">
                      <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 animate-pulse" />
                      <XCircle className="w-14 h-14 text-red-500 relative z-10" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">Acceso Denegado</h2>
                    <p className="text-red-400 font-medium text-lg">{resultMsg || 'No autorizado'}</p>

                    <div className="pt-6 flex flex-col gap-3">
                      {(member?.status === 'vencido' || member?.status === 'inactivo' || resultMsg.includes('vencida') || resultMsg.includes('inactive')) && (
                        <button
                          onClick={async () => {
                            // Cerrar resultado y mostrar selección de clases primero
                            setOpenResult(false)

                            // Cargar las clases del miembro si no están cargadas
                            if (candidateClasses.length === 0 && member) {
                              const { data } = await supabase
                                .from('class_enrollments')
                                .select(`class_id, is_principal, classes(id, name, instructor, start_time, end_time, color, days)`)
                                .eq('user_id', member.user_id)

                              if (data) {
                                const mapped = data
                                  .filter(e => e.classes)
                                  .map(e => e.classes as unknown as ClassCandidate)
                                setCandidateClasses(mapped)
                                setSelectedClassIds(new Set(mapped.map(c => c.id)))
                              }
                            }

                            // Mostrar selección de clases → desde ahí el usuario confirma → ahí sí va a MP
                            setShowClassSelection(true)
                          }}
                          className="w-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 border-none bg-[#009EE3] p-0 rounded-2xl overflow-hidden shadow-lg shadow-blue-500/20"
                        >
                          <div className="relative h-16 w-full">
                            <Image
                              src="/mp_button.png"
                              alt="Pagar con Mercado Pago"
                              fill
                              className="object-contain"
                            />
                          </div>
                        </button>
                      )}

                      <Button
                        onClick={() => setOpenResult(false)}
                        className="w-full py-6 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 text-white font-bold"
                      >
                        REINTENTAR
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}

export default function ValidatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-blue-600/20 rounded-full mb-4" />
          <p className="text-xs uppercase tracking-widest text-slate-500">Cargando Validacón...</p>
        </div>
      </div>
    }>
      <ValidateContent />
    </Suspense>
  )
}
