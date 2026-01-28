export type MemberRow = {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    emergency_phone: string | null
    notes: string | null
    access_code: string | null
    next_payment_due: string | null
    start_date?: string | null // Original Join Date
    last_payment_date?: string | null // Last Payment / Renewal Date
    end_date?: string | null
    status?: 'activo' | 'inactivo' | 'vencido' | 'suspendido'
    class_ids?: number[]
    class_names?: string[]
    avatar_url?: string | null
    role?: 'admin' | 'member' | 'instructor' | 'becado' | null
    estimated_monthly_fee?: number | null
}

export type ClassRow = {
    id: number
    name: string
    is_principal?: boolean
    price_principal?: number
    price_additional?: number
}

export type MemberPayload = {
    full_name: string
    email: string
    phone?: string
    access_code?: string
    classes: { class_id: number; is_principal: boolean }[]
    last_payment_date?: string
    next_payment_due?: string
    emergency_contact?: string
    notes?: string
    role?: 'admin' | 'member' | 'instructor' | 'becado'
}

export type ClassOption = {
    id: number
    name: string
    price_principal: number | null
    price_additional: number | null
    color: string | null
}
