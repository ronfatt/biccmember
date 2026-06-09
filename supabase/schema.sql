create extension if not exists pgcrypto;

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
  stage_name text,
  role public.user_role not null default 'hub_member',
  city text,
  country text,
  specialty text,
  skills text[] not null default '{}',
  bio text,
  social_links jsonb not null default '{}'::jsonb,
  visibility text not null default 'delegates_only',
  delegate_id text unique,
  delegate_approved_at timestamptz,
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
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.workshop_registrations (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attended boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (workshop_id, profile_id)
);

create or replace view public.workshops_with_counts as
select
  w.*,
  count(wr.id)::integer as registered
from public.workshops w
left join public.workshop_registrations wr on wr.workshop_id = w.id
group by w.id;

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  scanned_by uuid references public.profiles(id),
  source text not null default 'front_desk',
  created_at timestamptz not null default now()
);

create table public.welcome_kit_claims (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade unique,
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz not null default now()
);

create table public.photo_posts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null,
  country text,
  image_path text not null,
  image_url text not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden')),
  created_at timestamptz not null default now()
);

create table public.photo_reactions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photo_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, profile_id)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null check (audience in ('members', 'delegates', 'all')),
  is_urgent boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workshop_id uuid references public.workshops(id) on delete set null,
  title text not null,
  status text not null default 'Pending' check (status in ('Ready', 'Pending')),
  issued_by uuid references public.profiles(id),
  issued_at timestamptz,
  verification_code text unique default encode(gen_random_bytes(8), 'hex'),
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

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'stage_name',
    split_part(new.email, '@', 1),
    'BICC Member'
  );

  insert into public.profiles (id, full_name, stage_name, role)
  values (
    new.id,
    display_name,
    coalesce(new.raw_user_meta_data->>'stage_name', display_name),
    'hub_member'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_member_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.delegate_id := old.delegate_id;
    new.delegate_approved_at := old.delegate_approved_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists prevent_member_role_escalation on public.profiles;
create trigger prevent_member_role_escalation
before update on public.profiles
for each row execute function public.prevent_member_role_escalation();

create or replace function public.register_workshop(p_workshop_id uuid)
returns public.workshop_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles;
  selected_workshop public.workshops;
  registered_count integer;
  registration public.workshop_registrations;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into current_profile
  from public.profiles
  where id = auth.uid();

  if current_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if current_profile.role not in ('delegate', 'verified_performer', 'mentor', 'admin') then
    raise exception 'Delegate access required';
  end if;

  select * into selected_workshop
  from public.workshops
  where id = p_workshop_id
  for update;

  if selected_workshop.id is null then
    raise exception 'Workshop not found';
  end if;

  select count(*)::integer into registered_count
  from public.workshop_registrations
  where workshop_id = p_workshop_id;

  if registered_count >= selected_workshop.capacity then
    raise exception 'Workshop is full';
  end if;

  insert into public.workshop_registrations (workshop_id, profile_id)
  values (p_workshop_id, auth.uid())
  on conflict (workshop_id, profile_id) do update
    set created_at = public.workshop_registrations.created_at
  returning * into registration;

  return registration;
end;
$$;

alter table public.profiles enable row level security;
alter table public.workshops enable row level security;
alter table public.workshop_registrations enable row level security;
alter table public.check_ins enable row level security;
alter table public.welcome_kit_claims enable row level security;
alter table public.photo_posts enable row level security;
alter table public.photo_reactions enable row level security;
alter table public.announcements enable row level security;
alter table public.certificates enable row level security;
alter table public.performance_submissions enable row level security;

create policy "profiles visible to signed in users" on public.profiles for select to authenticated using (true);
create policy "members insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "members update own profile or admins update all" on public.profiles for update to authenticated using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

create policy "workshops visible to signed in users" on public.workshops for select to authenticated using (true);
create policy "admins manage workshops" on public.workshops for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "members manage own workshop registrations" on public.workshop_registrations for all to authenticated using (auth.uid() = profile_id or public.is_admin()) with check (auth.uid() = profile_id or public.is_admin());

create policy "admins manage check ins" on public.check_ins for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "members read own check ins" on public.check_ins for select to authenticated using (auth.uid() = profile_id);

create policy "admins manage welcome kits" on public.welcome_kit_claims for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "members read own kit claim" on public.welcome_kit_claims for select to authenticated using (auth.uid() = profile_id);

create policy "published photos visible" on public.photo_posts for select to authenticated using (status = 'published' or auth.uid() = profile_id or public.is_admin());
create policy "members insert own photos" on public.photo_posts for insert to authenticated with check (auth.uid() = profile_id);
create policy "members update own photos or admins moderate" on public.photo_posts for update to authenticated using (auth.uid() = profile_id or public.is_admin()) with check (auth.uid() = profile_id or public.is_admin());

create policy "photo reactions visible" on public.photo_reactions for select to authenticated using (true);
create policy "members react as self" on public.photo_reactions for insert to authenticated with check (auth.uid() = profile_id);
create policy "members remove own reaction" on public.photo_reactions for delete to authenticated using (auth.uid() = profile_id);

create policy "announcements visible to signed in users" on public.announcements for select to authenticated using (true);
create policy "admins send announcements" on public.announcements for insert to authenticated with check (public.is_admin());

create policy "members read own certificates or admins read all" on public.certificates for select to authenticated using (auth.uid() = profile_id or public.is_admin());
create policy "admins issue certificates" on public.certificates for insert to authenticated with check (public.is_admin());
create policy "admins update certificates" on public.certificates for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "delegates submit own performances" on public.performance_submissions for insert to authenticated with check (auth.uid() = profile_id);
create policy "members read own performance submissions or admins read all" on public.performance_submissions for select to authenticated using (auth.uid() = profile_id or public.is_admin());
create policy "admins update performance submissions" on public.performance_submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('photo-wall', 'photo-wall', true)
on conflict (id) do nothing;

create policy "members upload photo wall objects" on storage.objects for insert to authenticated with check (bucket_id = 'photo-wall' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photo wall objects are public" on storage.objects for select to public using (bucket_id = 'photo-wall');
create policy "members update own photo wall objects" on storage.objects for update to authenticated using (bucket_id = 'photo-wall' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "admins delete photo wall objects" on storage.objects for delete to authenticated using (bucket_id = 'photo-wall' and public.is_admin());
