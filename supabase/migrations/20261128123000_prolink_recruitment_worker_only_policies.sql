-- Keep recruitment records Worker-only and make the deny-by-default intent explicit.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prolink_employer_profiles' and policyname='Recruitment records are Worker only') then
    create policy "Recruitment records are Worker only" on public.prolink_employer_profiles for all to anon, authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prolink_job_seeker_profiles' and policyname='Recruitment records are Worker only') then
    create policy "Recruitment records are Worker only" on public.prolink_job_seeker_profiles for all to anon, authenticated using (false) with check (false);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prolink_jobs' and policyname='Recruitment records are Worker only') then
    create policy "Recruitment records are Worker only" on public.prolink_jobs for all to anon, authenticated using (false) with check (false);
  end if;
end $$;
create index if not exists prolink_employer_profiles_reviewed_by_idx on public.prolink_employer_profiles(reviewed_by);
create index if not exists prolink_job_seeker_profiles_reviewed_by_idx on public.prolink_job_seeker_profiles(reviewed_by);
create index if not exists prolink_jobs_reviewed_by_idx on public.prolink_jobs(reviewed_by);
