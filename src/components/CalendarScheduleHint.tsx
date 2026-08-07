export const CALENDAR_SCHEDULE_HINT =
  'After pressing Save, click on the calendar where you want to schedule.'

export function CalendarScheduleHint({ className = '' }: { className?: string }) {
  return (
    <p
      className={`rounded-md border border-blue-600/30 bg-blue-950/30 px-3 py-2 text-sm text-blue-200 ${className}`}
    >
      {CALENDAR_SCHEDULE_HINT}
    </p>
  )
}
