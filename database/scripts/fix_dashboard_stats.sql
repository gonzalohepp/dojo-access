-- 1. Eliminar la vista si ya existe para evitar conflictos de reemplazo
DROP VIEW IF EXISTS dashboard_stats;

-- 2. Crear la vista dashboard_stats
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

-- 3. Otorgar permisos (Esencial para que la API pueda leerla)
GRANT SELECT ON dashboard_stats TO anon;
GRANT SELECT ON dashboard_stats TO authenticated;
GRANT SELECT ON dashboard_stats TO service_role;
