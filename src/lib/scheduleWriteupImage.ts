const DIVIDER = '----------------------------------------'
const GOODWILL_ORG = 'Goodwill Western & Northern Connecticut'

const GW_BLUE = 'rgb(0, 83, 160)'
const GW_BLUE_LIGHT = 'rgb(232, 242, 252)'
const GW_BLUE_MID = 'rgb(179, 208, 235)'
const GW_BLACK = 'rgb(35, 31, 32)'
const GW_GRAY = 'rgb(82, 90, 99)'
const GW_MUTED = 'rgb(120, 128, 138)'

const PAGE_WIDTH = 612
const MARGIN = 48

export interface ScheduleImageOptions {
  writeup: string
  scheduleKind: 'participant' | 'coach'
  personName: string
  regionLabel: string
  weekLabel: string
}

interface ParsedEntry {
  title: string
  lines: string[]
}

interface ParsedWriteup {
  greeting?: string
  meta: Array<{ key: string; value: string }>
  summary?: string
  entries: ParsedEntry[]
  totals: string[]
  closing?: string
}

function scheduleTitle(kind: ScheduleImageOptions['scheduleKind']): string {
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

    if (
      !currentEntry &&
      !inTotals &&
      !inAdvice &&
      line.startsWith('Hi ') &&
      line.includes('You can find your schedule')
    ) {
      result.greeting = line
      continue
    }

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
  return text.replace(/\((\d+(?:\.\d+)?)\s+hours?\)/gi, '($1h)')
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
    const primary = [fields.get('Assignment'), 'Other coaching assignment'].filter(Boolean).join(' · ')
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
      fields.get('Coach') && fields.get('Coach') !== 'To be assigned' ? fields.get('Coach') : undefined,
    ]
      .filter(Boolean)
      .join(' · ')
    const secondary = [fields.get('Notes'), fields.get('Type'), ...extras].filter(Boolean).join(' · ')
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

  const secondary = [fields.get('Notes'), ...extras].filter(Boolean).join(' · ')

  return { primary: primary || lines.join(' · '), siteContact, secondary: secondary || undefined }
}

function font(weight: 'normal' | 'bold', size: number, italic = false): string {
  return `${italic ? 'italic ' : ''}${weight === 'bold' ? 'bold ' : ''}${size}px Helvetica, Arial, sans-serif`
}

function splitText(ctx: CanvasRenderingContext2D, text: string, width: number, fontValue: string): string[] {
  if (!text) return []
  ctx.font = fontValue
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= width) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
  ctx.fill()
}

function renderScheduleCanvas(options: ScheduleImageOptions): HTMLCanvasElement {
  const parsed = parseWriteup(options.writeup)
  const contentWidth = PAGE_WIDTH - MARGIN * 2
  const colDay = 76
  const colTime = 128
  const colDetail = contentWidth - colDay - colTime - 12
  const detailX = MARGIN + colDay + colTime + 12

  const measureCanvas = document.createElement('canvas')
  const measure = measureCanvas.getContext('2d')
  if (!measure) throw new Error('Could not draw the schedule image')

  type Op = (ctx: CanvasRenderingContext2D) => void
  const ops: Op[] = []
  let y = 0

  ops.push((ctx) => {
    ctx.fillStyle = GW_BLUE
    ctx.fillRect(0, 0, PAGE_WIDTH, 64)
    ctx.fillStyle = '#ffffff'
    ctx.font = font('normal', 8)
    ctx.fillText(GOODWILL_ORG, MARGIN, 18)
    ctx.font = font('bold', 17)
    ctx.fillText(scheduleTitle(options.scheduleKind), MARGIN, 38)
    ctx.font = font('normal', 10)
    ctx.fillText(`${options.regionLabel} · ${options.weekLabel}`, MARGIN, 54)
  })

  y = 82
  const personName = options.personName || 'Unnamed'
  ops.push((ctx) => {
    ctx.fillStyle = GW_BLACK
    ctx.font = font('bold', 16)
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(personName, MARGIN, 82)
    ctx.strokeStyle = GW_BLUE
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(MARGIN, 87)
    ctx.lineTo(MARGIN + 64, 87)
    ctx.stroke()
  })
  y += 22

  if (parsed.greeting) {
    const greetingFont = font('normal', 9, true)
    const greetingLines = splitText(measure, parsed.greeting, contentWidth, greetingFont)
    const greetingY = y
    ops.push((ctx) => {
      ctx.fillStyle = GW_GRAY
      ctx.font = greetingFont
      greetingLines.forEach((line, index) => {
        ctx.fillText(line, MARGIN, greetingY + index * 12)
      })
    })
    y += greetingLines.length * 12 + 8
  }

  const metaParts = parsed.meta
    .filter((m) => !['Name', 'Coach', 'Site contact'].includes(m.key))
    .map((m) => `${m.key}: ${m.value}`)
  if (metaParts.length > 0) {
    const metaFont = font('normal', 9)
    const metaLines = splitText(measure, metaParts.join('  ·  '), contentWidth, metaFont)
    const metaY = y
    ops.push((ctx) => {
      ctx.fillStyle = GW_GRAY
      ctx.font = metaFont
      metaLines.forEach((line, index) => {
        ctx.fillText(line, MARGIN, metaY + index * 12)
      })
    })
    y += metaLines.length * 12 + 6
  }

  if (parsed.summary) {
    const summaryY = y
    ops.push((ctx) => {
      ctx.fillStyle = GW_BLACK
      ctx.font = font('normal', 9.5)
      ctx.fillText(parsed.summary ?? '', MARGIN, summaryY)
    })
    y += 18
  }

  if (parsed.entries.length > 0) {
    const headerY = y
    ops.push((ctx) => {
      ctx.fillStyle = GW_BLUE
      ctx.fillRect(MARGIN, headerY, contentWidth, 20)
      ctx.fillStyle = '#ffffff'
      ctx.font = font('bold', 8.5)
      ctx.fillText('DAY', MARGIN + 6, headerY + 13)
      ctx.fillText('TIME', MARGIN + colDay + 6, headerY + 13)
      ctx.fillText('DETAILS', detailX, headerY + 13)
    })
    y += 24

    parsed.entries.forEach((entry, index) => {
      const day = dayFromTitle(entry.title)
      const time = timeFromLines(entry.lines)
      const { primary, siteContact, secondary } = condenseDetails(entry.lines)
      const primaryFont = font('bold', 8.5)
      const secondaryFont = font('normal', 7.5)
      const primaryLines = splitText(measure, primary, colDetail, primaryFont)
      const secondaryLines = secondary ? splitText(measure, secondary, colDetail, secondaryFont) : []
      let rowHeight = 20
      rowHeight += Math.max(0, primaryLines.length - 1) * 12
      if (siteContact) rowHeight += 12
      rowHeight += secondaryLines.length * 11
      rowHeight = Math.max(rowHeight, 32)

      const rowTop = y
      const textY = rowTop + 14
      ops.push((ctx) => {
        if (index % 2 === 0) {
          ctx.fillStyle = GW_BLUE_LIGHT
          ctx.fillRect(MARGIN, rowTop, contentWidth, rowHeight)
        }
        ctx.fillStyle = GW_BLUE
        ctx.font = font('bold', 9)
        ctx.fillText(day, MARGIN + 6, textY)
        ctx.fillStyle = GW_BLACK
        ctx.font = font('normal', 8.5)
        ctx.fillText(time, MARGIN + colDay + 6, textY)
        ctx.font = primaryFont
        primaryLines.forEach((line, lineIndex) => {
          ctx.fillText(line, detailX, textY + lineIndex * 12)
        })
        let detailY = textY + Math.max(0, (primaryLines.length - 1) * 12)
        if (siteContact) {
          detailY += 12
          ctx.fillStyle = GW_GRAY
          ctx.font = font('normal', 8)
          ctx.fillText(`Site contact: ${siteContact}`, detailX, detailY)
        }
        if (secondaryLines.length > 0) {
          detailY += 12
          ctx.fillStyle = GW_MUTED
          ctx.font = secondaryFont
          secondaryLines.forEach((line, lineIndex) => {
            ctx.fillText(line, detailX, detailY + lineIndex * 11)
          })
        }
        ctx.strokeStyle = GW_BLUE_MID
        ctx.lineWidth = 0.4
        ctx.beginPath()
        ctx.moveTo(MARGIN, rowTop + rowHeight - 1)
        ctx.lineTo(MARGIN + contentWidth, rowTop + rowHeight - 1)
        ctx.stroke()
      })
      y = rowTop + rowHeight + 4
    })
  }

  if (parsed.totals.length > 0) {
    const totalsHeight = 22 + parsed.totals.length * 14
    y += 8
    const boxY = y
    ops.push((ctx) => {
      ctx.fillStyle = GW_BLUE_LIGHT
      fillRoundRect(ctx, MARGIN, boxY, contentWidth, totalsHeight, 3)
      ctx.fillStyle = GW_BLUE
      ctx.font = font('bold', 9)
      ctx.fillText('WEEKLY TOTALS', MARGIN + 10, boxY + 14)
      ctx.fillStyle = GW_BLACK
      ctx.font = font('normal', 8.5)
      parsed.totals.forEach((total, index) => {
        ctx.fillText(total, MARGIN + 10, boxY + 24 + index * 14)
      })
    })
    y += totalsHeight + 8
  }

  if (parsed.closing) {
    const adviceFont = font('normal', 8)
    const adviceBodyWidth = contentWidth - 20
    const closingLines = splitText(measure, parsed.closing, adviceBodyWidth, adviceFont)
    const adviceBoxHeight = 20 + 16 + closingLines.length * 11
    y += 8
    const boxY = y
    ops.push((ctx) => {
      ctx.fillStyle = GW_BLUE_LIGHT
      fillRoundRect(ctx, MARGIN, boxY, contentWidth, adviceBoxHeight, 3)
      ctx.fillStyle = GW_BLUE
      ctx.font = font('bold', 8.5)
      ctx.fillText('GENERAL ADVICE', MARGIN + 10, boxY + 20)
      ctx.fillStyle = GW_GRAY
      ctx.font = adviceFont
      closingLines.forEach((line, index) => {
        ctx.fillText(line, MARGIN + 10, boxY + 16 + 14 + index * 11)
      })
    })
    y += adviceBoxHeight
  }

  y += 28
  const footerLineY = y
  const footerTextY = y + 14
  ops.push((ctx) => {
    ctx.strokeStyle = GW_BLUE_MID
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(MARGIN, footerLineY)
    ctx.lineTo(PAGE_WIDTH - MARGIN, footerLineY)
    ctx.stroke()
    ctx.fillStyle = GW_MUTED
    ctx.font = font('normal', 7)
    ctx.fillText(GOODWILL_ORG, MARGIN, footerTextY)
  })
  const pageHeight = footerTextY + 24

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = PAGE_WIDTH * scale
  canvas.height = pageHeight * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not draw the schedule image')
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAGE_WIDTH, pageHeight)
  ctx.textBaseline = 'alphabetic'
  for (const op of ops) op(ctx)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not create the schedule image'))
    }, type)
  })
}

/** Copies the styled schedule. PNG is what email and chat apps accept when pasting. */
export async function copyScheduleWriteupImage(options: ScheduleImageOptions): Promise<void> {
  const canvas = renderScheduleCanvas(options)
  const png = canvasToBlob(canvas, 'image/png')
  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': png,
    }),
  ])
}

export function downloadScheduleWriteupJpg(options: ScheduleImageOptions, filename: string): void {
  const canvas = renderScheduleCanvas(options)
  const url = canvas.toDataURL('image/jpeg', 0.92)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`
  link.click()
}
