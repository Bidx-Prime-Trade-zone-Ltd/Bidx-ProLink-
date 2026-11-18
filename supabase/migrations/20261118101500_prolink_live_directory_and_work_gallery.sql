create table if not exists public.prolink_professional_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  professional_name text not null,
  category text,
  subcategory text,
  experience text,
  skills text[] not null default '{}',
  about text,
  country_code text,
  country_iso3 text,
  country_name text,
  region text,
  district text,
  city text,
  local_area text,
  business_phone text,
  whatsapp text,
  is_published boolean not null default false,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists prolink_professionals_public_idx on public.prolink_professional_profiles(is_published,country_code,category,city);
alter table public.prolink_professional_profiles enable row level security;
create policy "Public can view approved Prolink professionals" on public.prolink_professional_profiles for select to anon,authenticated using(is_published=true);
grant select on public.prolink_professional_profiles to anon,authenticated;

create table if not exists public.prolink_work_gallery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  object_path text not null unique,
  caption text not null default '',
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists prolink_work_gallery_user_idx on public.prolink_work_gallery(user_id,created_at desc);
alter table public.prolink_work_gallery enable row level security;
create policy "Public can view published professional work" on public.prolink_work_gallery for select to anon,authenticated using(is_public=true and exists(select 1 from public.prolink_professional_profiles p where p.user_id=prolink_work_gallery.user_id and p.is_published=true));
create policy "Professionals read own work gallery" on public.prolink_work_gallery for select to authenticated using(user_id=auth.uid());
create policy "Professionals add own work gallery items" on public.prolink_work_gallery for insert to authenticated with check(user_id=auth.uid());
create policy "Professionals update own work gallery items" on public.prolink_work_gallery for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "Professionals delete own work gallery items" on public.prolink_work_gallery for delete to authenticated using(user_id=auth.uid());
grant select,insert,update,delete on public.prolink_work_gallery to authenticated;
grant select on public.prolink_work_gallery to anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('prolink-work-gallery','prolink-work-gallery',true,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=8388608,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "Professionals upload own portfolio images" on storage.objects for insert to authenticated with check(bucket_id='prolink-work-gallery' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Public reads Prolink portfolio images" on storage.objects for select to anon,authenticated using(bucket_id='prolink-work-gallery');
create policy "Professionals delete own portfolio images" on storage.objects for delete to authenticated using(bucket_id='prolink-work-gallery' and (storage.foldername(name))[1]=(select auth.uid())::text);
