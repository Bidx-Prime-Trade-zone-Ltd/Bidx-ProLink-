-- Adds the existing Prolink single-admin review foundation to this project.
create table if not exists public.prolink_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (lower(email)=lower('Ojepaamedu@gmail.com')),
  created_at timestamptz not null default now(),
  constraint prolink_single_admin_email unique (email)
);
alter table public.prolink_admins enable row level security;
revoke all on public.prolink_admins from anon, authenticated;
grant select on public.prolink_admins to authenticated;

create or replace function public.prolink_is_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from public.prolink_admins a
    join auth.users u on u.id=a.user_id
    where a.user_id=auth.uid()
      and lower(u.email)=lower('Ojepaamedu@gmail.com')
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.prolink_is_admin() from public;
grant execute on function public.prolink_is_admin() to authenticated;

create or replace function public.prolink_assign_single_admin()
returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  if lower(coalesce(new.email,''))=lower('Ojepaamedu@gmail.com') and new.email_confirmed_at is not null then
    insert into public.prolink_admins(user_id,email) values(new.id,new.email)
    on conflict(user_id) do update set email=excluded.email;
  elsif tg_op='UPDATE' and lower(coalesce(old.email,''))=lower('Ojepaamedu@gmail.com')
    and lower(coalesce(new.email,''))<>lower('Ojepaamedu@gmail.com') then
    delete from public.prolink_admins where user_id=new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.prolink_assign_single_admin() from public,anon,authenticated;
drop trigger if exists prolink_single_admin_auth_user on auth.users;
create trigger prolink_single_admin_auth_user after insert or update of email,email_confirmed_at on auth.users
for each row execute function public.prolink_assign_single_admin();

insert into public.prolink_admins(user_id,email)
select id,email from auth.users where lower(email)=lower('Ojepaamedu@gmail.com') and email_confirmed_at is not null
on conflict(user_id) do update set email=excluded.email;

create table if not exists public.prolink_admin_audit (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  target_user_id uuid references auth.users(id),
  section text,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.prolink_admin_audit enable row level security;

create table if not exists public.prolink_admin_messages (
  id bigint generated always as identity primary key,
  sender_user_id uuid not null references auth.users(id),
  recipient_user_id uuid references auth.users(id),
  subject text not null,
  body text not null,
  broadcast boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.prolink_admin_messages enable row level security;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='prolink_admin_audit' and policyname='single admin reads audit') then
    create policy "single admin reads audit" on public.prolink_admin_audit for select to authenticated using(public.prolink_is_admin());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='prolink_admin_audit' and policyname='single admin records audit') then
    create policy "single admin records audit" on public.prolink_admin_audit for insert to authenticated with check(public.prolink_is_admin() and admin_user_id=auth.uid());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='prolink_admin_messages' and policyname='users read own admin messages') then
    create policy "users read own admin messages" on public.prolink_admin_messages for select to authenticated using(recipient_user_id=auth.uid() or (broadcast and recipient_user_id is null));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='prolink_admin_messages' and policyname='admin reads all messages') then
    create policy "admin reads all messages" on public.prolink_admin_messages for select to authenticated using(public.prolink_is_admin());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='prolink_admin_messages' and policyname='admin sends messages') then
    create policy "admin sends messages" on public.prolink_admin_messages for insert to authenticated with check(public.prolink_is_admin() and sender_user_id=auth.uid());
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='prolink_admin_messages' and policyname='users mark own messages read') then
    create policy "users mark own messages read" on public.prolink_admin_messages for update to authenticated using(recipient_user_id=auth.uid() or (broadcast and recipient_user_id is null)) with check(recipient_user_id=auth.uid() or (broadcast and recipient_user_id is null));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='prolink_review_records' and policyname='single admin reads review records') then
    create policy "single admin reads review records" on public.prolink_review_records for select to authenticated using(public.prolink_is_admin());
  end if;
end $$;

create or replace function public.prolink_admin_review(p_record_id bigint,p_action text,p_reason text default null)
returns void language plpgsql security definer
set search_path = '' as $$
declare r public.prolink_review_records;
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
      'Your '||replace(r.section,'_',' ')||' submission needs correction. Admin reason: '||trim(p_reason)||'. Please update the rejected section and resubmit.');
  end if;
end;
$$;
revoke all on function public.prolink_admin_review(bigint,text,text) from public;
grant execute on function public.prolink_admin_review(bigint,text,text) to authenticated;

grant select,insert on public.prolink_review_records to authenticated;
grant select,insert on public.prolink_admin_messages to authenticated;
grant select,insert on public.prolink_admin_audit to authenticated;
revoke update,delete on public.prolink_review_records from authenticated;
revoke update,delete on public.prolink_admin_audit from authenticated;
revoke update,delete on public.prolink_admin_messages from authenticated;
