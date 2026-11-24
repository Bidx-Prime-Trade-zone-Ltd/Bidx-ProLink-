-- Fix infinite RLS recursion: an INSERT policy must not query the same
-- RLS-protected table to test whether the row already exists. The primary key
-- enforces one row per user, and authenticated users have no UPDATE/DELETE grants.
drop policy if exists "Users can set their ProLink country once" on public.prolink_account_settings;
create policy "Users can set their ProLink country once"
  on public.prolink_account_settings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
