-- ==============================================================================
-- Re-fix: members_with_status / dashboard_stats leaking PII to anon
-- ==============================================================================
-- security_patch.sql (2026-01-20) set `security_invoker = on` on members_with_status
-- and dashboard_stats so they'd respect RLS. tiered_pricing_logic.sql (2026-04-01)
-- later ran `DROP VIEW ... CASCADE` + `CREATE VIEW` to add tiered pricing columns,
-- which silently reset both views back to the Postgres default (SECURITY DEFINER-
-- like behavior: the view runs as its owner, not as the calling role).
--
-- Verified live against staging with only the public anon key (2026-07-24):
--   GET /rest/v1/members_with_status?select=user_id,first_name,last_name,email,phone,status
--   -> returned all 116 members' full name, email, phone and payment status,
--      with zero authentication.
--
-- profiles/payments/memberships themselves are correctly locked down (see
-- harden_payments_memberships_rls.sql) — this migration only needed to restore
-- security_invoker on the two views layered on top of them, and drop the
-- `anon` grant since neither view should be publicly readable.
-- ==============================================================================

ALTER VIEW public.members_with_status SET (security_invoker = on);
ALTER VIEW public.dashboard_stats SET (security_invoker = on);

REVOKE SELECT ON public.members_with_status FROM anon;
REVOKE SELECT ON public.dashboard_stats FROM anon;

-- Members should still be able to read their OWN row (SubscriptionModal,
-- StudentLayout, profile page all query members_with_status client-side for
-- the logged-in user). Staff need to see everyone (admin dashboard, members
-- list, metrics). Both rely on the underlying `profiles`/`memberships`/`payments`
-- RLS policies now that security_invoker is back on, EXCEPT profiles doesn't yet
-- have an explicit "select own row" policy — add one so members_with_status
-- doesn't go fully blank for a logged-in member querying their own status.
DROP POLICY IF EXISTS "profiles select own" ON public.profiles;
CREATE POLICY "profiles select own" ON public.profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles staff all" ON public.profiles;
CREATE POLICY "profiles staff all" ON public.profiles
FOR ALL TO authenticated
USING (
    exists (
        select 1 from profiles admin_check
        where admin_check.user_id = auth.uid()
        and admin_check.role in ('admin', 'instructor')
    )
);
