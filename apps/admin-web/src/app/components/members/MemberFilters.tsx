'use client'

type Filters = {
  status: 'todos' | 'activo' | 'vencido'
  className: 'todas' | string
  role: 'todos' | 'admin' | 'member' | 'instructor' | 'becado'
}

type ClassOpt = { id: number; name: string }

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
    <div className="flex flex-wrap gap-2">
      {/* Estado */}
      <select
        className="h-10 rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm px-4 text-xs font-bold uppercase tracking-wider text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none hover:bg-white"
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value as Filters['status'] })}
      >
        <option value="todos">Todos los Estados</option>
        <option value="activo">Activos</option>
        <option value="vencido">Vencidos</option>
      </select>


      {/* Clase (dinámico) */}
      <select
        className="h-10 rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm px-4 text-xs font-bold uppercase tracking-wider text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none hover:bg-white"
        value={value.className}
        onChange={(e) => onChange({ ...value, className: e.target.value as Filters['className'] })}
      >
        <option value="todas">Todas las Clases</option>
        {classes.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Rol */}
      <select
        className="h-10 rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm px-4 text-xs font-bold uppercase tracking-wider text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none hover:bg-white"
        value={value.role}
        onChange={(e) => onChange({ ...value, role: e.target.value as Filters['role'] })}
      >
        <option value="todos">Todos los Roles</option>
        <option value="member">Socios</option>
        <option value="instructor">Instructores</option>
        <option value="becado">Becados</option>
        <option value="admin">Administrador</option>
      </select>
    </div>
  )
}
