import type { ConfirmDialogOptions } from '../components/ConfirmDialog'

export function participantDeleteConfirm(name: string): ConfirmDialogOptions {
  const displayName = name.trim() || 'this participant'
  const subject =
    displayName === 'this participant' ? 'this participant' : `"${displayName}"`

  return {
    title: `Remove ${displayName}?`,
    impact: `Are you sure you want to delete ${subject}? All of their data will be deleted, including authorizations, notes, and every scheduled shift. Do not proceed if you will need to access this data at a later time.`,
    confirmLabel: 'Delete participant',
  }
}

export function coachConvertToSoloConfirm(name: string): ConfirmDialogOptions {
  const displayName = name.trim() || 'this coach'

  return {
    title: `Convert shifts to solo and remove ${displayName}?`,
    impact: `All coached shifts for this coach become solo (no coach). Other coaching assignments for them are deleted. The coach record is permanently removed. Use this only when you do not need their name on past shifts for billing.`,
    confirmLabel: 'Convert to solo & remove',
  }
}

export function coachKeepHistoryConfirm(name: string): ConfirmDialogOptions {
  const displayName = name.trim() || 'this coach'

  return {
    title: `Keep history and deactivate ${displayName}?`,
    impact: `Past shifts stay under this coach’s name for billing and reports. They are marked inactive so they no longer appear on future weeks or when assigning new shifts. The coach record is kept.`,
    confirmLabel: 'Keep history & deactivate',
    variant: 'warning',
  }
}

export function otherCoachingDeleteConfirm(name: string): ConfirmDialogOptions {
  const displayName = name.trim() || 'this assignment'

  return {
    title: `Remove ${displayName}?`,
    impact: `This other coaching assignment will be permanently removed. All calendar shifts linked to this assignment will be deleted and cannot be recovered.`,
    confirmLabel: 'Remove assignment',
  }
}

export function authorizationDeleteConfirm(service: string): ConfirmDialogOptions {
  return {
    title: `Remove ${service} authorization?`,
    impact: `This authorization will be permanently removed from the participant. Any shifts scheduled under this authorization will lose their authorization link and may show scheduling conflicts.`,
    confirmLabel: 'Remove authorization',
  }
}

export function shiftDeleteConfirm(): ConfirmDialogOptions {
  return {
    title: 'Delete this shift?',
    impact: 'This shift will be permanently removed from the calendar. This action cannot be undone.',
    confirmLabel: 'Delete shift',
  }
}
