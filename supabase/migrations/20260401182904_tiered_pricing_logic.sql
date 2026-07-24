-- 1. Borramos versiones anteriores para evitar conflictos
DROP VIEW IF EXISTS public.dashboard_stats;
DROP VIEW IF EXISTS public.members_with_status CASCADE;

-- 2. Vista de socios con estado (Gracia 1-20 + Roles especiales)
CREATE VIEW public.members_with_status AS
WITH latest_memberships AS (
    SELECT DISTINCT ON (member_id)
        member_id, type, end_date
    FROM memberships
    ORDER BY member_id, end_date DESC
),
current_month_payments AS (
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
    SELECT ce.user_id, json_agg(c.name) as class_names
    FROM class_enrollments ce
    JOIN classes c ON ce.class_id = c.id
    GROUP BY ce.user_id
)
SELECT 
    p.user_id, p.first_name, p.last_name, p.email, p.phone, p.emergency_phone, p.notes, p.access_code, p.role,
    m.type as membership_type, m.end_date as next_payment_due, ec.class_names,
    COALESCE((
        SELECT SUM(CASE WHEN ce.is_principal THEN c.price_principal ELSE COALESCE(c.price_additional, c.price_principal) END)
        FROM class_enrollments ce JOIN classes c ON ce.class_id = c.id WHERE ce.user_id = p.user_id
    ), 0) as estimated_monthly_fee,
    NOT EXISTS (SELECT 1 FROM payments pay WHERE pay.user_id = p.user_id) as is_new_member,
    CASE 
        WHEN p.role = 'admin' THEN 'activo'
        WHEN p.role = 'instructor' THEN 'activo'
        WHEN p.role = 'becado' THEN 'activo'
        WHEN cp.user_id IS NOT NULL THEN 'activo'
        WHEN m.end_date >= CURRENT_DATE THEN 'activo'
        WHEN EXTRACT(DAY FROM CURRENT_DATE) <= 20 
             AND m.end_date >= (date_trunc('month', CURRENT_DATE) - interval '1 month')
             THEN 'activo'
        ELSE 'vencido'
    END as status
FROM profiles p
LEFT JOIN latest_memberships m ON p.user_id = m.member_id
LEFT JOIN current_month_payments cp ON p.user_id = cp.user_id
LEFT JOIN enrolled_classes ec ON p.user_id = ec.user_id
WHERE p.role IN ('member', 'admin', 'instructor', 'becado') OR p.role IS NULL;

-- 3. Vista del Dashboard con "Avisos Inteligentes"
CREATE VIEW public.dashboard_stats AS
WITH stats AS (
  SELECT 
    count(*) as total,
    count(*) filter (where status = 'activo') as actives,
    count(*) filter (where status = 'vencido') as inactives
  FROM members_with_status
  WHERE role != 'admin' -- El admin no cuenta para las métricas de socios
),
revenue AS (
  SELECT COALESCE(SUM(amount), 0) as total_month
  FROM payments
  WHERE date_trunc('month', paid_at) = date_trunc('month', CURRENT_DATE)
),
access_today AS (
  SELECT 
    count(*) filter (where result IN ('authorized', 'autorizado', 'success', 'ok')) as success,
    count(*) filter (where result IN ('denied', 'denegado', 'rejected')) as denied
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
        AND (p.role = 'member' OR p.role IS NULL) -- Solo avisar de vencimientos de socios pagantes
        AND (
          -- 1. Próximos a vencer en el futuro (próximos 7 días)
          (next_payment_due >= CURRENT_DATE AND next_payment_due <= (CURRENT_DATE + interval '7 days'))
          OR
          -- 2. Ya vencieron (periodo de gracia) pero con avisos inteligentes:
          (
            next_payment_due < CURRENT_DATE 
            AND (
              (EXTRACT(DAY FROM CURRENT_DATE) BETWEEN 7 AND 10) -- Día 7-10: Aviso interés
              OR
              (EXTRACT(DAY FROM CURRENT_DATE) BETWEEN 11 AND 17) -- Día 11-17: Interés aplicado
              OR
              (EXTRACT(DAY FROM CURRENT_DATE) >= 18) -- Día 18-20: Aviso bloqueo
            )
          )
        )
      ORDER BY next_payment_due ASC
      LIMIT 15
    ) expiring
  ) as expiring_next_7d
FROM stats s, revenue r, access_today a;

-- 4. Permisos
GRANT SELECT ON public.dashboard_stats TO anon, authenticated, service_role;
GRANT SELECT ON public.members_with_status TO anon, authenticated, service_role;
