-- 1. Drop the old permissive policy
drop policy if exists "access_logs insert by authenticated" on public.access_logs;

-- 2. New Policy: Members can ONLY insert logs for themselves
create policy "Members can log own access"
on public.access_logs
for insert
to authenticated
with check (
  auth.uid() = user_id
);

-- 3. New Policy: Admins can insert ANY log (including Guest/NULL user_id)
create policy "Admins can log any access"
on public.access_logs
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
    and profiles.role = 'admin'
  )
);
