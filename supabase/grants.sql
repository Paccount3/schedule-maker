-- Fix: the app key uses the `anon` role, which cannot read tables until granted.
-- Paste into Supabase SQL Editor and Run.

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
