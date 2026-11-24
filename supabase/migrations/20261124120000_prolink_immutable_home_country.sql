-- A ProLink account has one immutable home country. Country is stored outside
-- user_metadata because users can edit their own user_metadata through Auth APIs.
create table if not exists public.prolink_account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  home_country_code text not null check (home_country_code ~ '^[A-Z]{2}$'),
  home_country_iso3 text not null check (home_country_iso3 ~ '^[A-Z]{3}$'),
  home_country_name text not null check (length(trim(home_country_name)) > 0),
  preferred_language text not null default 'en' check (preferred_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  created_at timestamptz not null default now()
);

alter table public.prolink_account_settings enable row level security;
revoke all on public.prolink_account_settings from anon, authenticated;
grant select, insert on public.prolink_account_settings to authenticated;
grant all on public.prolink_account_settings to service_role;

drop policy if exists "Users can read their own ProLink country" on public.prolink_account_settings;
create policy "Users can read their own ProLink country"
  on public.prolink_account_settings for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can set their ProLink country once" on public.prolink_account_settings;
create policy "Users can set their ProLink country once"
  on public.prolink_account_settings for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and not exists (
      select 1 from public.prolink_account_settings existing
      where existing.user_id = (select auth.uid())
    )
  );

create or replace function public.prolink_capture_signup_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  country_code text := upper(coalesce(metadata->>'home_country_code', metadata->>'country_code', ''));
  country_iso3 text := upper(coalesce(metadata->>'home_country_iso3', metadata->>'country_iso3', ''));
  country_name text := trim(coalesce(metadata->>'home_country_name', metadata->>'country_name', ''));
  language_code text := lower(coalesce(metadata->>'preferred_language', 'en'));
begin
  if country_code ~ '^[A-Z]{2}$'
     and country_iso3 ~ '^[A-Z]{3}$'
     and country_name <> '' then
    insert into public.prolink_account_settings
      (user_id, home_country_code, home_country_iso3, home_country_name, preferred_language)
    values
      (new.id, country_code, country_iso3, country_name, language_code)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists prolink_capture_signup_country on auth.users;
create trigger prolink_capture_signup_country
  after insert on auth.users
  for each row execute function public.prolink_capture_signup_country();

-- Backfill existing accounts from their current professional profile first,
-- then from their existing Auth metadata. Existing country details are preserved.
insert into public.prolink_account_settings
  (user_id, home_country_code, home_country_iso3, home_country_name, preferred_language)
select
  u.id,
  upper(coalesce(nullif(p.country_code,''), nullif(u.raw_user_meta_data->>'country_code',''))),
  upper(coalesce(nullif(p.country_iso3,''), nullif(u.raw_user_meta_data->>'country_iso3',''))),
  coalesce(nullif(p.country_name,''), nullif(u.raw_user_meta_data->>'country_name','')),
  lower(coalesce(nullif(u.raw_user_meta_data->>'preferred_language',''), 'en'))
from auth.users u
left join public.prolink_professional_profiles p on p.user_id = u.id
where upper(coalesce(nullif(p.country_code,''), nullif(u.raw_user_meta_data->>'country_code',''))) ~ '^[A-Z]{2}$'
  and upper(coalesce(nullif(p.country_iso3,''), nullif(u.raw_user_meta_data->>'country_iso3',''))) ~ '^[A-Z]{3}$'
  and coalesce(nullif(p.country_name,''), nullif(u.raw_user_meta_data->>'country_name','')) is not null
on conflict (user_id) do nothing;
