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

export type AuthorizationStatus = 'active' | 'closed_early'

export interface Authorization {
  id: string
  service: ParticipantService
  authNumber: string
  authStart: string
  authEnd: string
  workingHours: number
  coachingHours: number
  status: AuthorizationStatus
  closedReason?: string
  closedAt?: string
}

export interface Participant {
  id: string
  regionId: string
  name: string
  phone: string
  site: string
  siteContact: string
  authorizations: Authorization[]
  bestAddressForChecks: string
  notes: string
}

export type ParticipantService =
  | 'WA'
  | 'CPO'
  | 'TWE'
  | 'JC'
  | 'LVL UP'
  | 'Interview Prep'
  | 'Job Exploration'
  | 'Orientation'
  | 'Other Module'
  | 'Other Service'

export const PARTICIPANT_SERVICES: ParticipantService[] = [
  'WA',
  'CPO',
  'TWE',
  'JC',
  'LVL UP',
  'Interview Prep',
  'Job Exploration',
  'Orientation',
  'Other Module',
  'Other Service',
]

/** Short label for sidebar / reports (e.g. Interview Prep → IP) */
export const PARTICIPANT_SERVICE_ACRONYMS: Record<ParticipantService, string> = {
  WA: 'WA',
  CPO: 'CPO',
  TWE: 'TWE',
  JC: 'JC',
  'LVL UP': 'LVL UP',
  'Interview Prep': 'IP',
  'Job Exploration': 'JE',
  Orientation: 'ORI',
  'Other Module': 'OM',
  'Other Service': 'OS',
}

export function serviceAcronym(service: ParticipantService): string {
  return PARTICIPANT_SERVICE_ACRONYMS[service] ?? service
}

export const PARTICIPANT_NOTES_MAX = 30

export const PARTICIPANT_CHECK_ADDRESS_MAX = 100

export const PARTICIPANT_AUTH_NUMBER_LENGTH = 11

export const DEFAULT_PARTICIPANT_AUTH_NUMBER = '00000000000'

export const COACH_NOTES_MAX = 30

export type OtherCoachingCategory =
  | 'Office Time'
  | 'Report Writing'
  | 'Training'
  | 'Shadowing'
  | 'Vacation'
  | 'Sick Time'
  | 'Other'

export const OTHER_COACHING_CATEGORIES: OtherCoachingCategory[] = [
  'Office Time',
  'Report Writing',
  'Training',
  'Shadowing',
  'Vacation',
  'Sick Time',
  'Other',
]

export const OTHER_COACHING_NOTES_MAX = 30

/** Default starting hours when an assignment type is selected */
export const OTHER_COACHING_DEFAULT_HOURS: Record<OtherCoachingCategory, number> = {
  'Office Time': 2,
  'Report Writing': 2,
  Training: 4,
  Shadowing: 4,
  Vacation: 8,
  'Sick Time': 8,
  Other: 2,
}

export function defaultStartingHoursForCategory(category: OtherCoachingCategory): number {
  return OTHER_COACHING_DEFAULT_HOURS[category]
}

export interface OtherCoachingActivity {
  id: string
  regionId: string
  name: OtherCoachingCategory
  notes: string
  hoursPerWeek: number
  shiftsPerWeek: number
  coachId: string
  /** ISO date of the Monday of the week this assignment belongs to */
  weekOf: string
}

export interface Coach {
  id: string
  regionId: string
  name: string
  startingLocation: string
  phone: string
  notes: string
  color: string
  availability: Partial<Record<DayOfWeek, TimeRange | null>>
  inactiveDate?: string
}

export type ShiftType = 'solo' | 'coached' | 'other-coaching'

export interface Shift {
  id: string
  participantId?: string
  authorizationId?: string
  otherCoachingActivityId?: string
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
  otherCoachingActivities: OtherCoachingActivity[]
  shifts: Shift[]
  weekStart: string
}
