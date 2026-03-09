/**
 * Calculates the payment multiplier based on the membership expiration date.
 * Rule: 
 * - Until the 10th of the month of expiration OR the month immediately following expiration: 1.0 (no fine)
 * - After the 10th of those months OR 2+ months late: 1.2 (20% fine)
 */
export function getPaymentMultiplier(nextPaymentDue: string | null, isNewMember: boolean): number {
    if (isNewMember) return 1.0
    if (!nextPaymentDue) return 1.0

    const today = new Date()
    const due = new Date(nextPaymentDue + 'T12:00:00')

    // If still valid, no fine
    if (today <= due) return 1.0

    const todayMonth = today.getFullYear() * 12 + today.getMonth()
    const dueMonth = due.getFullYear() * 12 + due.getMonth()

    // Grace months: same month as expiration OR month immediately following
    if (todayMonth === dueMonth || todayMonth === dueMonth + 1) {
        return today.getDate() <= 10 ? 1.0 : 1.2
    }

    // 2+ months late
    return 1.2
}

/**
 * Determines if a member should be allowed access.
 * Rule:
 * - Admins, Instructores, Becados: Always active.
 * - Suspended: Always inactive.
 * - Active: Explicit 'activo' status is trusted (but mostly we check dates).
 * - Delinquent: Allowed until the 20th of the month of expiration.
 */
export function isMemberActive(member: {
    status?: string | null
    role?: string | null
    next_payment_due?: string | null
}): boolean {
    // Special roles bypass expiration
    if (member.role && ['admin', 'instructor', 'becado'].includes(member.role)) return true

    // Explicit suspension
    if (member.status === 'suspendido') return false

    // Lifelong membership
    if (member.next_payment_due === '2099-12-31') return true

    const today = new Date()

    // If no expiration date, assume inactive unless explicitly 'activo'
    if (!member.next_payment_due) {
        return member.status === 'activo'
    }

    const due = new Date(member.next_payment_due + 'T12:00:00')

    // Still within the paid period
    if (today <= due) return true

    const todayMonth = today.getFullYear() * 12 + today.getMonth()
    const dueMonth = due.getFullYear() * 12 + due.getMonth()

    // Grace period for access: same month as expiration until the 20th
    if (todayMonth === dueMonth) {
        return today.getDate() <= 20
    }

    // Any other case (next month or past the 20th)
    return false
}
