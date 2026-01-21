-- ==============================================================================
-- SUPABASE SECURITY HARDENING PATCH
-- Resolve RLS and Security Definer Lints
-- ==============================================================================

-- 1. ENABLE RLS ON PUBLIC TABLES
-- These tables were reported as having RLS disabled or having policies but RLS not enabled.

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- 2. ENSURE BASE POLICIES FOR THESE TABLES
-- We need to ensure that the app can still read these tables for the public sections,
-- and admins can manage them fully.

-- MEMBERSHIPS
DROP POLICY IF EXISTS "memberships select all" ON public.memberships;
CREATE POLICY "memberships select all" ON public.memberships FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "memberships admin all" ON public.memberships;
CREATE POLICY "memberships admin all" ON public.memberships FOR ALL TO authenticated 
USING (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'admin'));

-- PAYMENTS
DROP POLICY IF EXISTS "payments select all" ON public.payments;
CREATE POLICY "payments select all" ON public.payments FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "payments admin all" ON public.payments;
CREATE POLICY "payments admin all" ON public.payments FOR ALL TO authenticated 
USING (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'admin'));

-- CLASSES
DROP POLICY IF EXISTS "classes select all" ON public.classes;
CREATE POLICY "classes select all" ON public.classes FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "classes admin all" ON public.classes;
CREATE POLICY "classes admin all" ON public.classes FOR ALL TO authenticated 
USING (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'admin'));


-- 3. FIX SECURITY DEFINER VIEWS
-- The linter detects views defined as SECURITY DEFINER. 
-- We should convert them to SECURITY INVOKER (the default for regular views).
-- We do this by recreating them or altering them if supported.

-- dashboard_stats
ALTER VIEW IF EXISTS public.dashboard_stats SET (security_invoker = on);

-- members_with_status
ALTER VIEW IF EXISTS public.members_with_status SET (security_invoker = on);

-- v_members
ALTER VIEW IF EXISTS public.v_members SET (security_invoker = on);

-- v_member_classes
ALTER VIEW IF EXISTS public.v_member_classes SET (security_invoker = on);

-- access_logs_view
ALTER VIEW IF EXISTS public.access_logs_view SET (security_invoker = on);
