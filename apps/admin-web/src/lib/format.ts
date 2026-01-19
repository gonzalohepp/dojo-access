
/**
 * Formats a number or string as ARS currency.
 */
export function fmtARS(v: number | string | null) {
    const n = typeof v === 'string' ? Number(v) : v ?? 0;
    return n.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 2,
    });
}

/**
 * Formats an ISO date string to a human-readable Spanish format.
 */
export function fmtDate(d?: string | null | Date) {
    if (!d) return '—';

    let date: Date;
    if (d instanceof Date) {
        date = d;
    } else {
        const iso = d.includes('T') ? d : `${d}T00:00:00`;
        date = new Date(iso);
    }

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Formats a date specifically for tables (shorter format).
 */
export function fmtDateShort(d?: string | null | Date) {
    if (!d) return '—';

    let date: Date;
    if (d instanceof Date) {
        date = d;
    } else {
        const iso = d.includes('T') ? d : `${d}T00:00:00`;
        date = new Date(iso);
    }

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

/**
 * Formats a date and time.
 */
export function fmtDateTime(d?: string | null | Date) {
    if (!d) return '—';

    let date: Date;
    if (d instanceof Date) {
        date = d;
    } else {
        date = new Date(d);
    }

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short'
    }) + ', ' + date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Normalizes a day name to its Spanish abbreviation.
 */
const DAY_MAP: Record<string, string> = {
    mon: 'Lun', tue: 'Mar', wed: 'Mie', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

export function fmtDay(day: string) {
    return DAY_MAP[day.toLowerCase().slice(0, 3)] ?? day;
}

/**
 * Formats a schedule string from days and times.
 */
export function fmtSchedule(days: string[] | null, start?: string | null, end?: string | null) {
    const dias = (days ?? []).map(fmtDay);
    const base = dias.length ? dias.join(', ') : '—';

    const fmtTime = (v?: string | null) => {
        if (!v) return '';
        const date = new Date(`1970-01-01T${v}`);
        return isNaN(date.getTime())
            ? v
            : date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    };

    return (start || end)
        ? `${base} – ${fmtTime(start)}${end ? ` a ${fmtTime(end)}` : ''}`
        : base;
}
