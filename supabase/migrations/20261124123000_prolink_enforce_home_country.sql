-- Keep mutable Auth metadata and published/reviewed profiles aligned with the
-- immutable account-country record. The country-settings table remains the source of truth.
create or replace function public.prolink_enforce_auth_home_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare locked record;
begin
  select home_country_code,home_country_iso3,home_country_name
    into locked
    from public.prolink_account_settings
    where user_id = new.id;
  if found then
    new.raw_user_meta_data := jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(coalesce(new.raw_user_meta_data,'{}'::jsonb),'{country_code}',to_jsonb(locked.home_country_code),true),
          '{country_iso3}',to_jsonb(locked.home_country_iso3),true),
        '{country_name}',to_jsonb(locked.home_country_name),true),
      '{home_country_code}',to_jsonb(locked.home_country_code),true);
    new.raw_user_meta_data := jsonb_set(new.raw_user_meta_data,'{home_country_iso3}',to_jsonb(locked.home_country_iso3),true);
    new.raw_user_meta_data := jsonb_set(new.raw_user_meta_data,'{home_country_name}',to_jsonb(locked.home_country_name),true);
  end if;
  return new;
end;
$$;

drop trigger if exists prolink_enforce_auth_home_country on auth.users;
create trigger prolink_enforce_auth_home_country
  before update of raw_user_meta_data on auth.users
  for each row execute function public.prolink_enforce_auth_home_country();

create or replace function public.prolink_enforce_profile_home_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare locked record;
begin
  select home_country_code,home_country_iso3,home_country_name
    into locked
    from public.prolink_account_settings
    where user_id = new.user_id;
  if found then
    new.country_code := locked.home_country_code;
    new.country_iso3 := locked.home_country_iso3;
    new.country_name := locked.home_country_name;
  end if;
  return new;
end;
$$;

drop trigger if exists prolink_enforce_profile_home_country on public.prolink_professional_profiles;
create trigger prolink_enforce_profile_home_country
  before insert or update of user_id,country_code,country_iso3,country_name
  on public.prolink_professional_profiles
  for each row execute function public.prolink_enforce_profile_home_country();

create or replace function public.prolink_enforce_review_home_country()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare locked record;
begin
  select home_country_code,home_country_iso3,home_country_name
    into locked
    from public.prolink_account_settings
    where user_id = new.user_id;
  if found and jsonb_typeof(coalesce(new.submitted_data,'{}'::jsonb)) = 'object' then
    new.submitted_data := jsonb_set(
      jsonb_set(
        jsonb_set(coalesce(new.submitted_data,'{}'::jsonb),'{country_code}',to_jsonb(locked.home_country_code),true),
        '{country_iso3}',to_jsonb(locked.home_country_iso3),true),
      '{country_name}',to_jsonb(locked.home_country_name),true);
  end if;
  return new;
end;
$$;

drop trigger if exists prolink_enforce_review_home_country on public.prolink_review_records;
create trigger prolink_enforce_review_home_country
  before insert or update of user_id,submitted_data
  on public.prolink_review_records
  for each row execute function public.prolink_enforce_review_home_country();

-- Set a sensible country-language default for older accounts whose language was never saved.
update public.prolink_account_settings
set preferred_language = case home_country_code
  when 'ES' then 'es' when 'PL' then 'pl' when 'PT' then 'pt'
  when 'FR' then 'fr' when 'DE' then 'de' when 'IT' then 'it'
  when 'NL' then 'nl' when 'BE' then 'nl' when 'AT' then 'de'
  when 'BG' then 'bg' when 'HR' then 'hr' when 'CY' then 'el'
  when 'CZ' then 'cs' when 'DK' then 'da' when 'EE' then 'et'
  when 'FI' then 'fi' when 'GR' then 'el' when 'HU' then 'hu'
  when 'LV' then 'lv' when 'LT' then 'lt' when 'LU' then 'fr'
  when 'MT' then 'mt' when 'RO' then 'ro' when 'SK' then 'sk'
  when 'SI' then 'sl' when 'SE' then 'sv' when 'BD' then 'bn'
  when 'IN' then 'hi' when 'PK' then 'ur' when 'TZ' then 'sw'
  when 'RW' then 'rw' when 'WS' then 'sm' else preferred_language end
where preferred_language = 'en';
