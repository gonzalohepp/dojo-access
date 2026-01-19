-- 1. Redifinir la vista members_with_status para lógica de bloqueo automático
-- Bloquea (vencido) después del día 20 si no hay pago para el mes actual.

DROP VIEW IF EXISTS public.members_with_status CASCADE;

CREATE OR REPLACE VIEW members_with_status AS
WITH current_month_payments AS (
    -- Buscamos pagos que cubran el día de hoy
    SELECT DISTINCT user_id
    FROM payments
    WHERE 
        (period_from <= CURRENT_DATE AND period_to >= CURRENT_DATE)
        OR (
            EXTRACT(MONTH FROM paid_at) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM paid_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        )
),
enrolled_classes AS (
    SELECT 
        ce.user_id,
        json_agg(c.name) as class_names
    FROM class_enrollments ce
    JOIN classes c ON ce.class_id = c.id
    GROUP BY ce.user_id
)
SELECT 
    p.user_id,
    p.first_name,
    p.last_name,
    p.email,
    p.phone,
    p.emergency_phone,
    p.notes,
    p.access_code,
    p.role,
    m.type as membership_type,
    m.end_date as next_payment_due,
    ec.class_names,
    COALESCE((
        SELECT SUM(CASE WHEN ce.is_principal THEN c.price_principal ELSE COALESCE(c.price_additional, c.price_principal) END)
        FROM class_enrollments ce 
        JOIN classes c ON ce.class_id = c.id 
        WHERE ce.user_id = p.user_id
    ), 0) as estimated_monthly_fee,
    CASE 
        WHEN p.role = 'admin' THEN 'activo'
        -- Si ya tiene un pago para este mes, está activo pase lo que pase
        WHEN cp.user_id IS NOT NULL THEN 'activo'
        -- Si hoy es entre 1 y 20, sigue activo por gracia (si tiene una membresía previa aceptable)
        WHEN EXTRACT(DAY FROM CURRENT_DATE) <= 20 THEN 'activo'
        -- Día 21 en adelante sin pago = Vencido
        ELSE 'vencido'
    END as status
FROM profiles p
LEFT JOIN memberships m ON p.user_id = m.member_id
LEFT JOIN current_month_payments cp ON p.user_id = cp.user_id
LEFT JOIN enrolled_classes ec ON p.user_id = ec.user_id
WHERE p.role = 'member';

-- 2. Función auxiliar para obtener el multiplicador de precio actual
-- 1 al 10: 1.0x
-- 11 al 20: 1.2x (20% recargo)
-- 21+: 1.2x (Sigue con recargo si se llega a habilitar el pago manualmente)

CREATE OR REPLACE FUNCTION get_current_pricing_multiplier() 
RETURNS NUMERIC AS $$
BEGIN
    IF EXTRACT(DAY FROM CURRENT_DATE) <= 10 THEN
        RETURN 1.0;
    ELSE
        RETURN 1.2;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
