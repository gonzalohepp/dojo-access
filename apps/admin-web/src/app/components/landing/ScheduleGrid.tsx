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

type MartialSchedule = {
  type: "martiales"
  title: string
  description: string
  days: string[]
  rows: string[][]
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
    title: "BJJ / Grappling / MMA / Judo",
    description:
      "Horarios de BJJ, Grappling, MMA y Judo organizados por día para todos los niveles.",
    days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"],
    rows: [
      ["", "BJJ 7:30–9:00", "", "BJJ 7:30–9:00", "", "Grappling 10:00–11:30"],
      ["", "", "", "", "", "BJJ Competitivo 12:00–13:30"],
      ["BJJ 16:30–18:00", "", "BJJ 16:30–18:00", "", "BJJ 16:30–18:00", ""],
      ["BJJ Kids 18:00–19:00", "", "BJJ Kids 18:00–19:00", "", "BJJ Kids 18:00–19:00", ""],
      ["MMA 19:00–20:00", "Grappling 19:00–20:30", "MMA 19:00–20:00", "Grappling 19:00–20:30", "MMA 19:00–20:00", ""],
      ["BJJ 20:00–21:30", "", "BJJ 20:00–21:30", "", "BJJ 20:00–21:30", ""],
      ["", "Judo 20:30–22:00", "", "Judo 20:30–22:00", "", ""],
    ],
  },
}

type ScheduleKey = keyof typeof schedules

export function ScheduleGrid() {
  const [activeTab, setActiveTab] = useState<ScheduleKey>("martiales")
  const currentSchedule = schedules[activeTab]

  // Helper: Pivot table for "Conditioning" to show as Card Columns like Martiales
  const conditioningDays = currentSchedule.type === "acondicionamiento"
    ? currentSchedule.days.map((day, dayIndex) => {
      const times = currentSchedule.times
        .filter(slot => slot.available[dayIndex])
        .map(slot => slot.time)
      return { day, times }
    })
    : []

  // Helper: Get classes for Martiales
  const martialDays =
    currentSchedule.type === "martiales"
      ? currentSchedule.days.map((day, dayIndex) => {
        const classes = currentSchedule.rows
          .map((row) => row[dayIndex])
          .filter((cell) => cell && cell.trim().length > 0)
        return { day, classes }
      })
      : []

  return (
    <div className="w-full relative">
      {/* Decorative background glow for the whole component */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-600/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Tabs */}
      <div className="relative z-10 flex justify-center gap-4 mb-12">
        <div className="bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 flex flex-wrap justify-center gap-2 shadow-2xl">
          <button
            onClick={() => setActiveTab("martiales")}
            className={`
              relative px-6 py-3 rounded-xl text-sm md:text-base font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
              ${activeTab === "martiales" ? "text-white shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"}
            `}
          >
            {activeTab === "martiales" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-blue-600 rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Swords className="w-4 h-4" /> BJJ / MMA / Judo
            </span>
          </button>

          <button
            onClick={() => setActiveTab("acondicionamiento")}
            className={`
              relative px-6 py-3 rounded-xl text-sm md:text-base font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2
              ${activeTab === "acondicionamiento" ? "text-white shadow-lg" : "text-slate-400 hover:text-white hover:bg-white/5"}
            `}
          >
            {activeTab === "acondicionamiento" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-emerald-600 rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Dumbbell className="w-4 h-4" /> Acondicionamiento
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
          transition={{ duration: 0.4 }}
          className="relative z-10"
        >
          {/* Header */}
          <div className="text-center mb-10 space-y-3">
            <h3 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center justify-center gap-3">
              {currentSchedule.type === "martiales" ? (
                <Trophy className="w-8 h-8 text-yellow-400" />
              ) : (
                <Sparkles className="w-8 h-8 text-emerald-400" />
              )}
              {currentSchedule.title}
            </h3>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium">
              {currentSchedule.description}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:gap-4">
            {(currentSchedule.type === "martiales" ? martialDays : conditioningDays).map((item, index) => {
              // Determine if it's the "Conditioning" render logic (item has .times) or "Martial" (item has .classes)
              // Since both arrays are mapped to objects with different properties, we cast or check
              const day = item.day
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const items = (item as any).classes || (item as any).times

              // Styling constants based on type
              const isMartial = currentSchedule.type === "martiales"
              const cardBorder = isMartial ? "hover:border-blue-500/50" : "hover:border-emerald-500/50"
              const cardShadow = isMartial ? "hover:shadow-blue-500/20" : "hover:shadow-emerald-500/20"
              const chipGradient = isMartial
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-900/30"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-900/30"
              const dayColor = isMartial ? "text-blue-400" : "text-emerald-400"

              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`
                    group relative bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-3xl p-5 
                    flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:bg-slate-900/80
                    ${cardBorder} shadow-xl ${cardShadow}
                  `}
                >
                  <div className="text-center border-b border-white/5 pb-3">
                    <h4 className={`font-black text-lg uppercase tracking-wider ${dayColor}`}>
                      {day}
                    </h4>
                  </div>

                  <div className="flex flex-col gap-2.5 flex-1">
                    {items.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-slate-600 text-sm font-medium italic min-h-[100px]">
                        Descanso
                      </div>
                    ) : (
                      items.map((text: string, idx: number) => (
                        <div
                          key={idx}
                          className={`
                            ${chipGradient} text-white py-3 px-3 rounded-xl text-xs font-bold text-center shadow-lg
                            flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform
                          `}
                        >
                          {!isMartial && <Clock className="w-3.5 h-3.5 opacity-80" />}
                          {text}
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}