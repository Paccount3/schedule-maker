-- Schedule Maker Pro schema
-- Paste this into Supabase: SQL Editor → New query → Run
--
-- IDs are text so existing localStorage UUIDs and region slugs (north-region) import cleanly.
-- Coach/participant schedules are NOT tables. They are generated from shifts.

create table if not exists public.regions (
  id text primary key,
  name text not null
);

create table if not exists public.participants (
  id text primary key,
  region_id text not null references public.regions (id) on delete restrict,
  name text not null default '',
  phone text not null default '',
  site text not null default '',
  site_contact text not null default '',
  best_address_for_checks text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.authorizations (
  id text primary key,
  participant_id text not null references public.participants (id) on delete cascade,
  service text not null,
  auth_number text not null default '00000000000',
  auth_start date not null,
  auth_end date not null,
  working_hours numeric not null default 0,
  coaching_hours numeric not null default 0,
  status text not null default 'active',
  closed_reason text,
  closed_at date,
  constraint authorizations_service_check check (
    service in (
      'WA',
      'CPO',
      'TWE',
      'JC',
      'LVL UP',
      'Interview Prep',
      'Job Exploration',
      'Orientation',
      'Other Module',
      'Other Service'
    )
  ),
  constraint authorizations_status_check check (status in ('active', 'closed_early'))
);

create table if not exists public.coaches (
  id text primary key,
  region_id text not null references public.regions (id) on delete restrict,
  name text not null default '',
  starting_location text not null default '',
  phone text not null default '',
  notes text not null default '',
  color text not null default '#3b82f6',
  inactive_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_availability (
  id text primary key default gen_random_uuid()::text,
  coach_id text not null references public.coaches (id) on delete cascade,
  day_of_week text not null,
  start_minutes integer not null,
  end_minutes integer not null,
  constraint coach_availability_day_check check (
    day_of_week in (
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday'
    )
  ),
  constraint coach_availability_unique unique (coach_id, day_of_week)
);

create table if not exists public.other_coaching_activities (
  id text primary key,
  region_id text not null references public.regions (id) on delete restrict,
  coach_id text references public.coaches (id) on delete set null,
  name text not null,
  notes text not null default '',
  hours_per_week numeric not null default 2,
  shifts_per_week integer not null default 1,
  week_of date,
  constraint other_coaching_name_check check (
    name in (
      'Office Time',
      'Report Writing',
      'Training',
      'Shadowing',
      'Vacation',
      'Sick Time',
      'Other'
    )
  )
);

create table if not exists public.shifts (
  id text primary key,
  date date not null,
  start_minutes integer not null,
  end_minutes integer not null,
  type text not null,
  participant_id text references public.participants (id) on delete cascade,
  authorization_id text references public.authorizations (id) on delete set null,
  coach_id text references public.coaches (id) on delete set null,
  other_coaching_activity_id text references public.other_coaching_activities (id) on delete cascade,
  notes text,
  constraint shifts_type_check check (type in ('solo', 'coached', 'other-coaching')),
  constraint shifts_time_check check (end_minutes > start_minutes)
);

create table if not exists public.on_call_phones (
  region_id text not null references public.regions (id) on delete cascade,
  week_start date not null,
  phone text not null,
  primary key (region_id, week_start)
);

create index if not exists participants_region_id_idx on public.participants (region_id);
create index if not exists authorizations_participant_id_idx on public.authorizations (participant_id);
create index if not exists coaches_region_id_idx on public.coaches (region_id);
create index if not exists shifts_date_idx on public.shifts (date);
create index if not exists shifts_participant_id_idx on public.shifts (participant_id);
create index if not exists shifts_coach_id_idx on public.shifts (coach_id);

insert into public.regions (id, name)
values
  ('north-region', 'North Region'),
  ('west-region', 'West Region')
on conflict (id) do nothing;

-- Temporary: the Vite app uses the public publishable key and has no login yet.
-- Tighten these policies when you add Supabase Auth.
alter table public.regions enable row level security;
alter table public.participants enable row level security;
alter table public.authorizations enable row level security;
alter table public.coaches enable row level security;
alter table public.coach_availability enable row level security;
alter table public.other_coaching_activities enable row level security;
alter table public.shifts enable row level security;
alter table public.on_call_phones enable row level security;

drop policy if exists regions_all on public.regions;
drop policy if exists participants_all on public.participants;
drop policy if exists authorizations_all on public.authorizations;
drop policy if exists coaches_all on public.coaches;
drop policy if exists coach_availability_all on public.coach_availability;
drop policy if exists other_coaching_activities_all on public.other_coaching_activities;
drop policy if exists shifts_all on public.shifts;
drop policy if exists on_call_phones_all on public.on_call_phones;

create policy regions_all on public.regions for all to anon, authenticated using (true) with check (true);
create policy participants_all on public.participants for all to anon, authenticated using (true) with check (true);
create policy authorizations_all on public.authorizations for all to anon, authenticated using (true) with check (true);
create policy coaches_all on public.coaches for all to anon, authenticated using (true) with check (true);
create policy coach_availability_all on public.coach_availability for all to anon, authenticated using (true) with check (true);
create policy other_coaching_activities_all on public.other_coaching_activities for all to anon, authenticated using (true) with check (true);
create policy shifts_all on public.shifts for all to anon, authenticated using (true) with check (true);
create policy on_call_phones_all on public.on_call_phones for all to anon, authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.regions,
  public.participants,
  public.authorizations,
  public.coaches,
  public.coach_availability,
  public.other_coaching_activities,
  public.shifts,
  public.on_call_phones
to anon, authenticated;
