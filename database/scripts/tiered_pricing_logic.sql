-- 1. Redifinir la vista members_with_status para lógica de bloqueo automático
-- Bloquea (vencido) después del día 20 si no hay pago para el mes actual.

DROP VIEW IF EXISTS public.members_with_status CASCADE;

CREATE OR REPLACE VIEW members_with_status AS
WITH latest_memberships AS (
    -- Obtenemos solo la membresía más reciente por cada miembro
    SELECT DISTINCT ON (member_id)
        member_id,
        type,
        end_date
    FROM memberships
    ORDER BY member_id, end_date DESC
),
current_month_payments AS (
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
    NOT EXISTS (
        SELECT 1 FROM payments pay WHERE pay.user_id = p.user_id
    ) as is_new_member,
    CASE 
        WHEN p.role = 'admin' THEN 'activo'
        -- Si ya tiene un pago para este período/mes, está activo
        WHEN cp.user_id IS NOT NULL THEN 'activo'
        -- Si su membresía aún no vence, está activo
        WHEN m.end_date >= CURRENT_DATE THEN 'activo'
        -- REGLA DE GRACIA: Si estamos entre el 1 y el 20, permitimos el acceso
        -- siempre que haya vencido como máximo el mes pasado.
        WHEN EXTRACT(DAY FROM CURRENT_DATE) <= 20 
             AND m.end_date >= (date_trunc('month', CURRENT_DATE) - interval '1 month')
             THEN 'activo'
        -- Día 21 en adelante sin pago o vencido de meses anteriores = Vencido
        ELSE 'vencido'
    END as status
FROM profiles p
LEFT JOIN latest_memberships m ON p.user_id = m.member_id
LEFT JOIN current_month_payments cp ON p.user_id = cp.user_id
LEFT JOIN enrolled_classes ec ON p.user_id = ec.user_id
WHERE p.role = 'member' OR p.role = 'admin';

-- 2. Sincronizar dashboard_stats para que use la misma lógica
CREATE OR REPLACE VIEW dashboard_stats AS
WITH stats AS (
  SELECT 
    count(*) as total,
    count(*) filter (where status = 'activo') as actives,
    count(*) filter (where status = 'vencido') as inactives
  FROM members_with_status
  WHERE role = 'member'
),
revenue AS (
  SELECT COALESCE(SUM(amount), 0) as total_month
  FROM payments
  WHERE date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)
),
access_today AS (
  SELECT 
    count(*) filter (where result = 'authorized') as success,
    count(*) filter (where result = 'denied') as denied
  FROM access_logs
  WHERE scanned_at >= CURRENT_DATE
)
SELECT 
  s.total as members_total,
  s.actives as members_active,
  s.inactives as members_inactive,
  a.success as accesses_success_today,
  a.denied as accesses_denied_today,
  r.total_month as revenue_this_month,
  (
    SELECT json_agg(expiring)
    FROM (
      SELECT user_id, first_name, last_name, phone, next_payment_due as end_date
      FROM members_with_status
      WHERE status = 'activo'
    SELECT json_agg(expiring)
    FROM (
      SELECT user_id, first_name, last_name, phone, next_payment_due as end_date
      FROM members_with_status
      WHERE status = 'activo'
        AND (
          -- 1. Próximos a vencer en el futuro (próximos 7 días)
          (next_payment_due >= CURRENT_DATE AND next_payment_due <= (CURRENT_DATE + interval '7 days'))
          OR
          -- 2. Ya vencieron (periodo de gracia) pero con avisos inteligentes:
          (
            next_payment_due < CURRENT_DATE 
            AND (
              -- Fase 1: Del día 7 al 10 (Aviso: pronto interés del 20%)
              (EXTRACT(DAY FROM CURRENT_DATE) BETWEEN 7 AND 10)
              OR
              -- Fase 2: Del día 11 al 17 (Aviso: interés del 20% ya aplicado)
              (EXTRACT(DAY FROM CURRENT_DATE) BETWEEN 11 AND 17)
              OR
              -- Fase 3: Del día 18 en adelante (Aviso: bloqueo inminente el 21)
              (EXTRACT(DAY FROM CURRENT_DATE) >= 18)
            )
          )
        )
      ORDER BY next_payment_due ASC
      LIMIT 15
    ) expiring
  ) as expiring_next_7d
FROM stats s, revenue r, access_today a;

-- 3. Función auxiliar para el multiplicador de precio
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
