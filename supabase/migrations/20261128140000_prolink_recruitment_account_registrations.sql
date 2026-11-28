-- Persist employment intent independently from optional employer/candidate profile completion.
create table if not exists public.prolink_recruitment_registrations (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('employer','job_seeker')),
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, account_type)
);
create index if not exists prolink_recruitment_registrations_type_idx
  on public.prolink_recruitment_registrations(account_type, registered_at desc);

alter table public.prolink_recruitment_registrations enable row level security;
revoke all on public.prolink_recruitment_registrations from anon, authenticated;
grant select, insert, update, delete on public.prolink_recruitment_registrations to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='prolink_recruitment_registrations'
      and policyname='Recruitment registrations are Worker only'
  ) then
    create policy "Recruitment registrations are Worker only"
      on public.prolink_recruitment_registrations
      for all to anon, authenticated
      using (false) with check (false);
  end if;
end $$;
