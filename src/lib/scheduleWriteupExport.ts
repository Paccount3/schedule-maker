import { jsPDF } from 'jspdf'
import { addDays, parseDateInput, toDateInput } from './time'

const DIVIDER = '----------------------------------------'
const GOODWILL_ORG = 'Goodwill Western & Northern Connecticut'

/** Goodwill brand palette (French Blue + Attractive Black) */
const GW_BLUE: [number, number, number] = [0, 83, 160]
const GW_BLUE_LIGHT: [number, number, number] = [232, 242, 252]
const GW_BLUE_MID: [number, number, number] = [179, 208, 235]
const GW_BLACK: [number, number, number] = [35, 31, 32]
const GW_GRAY: [number, number, number] = [82, 90, 99]
const GW_MUTED: [number, number, number] = [120, 128, 138]

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_') || 'schedule'
}

export interface ScheduleWriteupPdfOptions {
  writeup: string
  scheduleKind: 'participant' | 'coach'
  personName: string
  regionLabel: string
  weekLabel: string
  weekStart: string
}

function formatWeekFilenameRange(weekStart: string): string {
  const start = parseDateInput(weekStart)
  const end = addDays(start, 6)
  return `${toDateInput(start)}_to_${toDateInput(end)}`
}

export function buildScheduleExportFilename(options: ScheduleWriteupPdfOptions): string {
  const name = safeFilename(options.personName)
  const range = formatWeekFilenameRange(options.weekStart)
  const suffix = options.scheduleKind === 'coach' ? 'coach_schedule' : 'participant_schedule'
  return `${name}_${range}_${suffix}.pdf`
}

interface ParsedEntry {
  title: string
  lines: string[]
}

interface ParsedWriteup {
  meta: Array<{ key: string; value: string }>
  summary?: string
  entries: ParsedEntry[]
  totals: string[]
  closing?: string
}

function scheduleTitle(kind: ScheduleWriteupPdfOptions['scheduleKind']): string {
  return kind === 'coach' ? 'Coach Schedule' : 'Participant Schedule'
}

function parseWriteup(writeup: string): ParsedWriteup {
  const result: ParsedWriteup = { meta: [], entries: [], totals: [] }
  let currentEntry: ParsedEntry | null = null
  let inTotals = false
  let inAdvice = false

  for (const raw of writeup.split('\n')) {
    const line = raw.trimEnd()
    if (line === 'YOUR SCHEDULE' || line === 'COACH SCHEDULE') continue
    if (line === DIVIDER) {
      if (currentEntry) {
        result.entries.push(currentEntry)
        currentEntry = null
      }
      inTotals = false
      inAdvice = false
      continue
    }
    if (line === 'WEEKLY TOTALS') {
      if (currentEntry) {
        result.entries.push(currentEntry)
        currentEntry = null
      }
      inTotals = true
      inAdvice = false
      continue
    }
    if (line === 'GENERAL ADVICE') {
      if (currentEntry) {
        result.entries.push(currentEntry)
        currentEntry = null
      }
      inTotals = false
      inAdvice = true
      continue
    }
    if (!line) continue

    if (/^(SHIFT|SESSION|OTHER COACHING ASSIGNMENT|OTHER COACHING) \d+ —/.test(line)) {
      if (currentEntry) result.entries.push(currentEntry)
      currentEntry = { title: line, lines: [] }
      inTotals = false
      inAdvice = false
      continue
    }

    if (inAdvice) {
      result.closing = result.closing ? `${result.closing} ${line}` : line
      continue
    }

    if (inTotals) {
      result.totals.push(line)
      continue
    }

    if (currentEntry) {
      currentEntry.lines.push(line)
      continue
    }

    if (line.startsWith('You have ') || line.startsWith('No ')) {
      result.summary = line
      continue
    }

    const colon = line.indexOf(':')
    if (colon > 0 && colon < 32) {
      result.meta.push({
        key: line.slice(0, colon).trim(),
        value: line.slice(colon + 1).trim(),
      })
    } else {
      result.summary = result.summary ? `${result.summary} ${line}` : line
    }
  }

  if (currentEntry) result.entries.push(currentEntry)
  return result
}

function dayFromTitle(title: string): string {
  const parts = title.split('—')
  return (parts[1] ?? title).trim()
}

function shortenHours(text: string): string {
  return text
    .replace(/\((\d+(?:\.\d+)?)\s+hours?\)/gi, '($1h)')
    .replace(/\((\d+(?:\.\d+)?)\s+hour\)/gi, '($1h)')
}

function timeFromLines(lines: string[]): string {
  const when = lines.find((l) => l.startsWith('When:'))
  if (!when) return ''
  return shortenHours(when.replace(/^When:\s*/, ''))
}

function condenseDetails(lines: string[]): {
  primary: string
  siteContact?: string
  secondary?: string
} {
  const fields = new Map<string, string>()
  const extras: string[] = []

  for (const line of lines) {
    if (line.startsWith('When:')) continue
    if (line.startsWith('Type: Other coaching assignment')) continue
    if (line.startsWith('What to expect:')) continue

    if (line.startsWith('Important:')) {
      extras.push(line.replace(/^Important:\s*/, ''))
      continue
    }

    const colon = line.indexOf(':')
    if (colon > 0) {
      fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim())
    }
  }

  const siteContact = fields.get('Site contact')

  if (fields.has('Assignment')) {
    const primary = [fields.get('Assignment'), 'Other coaching assignment']
      .filter(Boolean)
      .join(' · ')
    const secondary = [fields.get('Assignment notes'), fields.get('Shift notes'), ...extras]
      .filter(Boolean)
      .join(' · ')
    return { primary, secondary: secondary || undefined }
  }

  if (fields.has('Participant')) {
    const primary = [fields.get('Participant'), fields.get('Site'), fields.get('Service')]
      .filter(Boolean)
      .join(' · ')
    const secondary = [
      fields.get('Notes / risks'),
      fields.get('Notes'),
      fields.get('Shift notes'),
      fields.get('Coach') && fields.get('Coach') !== 'To be assigned'
        ? `Coach: ${fields.get('Coach')}`
        : undefined,
      fields.get('Type'),
      ...extras,
    ]
      .filter(Boolean)
      .join(' · ')
    return { primary, siteContact, secondary: secondary || undefined }
  }

  if (fields.has('Site') || fields.has('Location')) {
    const primary = [
      fields.get('Site') || fields.get('Location'),
      fields.get('Service'),
      fields.get('Coach') && fields.get('Coach') !== 'To be assigned'
        ? fields.get('Coach')
        : undefined,
    ]
      .filter(Boolean)
      .join(' · ')
    const secondary = [
      fields.get('Notes'),
      fields.get('Type'),
      ...extras,
    ]
      .filter(Boolean)
      .join(' · ')
    return { primary, siteContact, secondary: secondary || undefined }
  }

  const primary = [
    fields.get('Type'),
    fields.get('Coach'),
    fields.get('Location'),
    fields.get('Site'),
    fields.get('Service'),
  ]
    .filter(Boolean)
    .join(' · ')

  const secondary = [
    fields.get('Notes'),
    ...extras,
  ]
    .filter(Boolean)
    .join(' · ')

  return { primary: primary || lines.join(' · '), siteContact, secondary: secondary || undefined }
}

function lineCount(doc: jsPDF, text: string, width: number, lineHeight: number): number {
  if (!text) return 0
  return doc.splitTextToSize(text, width).length * lineHeight
}

function estimateRowHeight(
  doc: jsPDF,
  primary: string,
  siteContact: string | undefined,
  secondary: string | undefined,
  colDetail: number,
): number {
  const pad = 20
  let h = pad
  h += lineCount(doc, primary, colDetail, 12)
  if (siteContact) h += 12
  h += lineCount(doc, secondary ?? '', colDetail, 11)
  return Math.max(h, 32)
}

function drawCompactSchedulePdf(
  doc: jsPDF,
  parsed: ParsedWriteup,
  options: ScheduleWriteupPdfOptions,
): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const footerY = pageHeight - 28
  const contentWidth = pageWidth - margin * 2
  const colDay = 76
  const colTime = 128
  const colDetail = contentWidth - colDay - colTime - 12
  const detailX = margin + colDay + colTime + 12

  let y = 0

  // Header band
  doc.setFillColor(...GW_BLUE)
  doc.rect(0, 0, pageWidth, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(GOODWILL_ORG, margin, 18)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(scheduleTitle(options.scheduleKind), margin, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${options.regionLabel} · ${options.weekLabel}`, margin, 54)

  y = 82
  doc.setTextColor(...GW_BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(options.personName || 'Unnamed', margin, y)

  doc.setDrawColor(...GW_BLUE)
  doc.setLineWidth(1.5)
  doc.line(margin, y + 5, margin + 64, y + 5)
  y += 22

  const metaParts = parsed.meta
    .filter((m) => !['Name', 'Coach', 'Site contact'].includes(m.key))
    .map((m) => `${m.key}: ${m.value}`)
  if (metaParts.length > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GW_GRAY)
    const metaLine = doc.splitTextToSize(metaParts.join('  ·  '), contentWidth)
    doc.text(metaLine, margin, y)
    y += metaLine.length * 12 + 6
  }

  if (parsed.summary) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...GW_BLACK)
    doc.text(parsed.summary, margin, y)
    y += 18
  }

  if (parsed.entries.length > 0) {
    doc.setFillColor(...GW_BLUE)
    doc.rect(margin, y, contentWidth, 20, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(255, 255, 255)
    doc.text('DAY', margin + 6, y + 13)
    doc.text('TIME', margin + colDay + 6, y + 13)
    doc.text('DETAILS', detailX, y + 13)
    y += 24

    for (let i = 0; i < parsed.entries.length; i++) {
      const entry = parsed.entries[i]
      const day = dayFromTitle(entry.title)
      const time = timeFromLines(entry.lines)
      const { primary, siteContact, secondary } = condenseDetails(entry.lines)
      const rowHeight = estimateRowHeight(doc, primary, siteContact, secondary, colDetail)

      if (y + rowHeight > footerY - 48) {
        doc.addPage()
        y = margin
      }

      const rowTop = y
      if (i % 2 === 0) {
        doc.setFillColor(...GW_BLUE_LIGHT)
        doc.rect(margin, rowTop, contentWidth, rowHeight, 'F')
      }

      const textY = rowTop + 14
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...GW_BLUE)
      doc.text(day, margin + 6, textY)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...GW_BLACK)
      doc.text(time, margin + colDay + 6, textY)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...GW_BLACK)
      const primaryLines = doc.splitTextToSize(primary, colDetail)
      doc.text(primaryLines, detailX, textY)

      let detailY = textY + Math.max(0, (primaryLines.length - 1) * 12)

      if (siteContact) {
        detailY += 12
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...GW_GRAY)
        doc.text(`Site contact: ${siteContact}`, detailX, detailY)
      }

      if (secondary) {
        detailY += 12
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...GW_MUTED)
        const secondaryLines = doc.splitTextToSize(secondary, colDetail)
        doc.text(secondaryLines, detailX, detailY)
        detailY += Math.max(0, (secondaryLines.length - 1) * 10)
      }

      doc.setDrawColor(...GW_BLUE_MID)
      doc.setLineWidth(0.4)
      doc.line(margin, rowTop + rowHeight - 1, margin + contentWidth, rowTop + rowHeight - 1)
      y = rowTop + rowHeight + 4
    }
  }

  if (parsed.totals.length > 0) {
    const totalsHeight = 22 + parsed.totals.length * 14
    if (y + totalsHeight > footerY - 16) {
      doc.addPage()
      y = margin
    }
    y += 8
    doc.setFillColor(...GW_BLUE_LIGHT)
    doc.roundedRect(margin, y, contentWidth, totalsHeight, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...GW_BLUE)
    doc.text('WEEKLY TOTALS', margin + 10, y + 14)
    y += 24
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...GW_BLACK)
    for (const total of parsed.totals) {
      doc.text(total, margin + 10, y)
      y += 14
    }
    y += 8
  }

  if (parsed.closing) {
    const advicePadX = 10
    const advicePadY = 10
    const adviceTitleHeight = 16
    const adviceLineHeight = 11
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const adviceBodyWidth = contentWidth - advicePadX * 2
    const closingLines = doc.splitTextToSize(parsed.closing, adviceBodyWidth)
    const adviceBoxHeight =
      advicePadY * 2 + adviceTitleHeight + closingLines.length * adviceLineHeight

    if (y + adviceBoxHeight + 16 > footerY - 8) {
      doc.addPage()
      y = margin
    }

    y += 8
    doc.setFillColor(...GW_BLUE_LIGHT)
    doc.roundedRect(margin, y, contentWidth, adviceBoxHeight, 3, 3, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...GW_BLUE)
    doc.text('GENERAL ADVICE', margin + advicePadX, y + advicePadY + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GW_GRAY)
    doc.text(closingLines, margin + advicePadX, y + advicePadY + adviceTitleHeight + 4)
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)
    doc.setDrawColor(...GW_BLUE_MID)
    doc.setLineWidth(0.5)
    doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GW_MUTED)
    doc.text(GOODWILL_ORG, margin, footerY)
    if (pageCount > 1) {
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, footerY, { align: 'right' })
    }
  }
}

export function exportScheduleWriteupPdf(options: ScheduleWriteupPdfOptions): void {
  const parsed = parseWriteup(options.writeup)
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  drawCompactSchedulePdf(doc, parsed, options)

  doc.save(buildScheduleExportFilename(options))
}
