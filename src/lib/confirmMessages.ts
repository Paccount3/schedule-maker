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

export function coachDeleteConfirm(name: string): ConfirmDialogOptions {
  const displayName = name.trim() || 'this coach'

  return {
    title: `Remove ${displayName}?`,
    impact: `This coach will be permanently removed. All shifts currently assigned to them will become solo shifts with no coach. Their availability, contact information, and schedule history as a coach will be deleted.`,
    confirmLabel: 'Remove coach',
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
