-- 1. Mejorar el conteo del dashboard
CREATE OR REPLACE VIEW dashboard_stats AS
WITH counts AS (
  SELECT 
    (SELECT count(*) FROM profiles WHERE role = 'member') as total,
    (SELECT count(DISTINCT p.user_id) FROM profiles p 
     JOIN memberships m ON p.user_id = m.member_id 
     WHERE p.role = 'member' AND m.end_date >= CURRENT_DATE) as actives,
    (SELECT count(DISTINCT p.user_id) FROM profiles p 
     JOIN memberships m ON p.user_id = m.member_id 
     WHERE p.role = 'member' AND m.end_date < CURRENT_DATE) as inactives
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
  c.total as members_total,
  c.actives as members_active,
  c.inactives as members_inactive,
  a.success as accesses_success_today,
  a.denied as accesses_denied_today,
  r.total_month as revenue_this_month,
  (
    SELECT json_agg(expiring)
    FROM (
      SELECT p.user_id, p.first_name, p.last_name, p.phone, m.end_date
      FROM profiles p
      JOIN memberships m ON p.user_id = m.member_id
      WHERE m.end_date >= CURRENT_DATE 
        AND m.end_date <= (CURRENT_DATE + interval '7 days')
      ORDER BY m.end_date ASC
    ) expiring
  ) as expiring_next_7d
FROM counts c, revenue r, access_today a;

-- 2. Asegurar que las políticas de RLS permitan leer esta vista (generalmente si no tiene RLS, es legible por roles con permiso en tablas base)
--GRANT SELECT ON dashboard_stats TO authenticated;
--GRANT SELECT ON dashboard_stats TO service_role;
