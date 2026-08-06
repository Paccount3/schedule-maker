import type { Shift } from '../types'

export interface ShiftLayout {
  column: number
  totalColumns: number
}

function overlaps(a: Shift, b: Shift): boolean {
  return a.startMinutes < b.endMinutes && a.endMinutes > b.startMinutes
}

function clusterShifts(shifts: Shift[]): Shift[][] {
  let clusters: Shift[][] = shifts.map((s) => [s])

  let changed = true
  while (changed) {
    changed = false
    const merged: Shift[][] = []

    for (const cluster of clusters) {
      let placed = false
      for (const existing of merged) {
        if (cluster.some((s) => existing.some((e) => overlaps(s, e)))) {
          existing.push(...cluster)
          placed = true
          changed = true
          break
        }
      }
      if (!placed) merged.push([...cluster])
    }
    clusters = merged
  }

  return clusters
}

function layoutCluster(shifts: Shift[]): Map<string, ShiftLayout> {
  const result = new Map<string, ShiftLayout>()
  if (shifts.length === 0) return result

  // Process in stable id order so overlapping shifts don't swap columns when
  // start times match or one is being dragged/resized.
  const sorted = [...shifts].sort((a, b) => a.id.localeCompare(b.id))

  const columnEnds: number[] = []
  const columnByShift = new Map<string, number>()

  for (const shift of sorted) {
    let col = columnEnds.findIndex((end) => end <= shift.startMinutes)
    if (col === -1) {
      col = columnEnds.length
      columnEnds.push(shift.endMinutes)
    } else {
      columnEnds[col] = Math.max(columnEnds[col], shift.endMinutes)
    }
    columnByShift.set(shift.id, col)
  }

  const totalColumns = columnEnds.length

  for (const shift of shifts) {
    result.set(shift.id, {
      column: columnByShift.get(shift.id) ?? 0,
      totalColumns,
    })
  }

  return result
}

export function layoutDayShifts(shifts: Shift[]): Map<string, ShiftLayout> {
  const layouts = new Map<string, ShiftLayout>()
  for (const cluster of clusterShifts(shifts)) {
    const clusterLayouts = layoutCluster(cluster)
    for (const [id, layout] of clusterLayouts) {
      layouts.set(id, layout)
    }
  }
  return layouts
}

export function layoutStyle(layout: ShiftLayout, gapPx = 2): {
  left: string
  width: string
} {
  const { column, totalColumns } = layout
  const gap = gapPx
  const widthExpr = `calc((100% - ${gap * (totalColumns - 1)}px) / ${totalColumns})`
  const leftExpr =
    column === 0
      ? '0px'
      : `calc(((100% - ${gap * (totalColumns - 1)}px) / ${totalColumns} + ${gap}px) * ${column})`

  return { left: leftExpr, width: widthExpr }
}
