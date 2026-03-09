'use client'

type Filters = {
  status: 'todos' | 'activo' | 'vencido'
  className: 'todas' | string
  role: 'todos' | 'admin' | 'member' | 'instructor' | 'becado'
}

type ClassOpt = { id: number; name: string }

const selectClass = `
  h-9 md:h-10 rounded-xl border border-slate-200 dark:border-slate-700
  bg-white dark:bg-slate-800 px-3 md:px-4
  text-[11px] md:text-xs font-bold uppercase tracking-wider
  text-slate-600 dark:text-slate-300
  focus:outline-none focus:ring-2 focus:ring-blue-500/20
  transition-all cursor-pointer appearance-none
  hover:bg-slate-50 dark:hover:bg-slate-700
  shrink-0
`.replace(/\s+/g, ' ').trim()

export default function MemberFilters({
  value,
  onChange,
  classes,
}: {
  value: Filters
  onChange: (v: Filters) => void
  classes: ClassOpt[]
}) {
  return (
    <>
      <select
        className={selectClass}
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value as Filters['status'] })}
      >
        <option value="todos">Todos los Estados</option>
        <option value="activo">Activos</option>
        <option value="vencido">Vencidos</option>
      </select>

      <select
        className={selectClass}
        value={value.className}
        onChange={(e) => onChange({ ...value, className: e.target.value as Filters['className'] })}
      >
        <option value="todas">Todas las Clases</option>
        {classes.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={value.role}
        onChange={(e) => onChange({ ...value, role: e.target.value as Filters['role'] })}
      >
        <option value="todos">Todos los Roles</option>
        <option value="member">Socios</option>
        <option value="instructor">Instructores</option>
        <option value="becado">Becados</option>
        <option value="admin">Administrador</option>
      </select>
    </>
  )
}