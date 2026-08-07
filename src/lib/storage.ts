import type { AppState, Coach, Participant, Shift } from '../types'
import { DEFAULT_REGIONS } from '../types'
import { pickCoachColor } from './colors'
import { getDefaultRegionId } from './regions'
import { defaultAvailability } from './scheduling'
import { generateId, defaultParticipantAuthRange, parseDateInput, startOfWeek, toDateInput } from './time'

const STORAGE_KEY = 'schedule-maker-state'
const NORTH = DEFAULT_REGIONS[0].id
const WEST = DEFAULT_REGIONS[1].id

function createSampleData(): AppState {
  const weekStart = toDateInput(startOfWeek(new Date()))
  const sampleAuth = defaultParticipantAuthRange(new Date())

  const participants: Participant[] = [
    {
      id: generateId(),
      regionId: NORTH,
      name: 'Alex Rivera',
      site: 'Downtown Center',
      service: 'WA',
      workingHoursPerWeek: 40,
      coachingHoursPerWeek: 20,
      authStart: sampleAuth.authStart,
      authEnd: sampleAuth.authEnd,
      notes: '',
    },
    {
      id: generateId(),
      regionId: WEST,
      name: 'Jordan Kim',
      site: 'North Campus',
      service: 'WA',
      workingHoursPerWeek: 30,
      coachingHoursPerWeek: 15,
      authStart: sampleAuth.authStart,
      authEnd: sampleAuth.authEnd,
      notes: '',
    },
  ]

  const coaches: Coach[] = [
    {
      id: generateId(),
      regionId: NORTH,
      name: 'Sam Chen',
      startingLocation: 'Downtown Center',
      phone: '',
      notes: '',
      color: pickCoachColor(0),
      availability: {
        monday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
        tuesday: { startMinutes: 8 * 60, endMinutes: 16 * 60 },
        wednesday: { startMinutes: 9 * 60, endMinutes: 17 * 60 },
        thursday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
        friday: { startMinutes: 8 * 60, endMinutes: 14 * 60 },
      },
    },
    {
      id: generateId(),
      regionId: WEST,
      name: 'Taylor Brooks',
      startingLocation: 'North Campus',
      phone: '',
      notes: '',
      color: pickCoachColor(1),
      availability: defaultAvailability(),
    },
    {
      id: generateId(),
      regionId: NORTH,
      name: 'Morgan Lee',
      startingLocation: 'Downtown Center',
      phone: '',
      notes: '',
      color: pickCoachColor(2),
      availability: {
        monday: { startMinutes: 7 * 60, endMinutes: 15 * 60 },
        tuesday: { startMinutes: 8 * 60, endMinutes: 18 * 60 },
        wednesday: { startMinutes: 8 * 60, endMinutes: 18 * 60 },
        thursday: { startMinutes: 7 * 60, endMinutes: 15 * 60 },
        friday: { startMinutes: 8 * 60, endMinutes: 12 * 60 },
      },
    },
    {
      id: generateId(),
      regionId: WEST,
      name: 'Riley Patel',
      startingLocation: 'North Campus',
      phone: '',
      notes: '',
      color: pickCoachColor(3),
      availability: {
        monday: { startMinutes: 9 * 60, endMinutes: 17 * 60 },
        tuesday: { startMinutes: 9 * 60, endMinutes: 17 * 60 },
        wednesday: { startMinutes: 10 * 60, endMinutes: 18 * 60 },
        thursday: { startMinutes: 9 * 60, endMinutes: 17 * 60 },
        friday: { startMinutes: 9 * 60, endMinutes: 16 * 60 },
      },
    },
    {
      id: generateId(),
      regionId: WEST,
      name: 'Casey Nguyen',
      startingLocation: 'East Side Hub',
      phone: '',
      notes: '',
      color: pickCoachColor(4),
      availability: {
        monday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
        wednesday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
        friday: { startMinutes: 8 * 60, endMinutes: 20 * 60 },
        saturday: { startMinutes: 9 * 60, endMinutes: 14 * 60 },
      },
    },
  ]

  const p1 = participants[0].id
  const c1 = coaches[0].id
  const mon = weekStart
  const tue = new Date(weekStart)
  tue.setDate(tue.getDate() + 1)

  const shifts: Shift[] = [
    {
      id: generateId(),
      participantId: p1,
      date: mon,
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      type: 'coached',
      coachId: c1,
    },
    {
      id: generateId(),
      participantId: p1,
      date: toDateInput(tue),
      startMinutes: 10 * 60,
      endMinutes: 14 * 60,
      type: 'coached',
      coachId: c1,
    },
  ]

  return {
    regions: [...DEFAULT_REGIONS],
    selectedRegionId: NORTH,
    participants,
    coaches,
    shifts,
    weekStart,
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      const regions =
        parsed.regions?.length > 0 ? parsed.regions : [...DEFAULT_REGIONS]
      const defaultRegionId = regions[0]?.id ?? getDefaultRegionId()
      const defaultAuth = defaultParticipantAuthRange(new Date())
      const weekStart = parsed.weekStart
        ? toDateInput(startOfWeek(parseDateInput(parsed.weekStart)))
        : toDateInput(startOfWeek(new Date()))
      return {
        ...parsed,
        regions,
        weekStart,
        selectedRegionId:
          parsed.selectedRegionId &&
          regions.some((r) => r.id === parsed.selectedRegionId)
            ? parsed.selectedRegionId
            : defaultRegionId,
        participants: parsed.participants.map((p) => ({
          ...p,
          regionId: p.regionId ?? defaultRegionId,
          service: p.service ?? 'WA',
          notes: p.notes ?? '',
          authStart: p.authStart?.trim() || defaultAuth.authStart,
          authEnd: p.authEnd?.trim() || defaultAuth.authEnd,
        })),
        coaches: parsed.coaches.map((c, i) => ({
          ...c,
          regionId: c.regionId ?? defaultRegionId,
          color: c.color || pickCoachColor(i),
          phone: c.phone ?? '',
          notes: c.notes ?? '',
        })),
      }
    }
  } catch {
    // fall through to sample data
  }
  return createSampleData()
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function createEmptyParticipant(regionId: string): Participant {
  const { authStart, authEnd } = defaultParticipantAuthRange(new Date())
  return {
    id: generateId(),
    regionId,
    name: '',
    site: '',
    service: 'WA',
    workingHoursPerWeek: 40,
    coachingHoursPerWeek: 20,
    authStart,
    authEnd,
    notes: '',
  }
}

export function createEmptyCoach(colorIndex = 0, regionId: string): Coach {
  return {
    id: generateId(),
    regionId,
    name: '',
    startingLocation: '',
    phone: '',
    notes: '',
    color: pickCoachColor(colorIndex),
    availability: defaultAvailability(),
  }
}

export function createShift(
  participantId: string,
  date: string,
  startMinutes: number,
  endMinutes: number,
  type: 'solo' | 'coached' = 'solo',
): Shift {
  return {
    id: generateId(),
    participantId,
    date,
    startMinutes,
    endMinutes,
    type,
  }
}
