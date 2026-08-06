import type { AppState, Coach, Participant, Shift } from '../types'
import { pickCoachColor } from './colors'
import { defaultAvailability } from './scheduling'
import { generateId, startOfWeek, toDateInput } from './time'

const STORAGE_KEY = 'schedule-maker-state'

function createSampleData(): AppState {
  const weekStart = toDateInput(startOfWeek(new Date()))

  const participants: Participant[] = [
    {
      id: generateId(),
      name: 'Alex Rivera',
      site: 'Downtown Center',
      service: 'WA',
      workingHoursPerWeek: 40,
      coachingHoursPerWeek: 20,
      authStart: '2026-01-01',
      authEnd: '2026-12-31',
      notes: '',
    },
    {
      id: generateId(),
      name: 'Jordan Kim',
      site: 'North Campus',
      service: 'WA',
      workingHoursPerWeek: 30,
      coachingHoursPerWeek: 15,
      authStart: '2026-02-01',
      authEnd: '2026-08-31',
      notes: '',
    },
  ]

  const coaches: Coach[] = [
    {
      id: generateId(),
      name: 'Sam Chen',
      startingLocation: 'Downtown Center',
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
      name: 'Taylor Brooks',
      startingLocation: 'North Campus',
      color: pickCoachColor(1),
      availability: defaultAvailability(),
    },
    {
      id: generateId(),
      name: 'Morgan Lee',
      startingLocation: 'Downtown Center',
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
      name: 'Riley Patel',
      startingLocation: 'North Campus',
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
      name: 'Casey Nguyen',
      startingLocation: 'East Side Hub',
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

  return { participants, coaches, shifts, weekStart }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      return {
        ...parsed,
        participants: parsed.participants.map((p) => ({
          ...p,
          service: p.service ?? 'WA',
          notes: p.notes ?? '',
        })),
        coaches: parsed.coaches.map((c, i) => ({
          ...c,
          color: c.color || pickCoachColor(i),
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

export function createEmptyParticipant(): Participant {
  const weekStart = toDateInput(startOfWeek(new Date()))
  return {
    id: generateId(),
    name: '',
    site: '',
    service: 'WA',
    workingHoursPerWeek: 40,
    coachingHoursPerWeek: 20,
    authStart: weekStart,
    authEnd: `${new Date().getFullYear()}-12-31`,
    notes: '',
  }
}

export function createEmptyCoach(colorIndex = 0): Coach {
  return {
    id: generateId(),
    name: '',
    startingLocation: '',
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
