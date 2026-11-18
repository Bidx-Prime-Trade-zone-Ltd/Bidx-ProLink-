create or replace function public.prolink_admin_review(p_record_id bigint,p_action text,p_reason text default null)
returns void language plpgsql security definer
set search_path = '' as $$
declare
  r public.prolink_review_records;
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

  update public.prolink_review_records
    set status=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'removed' end,
        rejection_reason=case when p_action='reject' then trim(p_reason) else null end,
        reviewed_at=now(),reviewed_by=auth.uid(),
        removed_at=case when p_action='remove' then now() else null end
    where id=p_record_id;

  insert into public.prolink_admin_audit(admin_user_id,action,target_user_id,section,reason,details)
  values(auth.uid(),p_action,r.user_id,r.section,nullif(trim(coalesce(p_reason,'')),''),jsonb_build_object('record_id',p_record_id));

  if p_action='reject' then
    insert into public.prolink_admin_messages(sender_user_id,recipient_user_id,subject,body)
    values(auth.uid(),r.user_id,'Action required: please update your submission',
      'Your '||replace(r.section,'_',' ')||' submission needs correction. Admin reason: '||trim(p_reason)||'. Please update your submission and contact Prolink support if you need assistance.');
  end if;

  select status into personal_status from public.prolink_review_records
    where user_id=r.user_id and section='legal_identity' order by submitted_at desc limit 1;
  select status into profile_status from public.prolink_review_records
    where user_id=r.user_id and section='professional_profile' order by submitted_at desc limit 1;
  select status into working_id_status from public.prolink_review_records
    where user_id=r.user_id and section='supporting_document'
      and submitted_data->>'document_type'='working_id' order by submitted_at desc limit 1;
  select status into certificate_status from public.prolink_review_records
    where user_id=r.user_id and section='supporting_document'
      and submitted_data->>'document_type'='competency_certificate' order by submitted_at desc limit 1;

  all_approved := coalesce(personal_status='approved',false)
    and coalesce(working_id_status='approved',false)
    and coalesce(certificate_status='approved',false)
    and coalesce(profile_status='approved',false);

  update auth.users
  set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb) || jsonb_build_object(
    'personal_details_review_status',coalesce(personal_status,'pending'),
    'working_id_review_status',coalesce(working_id_status,'pending'),
    'skills_certificate_review_status',coalesce(certificate_status,'pending'),
    'professional_profile_review_status',coalesce(profile_status,'pending'),
    'professional_onboarding_status',case when all_approved then 'approved' else 'pending_manual_review' end,
    'manual_verification_status',case when all_approved then 'verified' else 'pending_review' end
  )
  where id=r.user_id;
end;
$$;
revoke all on function public.prolink_admin_review(bigint,text,text) from public;
grant execute on function public.prolink_admin_review(bigint,text,text) to authenticated;