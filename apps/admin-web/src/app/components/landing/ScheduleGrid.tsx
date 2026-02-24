"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Dumbbell, Swords, Trophy, Sparkles, X } from "lucide-react"

type TimeSlot = {
  time: string
  available: boolean[]
}

type ConditioningSchedule = {
  type: "acondicionamiento"
  title: string
  description: string
  days: string[]
  times: TimeSlot[]
}

type MartialClass = {
  nombre: string
  subtitle?: string
  horario: string
  tipo: "bjj" | "kids" | "mma" | "grappling" | "judo" | "fem"
  col: number
  row: number
}

type MartialSchedule = {
  type: "martiales"
  title: string
  description: string
  days: string[]
  clases: MartialClass[]
}

type Schedule = ConditioningSchedule | MartialSchedule

const schedules: Record<"acondicionamiento" | "martiales", Schedule> = {
  acondicionamiento: {
    type: "acondicionamiento",
    title: "Acondicionamiento Físico",
    description: "Entrenamiento funcional al máximo: fuerza, resistencia y movilidad.",
    days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
    times: [
      { time: "7:30", available: [true, false, true, false, true] },
      { time: "8:30", available: [true, true, true, true, true] },
      { time: "9:30", available: [true, false, true, false, true] },
      { time: "16:00", available: [false, true, false, true, false] },
      { time: "17:00", available: [true, true, true, true, true] },
      { time: "18:00", available: [true, true, true, true, true] },
      { time: "19:00", available: [true, false, true, false, true] },
      { time: "20:00", available: [false, true, false, true, false] },
    ],
  },
  martiales: {
    type: "martiales",
    title: "",
    description: "Horarios de BJJ, Grappling, MMA y Judo organizados por día para todos los niveles.",
    days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
    clases: [
      { nombre: 'BJJ', horario: '7:30 A 9:00', tipo: 'bjj', col: 2, row: 2 },
      { nombre: 'BJJ', horario: '7:30 A 9:00', tipo: 'bjj', col: 4, row: 2 },
      { nombre: 'BJJ', subtitle: 'FEMENINO', horario: '08:00 A 09:30', tipo: 'fem', col: 6, row: 2 },
      { nombre: 'BJJ', horario: '16:30 A 18:00', tipo: 'bjj', col: 1, row: 3 },
      { nombre: 'BJJ', horario: '16:30 A 18:00', tipo: 'bjj', col: 3, row: 3 },
      { nombre: 'BJJ', horario: '16:30 A 18:00', tipo: 'bjj', col: 5, row: 3 },
      { nombre: 'GRAPPLING', horario: '10:00 A 11:30', tipo: 'grappling', col: 6, row: 3 },
      { nombre: 'BJJ', subtitle: 'KIDS', horario: '18:00 A 19:00', tipo: 'kids', col: 1, row: 4 },
      { nombre: 'BJJ', subtitle: 'KIDS', horario: '18:00 A 19:00', tipo: 'kids', col: 3, row: 4 },
      { nombre: 'BJJ', subtitle: 'KIDS', horario: '18:00 A 19:00', tipo: 'kids', col: 5, row: 4 },
      { nombre: 'MMA', horario: '19:00 A 20:00', tipo: 'mma', col: 1, row: 6 },
      { nombre: 'GRAPPLING', horario: '19:00 A 20:30', tipo: 'grappling', col: 2, row: 6 },
      { nombre: 'MMA', horario: '19:00 A 20:00', tipo: 'mma', col: 3, row: 6 },
      { nombre: 'GRAPPLING', horario: '19:00 A 20:30', tipo: 'grappling', col: 4, row: 6 },
      { nombre: 'MMA', horario: '19:00 A 20:00', tipo: 'mma', col: 5, row: 6 },
      { nombre: 'BJJ', horario: '20:00 A 21:30', tipo: 'bjj', col: 1, row: 7 },
      { nombre: 'JUDO', horario: '20:30 A 22:00', tipo: 'judo', col: 2, row: 7 },
      { nombre: 'BJJ', horario: '20:00 A 21:30', tipo: 'bjj', col: 3, row: 7 },
      { nombre: 'JUDO', horario: '20:30 A 22:00', tipo: 'judo', col: 4, row: 7 },
      { nombre: 'BJJ', horario: '20:00 A 21:30', tipo: 'bjj', col: 5, row: 7 },
    ],
  },
}

type ScheduleKey = keyof typeof schedules

const INFO_CLASES = {
  bjj: {
    descripcion: "El Jiu-Jitsu Brasileño se centra en la lucha cuerpo a cuerpo en el suelo, usando palancas y estrangulaciones para someter al oponente sin necesidad de golpes.",
    requisitos: "Ropa deportiva o kimono (se puede conseguir en dojo). Protector bucal recomendado.",
    beneficios: "Mejora la fuerza funcional, la movilidad, la técnica, la concentración y la confianza, siendo apto tanto para defensa personal como para práctica recreativa y competitiva."
  },
  mma: {
    descripcion: "Las Artes Marciales Mixtas combinan golpeo, derribos y lucha en el suelo, integrando distintas disciplinas en un sistema completo de combate.",
    requisitos: "Ropa deportiva, vendas, protector bucal y guantes (se pueden conseguir en el dojo).",
    beneficios: "Desarrolla condición física general, coordinación, resistencia y comprensión integral del combate."
  },
  grappling: {
    descripcion: "El Grappling es lucha cuerpo a cuerpo sin kimono, enfocada en derribos, control, transiciones y sumisiones, con un ritmo más dinámico.",
    requisitos: "Ropa deportiva ajustada (rashguard o similar). Protector bucal recomendado.",
    beneficios: "Mejora la movilidad, el control corporal y la eficacia en situaciones reales y competitivas."
  },
  judo: {
    descripcion: "El Judo es un arte marcial basado en proyecciones, desequilibrios y control en el suelo, priorizando el uso eficiente de la fuerza.",
    requisitos: "Kimono de judo o ropa resistente para comenzar.",
    beneficios: "Desarrolla fuerza, equilibrio, coordinación y disciplina, con una base técnica sólida y formativa."
  },
  kids: {
    descripcion: "El Jiu-Jitsu Infantil enseña a niños y niñas a controlar su cuerpo, respetar normas y resolver situaciones físicas de forma segura, a través del juego y la técnica.",
    requisitos: "Ropa cómoda o kimono (se puede conseguir en el dojo).",
    beneficios: "Mejora la coordinación, la disciplina, la confianza y el autocontrol, en un entorno cuidado y formativo."
  },
  fem: {
    descripcion: "La clase de Jiu-Jitsu Femenino es un espacio de entrenamiento recreativo destinado exclusivamente a mujeres, pensado para aprender y practicar Jiu-Jitsu Brasileño de forma progresiva, técnica y en un ambiente cómodo y de acompañamiento.",
    requisitos: "Ropa deportiva o kimono (se puede conseguir en dojo). Protector bucal recomendado.",
    beneficios: "Mejora la fuerza funcional, la movilidad, la técnica, la concentración y la confianza, siendo apto tanto para defensa personal como para práctica recreativa y competitiva."
  }
}

export function ScheduleGrid() {
  const [activeTab, setActiveTab] = useState<ScheduleKey>("martiales")
  const [selectedClass, setSelectedClass] = useState<MartialClass | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const currentSchedule = schedules[activeTab]

  // ACA CAMBIO LOS COLORES DE LAS CARDS
  const getStyles = (tipo: string) => {
    const themes: Record<string, string> = {
      bjj: 'from-blue-600 to-indigo-700 shadow-blue-500/20 border-blue-400/30',
      fem: 'from-pink-600 to-rose-700 shadow-pink-500/20 border-pink-400/30',
      kids: 'from-sky-500 to-blue-600 shadow-sky-500/20 border-sky-400/30',
      mma: 'from-zinc-700 to-black shadow-slate-500/20 border-slate-500/30',
      grappling: 'from-indigo-600 to-violet-800 shadow-indigo-500/20 border-indigo-400/30',
      judo: 'from-blue-800 to-slate-900 shadow-blue-700/20 border-blue-600/30',
    }
    return themes[tipo] || themes.bjj
  }

  // Handle conditioning pivot for the card-based layout
  const conditioningDays = currentSchedule.type === "acondicionamiento"
    ? currentSchedule.days.map((day, dayIndex) => {
      const times = currentSchedule.times
        .filter(slot => slot.available[dayIndex])
        .map(slot => slot.time)
      return { day, times }
    })
    : []

  return (
    <div className="w-full relative py-12 px-2 md:px-0">

      {/* Tabs */}
      <div className="relative z-10 flex justify-center gap-4 mb-12">
        <div className="bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 flex flex-wrap justify-center gap-2 shadow-2xl">
          <button
            onClick={() => setActiveTab("martiales")}
            className={`relative px-6 py-3 rounded-xl text-sm md:text-base font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
              ${activeTab === "martiales" ? "text-white shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
          >
            {activeTab === "martiales" && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-blue-600 rounded-xl" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <span className="relative z-10">Artes Marciales</span>
          </button>

          <button
            onClick={() => setActiveTab("acondicionamiento")}
            className={`relative px-6 py-3 rounded-xl text-sm md:text-base font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
              ${activeTab === "acondicionamiento" ? "text-white shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
          >
            {activeTab === "acondicionamiento" && (
              <motion.div layoutId="activeTab" className="absolute inset-0 bg-blue-600 rounded-xl" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <span className="relative z-10">Acondicionamiento</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
          transition={{ duration: 0.4 }}
          className="relative z-10"
        >
          {/* Header */}
          <div className="text-center mb-10 space-y-3">
            <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter flex items-center justify-center gap-3 italic">
              {currentSchedule.type === "acondicionamiento" && <Sparkles className="w-8 h-8 text-blue-400" />}
              {currentSchedule.title.toUpperCase()}
            </h3>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium">
              {currentSchedule.description}
            </p>
          </div>

          {currentSchedule.type === "martiales" ? (
            <>
              {/* Desktop Grid (lg and up) */}
              <div className="hidden lg:grid lg:grid-cols-6 gap-4">
                {/* Day Headers */}
                {currentSchedule.days.map((dia) => (
                  <div key={dia} className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-4">
                    <h4 className="text-blue-400 font-black text-center text-sm tracking-[0.2em]">{dia.toUpperCase()}</h4>
                  </div>
                ))}

                {/* Full Grid Rendering (Rows 2 to 7) */}
                {Array.from({ length: 6 }).map((_, rowIndex) => {
                  const currentRow = rowIndex + 2
                  return currentSchedule.days.map((_, colIndex) => {
                    const currentCol = colIndex + 1
                    const clase = currentSchedule.clases.find(c => c.col === currentCol && c.row === currentRow)
                    const theme = clase ? getStyles(clase.tipo) : ''

                    return (
                      <motion.div
                        key={`desktop-${currentRow}-${currentCol}`}
                        whileHover={clase ? { scale: 1.02, y: -4 } : {}}
                        onClick={() => clase && setSelectedClass(clase)}
                        className={`
                          relative rounded-2xl p-5 border min-h-[120px] flex flex-col justify-center transition-all duration-300
                          ${clase
                            ? `bg-gradient-to-br ${theme} cursor-pointer shadow-xl group`
                            : 'bg-white/[0.02] border-white/5'
                          }
                        `}
                      >
                        {clase && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                            <div className="relative z-10 flex flex-col items-center text-center gap-2">
                              <h5 className="font-black text-2xl md:text-3xl text-white tracking-tighter leading-none italic uppercase">
                                {clase.nombre}
                              </h5>
                              {clase.subtitle && (
                                <span className="text-[10px] font-black text-white/90 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10">
                                  {clase.subtitle}
                                </span>
                              )}
                              <div className="flex items-center gap-1.5 text-white/90 font-bold text-[11px] bg-black/30 px-2.5 py-1.5 rounded-xl border border-white/5 mt-1">
                                <Clock className="w-3 h-3" />
                                {clase.horario}
                              </div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    )
                  })
                })}
              </div>

              {/* Mobile/Tablet Layout (below lg) - Cards grouped by day */}
              <div className="lg:hidden space-y-6">
                {currentSchedule.days.map((dia, dayIndex) => {
                  const dayCol = dayIndex + 1
                  const clasesDelDia = currentSchedule.clases
                    .filter(c => c.col === dayCol)
                    .sort((a, b) => a.row - b.row)

                  if (clasesDelDia.length === 0) return null

                  return (
                    <motion.div
                      key={dia}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: dayIndex * 0.05 }}
                      className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-4 md:p-6"
                    >
                      {/* Day Header */}
                      <div className="text-center border-b border-white/10 pb-3 mb-4">
                        <h4 className="font-black text-lg uppercase tracking-wider text-blue-400">{dia.toUpperCase()}</h4>
                      </div>

                      {/* Classes for this day */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {clasesDelDia.map((clase, idx) => {
                          const theme = getStyles(clase.tipo)
                          return (
                            <motion.div
                              key={`mobile-${dia}-${idx}`}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSelectedClass(clase)}
                              className={`relative rounded-2xl p-4 border bg-gradient-to-br ${theme} cursor-pointer shadow-xl group`}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                              <div className="relative z-10 flex flex-col items-center text-center gap-1.5">
                                <h5 className="font-black text-xl text-white tracking-tighter leading-none italic uppercase">
                                  {clase.nombre}
                                </h5>
                                {clase.subtitle && (
                                  <span className="text-[9px] font-black text-white/90 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10">
                                    {clase.subtitle}
                                  </span>
                                )}
                                <div className="flex items-center gap-1 text-white/90 font-bold text-[10px] bg-black/30 px-2 py-1 rounded-lg border border-white/5 mt-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {clase.horario}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </>
          ) : (
            /* Conditioning Render (Cards) */
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 lg:gap-4">
              {conditioningDays.map((item, index) => (
                <motion.div
                  key={item.day}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-5 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:bg-slate-900/80 hover:border-blue-500/50 shadow-xl hover:shadow-blue-500/20"
                >
                  <div className="text-center border-b border-white/5 pb-3">
                    <h4 className="font-black text-lg uppercase tracking-wider text-blue-400">{item.day}</h4>
                  </div>
                  <div className="flex flex-col gap-2.5 flex-1">
                    {item.times.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-slate-600 text-sm font-medium italic min-h-[100px]">Descanso</div>
                    ) : (
                      item.times.map((time, idx) => (
                        <div key={idx} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-3 rounded-xl text-xs font-bold text-center shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-blue-900/30">
                          <Clock className="w-3.5 h-3.5 opacity-80" />
                          {time}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {/* Modal / Popup - Using Portal to ensure it's always centered in the viewport */}
      {isMounted && createPortal(
        <AnimatePresence>
          {selectedClass && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-none">
              {/* Fondo desenfocado */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedClass(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto"
              />

              {/* Tarjeta del Modal */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className={`relative w-full max-w-lg rounded-[2.5rem] border border-white/20 shadow-2xl shadow-black overflow-hidden bg-zinc-900 pointer-events-auto max-h-[90vh] flex flex-col`}
              >

                {/* 📍 ZONA DE VIDEO (Se muestra si el tipo tiene video asignado) */}
                {['bjj', 'grappling', 'fem', 'mma'].includes(selectedClass.tipo) && (
                  <div className="absolute inset-0 z-0">
                    <video
                      autoPlay
                      loop
                      muted
                      playsInline
                      src={
                        selectedClass.tipo === 'grappling' ? '/gpp.mp4' :
                          selectedClass.tipo === 'fem' ? '/bjj_fem.mp4' :
                            selectedClass.tipo === 'mma' ? '/mma.mp4' :
                              '/bjj.mp4'
                      }
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 mix-blend-multiply ${selectedClass.tipo === 'grappling' ? 'bg-indigo-900/60' :
                      selectedClass.tipo === 'fem' ? 'bg-pink-900/60' :
                        selectedClass.tipo === 'mma' ? 'bg-red-900/60' :
                          'bg-blue-900/60'
                      }`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  </div>
                )}

                {/* 📍 ZONA DE CONTENIDO (Texto y botones) - Contenedor con scroll para mobile */}
                <div className={`relative z-10 p-8 h-full overflow-y-auto scrollbar-none ${!['bjj', 'grappling', 'fem', 'mma'].includes(selectedClass.tipo) ? `bg-gradient-to-br ${getStyles(selectedClass.tipo)}` : ''}`}>

                  {/* Botón Cerrar */}
                  <button
                    onClick={() => setSelectedClass(null)}
                    className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-black/20 p-2 rounded-full backdrop-blur-sm z-50"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  <div className="space-y-6">
                    <div>
                      <span className="text-white/80 font-black tracking-widest text-xs uppercase">Información de Clase</span>
                      <h2 className="text-4xl md:text-5xl font-black text-white italic leading-none mt-2 drop-shadow-lg">
                        {selectedClass.nombre}
                      </h2>
                      {selectedClass.subtitle && (
                        <span className="inline-block mt-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold text-white uppercase tracking-tighter backdrop-blur-md">
                          {selectedClass.subtitle}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-white/10">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-white font-bold text-sm">{selectedClass.horario}</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-white/90 leading-relaxed font-medium drop-shadow-sm">
                        {INFO_CLASES[selectedClass.tipo as keyof typeof INFO_CLASES]?.descripcion ||
                          "Prepárate para una sesión intensa de entrenamiento. Consulta con el profesor los requisitos de equipo."}
                      </p>

                      {INFO_CLASES[selectedClass.tipo as keyof typeof INFO_CLASES] && (
                        <div className="bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                          <h4 className="text-blue-300 font-black text-xs uppercase mb-1 italic">Requisitos:</h4>
                          <p className="text-white/80 text-sm italic mb-3">
                            {INFO_CLASES[selectedClass.tipo as keyof typeof INFO_CLASES].requisitos}
                          </p>
                          <h4 className="text-green-300 font-black text-xs uppercase mb-1 italic">Beneficios:</h4>
                          <p className="text-white/80 text-sm italic">
                            {INFO_CLASES[selectedClass.tipo as keyof typeof INFO_CLASES].beneficios}
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedClass(null)}
                      className="w-full bg-white/90 backdrop-blur-sm text-black font-black py-4 rounded-2xl hover:bg-white transition-all active:scale-95 uppercase tracking-widest shadow-lg mt-4"
                    >
                      Cerrar Detalles
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}