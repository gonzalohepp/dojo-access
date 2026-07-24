-- ==============================================================================
-- Harden RLS on payments & memberships
-- ==============================================================================
-- security_patch.sql (2026-01-20) enabled RLS on these tables but granted
-- SELECT to `anon` with `USING (true)`. Since the anon key is public (shipped
-- in every browser bundle), anyone can currently do:
--
--   curl 'https://<project>.supabase.co/rest/v1/payments?select=*' \
--        -H 'apikey: <anon key>'
--
-- ...and dump every member's payment history / membership status, without
-- logging in. This script removes anon access and scopes `authenticated`
-- reads to the member's own row, keeping full access for staff (admin +
-- instructor, matching the roles src/middleware.ts already treats as staff
-- for /payments, /members, etc).
--
-- REVIEW BEFORE RUNNING ON PRODUCTION:
--   1. Confirm no public/anon page actually reads these tables directly
--      (the public landing page only needs `classes` and `academies`, which
--      this script does NOT touch).
--   2. Confirm instructors are expected to have full read/write on payments
--      and memberships (today's admin-only policy is extended to instructor
--      here to match what the admin UI already exposes to that role).
--   3. Test in a staging project / branch before applying to prod.
-- ==============================================================================

-- MEMBERSHIPS
DROP POLICY IF EXISTS "memberships select all" ON public.memberships;
DROP POLICY IF EXISTS "memberships admin all" ON public.memberships;

CREATE POLICY "memberships select own" ON public.memberships
FOR SELECT TO authenticated
USING (member_id = auth.uid());

CREATE POLICY "memberships staff all" ON public.memberships
FOR ALL TO authenticated
USING (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
        and profiles.role in ('admin', 'instructor')
    )
);

-- PAYMENTS
DROP POLICY IF EXISTS "payments select all" ON public.payments;
DROP POLICY IF EXISTS "payments admin all" ON public.payments;

CREATE POLICY "payments select own" ON public.payments
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "payments staff all" ON public.payments
FOR ALL TO authenticated
USING (
    exists (
        select 1 from profiles
        where profiles.user_id = auth.uid()
        and profiles.role in ('admin', 'instructor')
    )
);
