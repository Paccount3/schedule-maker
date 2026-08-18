import type {
  AppState,
  Authorization,
  Coach,
  DayOfWeek,
  OtherCoachingActivity,
  Participant,
  ParticipantService,
  Region,
  Shift,
  ShiftType,
  TimeRange,
} from '../types'
import { DAYS } from '../types'
import { startOfWeek, toDateInput } from './time'
import { supabase } from './supabase'

const UI_PREFS_KEY = 'schedule-maker-ui-prefs'

interface UiPrefs {
  selectedRegionId?: string
  weekStart?: string
}

export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as UiPrefs
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveUiPrefs(prefs: UiPrefs): void {
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs))
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asDateString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, 10)
}

type RegionRow = { id: string; name: string }

type ParticipantRow = {
  id: string
  region_id: string
  name: string
  phone: string
  site: string
  site_contact: string
  best_address_for_checks: string
  notes: string
}

type AuthorizationRow = {
  id: string
  participant_id: string
  service: string
  auth_number: string
  auth_start: string
  auth_end: string
  working_hours: number | string
  coaching_hours: number | string
  status: string
  closed_reason: string | null
  closed_at: string | null
}

type CoachRow = {
  id: string
  region_id: string
  name: string
  starting_location: string
  phone: string
  notes: string
  color: string
}

type AvailabilityRow = {
  id?: string
  coach_id: string
  day_of_week: string
  start_minutes: number
  end_minutes: number
}

type OtherCoachingRow = {
  id: string
  region_id: string
  coach_id: string | null
  name: string
  notes: string
  hours_per_week: number | string
  shifts_per_week: number
}

type ShiftRow = {
  id: string
  date: string
  start_minutes: number
  end_minutes: number
  type: string
  participant_id: string | null
  authorization_id: string | null
  coach_id: string | null
  other_coaching_activity_id: string | null
  notes: string | null
}

function participantToRow(p: Participant): ParticipantRow {
  return {
    id: p.id,
    region_id: p.regionId,
    name: p.name,
    phone: p.phone,
    site: p.site,
    site_contact: p.siteContact,
    best_address_for_checks: p.bestAddressForChecks,
    notes: p.notes,
  }
}

function authorizationToRow(participantId: string, auth: Authorization): AuthorizationRow {
  return {
    id: auth.id,
    participant_id: participantId,
    service: auth.service,
    auth_number: auth.authNumber,
    auth_start: auth.authStart,
    auth_end: auth.authEnd,
    working_hours: auth.workingHours,
    coaching_hours: auth.coachingHours,
    status: auth.status,
    closed_reason: auth.closedReason ?? null,
    closed_at: auth.closedAt ?? null,
  }
}

function authorizationFromRow(row: AuthorizationRow): Authorization {
  return {
    id: row.id,
    service: row.service as ParticipantService,
    authNumber: row.auth_number,
    authStart: asDateString(row.auth_start),
    authEnd: asDateString(row.auth_end),
    workingHours: asNumber(row.working_hours),
    coachingHours: asNumber(row.coaching_hours),
    status: row.status === 'closed_early' ? 'closed_early' : 'active',
    closedReason: row.closed_reason ?? undefined,
    closedAt: row.closed_at ? asDateString(row.closed_at) : undefined,
  }
}

function coachToRow(c: Coach): CoachRow {
  return {
    id: c.id,
    region_id: c.regionId,
    name: c.name,
    starting_location: c.startingLocation,
    phone: c.phone,
    notes: c.notes,
    color: c.color,
  }
}

function availabilityRows(coach: Coach): AvailabilityRow[] {
  return DAYS.flatMap((day) => {
    const range = coach.availability[day]
    if (!range) return []
    return [
      {
        id: crypto.randomUUID(),
        coach_id: coach.id,
        day_of_week: day,
        start_minutes: range.startMinutes,
        end_minutes: range.endMinutes,
      },
    ]
  })
}

function otherCoachingToRow(activity: OtherCoachingActivity): OtherCoachingRow {
  return {
    id: activity.id,
    region_id: activity.regionId,
    coach_id: activity.coachId || null,
    name: activity.name,
    notes: activity.notes,
    hours_per_week: activity.hoursPerWeek,
    shifts_per_week: activity.shiftsPerWeek,
  }
}

function shiftToRow(shift: Shift): ShiftRow {
  return {
    id: shift.id,
    date: shift.date,
    start_minutes: shift.startMinutes,
    end_minutes: shift.endMinutes,
    type: shift.type,
    participant_id: shift.participantId ?? null,
    authorization_id: shift.authorizationId ?? null,
    coach_id: shift.coachId ?? null,
    other_coaching_activity_id: shift.otherCoachingActivityId ?? null,
    notes: shift.notes ?? null,
  }
}

function shiftFromRow(row: ShiftRow): Shift {
  return {
    id: row.id,
    date: asDateString(row.date),
    startMinutes: asNumber(row.start_minutes),
    endMinutes: asNumber(row.end_minutes),
    type: row.type as ShiftType,
    participantId: row.participant_id ?? undefined,
    authorizationId: row.authorization_id ?? undefined,
    coachId: row.coach_id ?? undefined,
    otherCoachingActivityId: row.other_coaching_activity_id ?? undefined,
    notes: row.notes ?? undefined,
  }
}

export async function loadAppStateFromSupabase(): Promise<AppState> {
  const [
    regionsRes,
    participantsRes,
    authorizationsRes,
    coachesRes,
    availabilityRes,
    otherRes,
    shiftsRes,
  ] = await Promise.all([
    supabase.from('regions').select('*').order('name'),
    supabase.from('participants').select('*'),
    supabase.from('authorizations').select('*'),
    supabase.from('coaches').select('*'),
    supabase.from('coach_availability').select('*'),
    supabase.from('other_coaching_activities').select('*'),
    supabase.from('shifts').select('*'),
  ])

  throwIfError(regionsRes.error)
  throwIfError(participantsRes.error)
  throwIfError(authorizationsRes.error)
  throwIfError(coachesRes.error)
  throwIfError(availabilityRes.error)
  throwIfError(otherRes.error)
  throwIfError(shiftsRes.error)

  const regions = (regionsRes.data as RegionRow[]).map(
    (row): Region => ({ id: row.id, name: row.name }),
  )

  const authsByParticipant = new Map<string, Authorization[]>()
  for (const row of (authorizationsRes.data ?? []) as AuthorizationRow[]) {
    const list = authsByParticipant.get(row.participant_id) ?? []
    list.push(authorizationFromRow(row))
    authsByParticipant.set(row.participant_id, list)
  }

  const participants = ((participantsRes.data ?? []) as ParticipantRow[]).map(
    (row): Participant => ({
      id: row.id,
      regionId: row.region_id,
      name: row.name,
      phone: row.phone,
      site: row.site,
      siteContact: row.site_contact,
      authorizations: authsByParticipant.get(row.id) ?? [],
      bestAddressForChecks: row.best_address_for_checks,
      notes: row.notes,
    }),
  )

  const availabilityByCoach = new Map<string, Partial<Record<DayOfWeek, TimeRange | null>>>()
  for (const row of (availabilityRes.data ?? []) as AvailabilityRow[]) {
    const day = row.day_of_week as DayOfWeek
    const current = availabilityByCoach.get(row.coach_id) ?? {}
    current[day] = { startMinutes: row.start_minutes, endMinutes: row.end_minutes }
    availabilityByCoach.set(row.coach_id, current)
  }

  const coaches = ((coachesRes.data ?? []) as CoachRow[]).map(
    (row): Coach => ({
      id: row.id,
      regionId: row.region_id,
      name: row.name,
      startingLocation: row.starting_location,
      phone: row.phone,
      notes: row.notes,
      color: row.color,
      availability: availabilityByCoach.get(row.id) ?? {},
    }),
  )

  const otherCoachingActivities = ((otherRes.data ?? []) as OtherCoachingRow[]).map(
    (row): OtherCoachingActivity => ({
      id: row.id,
      regionId: row.region_id,
      coachId: row.coach_id ?? '',
      name: row.name as OtherCoachingActivity['name'],
      notes: row.notes,
      hoursPerWeek: asNumber(row.hours_per_week),
      shiftsPerWeek: row.shifts_per_week,
    }),
  )

  const shifts = ((shiftsRes.data ?? []) as ShiftRow[]).map(shiftFromRow)

  const prefs = loadUiPrefs()
  const selectedRegionId =
    prefs.selectedRegionId && regions.some((r) => r.id === prefs.selectedRegionId)
      ? prefs.selectedRegionId
      : (regions[0]?.id ?? '')

  const weekStart = prefs.weekStart?.trim()
    ? prefs.weekStart
    : toDateInput(startOfWeek(new Date()))

  return {
    regions,
    selectedRegionId,
    participants,
    coaches,
    otherCoachingActivities,
    shifts,
    weekStart,
  }
}

export async function persistRegion(region: Region): Promise<void> {
  const { error } = await supabase.from('regions').upsert({ id: region.id, name: region.name })
  throwIfError(error)
}

export async function persistParticipant(participant: Participant): Promise<void> {
  const { error: participantError } = await supabase
    .from('participants')
    .upsert(participantToRow(participant))
  throwIfError(participantError)

  const authRows = participant.authorizations.map((auth) =>
    authorizationToRow(participant.id, auth),
  )
  if (authRows.length > 0) {
    const { error: authError } = await supabase.from('authorizations').upsert(authRows)
    throwIfError(authError)
  }

  const { data: existing, error: existingError } = await supabase
    .from('authorizations')
    .select('id')
    .eq('participant_id', participant.id)
  throwIfError(existingError)

  const keep = new Set(participant.authorizations.map((auth) => auth.id))
  const removed = (existing ?? []).map((row) => row.id).filter((id) => !keep.has(id))
  if (removed.length > 0) {
    const { error } = await supabase.from('authorizations').delete().in('id', removed)
    throwIfError(error)
  }
}

export async function deleteParticipant(id: string): Promise<void> {
  const { error } = await supabase.from('participants').delete().eq('id', id)
  throwIfError(error)
}

export async function persistCoach(coach: Coach): Promise<void> {
  const { error: coachError } = await supabase.from('coaches').upsert(coachToRow(coach))
  throwIfError(coachError)

  const { error: deleteError } = await supabase
    .from('coach_availability')
    .delete()
    .eq('coach_id', coach.id)
  throwIfError(deleteError)

  const rows = availabilityRows(coach)
  if (rows.length > 0) {
    const { error } = await supabase.from('coach_availability').insert(rows)
    throwIfError(error)
  }
}

export async function deleteCoach(
  coachId: string,
  convertedShifts: Shift[],
  deletedShiftIds: string[],
): Promise<void> {
  if (deletedShiftIds.length > 0) {
    const { error } = await supabase.from('shifts').delete().in('id', deletedShiftIds)
    throwIfError(error)
  }
  if (convertedShifts.length > 0) {
    const { error } = await supabase.from('shifts').upsert(convertedShifts.map(shiftToRow))
    throwIfError(error)
  }
  const { error } = await supabase.from('coaches').delete().eq('id', coachId)
  throwIfError(error)
}

export async function persistOtherCoaching(activity: OtherCoachingActivity): Promise<void> {
  const { error } = await supabase
    .from('other_coaching_activities')
    .upsert(otherCoachingToRow(activity))
  throwIfError(error)
}

export async function deleteOtherCoaching(id: string): Promise<void> {
  const { error } = await supabase.from('other_coaching_activities').delete().eq('id', id)
  throwIfError(error)
}

export async function persistShifts(shifts: Shift[]): Promise<void> {
  if (shifts.length === 0) return
  const { error } = await supabase.from('shifts').upsert(shifts.map(shiftToRow))
  throwIfError(error)
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', id)
  throwIfError(error)
}

export async function loadOnCallPhone(regionId: string, weekStart: string): Promise<string> {
  if (!regionId || !weekStart) return ''
  const { data, error } = await supabase
    .from('on_call_phones')
    .select('phone')
    .eq('region_id', regionId)
    .eq('week_start', weekStart)
    .maybeSingle()
  throwIfError(error)
  return data?.phone ?? ''
}

export async function saveOnCallPhone(
  regionId: string,
  weekStart: string,
  phone: string,
): Promise<void> {
  const trimmed = phone.trim()
  if (!trimmed) {
    const { error } = await supabase
      .from('on_call_phones')
      .delete()
      .eq('region_id', regionId)
      .eq('week_start', weekStart)
    throwIfError(error)
    return
  }

  const { error } = await supabase.from('on_call_phones').upsert({
    region_id: regionId,
    week_start: weekStart,
    phone: trimmed,
  })
  throwIfError(error)
}
