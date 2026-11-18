alter table public.prolink_professional_profiles drop column if exists email;
update storage.buckets set public=false where id='prolink-work-gallery';
drop policy if exists "Public reads Prolink portfolio images" on storage.objects;
create policy "Approved customers read published Prolink portfolio images"
on storage.objects for select to authenticated
using(bucket_id='prolink-work-gallery' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or exists(select 1 from public.prolink_work_gallery g join public.prolink_professional_profiles p on p.user_id=g.user_id where g.object_path=storage.objects.name and g.is_public=true and p.is_published=true)
));

create or replace function public.prolink_admin_review(p_record_id bigint,p_action text,p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.prolink_review_records;
  u auth.users;
  m jsonb;
  personal_status text;
  working_id_status text;
  certificate_status text;
  profile_status text;
  all_approved boolean;
begin
  if not public.prolink_is_admin() then raise exception 'Not authorised'; end if;
  if p_action not in ('approve','reject','remove') then raise exception 'Invalid action'; end if;
  if p_action='reject' and length(trim(coalesce(p_reason,'')))<3 then raise exception 'A rejection reason is required'; end if;
  select * into r from public.prolink_review_records where id=p_record_id for update;
  if not found then raise exception 'Submission not found'; end if;
  update public.prolink_review_records set status=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'removed' end,
    rejection_reason=case when p_action='reject' then trim(p_reason) else null end,
    reviewed_at=now(),reviewed_by=auth.uid(),removed_at=case when p_action='remove' then now() else null end
    where id=p_record_id;
  insert into public.prolink_admin_audit(admin_user_id,action,target_user_id,section,reason,details)
    values(auth.uid(),p_action,r.user_id,r.section,nullif(trim(coalesce(p_reason,'')),''),jsonb_build_object('record_id',p_record_id));
  if p_action='reject' then
    insert into public.prolink_admin_messages(sender_user_id,recipient_user_id,subject,body)
    values(auth.uid(),r.user_id,'Action required: please update your submission',
      'Your '||replace(r.section,'_',' ')||' submission needs correction. Admin reason: '||trim(p_reason)||'. Please update your submission and contact Prolink support if you need assistance.');
  end if;
  select status into personal_status from public.prolink_review_records where user_id=r.user_id and section='legal_identity' order by submitted_at desc limit 1;
  select status into profile_status from public.prolink_review_records where user_id=r.user_id and section='professional_profile' order by submitted_at desc limit 1;
  select status into working_id_status from public.prolink_review_records where user_id=r.user_id and section='supporting_document' and submitted_data->>'document_type'='working_id' order by submitted_at desc limit 1;
  select status into certificate_status from public.prolink_review_records where user_id=r.user_id and section='supporting_document' and submitted_data->>'document_type'='competency_certificate' order by submitted_at desc limit 1;
  all_approved:=coalesce(personal_status='approved',false) and coalesce(working_id_status='approved',false) and coalesce(certificate_status='approved',false) and coalesce(profile_status='approved',false);
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object(
    'personal_details_review_status',coalesce(personal_status,'pending'),
    'working_id_review_status',coalesce(working_id_status,'pending'),
    'skills_certificate_review_status',coalesce(certificate_status,'pending'),
    'professional_profile_review_status',coalesce(profile_status,'pending'),
    'professional_onboarding_status',case when all_approved then 'approved' else 'pending_manual_review' end,
    'manual_verification_status',case when all_approved then 'verified' else 'pending_review' end)
    where id=r.user_id returning * into u;
  m:=coalesce(u.raw_user_meta_data,'{}'::jsonb);
  if all_approved then
    insert into public.prolink_professional_profiles(user_id,full_name,professional_name,category,subcategory,experience,skills,about,country_code,country_iso3,country_name,region,district,city,local_area,business_phone,whatsapp,is_published,approved_at,updated_at)
    values(u.id,coalesce(m->>'full_name',u.email),coalesce(m->>'professional_name',m->>'business_name',m->>'full_name',u.email),
      m->>'category',m->>'subcategory',m->>'experience',
      case when nullif(trim(m->>'skills'),'') is null then '{}'::text[] else regexp_split_to_array(m->>'skills','[,;\n]+') end,
      m->>'about',m->>'country_code',m->>'country_iso3',m->>'country_name',m->>'region',m->>'district',m->>'city',m->>'local_area',
      coalesce(m->>'business_phone',m->>'phone'),m->>'whatsapp',true,now(),now())
    on conflict(user_id) do update set full_name=excluded.full_name,professional_name=excluded.professional_name,
      category=excluded.category,subcategory=excluded.subcategory,experience=excluded.experience,skills=excluded.skills,about=excluded.about,
      country_code=excluded.country_code,country_iso3=excluded.country_iso3,country_name=excluded.country_name,
      region=excluded.region,district=excluded.district,city=excluded.city,local_area=excluded.local_area,
      business_phone=excluded.business_phone,whatsapp=excluded.whatsapp,is_published=true,
      approved_at=coalesce(public.prolink_professional_profiles.approved_at,now()),updated_at=now();
  else
    update public.prolink_professional_profiles set is_published=false,updated_at=now() where user_id=r.user_id;
  end if;
end;
$$;
revoke all on function public.prolink_admin_review(bigint,text,text) from public;
grant execute on function public.prolink_admin_review(bigint,text,text) to authenticated;
