import { minutesToTimeValue, parseTimeToMinutes, timeOptionItems } from '../lib/time'

const selectClass =
  'rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

interface TimeSelectProps {
  valueMinutes: number
  onChange: (minutes: number) => void
  minMinutes?: number
  maxMinutes?: number
  className?: string
  compact?: boolean
}

export function TimeSelect({
  valueMinutes,
  onChange,
  minMinutes,
  maxMinutes,
  className,
  compact,
}: TimeSelectProps) {
  const options = timeOptionItems().filter((o) => {
    if (minMinutes !== undefined && o.minutes <= minMinutes) return false
    if (maxMinutes !== undefined && o.minutes > maxMinutes) return false
    return true
  })

  const value = minutesToTimeValue(valueMinutes)
  const hasValue = options.some((o) => o.value === value)

  return (
    <select
      className={className ?? (compact ? `${selectClass} text-xs py-1` : selectClass)}
      value={hasValue ? value : options[0]?.value ?? value}
      onChange={(e) => onChange(parseTimeToMinutes(e.target.value))}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
