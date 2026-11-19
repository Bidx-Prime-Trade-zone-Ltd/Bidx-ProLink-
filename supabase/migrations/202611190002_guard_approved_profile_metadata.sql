create or replace function public.prolink_guard_approved_profile_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  approved_on timestamptz;
  protected_keys text[] := array[
    'title','full_name','date_of_birth','phone','whatsapp','country_code','country_iso3',
    'country_name','region','district','city','local_area','professional_name','category',
    'subcategory','experience','skills','about','business_phone','business_email','website',
    'business_address'
  ];
  key_name text;
begin
  if old.raw_user_meta_data is not distinct from new.raw_user_meta_data then
    return new;
  end if;

  select approved_at into approved_on
  from public.prolink_professional_profiles
  where user_id = new.id
  limit 1;

  if approved_on is null then
    return new;
  end if;

  if coalesce(auth.jwt()->>'role','') = 'service_role' then
    return new;
  end if;

  foreach key_name in array protected_keys loop
    if (old.raw_user_meta_data->key_name) is distinct from (new.raw_user_meta_data->key_name) then
      raise exception 'Approved professional information can only be changed through an Admin-approved profile change request.';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists prolink_guard_approved_profile_metadata on auth.users;
create trigger prolink_guard_approved_profile_metadata
before update of raw_user_meta_data on auth.users
for each row execute function public.prolink_guard_approved_profile_metadata();

revoke all on function public.prolink_guard_approved_profile_metadata() from public, anon, authenticated;
