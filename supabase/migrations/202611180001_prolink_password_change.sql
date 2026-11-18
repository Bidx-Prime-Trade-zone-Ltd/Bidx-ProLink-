-- Bidx ProLink: short-lived, encrypted password-change approvals.
-- Run this migration in the ProLink Supabase SQL editor for project ljttcncfcetgdqfmtdhm.
create table if not exists public.prolink_pending_password_changes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  encrypted_password text not null,
  encryption_iv text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists prolink_pending_password_changes_expiry_idx
  on public.prolink_pending_password_changes (expires_at);
alter table public.prolink_pending_password_changes enable row level security;
revoke all on public.prolink_pending_password_changes from anon, authenticated;
grant all on public.prolink_pending_password_changes to service_role;
