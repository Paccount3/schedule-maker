import { useState } from 'react'
import type { Authorization, AuthorizationStatus, Participant, ParticipantService } from '../types'
import {
  AUTHORIZATION_STATUS_LABELS,
  createEmptyAuthorization,
  isCoachingOnlyAuthorization,
} from '../lib/authorizations'
import { DEFAULT_PARTICIPANT_AUTH_NUMBER, PARTICIPANT_AUTH_NUMBER_LENGTH, PARTICIPANT_SERVICES } from '../types'
import { useConfirm } from '../store/useConfirm'
import { authorizationDeleteConfirm } from '../lib/confirmMessages'
import { DateSelect } from './DateSelect'

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

interface AuthorizationsEditorProps {
  participant: Participant
  onChange: (participant: Participant) => void
  fieldErrors: Record<string, string>
  onClearFieldError: (key: string) => void
}

function authFieldKey(authId: string, field: string): string {
  return `auth_${authId}_${field}`
}

export function AuthorizationsEditor({
  participant,
  onChange,
  fieldErrors,
  onClearFieldError,
}: AuthorizationsEditorProps) {
  const { confirm } = useConfirm()
  const [closingAuthId, setClosingAuthId] = useState<string | null>(null)
  const [closeReason, setCloseReason] = useState('')

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

  const setAuthStatus = (authId: string, status: AuthorizationStatus, reason?: string) => {
    updateAuth(authId, {
      status,
      closedReason: reason,
      closedAt: status === 'active' ? undefined : new Date().toISOString().slice(0, 10),
    })
  }

  const confirmCloseEarly = (authId: string) => {
    const reason = closeReason.trim() || 'Closed before all authorized hours were used.'
    setAuthStatus(authId, 'closed_early', reason)
    setClosingAuthId(null)
    setCloseReason('')
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
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  auth.status === 'active'
                    ? 'bg-emerald-950/80 text-emerald-300 ring-1 ring-emerald-500/30'
                    : auth.status === 'closed_early'
                      ? 'bg-amber-950/80 text-amber-300 ring-1 ring-amber-500/30'
                      : 'bg-slate-800 text-slate-400 ring-1 ring-slate-600/40'
                }`}
              >
                {AUTHORIZATION_STATUS_LABELS[auth.status]}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Service</span>
                <select
                  className={`${inputClass} mt-1`}
                  value={auth.service}
                  onChange={(e) =>
                    updateAuth(auth.id, { service: e.target.value as ParticipantService })
                  }
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
                  <span className="text-xs font-medium text-slate-400">Working Hours</span>
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} mt-1`}
                    value={auth.workingHours}
                    onChange={(e) =>
                      updateAuth(auth.id, { workingHours: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <label className={`block ${coachingOnly ? 'sm:col-span-2' : ''}`}>
                <span className="text-xs font-medium text-slate-400">Coaching Hours</span>
                <input
                  type="number"
                  min={0}
                  className={`${inputClass} mt-1`}
                  value={auth.coachingHours}
                  onChange={(e) =>
                    updateAuth(auth.id, { coachingHours: Number(e.target.value) })
                  }
                />
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
              </label>
            </div>

            {auth.closedReason && auth.status !== 'active' && (
              <p className="text-xs text-slate-500">
                Note: {auth.closedReason}
                {auth.closedAt ? ` · ${auth.closedAt}` : ''}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {auth.status === 'active' && (
                <>
                  <button
                    type="button"
                    onClick={() => setAuthStatus(auth.id, 'completed')}
                    className="rounded-md border border-emerald-700/50 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-950/40"
                  >
                    Mark completed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClosingAuthId(auth.id)
                      setCloseReason('')
                    }}
                    className="rounded-md border border-amber-700/50 px-2.5 py-1 text-xs text-amber-300 hover:bg-amber-950/40"
                  >
                    Close early
                  </button>
                </>
              )}
              {auth.status !== 'active' && (
                <button
                  type="button"
                  onClick={() => setAuthStatus(auth.id, 'active')}
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
              <div className="rounded-md border border-amber-800/50 bg-amber-950/20 p-3 space-y-2">
                <p className="text-xs text-amber-200/90">
                  Remaining authorized hours will be unused and not billed. You can add an optional
                  reason below.
                </p>
                <input
                  className={inputClass}
                  placeholder="Reason (optional)"
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmCloseEarly(auth.id)}
                    className="rounded-md bg-amber-900/60 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-900"
                  >
                    Confirm close early
                  </button>
                  <button
                    type="button"
                    onClick={() => setClosingAuthId(null)}
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

export function validateAuthorizations(
  participant: Participant,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const auth of participant.authorizations) {
    if (!auth.authStart?.trim()) {
      errors[authFieldKey(auth.id, 'authStart')] = 'Authorization start is required'
    }
    if (!auth.authEnd?.trim()) {
      errors[authFieldKey(auth.id, 'authEnd')] = 'Authorization end is required'
    }
    if (auth.authStart && auth.authEnd && auth.authEnd < auth.authStart) {
      errors[authFieldKey(auth.id, 'authEnd')] = 'End date must be on or after the start date'
    }
    const authNumber = auth.authNumber?.trim() ?? ''
    if (!authNumber) {
      errors[authFieldKey(auth.id, 'authNumber')] = 'Authorization number is required'
    } else if (authNumber.length !== PARTICIPANT_AUTH_NUMBER_LENGTH) {
      errors[authFieldKey(auth.id, 'authNumber')] =
        `Authorization number must be exactly ${PARTICIPANT_AUTH_NUMBER_LENGTH} characters`
    }
  }
  if (participant.authorizations.length === 0) {
    errors.auth_list = 'At least one authorization is required'
  }
  return errors
}
