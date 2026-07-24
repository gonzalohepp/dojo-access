-- ==============================================================================
-- Fix: infinite recursion in "profiles staff all" policy
-- ==============================================================================
-- fix_members_with_status_security_invoker.sql (previous migration) added a
-- policy on `profiles` whose USING clause queries `profiles` itself to check
-- the caller's role:
--
--   CREATE POLICY "profiles staff all" ON public.profiles ...
--     USING (exists (select 1 from profiles admin_check where ...))
--
-- Postgres RLS applies to that inner subquery too (it's just another read of
-- `profiles`), which re-evaluates the same policy, which runs the same
-- subquery again -> infinite recursion (error 42P17). Verified live: any
-- authenticated user (member or staff) got a hard error reading their own
-- profile or members_with_status after that migration.
--
-- The same latent problem existed in harden_payments_memberships_rls.sql's
-- "staff all" policies on payments/memberships, which also do
-- `select 1 from profiles where ...` — that inner read is subject to
-- profiles' RLS too.
--
-- Fix: a SECURITY DEFINER helper function bypasses RLS for just that internal
-- role check (the standard Supabase-recommended pattern for this), breaking
-- the recursion. All three "staff" policies now call it instead of querying
-- profiles directly.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_staff(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = uid AND role IN ('admin', 'instructor')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

DROP POLICY IF EXISTS "profiles staff all" ON public.profiles;
CREATE POLICY "profiles staff all" ON public.profiles
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "payments staff all" ON public.payments;
CREATE POLICY "payments staff all" ON public.payments
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "memberships staff all" ON public.memberships;
CREATE POLICY "memberships staff all" ON public.memberships
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()));
