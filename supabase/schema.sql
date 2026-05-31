create type public.user_role as enum (
  'guest',
  'hub_member',
  'delegate',
  'verified_performer',
  'mentor',
  'admin'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null default 'hub_member',
  city text,
  country text,
  specialty text,
  bio text,
  delegate_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mentor_id uuid references public.profiles(id),
  track text not null,
  starts_at timestamptz not null,
  room text not null,
  capacity integer not null check (capacity > 0),
  preview text not null,
  created_at timestamptz not null default now()
);

create table public.workshop_registrations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attended boolean not null default false,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workshop_id, profile_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null check (audience in ('members', 'delegates', 'all')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'Pending' check (status in ('Ready', 'Pending')),
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.performance_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  status text not null default 'submitted',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.workshops enable row level security;
alter table public.workshop_registrations enable row level security;
alter table public.announcements enable row level security;
alter table public.certificates enable row level security;
alter table public.performance_submissions enable row level security;

create policy "profiles are visible to signed in users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "members update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "workshops visible to signed in users"
  on public.workshops for select
  to authenticated
  using (true);

create policy "delegates manage own workshop registrations"
  on public.workshop_registrations for all
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "announcements visible to signed in users"
  on public.announcements for select
  to authenticated
  using (true);

create policy "members read own certificates"
  on public.certificates for select
  to authenticated
  using (auth.uid() = profile_id);

create policy "delegates submit own performances"
  on public.performance_submissions for insert
  to authenticated
  with check (auth.uid() = profile_id);
