-- Private bucket for manually submitted Prolink work IDs and skills certificates.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values('prolink-verification-documents','prolink-verification-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Prolink users upload their own verification documents') then
    create policy "Prolink users upload their own verification documents"
    on storage.objects for insert to authenticated
    with check(bucket_id='prolink-verification-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
  end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Prolink users and Admin read verification documents') then
    create policy "Prolink users and Admin read verification documents"
    on storage.objects for select to authenticated
    using(bucket_id='prolink-verification-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.prolink_is_admin()));
  end if;
end $$;