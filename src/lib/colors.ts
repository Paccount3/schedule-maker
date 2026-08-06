export const COACH_COLOR_PALETTE = [
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#10b981',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#ef4444',
  '#a855f7',
]

export function pickCoachColor(index: number): string {
  return COACH_COLOR_PALETTE[index % COACH_COLOR_PALETTE.length]
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function coachShiftStyle(color: string): { backgroundColor: string; borderColor: string; color: string } {
  return {
    backgroundColor: hexToRgba(color, 0.25),
    borderColor: color,
    color: '#f1f5f9',
  }
}

export function soloShiftStyle(): { backgroundColor: string; borderColor: string; color: string } {
  return {
    backgroundColor: hexToRgba('#64748b', 0.35),
    borderColor: '#64748b',
    color: '#e2e8f0',
  }
}

/** Scale shift label size with block height — stays readable on short and long shifts */
export function shiftLabelFontSize(blockHeight: number): number {
  return Math.min(13, Math.max(10, Math.round(blockHeight / 5.5)))
}
