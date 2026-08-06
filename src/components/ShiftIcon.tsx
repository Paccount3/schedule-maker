export function ShiftIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="4" y="5" width="16" height="5" rx="1" strokeWidth={2} />
        <rect x="4" y="14" width="16" height="5" rx="1" strokeWidth={2} />
      </svg>
    )
  }

  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="4" y="5" width="16" height="5" rx="1" strokeWidth={2} opacity={0.35} />
      <rect x="4" y="14" width="16" height="5" rx="1" strokeWidth={2} opacity={0.35} />
      <path strokeLinecap="round" strokeWidth={2} d="M4 4l16 16" />
    </svg>
  )
}
