import type { Coach, OtherCoachingActivity, Participant, Region, Shift } from '../types'
import { DEFAULT_REGIONS } from '../types'
import { isOtherCoachingRelevantForWeek, isParticipantRelevantForWeek } from './scheduling'
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

export function filterOtherCoachingByRegion(
  activities: OtherCoachingActivity[],
  regionId: string,
): OtherCoachingActivity[] {
  return activities.filter((a) => a.regionId === regionId)
}

/** Region assignments visible for the viewed week (scheduled this week or not yet on calendar) */
export function filterOtherCoachingForWeekView(
  activities: OtherCoachingActivity[],
  regionId: string,
  shifts: Shift[],
  weekStart: string,
): OtherCoachingActivity[] {
  const weekDates = getWeekDates(weekStart)
  return filterOtherCoachingByRegion(activities, regionId).filter((a) =>
    isOtherCoachingRelevantForWeek(a.id, shifts, weekDates),
  )
}

export function filterCoachesByRegion(coaches: Coach[], regionId: string): Coach[] {
  return coaches.filter((c) => c.regionId === regionId)
}

/**
 * Coaches in a region that are active during the given week.
 * A coach with no inactiveDate is always shown. Once inactiveDate is set,
 * the coach is hidden for any week that starts after that date.
 */
export function filterCoachesForWeekView(
  coaches: Coach[],
  regionId: string,
  weekStart: string,
): Coach[] {
  return filterCoachesByRegion(coaches, regionId).filter((c) => {
    if (!c.inactiveDate) return true
    return weekStart <= c.inactiveDate
  })
}

export function filterShiftsByRegion(
  shifts: Shift[],
  participants: Participant[],
  regionId: string,
  otherCoachingActivities: OtherCoachingActivity[] = [],
): Shift[] {
  const participantIds = new Set(
    filterParticipantsByRegion(participants, regionId).map((p) => p.id),
  )
  const activityIds = new Set(
    filterOtherCoachingByRegion(otherCoachingActivities, regionId).map((a) => a.id),
  )
  return shifts.filter(
    (s) =>
      (s.participantId && participantIds.has(s.participantId)) ||
      (s.otherCoachingActivityId && activityIds.has(s.otherCoachingActivityId)),
  )
}

export function regionName(regions: Region[], regionId: string): string {
  return regions.find((r) => r.id === regionId)?.name ?? 'Unknown region'
}
