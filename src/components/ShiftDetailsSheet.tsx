import type { Shift } from '../types'
import { formatDayHeader, formatMinutesRange } from '../lib/time'

export type ShiftDetails = {
  shift: Shift
  title: string
  subtitle?: string
  coachName?: string
  coachPhone?: string
  site?: string
  phone?: string
  service?: string
  authNumber?: string
  notes?: string
  timeLabel: string
  dateLabel: string
}

interface ShiftDetailsSheetProps {
  details: ShiftDetails | null
  onClose: () => void
}

export function ShiftDetailsSheet({ details, onClose }: ShiftDetailsSheetProps) {
  if (!details) return null

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close shift details"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 px-4 pb-8 pt-3 shadow-2xl md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-4">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-100">{details.title}</h3>
            {details.subtitle && (
              <p className="mt-0.5 truncate text-sm text-slate-400">{details.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            Close
          </button>
        </div>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">When</dt>
            <dd className="mt-0.5 text-slate-200">
              {details.dateLabel}
              <span className="text-slate-500"> · </span>
              {details.timeLabel}
            </dd>
          </div>
          {details.coachName && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Coach</dt>
              <dd className="mt-0.5 text-slate-200">{details.coachName}</dd>
            </div>
          )}
          {details.coachPhone && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Coach phone
              </dt>
              <dd className="mt-0.5">
                <a href={`tel:${details.coachPhone}`} className="text-blue-400 hover:text-blue-300">
                  {details.coachPhone}
                </a>
              </dd>
            </div>
          )}
          {details.service && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Service
              </dt>
              <dd className="mt-0.5 text-slate-200">
                {details.service}
                {details.authNumber ? ` · ${details.authNumber}` : ''}
              </dd>
            </div>
          )}
          {details.site && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Site</dt>
              <dd className="mt-0.5 text-slate-200">{details.site}</dd>
            </div>
          )}
          {details.phone && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Participant phone
              </dt>
              <dd className="mt-0.5">
                <a href={`tel:${details.phone}`} className="text-blue-400 hover:text-blue-300">
                  {details.phone}
                </a>
              </dd>
            </div>
          )}
          {details.notes && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Notes</dt>
              <dd className="mt-0.5 text-slate-200">{details.notes}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

export function buildShiftDetails(params: {
  shift: Shift
  title: string
  coachName?: string
  coachPhone?: string
  site?: string
  phone?: string
  service?: string
  authNumber?: string
  notes?: string
  isOtherCoaching?: boolean
}): ShiftDetails {
  return {
    shift: params.shift,
    title: params.title,
    subtitle: params.isOtherCoaching ? 'Other coaching assignment' : undefined,
    coachName: params.coachName,
    coachPhone: params.coachPhone,
    site: params.site,
    phone: params.phone,
    service: params.service,
    authNumber: params.authNumber,
    notes: params.notes,
    timeLabel: formatMinutesRange(params.shift.startMinutes, params.shift.endMinutes),
    dateLabel: formatDayHeader(params.shift.date),
  }
}
