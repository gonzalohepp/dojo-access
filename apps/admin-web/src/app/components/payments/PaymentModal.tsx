'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, User, DollarSign, Calendar, CreditCard, AlignLeft, Receipt, Clock } from 'lucide-react';
import { lastDayOfMonth, addMonths, isAfter } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';

type MemberOpt = {
  user_id: string;
  name: string;
  is_new_member: boolean;
  membership_type: string;
};

type ClassOpt = {
  id: number
  name: string
  price_principal: number
  price_additional: number
}

export default function PaymentModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([])
  const [loading, setLoading] = useState(false);

  // logic for class selection
  const [principalClass, setPrincipalClass] = useState<number | null>(null)
  const [additionalClasses, setAdditionalClasses] = useState<number[]>([])

  // form
  const [userId, setUserId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo');
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [from, setFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(() => {
    const dt = new Date();
    dt.setMonth(dt.getMonth() + 1);
    return dt.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');

  // 1. Load Members and Classes
  useEffect(() => {
    if (!open) return;
    (async () => {
      // Load classes
      const { data: classData } = await supabase.from('classes').select('*').order('name')
      if (classData) setClasses(classData)

      // Fetch from view to get fee and new_member status
      const { data, error } = await supabase
        .from('members_with_status')
        .select('user_id, first_name, last_name, is_new_member, membership_type')
        .order('last_name', { ascending: true, nullsFirst: true });

      if (error) {
        console.error('Error cargando miembros:', error);
        setMembers([]);
      } else {
        const opts = (data ?? []).map((p: any) => ({
          user_id: p.user_id,
          name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim(),
          is_new_member: p.is_new_member,
          membership_type: p.membership_type || 'monthly'
        }));
        setMembers(opts);
      }
    })();
  }, [open]);

  // 2. When user is selected, load their CURRENT classes
  useEffect(() => {
    if (!userId) {
      setPrincipalClass(null)
      setAdditionalClasses([])
      return
    }

    (async () => {
      const { data } = await supabase
        .from('class_enrollments')
        .select('class_id, is_principal')
        .eq('user_id', userId)

      if (data) {
        const p = data.find(d => d.is_principal)
        const a = data.filter(d => !d.is_principal).map(d => d.class_id)
        setPrincipalClass(p?.class_id || null)
        setAdditionalClasses(a)
      }
    })()
  }, [userId])

  // 3. Auto-calculate on Selection Change (User OR Classes)
  useEffect(() => {
    if (!userId) return;
    const member = members.find(m => m.user_id === userId);
    if (!member) return;

    // 1. Calculate Base Price
    let base = 0
    if (principalClass) {
      const p = classes.find(c => c.id === principalClass)
      base += Number(p?.price_principal || 0)
    }
    additionalClasses.forEach(id => {
      const a = classes.find(c => c.id === id)
      base += Number(a?.price_additional || a?.price_principal || 0)
    })

    const today = new Date();
    const day = today.getDate();
    // Logic: Surcharge if day > 10 and NOT new member
    const hasSurcharge = day > 10 && !member.is_new_member;
    const total = hasSurcharge ? base * 1.2 : base; // 20% surcharge

    setAmount(total);
    setMethod('efectivo');

    // Dates logic
    const fromDate = today;
    const durationMap = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
    const months = durationMap[member.membership_type as keyof typeof durationMap] || 1;
    const toDate = lastDayOfMonth(addMonths(fromDate, months - 1));

    setPaidAt(fromDate.toISOString().slice(0, 10));
    setFrom(fromDate.toISOString().slice(0, 10));
    setTo(toDate.toISOString().slice(0, 10));

    // Optional: Notes
    if (hasSurcharge) {
      setNotes(`Incluye recargo del 20% por pago fuera de término (día ${day}).`);
    } else {
      setNotes('');
    }

  }, [userId, members, principalClass, additionalClasses, classes]);

  const canSave = useMemo(
    () => !!userId && !!amount && !!paidAt && !!from && !!to,
    [userId, amount, paidAt, from, to]
  );

  const reset = () => {
    setUserId('');
    setAmount('');
    setMethod('efectivo');
    const today = new Date().toISOString().slice(0, 10);
    setPaidAt(today);
    setFrom(today);
    const dt = new Date();
    dt.setMonth(dt.getMonth() + 1);
    setTo(dt.toISOString().slice(0, 10));
    setNotes('');
    setPrincipalClass(null);
    setAdditionalClasses([]);
  };

  const save = async () => {
    if (!canSave) return;
    setLoading(true);

    // 0. Update Class Enrollments if changed
    // We only update if userId is set
    await supabase.from('class_enrollments').delete().eq('user_id', userId)
    const newEnrollments: any[] = []
    if (principalClass) newEnrollments.push({ user_id: userId, class_id: principalClass, is_principal: true })
    additionalClasses.forEach(id => newEnrollments.push({ user_id: userId, class_id: id, is_principal: false }))

    if (newEnrollments.length > 0) {
      await supabase.from('class_enrollments').insert(newEnrollments)
    }

    const { data: insertPay, error: payErr } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount,
        method,
        paid_at: paidAt,
        period_from: from,
        period_to: to,
        notes: notes || null,
      })
      .select('id')
      .maybeSingle();

    if (payErr) {
      alert('Error registrando pago: ' + payErr.message);
      setLoading(false);
      return;
    }

    const { error: membErr } = await supabase.from('memberships').upsert({
      member_id: userId,
      type: 'monthly', // Could also come from member.membership_type
      start_date: from,
      end_date: to,
      notes: `Pago ${insertPay?.id ?? ''}`.trim(),
    }, { onConflict: 'member_id' });

    if (membErr) {
      console.warn('Pago creado pero falló actualizar membresía:', membErr.message);
    }

    setLoading(false);
    reset();
    onSaved();
  };

  if (!open) return null;

  const inputClass = "w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 pl-11 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all";
  const labelClass = "text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block ml-1";

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => { reset(); onClose(); }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-white shadow-2xl custom-scrollbar"
      >
        {/* Header */}
        <div className="sticky top-0 z-[20] bg-slate-900 px-10 py-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-400 border border-white/10">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight uppercase leading-none">Registrar Cobro</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Gestión Financiera</p>
            </div>
          </div>
          <button
            onClick={() => { reset(); onClose(); }}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-10 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Payment Info */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Información del Cobro</h4>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Miembro Beneficiario *</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <select
                      className={`${inputClass} appearance-none cursor-pointer pr-10`}
                      value={userId}
                      onChange={e => setUserId(e.target.value)}
                    >
                      <option value="">Seleccionar miembro...</option>
                      {members.map(m => (
                        <option key={m.user_id} value={m.user_id}>{m.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                      <svg className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Monto Percibido *</label>
                    <div className="relative group">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                      <input
                        type="number"
                        className={inputClass}
                        placeholder="0.00"
                        value={amount}
                        onChange={e => setAmount(e.target.value ? Number(e.target.value) : '')}
                        min={0}
                      />
                      {/* Price Breakdown Hint */}
                      {userId && (() => {
                        const member = members.find(m => m.user_id === userId);
                        if (!member) return null

                        // Calculate base from classes state, not member view
                        let base = 0
                        if (principalClass) {
                          const p = classes.find(c => c.id === principalClass)
                          base += Number(p?.price_principal || 0)
                        }
                        additionalClasses.forEach(id => {
                          const a = classes.find(c => c.id === id)
                          base += Number(a?.price_additional || a?.price_principal || 0)
                        })

                        const isSurcharge = (amount as number) > base;
                        return (
                          <div className="absolute top-full left-0 mt-1 text-[10px] uppercase font-bold text-slate-400">
                            Base: ${base} {isSurcharge && <span className="text-emerald-500 font-black">+ Recargo (20%)</span>}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Fecha de Pago *</label>
                    <div className="relative group">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                      <input
                        type="date"
                        className={inputClass}
                        value={paidAt}
                        onChange={e => setPaidAt(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Método Utilizado</label>
                  <div className="relative group">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                    <select
                      className={`${inputClass} appearance-none cursor-pointer pr-10`}
                      value={method}
                      onChange={e => setMethod(e.target.value as typeof method)}
                    >
                      <option value="efectivo">Efectivo 💵</option>
                      <option value="transferencia">Transferencia Bancaria 🏦</option>
                      <option value="mercadopago">Mercado Pago 📱</option>
                    </select>
                    <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
                      <svg className="h-4 w-4 text-slate-400 group-focus-within:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Class Selection (Dynamic) */}
            <section className="space-y-6 md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Suscripción y Clases</h4>
              </div>

              <div className="p-6 bg-slate-50 rounded-[24px] border border-slate-100">
                <p className="text-xs text-slate-500 font-medium mb-4">Selecciona las clases para este periodo. El precio se calculará automáticamente.</p>

                <div className="flex flex-wrap gap-4">
                  {classes.map(c => {
                    const isPrincipal = principalClass === c.id
                    const isAdditional = additionalClasses.includes(c.id)
                    return (
                      <div
                        key={c.id}
                        className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col gap-2 min-w-[180px] ${isPrincipal
                            ? 'bg-white border-blue-500 shadow-lg shadow-blue-500/10'
                            : isAdditional
                              ? 'bg-white border-emerald-500 shadow-lg shadow-emerald-500/10'
                              : 'bg-white border-transparent hover:border-slate-200'
                          }`}
                        onClick={() => {
                          // toggle logic:
                          // if isPrincipal -> deselect (set null)
                          // if isAdditional -> remove
                          // if nothing -> set as Principal? Or add to additional?
                          // Let's cycle: Nothing -> Principal -> Additional -> Nothing
                          if (isPrincipal) {
                            setPrincipalClass(null)
                            setAdditionalClasses(prev => [...prev, c.id]) // Demote to additional
                          } else if (isAdditional) {
                            setAdditionalClasses(prev => prev.filter(x => x !== c.id))
                          } else {
                            if (!principalClass) setPrincipalClass(c.id)
                            else setAdditionalClasses(prev => [...prev, c.id])
                          }
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-bold text-slate-900">{c.name}</span>
                          {isPrincipal && <span className="bg-blue-100 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded">PRINCIPAL</span>}
                          {isAdditional && <span className="bg-emerald-100 text-emerald-600 text-[9px] font-black px-1.5 py-0.5 rounded">ADICIONAL</span>}
                        </div>
                        <div className="text-[10px] uppercase font-black text-slate-400">
                          ${isPrincipal ? c.price_principal : (c.price_additional || c.price_principal)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Period Info */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Calendar className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Vigencia y Notas</h4>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Periodo Desde *</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="date"
                        readOnly
                        className={`${inputClass.replace('emerald', 'blue')} bg-slate-100 text-slate-500 cursor-not-allowed`}
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Periodo Hasta *</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <input
                        type="date"
                        readOnly
                        className={`${inputClass.replace('emerald', 'blue')} bg-slate-100 text-slate-500 cursor-not-allowed`}
                        value={to}
                        onChange={e => setTo(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Observaciones Adicionales</label>
                  <div className="relative group">
                    <AlignLeft className="absolute left-4 top-5 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <textarea
                      rows={4}
                      className="w-full bg-slate-50 border border-slate-200 rounded-[24px] px-6 py-5 pl-11 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all resize-none italic"
                      placeholder="Detalles sobre el pago, descuentos, etc..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Footer Actions */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={!canSave || loading}
              onClick={save}
              className="flex-1 h-16 bg-emerald-600 text-white rounded-[24px] font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 disabled:opacity-60 transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              {loading ? 'Procesando...' : 'Confirmar Registro'}
            </motion.button>

            <button
              onClick={() => { reset(); onClose(); }}
              className="h-16 px-10 rounded-[24px] border border-slate-200 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
