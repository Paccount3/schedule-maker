import type {
  Authorization,
  AuthorizationStatus,
  Participant,
  ParticipantService,
  Shift,
} from '../types'
import { DEFAULT_PARTICIPANT_AUTH_NUMBER } from '../types'
import { defaultParticipantAuthRange, generateId } from './time'

export const AUTHORIZATION_STATUS_LABELS: Record<AuthorizationStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  closed_early: 'Closed early',
  cancelled: 'Cancelled',
}

export function createEmptyAuthorization(
  service: ParticipantService = 'WA',
  fromDate = new Date(),
): Authorization {
  const { authStart, authEnd } = defaultParticipantAuthRange(fromDate)
  return {
    id: generateId(),
    service,
    authNumber: DEFAULT_PARTICIPANT_AUTH_NUMBER,
    authStart,
    authEnd,
    workingHours: 40,
    coachingHours: 20,
    status: 'active',
  }
}

export function isCoachingOnlyAuthorization(auth: Authorization): boolean {
  return auth.service === 'JC'
}

export function isAuthorizationSchedulable(auth: Authorization): boolean {
  return auth.status === 'active'
}

export function authorizationOverlapsRange(
  auth: Authorization,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return auth.authStart <= rangeEnd && auth.authEnd >= rangeStart
}

export function getAuthorizationById(
  participant: Participant,
  authorizationId: string | undefined,
): Authorization | undefined {
  if (!authorizationId) return undefined
  return participant.authorizations.find((a) => a.id === authorizationId)
}

export function resolveSelectedAuthorization(
  participant: Participant,
  selectedAuthorizationId: string | undefined,
): Authorization | undefined {
  if (selectedAuthorizationId) {
    const selected = getAuthorizationById(participant, selectedAuthorizationId)
    if (selected) return selected
  }
  return (
    participant.authorizations.find((a) => a.status === 'active') ??
    participant.authorizations[0]
  )
}

export function getActiveAuthorizations(participant: Participant): Authorization[] {
  return participant.authorizations.filter((a) => a.status === 'active')
}

export interface LegacyParticipantFields {
  service?: ParticipantService
  workingHoursPerWeek?: number
  coachingHoursPerWeek?: number
  authStart?: string
  authEnd?: string
  authNumber?: string
  authorizations?: Authorization[]
}

export function migrateParticipantRecord(
  raw: LegacyParticipantFields & Omit<Participant, 'authorizations'>,
  defaultAuth = defaultParticipantAuthRange(new Date()),
): Participant {
  if (raw.authorizations && raw.authorizations.length > 0) {
    return {
      id: raw.id,
      regionId: raw.regionId,
      name: raw.name,
      phone: raw.phone ?? '',
      site: raw.site,
      siteContact: raw.siteContact ?? '',
      authorizations: raw.authorizations.map(normalizeAuthorization),
      bestAddressForChecks: raw.bestAddressForChecks ?? '',
      notes: raw.notes ?? '',
    }
  }

  const authId = generateId()
  return {
    id: raw.id,
    regionId: raw.regionId,
    name: raw.name,
    phone: raw.phone ?? '',
    site: raw.site,
    siteContact: raw.siteContact ?? '',
    authorizations: [
      normalizeAuthorization({
        id: authId,
        service: raw.service ?? 'WA',
        authNumber: raw.authNumber?.trim() || DEFAULT_PARTICIPANT_AUTH_NUMBER,
        authStart: raw.authStart?.trim() || defaultAuth.authStart,
        authEnd: raw.authEnd?.trim() || defaultAuth.authEnd,
        workingHours: raw.workingHoursPerWeek ?? 40,
        coachingHours: raw.coachingHoursPerWeek ?? 20,
        status: 'active',
      }),
    ],
    bestAddressForChecks: raw.bestAddressForChecks ?? '',
    notes: raw.notes ?? '',
  }
}

function normalizeService(service: string | undefined): ParticipantService {
  if (service === 'Module') return 'Other Module'
  if (service === 'Other') return 'Other Service'
  const valid = [
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
  ] as const
  if (valid.includes(service as ParticipantService)) return service as ParticipantService
  return 'WA'
}

function normalizeAuthorization(auth: Authorization): Authorization {
  return {
    ...auth,
    service: normalizeService(auth.service),
    authNumber: auth.authNumber?.trim() || DEFAULT_PARTICIPANT_AUTH_NUMBER,
    workingHours: auth.workingHours ?? 0,
    coachingHours: auth.coachingHours ?? 0,
    status: auth.status ?? 'active',
  }
}

export function assignShiftsToDefaultAuthorizations(
  participants: Participant[],
  shifts: Shift[],
): Shift[] {
  const defaultAuthByParticipant = new Map(
    participants.map((p) => [p.id, p.authorizations[0]?.id]),
  )
  return shifts.map((shift) => {
    if (!shift.participantId || shift.authorizationId) return shift
    const authId = defaultAuthByParticipant.get(shift.participantId)
    return authId ? { ...shift, authorizationId: authId } : shift
  })
}

export function authorizationLabel(auth: Authorization): string {
  return `${auth.service} · ${AUTHORIZATION_STATUS_LABELS[auth.status]}`
}
