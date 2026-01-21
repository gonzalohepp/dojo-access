"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Dumbbell, Swords, Trophy, Sparkles } from "lucide-react"

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
  tipo: "bjj" | "kids" | "muay" | "mma" | "grappling" | "judo" | "fem"
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
    title: "Artes Marciales",
    description: "Horarios de BJJ, Grappling, MMA, Muay Thai y Judo organizados por día para todos los niveles.",
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
      { nombre: 'MUAY', subtitle: 'THAI', horario: '17:00 A 19:00', tipo: 'muay', col: 1, row: 5 },
      { nombre: 'MUAY', subtitle: 'THAI', horario: '17:00 A 19:00', tipo: 'muay', col: 2, row: 5 },
      { nombre: 'MUAY', subtitle: 'THAI', horario: '17:00 A 19:00', tipo: 'muay', col: 3, row: 5 },
      { nombre: 'MUAY', subtitle: 'THAI', horario: '17:00 A 19:00', tipo: 'muay', col: 4, row: 5 },
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

export function ScheduleGrid() {
  const [activeTab, setActiveTab] = useState<ScheduleKey>("martiales")
  const currentSchedule = schedules[activeTab]

  // Helper styles for class types
  const getStyles = (tipo: string) => {
    const themes: Record<string, string> = {
      bjj: 'from-blue-600 to-indigo-700 shadow-blue-500/20 border-blue-400/30',
      fem: 'from-pink-600 to-rose-700 shadow-pink-500/20 border-pink-400/30',
      kids: 'from-sky-500 to-blue-600 shadow-sky-500/20 border-sky-400/30',
      muay: 'from-slate-700 to-indigo-900 shadow-indigo-500/20 border-indigo-400/30',
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
    <div className="w-full relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4 overflow-x-auto pb-4">
              {/* Day Headers */}
              {currentSchedule.days.map((dia, i) => (
                <div key={dia} className="hidden lg:block bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 sticky top-0 z-20" style={{ gridColumn: i + 1, gridRow: 1 }}>
                  <h4 className="text-blue-400 font-black text-center text-sm tracking-[0.2em]">{dia.toUpperCase()}</h4>
                </div>
              ))}

              {/* Full Grid Rendering (Rows 2 to 7) */}
              {Array.from({ length: 6 }).map((_, rowIndex) => { // 6 rows of classes (2 to 7)
                const currentRow = rowIndex + 2
                return Array.from({ length: 6 }).map((_, colIndex) => { // 6 columns (days)
                  const currentCol = colIndex + 1
                  // Find class for this specific cell
                  const clase = currentSchedule.clases.find(c => c.col === currentCol && c.row === currentRow)
                  const theme = clase ? getStyles(clase.tipo) : ''

                  return (
                    <motion.div
                      key={`${currentRow}-${currentCol}`}
                      whileHover={clase ? { scale: 1.02, y: -4 } : {}}
                      className={`
                        relative rounded-2xl p-5 border lg:min-h-[120px] flex flex-col justify-center transition-all duration-300
                        ${clase
                          ? `bg-gradient-to-br ${theme} cursor-pointer shadow-xl group`
                          : 'bg-slate-900/20 border-white/5 hidden lg:flex' // Empty cell style
                        }
                      `}
                      style={{
                        gridColumn: typeof window !== 'undefined' && window.innerWidth >= 1024 ? currentCol : 'auto',
                        gridRow: typeof window !== 'undefined' && window.innerWidth >= 1024 ? currentRow : 'auto',
                        // On mobile/tablet, hide empty cells entirely to stack only active classes
                        display: (typeof window !== 'undefined' && window.innerWidth < 1024 && !clase) ? 'none' : undefined
                      }}
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
    </div>
  )
}