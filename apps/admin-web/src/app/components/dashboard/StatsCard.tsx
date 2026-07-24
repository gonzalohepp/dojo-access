import { ReactNode } from 'react'
import { motion } from 'framer-motion'

export default function StatsCard({
  title,
  value,
  icon,
  color = 'blue',
  loading = false,
}: {
  title: string
  value: ReactNode
  icon: ReactNode
  color?: 'blue' | 'green' | 'red' | 'purple' | 'yellow'
  loading?: boolean
}) {
  const colors = {
    blue: 'bg-brand-light text-brand-dark dark:bg-brand/15 dark:text-brand',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    red: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
    purple: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    yellow: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  }
  const bars = {
    blue: 'bg-brand',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    purple: 'bg-violet-500',
    yellow: 'bg-amber-500',
  }

  const badge = colors[color] || colors.blue
  const bar = bars[color] || bars.blue

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 transition-colors hover:border-slate-300 dark:hover:border-white/20">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">{title}</p>
          <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {loading ? (
              <div className="h-9 w-24 rounded-lg bg-slate-200 dark:bg-white/10 animate-pulse" />
            ) : (
              value
            )}
          </div>
        </div>
        <div className={`rounded-xl p-2.5 ${badge}`}>
          {icon}
        </div>
      </div>

      <div className="h-1 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: loading ? '30%' : '100%' }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${bar}`}
        />
      </div>
    </div>
  )
}
