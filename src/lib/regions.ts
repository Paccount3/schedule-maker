import type { Coach, Participant, Region, Shift } from '../types'
import { DEFAULT_REGIONS } from '../types'
import { isParticipantRelevantForWeek } from './scheduling'
import { getWeekDates } from './time'

export function regionIdFromName(name: string, existingIds: Set<string>): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  let id = base || 'region'
  let n = 2
  while (existingIds.has(id)) {
    id = `${base}-${n}`
    n++
  }
  return id
}

export function getDefaultRegionId(): string {
  return DEFAULT_REGIONS[0].id
}

export function filterParticipantsByRegion(
  participants: Participant[],
  regionId: string,
): Participant[] {
  return participants.filter((p) => p.regionId === regionId)
}

/** Region participants active for the viewed week (auth, hours, shifts, or upcoming intake) */
export function filterParticipantsForWeekView(
  participants: Participant[],
  regionId: string,
  shifts: Shift[],
  weekStart: string,
): Participant[] {
  const weekDates = getWeekDates(weekStart)
  return filterParticipantsByRegion(participants, regionId).filter((p) =>
    isParticipantRelevantForWeek(p, shifts, weekDates),
  )
}

export function filterCoachesByRegion(coaches: Coach[], regionId: string): Coach[] {
  return coaches.filter((c) => c.regionId === regionId)
}

export function filterShiftsByRegion(
  shifts: Shift[],
  participants: Participant[],
  regionId: string,
): Shift[] {
  const participantIds = new Set(
    filterParticipantsByRegion(participants, regionId).map((p) => p.id),
  )
  return shifts.filter((s) => participantIds.has(s.participantId))
}

export function regionName(regions: Region[], regionId: string): string {
  return regions.find((r) => r.id === regionId)?.name ?? 'Unknown region'
}
