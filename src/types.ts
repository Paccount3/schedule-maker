export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export const DAYS: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
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

export interface Region {
  id: string
  name: string
}

export const DEFAULT_REGIONS: Region[] = [
  { id: 'north-region', name: 'North Region' },
  { id: 'west-region', name: 'West Region' },
]

export interface Participant {
  id: string
  regionId: string
  name: string
  site: string
  service: ParticipantService
  workingHoursPerWeek: number
  coachingHoursPerWeek: number
  authStart: string
  authEnd: string
  notes: string
}

export type ParticipantService =
  | 'WA'
  | 'CPO'
  | 'TWE'
  | 'JC'
  | 'LVL UP'
  | 'Module'
  | 'Orientation'
  | 'Other'

export const PARTICIPANT_SERVICES: ParticipantService[] = [
  'WA',
  'CPO',
  'TWE',
  'JC',
  'LVL UP',
  'Module',
  'Orientation',
  'Other',
]

export const PARTICIPANT_NOTES_MAX = 30

export const COACH_NOTES_MAX = 30

export interface Coach {
  id: string
  regionId: string
  name: string
  startingLocation: string
  phone: string
  notes: string
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
  regions: Region[]
  selectedRegionId: string
  participants: Participant[]
  coaches: Coach[]
  shifts: Shift[]
  weekStart: string
}
