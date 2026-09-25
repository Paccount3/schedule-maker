import type { AppState, Coach, OtherCoachingActivity, Participant, Shift } from '../types'
import { DEFAULT_REGIONS, defaultStartingHoursForCategory } from '../types'
import {
  assignShiftsToDefaultAuthorizations,
  createEmptyAuthorization,
  migrateParticipantRecord,
} from './authorizations'
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

  const p1Auth = createEmptyAuthorization('WA', new Date())
  p1Auth.authStart = sampleAuth.authStart
  p1Auth.authEnd = sampleAuth.authEnd

  const p2Auth = createEmptyAuthorization('WA', new Date())
  p2Auth.authStart = sampleAuth.authStart
  p2Auth.authEnd = sampleAuth.authEnd
  p2Auth.workingHours = 30
  p2Auth.coachingHours = 15

  const participants: Participant[] = [
    {
      id: generateId(),
      regionId: NORTH,
      name: 'Alex Rivera',
      phone: '',
      counselorName: '',
      site: 'Downtown Center',
      siteContact: '',
      authorizations: [p1Auth],
      bestAddressForChecks: '',
      notes: '',
    },
    {
      id: generateId(),
      regionId: WEST,
      name: 'Jordan Kim',
      phone: '',
      counselorName: '',
      site: 'North Campus',
      siteContact: '',
      authorizations: [p2Auth],
      bestAddressForChecks: '',
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
      authorizationId: p1Auth.id,
      date: mon,
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      type: 'coached',
      coachId: c1,
    },
    {
      id: generateId(),
      participantId: p1,
      authorizationId: p1Auth.id,
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
    otherCoachingActivities: [],
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

      const participants = (parsed.participants ?? []).map((p) =>
        migrateParticipantRecord(
          {
            ...p,
            regionId: p.regionId ?? defaultRegionId,
            notes: p.notes ?? '',
            bestAddressForChecks: p.bestAddressForChecks ?? '',
            siteContact: p.siteContact ?? '',
            counselorName: p.counselorName ?? '',
            phone: p.phone ?? '',
          },
          defaultAuth,
        ),
      )

      const shifts = assignShiftsToDefaultAuthorizations(
        participants,
        parsed.shifts ?? [],
      )

      return {
        ...parsed,
        regions,
        weekStart,
        selectedRegionId:
          parsed.selectedRegionId &&
          regions.some((r) => r.id === parsed.selectedRegionId)
            ? parsed.selectedRegionId
            : defaultRegionId,
        participants,
        coaches: (parsed.coaches ?? []).map((c, i) => ({
          ...c,
          regionId: c.regionId ?? defaultRegionId,
          color: c.color || pickCoachColor(i),
          phone: c.phone ?? '',
          notes: c.notes ?? '',
        })),
        otherCoachingActivities: parsed.otherCoachingActivities ?? [],
        shifts,
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
  return {
    id: generateId(),
    regionId,
    name: '',
    phone: '',
    counselorName: '',
    site: '',
    siteContact: '',
    authorizations: [createEmptyAuthorization()],
    bestAddressForChecks: '',
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
    inactiveDate: undefined,
  }
}

export function createEmptyOtherCoachingActivity(
  regionId: string,
  coachId = '',
  weekOf = '',
): OtherCoachingActivity {
  return {
    id: generateId(),
    regionId,
    name: 'Office Time',
    notes: '',
    hoursPerWeek: defaultStartingHoursForCategory('Office Time'),
    shiftsPerWeek: 1,
    coachId,
    weekOf,
  }
}

export function createOtherCoachingShift(
  activityId: string,
  coachId: string,
  date: string,
  startMinutes: number,
  endMinutes: number,
): Shift {
  return {
    id: generateId(),
    otherCoachingActivityId: activityId,
    coachId,
    date,
    startMinutes,
    endMinutes,
    type: 'other-coaching',
  }
}

export function createShift(
  participantId: string,
  authorizationId: string,
  date: string,
  startMinutes: number,
  endMinutes: number,
  type: 'solo' | 'coached' = 'solo',
): Shift {
  return {
    id: generateId(),
    participantId,
    authorizationId,
    date,
    startMinutes,
    endMinutes,
    type,
  }
}
