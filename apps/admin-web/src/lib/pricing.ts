/**
 * pricing.ts — Lógica de recargos por mora
 *
 * Reglas de negocio:
 *  - Pago dentro del mes o días 1-10 del siguiente → sin recargo (× 1.0)
 *  - Días 11-20 del mes siguiente                  → 20% recargo  (× 1.2)
 *  - Día 21+ del mes siguiente                     → 20% recargo  (× 1.2) + acceso bloqueado (lo maneja la view)
 *  - 2+ meses sin pagar                            → 20% recargo  (× 1.2) + acceso bloqueado
 *  - Nuevos miembros                               → sin recargo  (× 1.0)
 *  - Roles especiales (admin/instructor/becado)    → sin recargo  (× 1.0)
 */

/**
 * Devuelve el multiplicador de precio según la fecha de vencimiento del miembro
 * y la fecha actual en ART.
 *
 * @param nextPaymentDue  Campo `next_payment_due` de members_with_status (YYYY-MM-DD)
 * @param isNewMember     Si el miembro nunca hizo un pago
 * @param role            Rol del miembro
 */
export function getPaymentMultiplier(
    nextPaymentDue: string | null | undefined,
    isNewMember: boolean,
    role?: string | null
): number {
    // Roles especiales y nuevos miembros nunca tienen recargo
    if (isNewMember) return 1.0
    if (role && ['admin', 'instructor', 'becado'].includes(role)) return 1.0
    if (!nextPaymentDue || nextPaymentDue === '2099-12-31') return 1.0

    // Fecha actual en ART (UTC-3)
    const now = new Date()
    const todayART = new Date(
        now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
    )

    const due = new Date(nextPaymentDue + 'T12:00:00')

    // Todavía vigente → sin recargo
    if (todayART <= due) return 1.0

    // ¿Estamos en el mes inmediatamente siguiente al vencimiento?
    const isGraceMonth =
        (todayART.getFullYear() === due.getFullYear() &&
            todayART.getMonth() === due.getMonth() + 1) ||
        // Caso borde: diciembre → enero del año siguiente
        (due.getMonth() === 11 &&
            todayART.getMonth() === 0 &&
            todayART.getFullYear() === due.getFullYear() + 1)

    // 2+ meses vencido → recargo 20%
    if (!isGraceMonth) return 1.2

    // Dentro del mes de gracia: días 1-10 sin recargo, 11+ con 20%
    return todayART.getDate() <= 10 ? 1.0 : 1.2
}

/**
 * Devuelve un mensaje descriptivo del estado de pago para mostrar en la UI.
 */
export function getPaymentStatusMessage(
    nextPaymentDue: string | null | undefined,
    role?: string | null
): string {
    if (role && ['admin', 'instructor', 'becado'].includes(role)) return 'Tu membresía es vitalicia'
    if (!nextPaymentDue || nextPaymentDue === '2099-12-31') return 'Tu membresía es vitalicia'

    const now = new Date()
    const todayART = new Date(
        now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
    )
    const due = new Date(nextPaymentDue + 'T12:00:00')

    if (todayART <= due) {
        const daysLeft = Math.round((due.getTime() - todayART.getTime()) / 86400000)
        return `Quedan ${daysLeft} días de entrenamiento`
    }

    const isGraceMonth =
        (todayART.getFullYear() === due.getFullYear() &&
            todayART.getMonth() === due.getMonth() + 1) ||
        (due.getMonth() === 11 &&
            todayART.getMonth() === 0 &&
            todayART.getFullYear() === due.getFullYear() + 1)

    if (!isGraceMonth) return 'Acceso bloqueado. Regularizá tu situación.'

    const day = todayART.getDate()
    if (day <= 10) return '¡Aprovechá! Pagá sin interés hasta el día 10.'
    if (day <= 20) return '+20% de recargo por pago tardío.'
    return 'Acceso bloqueado. Podés pagar con 20% de recargo.'
}