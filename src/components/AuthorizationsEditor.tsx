import { useState } from 'react'
import type { Authorization, Participant, ParticipantService } from '../types'
import {
  createEmptyAuthorization,
  isCoachingOnlyAuthorization,
} from '../lib/authorizations'
import { DEFAULT_PARTICIPANT_AUTH_NUMBER, PARTICIPANT_AUTH_NUMBER_LENGTH, PARTICIPANT_SERVICES } from '../types'
import { todayDateInput } from '../lib/time'
import { useConfirm } from '../store/useConfirm'
import { authorizationDeleteConfirm } from '../lib/confirmMessages'
import { AuthorizationStatusBadge } from './AuthorizationStatusBadge'
import { DateSelect } from './DateSelect'
import { authFieldKey } from '../lib/participantValidation'

export { authFieldKey, validateAuthorizations } from '../lib/participantValidation'

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

interface AuthorizationsEditorProps {
  participant: Participant
  onChange: (participant: Participant) => void
  fieldErrors: Record<string, string>
  onClearFieldError: (key: string) => void
}

export function AuthorizationsEditor({
  participant,
  onChange,
  fieldErrors,
  onClearFieldError,
}: AuthorizationsEditorProps) {
  const { confirm } = useConfirm()
  const [closingAuthId, setClosingAuthId] = useState<string | null>(null)
  const [closeDate, setCloseDate] = useState('')
  const [closeDateError, setCloseDateError] = useState('')

  const updateAuth = (authId: string, patch: Partial<Authorization>) => {
    onChange({
      ...participant,
      authorizations: participant.authorizations.map((a) =>
        a.id === authId ? { ...a, ...patch } : a,
      ),
    })
  }

  const addAuthorization = () => {
    onChange({
      ...participant,
      authorizations: [...participant.authorizations, createEmptyAuthorization()],
    })
  }

  const removeAuthorization = async (authId: string) => {
    if (participant.authorizations.length <= 1) return

    const auth = participant.authorizations.find((a) => a.id === authId)
    if (!auth) return

    const ok = await confirm(authorizationDeleteConfirm(auth.service))
    if (!ok) return

    onChange({
      ...participant,
      authorizations: participant.authorizations.filter((a) => a.id !== authId),
    })
  }

  const reopenAuthorization = (authId: string) => {
    updateAuth(authId, {
      status: 'active',
      closedAt: undefined,
      closedReason: undefined,
    })
  }

  const startCloseEarly = (auth: Authorization) => {
    setClosingAuthId(auth.id)
    setCloseDate(todayDateInput())
    setCloseDateError('')
  }

  const confirmCloseEarly = (auth: Authorization) => {
    const trimmed = closeDate.trim()
    if (!trimmed) {
      setCloseDateError('Enter the date this authorization closed')
      return
    }
    if (trimmed < auth.authStart) {
      setCloseDateError('Close date must be on or after the authorization start date')
      return
    }
    if (trimmed > auth.authEnd) {
      setCloseDateError('Close date must be on or before the authorized end date')
      return
    }

    updateAuth(auth.id, {
      status: 'closed_early',
      closedAt: trimmed,
    })
    setClosingAuthId(null)
    setCloseDate('')
    setCloseDateError('')
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Authorizations
        </span>
        <button
          type="button"
          onClick={addAuthorization}
          className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          + Add authorization
        </button>
      </div>

      {fieldErrors.auth_list && (
        <p className="text-xs text-red-400">{fieldErrors.auth_list}</p>
      )}

      {participant.authorizations.map((auth, index) => {
        const coachingOnly = isCoachingOnlyAuthorization(auth)
        return (
          <div
            key={auth.id}
            className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-200">
                Authorization {index + 1} · {auth.service}
              </span>
              <AuthorizationStatusBadge authorization={auth} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-400">
                  Service <span className="text-red-400">*</span>
                </span>
                <select
                  className={`${inputClass} mt-1`}
                  value={auth.service}
                  onChange={(e) => {
                    const service = e.target.value as ParticipantService
                    updateAuth(auth.id, {
                      service,
                      ...(isCoachingOnlyAuthorization({ ...auth, service })
                        ? { workingHours: 0 }
                        : {}),
                    })
                  }}
                >
                  {PARTICIPANT_SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">
                  Authorization Number <span className="text-red-400">*</span>
                </span>
                <input
                  className={`${inputClass} mt-1 font-mono tracking-wider ${fieldErrors[authFieldKey(auth.id, 'authNumber')] ? 'border-red-500' : ''}`}
                  value={auth.authNumber}
                  maxLength={PARTICIPANT_AUTH_NUMBER_LENGTH}
                  placeholder={DEFAULT_PARTICIPANT_AUTH_NUMBER}
                  onChange={(e) => {
                    onClearFieldError(authFieldKey(auth.id, 'authNumber'))
                    updateAuth(auth.id, { authNumber: e.target.value })
                  }}
                />
                {fieldErrors[authFieldKey(auth.id, 'authNumber')] && (
                  <span className="mt-1 block text-xs text-red-400">
                    {fieldErrors[authFieldKey(auth.id, 'authNumber')]}
                  </span>
                )}
              </label>
              {!coachingOnly && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">
                    Working Hours <span className="text-red-400">*</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} mt-1 ${fieldErrors[authFieldKey(auth.id, 'workingHours')] ? 'border-red-500' : ''}`}
                    value={auth.workingHours}
                    onChange={(e) => {
                      onClearFieldError(authFieldKey(auth.id, 'workingHours'))
                      updateAuth(auth.id, { workingHours: Number(e.target.value) })
                    }}
                  />
                  {fieldErrors[authFieldKey(auth.id, 'workingHours')] && (
                    <span className="mt-1 block text-xs text-red-400">
                      {fieldErrors[authFieldKey(auth.id, 'workingHours')]}
                    </span>
                  )}
                </label>
              )}
              <label className={`block ${coachingOnly ? 'sm:col-span-2' : ''}`}>
                <span className="text-xs font-medium text-slate-400">
                  Coaching Hours <span className="text-red-400">*</span>
                </span>
                <input
                  type="number"
                  min={0}
                  className={`${inputClass} mt-1 ${fieldErrors[authFieldKey(auth.id, 'coachingHours')] ? 'border-red-500' : ''}`}
                  value={auth.coachingHours}
                  onChange={(e) => {
                    onClearFieldError(authFieldKey(auth.id, 'coachingHours'))
                    updateAuth(auth.id, { coachingHours: Number(e.target.value) })
                  }}
                />
                {fieldErrors[authFieldKey(auth.id, 'coachingHours')] && (
                  <span className="mt-1 block text-xs text-red-400">
                    {fieldErrors[authFieldKey(auth.id, 'coachingHours')]}
                  </span>
                )}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">
                  Start <span className="text-red-400">*</span>
                </span>
                <DateSelect
                  className={`mt-1 ${fieldErrors[authFieldKey(auth.id, 'authStart')] ? '[&>button]:border-red-500' : ''}`}
                  value={auth.authStart}
                  onChange={(authStart) => {
                    onClearFieldError(authFieldKey(auth.id, 'authStart'))
                    onClearFieldError(authFieldKey(auth.id, 'authEnd'))
                    updateAuth(auth.id, { authStart })
                  }}
                />
                {fieldErrors[authFieldKey(auth.id, 'authStart')] && (
                  <span className="mt-1 block text-xs text-red-400">
                    {fieldErrors[authFieldKey(auth.id, 'authStart')]}
                  </span>
                )}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">
                  End <span className="text-red-400">*</span>
                </span>
                <DateSelect
                  className={`mt-1 ${fieldErrors[authFieldKey(auth.id, 'authEnd')] ? '[&>button]:border-red-500' : ''}`}
                  value={auth.authEnd}
                  onChange={(authEnd) => {
                    onClearFieldError(authFieldKey(auth.id, 'authEnd'))
                    updateAuth(auth.id, { authEnd })
                  }}
                />
                {fieldErrors[authFieldKey(auth.id, 'authEnd')] && (
                  <span className="mt-1 block text-xs text-red-400">
                    {fieldErrors[authFieldKey(auth.id, 'authEnd')]}
                  </span>
                )}
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {auth.status === 'active' && (
                <button
                  type="button"
                  onClick={() => startCloseEarly(auth)}
                  className="rounded-md border border-red-800/50 px-2.5 py-1 text-xs text-red-300 hover:bg-red-950/40"
                >
                  Close early
                </button>
              )}
              {auth.status === 'closed_early' && (
                <button
                  type="button"
                  onClick={() => reopenAuthorization(auth.id)}
                  className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Reopen
                </button>
              )}
              {participant.authorizations.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAuthorization(auth.id)}
                  className="rounded-md border border-red-900/50 px-2.5 py-1 text-xs text-red-400 hover:bg-red-950/30"
                >
                  Remove
                </button>
              )}
            </div>

            {closingAuthId === auth.id && (
              <div className="rounded-md border border-red-800/50 bg-red-950/20 p-3 space-y-2">
                <p className="text-xs text-red-200/90">
                  Enter the date this authorization closed. Shifts after that date will no longer
                  be schedulable, even if the authorized end date is later.
                </p>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Date closed</span>
                  <DateSelect
                    className={`mt-1 ${closeDateError ? '[&>button]:border-red-500' : ''}`}
                    value={closeDate}
                    onChange={(value) => {
                      setCloseDate(value)
                      setCloseDateError('')
                    }}
                  />
                </label>
                {closeDateError && (
                  <span className="block text-xs text-red-400">{closeDateError}</span>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmCloseEarly(auth)}
                    className="rounded-md bg-red-900/70 px-3 py-1.5 text-xs font-medium text-red-50 hover:bg-red-900"
                  >
                    Confirm close early
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClosingAuthId(null)
                      setCloseDate('')
                      setCloseDateError('')
                    }}
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
