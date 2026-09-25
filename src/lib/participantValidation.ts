import type { Participant } from '../types'
import { isCoachingOnlyAuthorization } from './authorizations'
import { PARTICIPANT_AUTH_NUMBER_LENGTH } from '../types'

export const PARTICIPANT_NOTES_LABEL =
  'Notes / Risks - DO NOT INCLUDE PERSONAL HEALTH INFORMATION'

export function authFieldKey(authId: string, field: string): string {
  return `auth_${authId}_${field}`
}

export function validateAuthorizations(participant: Participant): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const auth of participant.authorizations) {
    const coachingOnly = isCoachingOnlyAuthorization(auth)

    if (!auth.authStart?.trim()) {
      errors[authFieldKey(auth.id, 'authStart')] = 'Authorization start is required'
    }
    if (!auth.authEnd?.trim()) {
      errors[authFieldKey(auth.id, 'authEnd')] = 'Authorization end is required'
    }
    if (auth.authStart && auth.authEnd && auth.authEnd < auth.authStart) {
      errors[authFieldKey(auth.id, 'authEnd')] = 'End date must be on or after the start date'
    }
    if (auth.status === 'closed_early') {
      if (!auth.closedAt?.trim()) {
        errors[authFieldKey(auth.id, 'closedAt')] =
          'Close date is required for closed authorizations'
      } else if (auth.authStart && auth.closedAt < auth.authStart) {
        errors[authFieldKey(auth.id, 'closedAt')] =
          'Close date must be on or after the authorization start date'
      } else if (auth.authEnd && auth.closedAt > auth.authEnd) {
        errors[authFieldKey(auth.id, 'closedAt')] =
          'Close date must be on or before the authorized end date'
      }
    }
    const authNumber = auth.authNumber?.trim() ?? ''
    if (!authNumber) {
      errors[authFieldKey(auth.id, 'authNumber')] = 'Authorization number is required'
    } else if (authNumber.length !== PARTICIPANT_AUTH_NUMBER_LENGTH) {
      errors[authFieldKey(auth.id, 'authNumber')] =
        `Authorization number must be exactly ${PARTICIPANT_AUTH_NUMBER_LENGTH} characters`
    }
    if (!coachingOnly && auth.workingHours <= 0) {
      errors[authFieldKey(auth.id, 'workingHours')] = 'Working hours must be greater than 0'
    }
    if (auth.coachingHours <= 0) {
      errors[authFieldKey(auth.id, 'coachingHours')] = 'Coaching hours must be greater than 0'
    }
  }
  if (participant.authorizations.length === 0) {
    errors.auth_list = 'At least one authorization is required'
  }
  return errors
}

export function validateParticipant(participant: Participant): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!participant.name.trim()) errors.name = 'Name is required'
  if (!participant.phone.trim()) errors.phone = 'Phone is required'
  if (!participant.counselorName.trim()) errors.counselorName = 'Counselor name is required'
  if (!participant.site.trim()) errors.site = 'Work site is required'
  if (!participant.siteContact.trim()) errors.siteContact = 'Site contact is required'
  if (!participant.bestAddressForChecks.trim()) {
    errors.bestAddressForChecks = 'Best participant address for checks is required'
  }
  if (!participant.notes.trim()) {
    errors.notes = 'Notes / risks are required'
  }

  Object.assign(errors, validateAuthorizations(participant))

  return errors
}

export function validationSummaryMessages(errors: Record<string, string>): string[] {
  return [...new Set(Object.values(errors))]
}
