-- Bring existing public professional rows into alignment with their immutable account country.
update public.prolink_professional_profiles p
set country_code = s.home_country_code,
    country_iso3 = s.home_country_iso3,
    country_name = s.home_country_name,
    updated_at = now()
from public.prolink_account_settings s
where s.user_id = p.user_id
  and (p.country_code is distinct from s.home_country_code
    or p.country_iso3 is distinct from s.home_country_iso3
    or p.country_name is distinct from s.home_country_name);
