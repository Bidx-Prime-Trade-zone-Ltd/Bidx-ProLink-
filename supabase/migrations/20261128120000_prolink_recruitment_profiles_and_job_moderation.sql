-- ProLink recruitment marketplace: employer profiles, job-seeker profiles and moderated vacancies.
create table if not exists public.prolink_employer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  registration_number text,
  industry text,
  website text,
  description text,
  contact_email text,
  phone text,
  country_name text,
  region text,
  city text,
  address text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create index if not exists prolink_employer_profiles_status_idx on public.prolink_employer_profiles(status, submitted_at desc);

create table if not exists public.prolink_job_seeker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  headline text,
  skills text[] not null default '{}',
  experience text,
  bio text,
  country_name text,
  region text,
  city text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  seeking_status text not null default 'active' check (seeking_status in ('active','closed')),
  review_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists prolink_job_seeker_profiles_review_idx on public.prolink_job_seeker_profiles(status, submitted_at desc);
create index if not exists prolink_job_seeker_profiles_active_idx on public.prolink_job_seeker_profiles(seeking_status, status);

create table if not exists public.prolink_jobs (
  id uuid primary key default gen_random_uuid(),
  employer_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  requirements text,
  location text,
  country_name text,
  employment_type text not null default 'full_time',
  workplace_type text not null default 'onsite',
  salary_min numeric(14,2),
  salary_max numeric(14,2),
  currency text,
  status text not null default 'pending' check (status in ('pending','live','rejected','closed')),
  review_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  published_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint prolink_jobs_salary_range check (salary_min is null or salary_max is null or salary_max >= salary_min)
);
create index if not exists prolink_jobs_status_idx on public.prolink_jobs(status, submitted_at desc);
create index if not exists prolink_jobs_employer_idx on public.prolink_jobs(employer_user_id, submitted_at desc);

alter table public.prolink_employer_profiles enable row level security;
alter table public.prolink_job_seeker_profiles enable row level security;
alter table public.prolink_jobs enable row level security;
revoke all on public.prolink_employer_profiles, public.prolink_job_seeker_profiles, public.prolink_jobs from anon, authenticated;
grant select, insert, update, delete on public.prolink_employer_profiles, public.prolink_job_seeker_profiles, public.prolink_jobs to service_role;
