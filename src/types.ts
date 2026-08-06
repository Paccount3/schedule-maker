export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export const DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

export interface TimeRange {
  startMinutes: number
  endMinutes: number
}

export interface Participant {
  id: string
  name: string
  site: string
  service: ParticipantService
  workingHoursPerWeek: number
  coachingHoursPerWeek: number
  authStart: string
  authEnd: string
  notes: string
}

export type ParticipantService = 'WA' | 'CPO' | 'TWE' | 'JC' | 'LVL UP' | 'Other'

export const PARTICIPANT_SERVICES: ParticipantService[] = [
  'WA',
  'CPO',
  'TWE',
  'JC',
  'LVL UP',
  'Other',
]

export const PARTICIPANT_NOTES_MAX = 30

export interface Coach {
  id: string
  name: string
  startingLocation: string
  color: string
  availability: Partial<Record<DayOfWeek, TimeRange | null>>
}

export type ShiftType = 'solo' | 'coached'

export interface Shift {
  id: string
  participantId: string
  date: string
  startMinutes: number
  endMinutes: number
  type: ShiftType
  coachId?: string
  notes?: string
}

export interface AppState {
  participants: Participant[]
  coaches: Coach[]
  shifts: Shift[]
  weekStart: string
}
