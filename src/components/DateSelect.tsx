import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, parseDateInput, toDateInput, todayDateInput } from '../lib/time'

const triggerClass =
  'flex w-full items-center justify-between rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface DateSelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

function formatDisplayDate(value: string): string {
  const d = parseDateInput(value)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}/${day}/${d.getFullYear()}`
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function DateSelect({ value, onChange, className }: DateSelectProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(parseDateInput(value)))
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setViewMonth(startOfMonth(parseDateInput(value)))
  }, [value])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const first = new Date(year, month, 1)
    const leading = first.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: Array<{ date: string; inMonth: boolean }> = []

    for (let i = 0; i < leading; i++) {
      const d = addDays(first, i - leading)
      cells.push({ date: toDateInput(d), inMonth: false })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: toDateInput(new Date(year, month, day)), inMonth: true })
    }
    while (cells.length % 7 !== 0) {
      const last = parseDateInput(cells[cells.length - 1].date)
      cells.push({ date: toDateInput(addDays(last, 1)), inMonth: false })
    }

    return cells
  }, [viewMonth])

  const selectDate = (date: string) => {
    onChange(date)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${triggerClass} ${open ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
      >
        <span className="tabular-nums">{formatDisplayDate(value)}</span>
        <svg
          className="h-4 w-4 shrink-0 text-slate-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 4a1 1 0 000 2h8a1 1 0 100-2H6z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-72 rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, -1))}
              className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-slate-200">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[10px] font-medium uppercase text-slate-500"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, inMonth }) => {
              const selected = date === value
              const isToday = date === todayDateInput()
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => selectDate(date)}
                  className={`rounded-md py-1.5 text-sm tabular-nums transition-colors ${
                    selected
                      ? 'bg-blue-600 font-medium text-white'
                      : isToday
                        ? 'border border-blue-500/50 text-blue-300 hover:bg-slate-800'
                        : inMonth
                          ? 'text-slate-200 hover:bg-slate-800'
                          : 'text-slate-600 hover:bg-slate-800/60 hover:text-slate-400'
                  }`}
                >
                  {parseDateInput(date).getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex justify-between border-t border-slate-800 pt-2">
            <button
              type="button"
              onClick={() => selectDate(todayDateInput())}
              className="text-xs font-medium text-blue-400 hover:text-blue-300"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
