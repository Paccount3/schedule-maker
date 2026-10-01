import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx-js-style'
import { formatTallyTableDate, type TallySheetData } from './tallySheet'

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_') || 'participant'
}

function drawTableGrid(
  doc: jsPDF,
  x: number,
  y: number,
  colWidths: number[],
  rowCount: number,
  rowHeight: number,
): void {
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0)
  const totalHeight = rowCount * rowHeight

  doc.setLineWidth(0.75)
  doc.rect(x, y, totalWidth, totalHeight)

  let colX = x
  for (let i = 0; i < colWidths.length - 1; i++) {
    colX += colWidths[i]
    doc.line(colX, y, colX, y + totalHeight)
  }

  for (let row = 1; row < rowCount; row++) {
    const rowY = y + row * rowHeight
    doc.line(x, rowY, x + totalWidth, rowY)
  }
}

function drawTallySheetPage(doc: jsPDF, data: TallySheetData): void {
  const margin = 48
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Authorization #: ${data.authNumber}`, 520, y, { align: 'right' })
  y += 28

  doc.setFontSize(16)
  doc.text('TALLY SHEET', 306, y, { align: 'center' })
  y += 20
  doc.setFontSize(12)
  doc.text(data.serviceLabel, 306, y, { align: 'center' })
  y += 28

  doc.setFontSize(10)
  doc.text(`Consumers Name: ${data.consumerName}`, margin, y)
  y += 18
  doc.text(`Staff Name: ${data.staffName || '_________________________'}`, margin, y)
  y += 18
  doc.text(`DORS Counselor: ${data.dorsCounselor}`, margin, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('(Period of time authorization is covered)', margin, y)
  y += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(
    `From: ${data.periodFromLabel}    To: ${data.periodToLabel}`,
    306,
    y,
    { align: 'center' },
  )
  y += 28

  const tableRowHeight = 18
  const dateColWidth = 90
  const valueColWidth = 50
  const leftTableX = margin
  const rightTableX = margin + 280
  const maxRows = Math.max(
    data.consumerWages.length,
    data.staffEvaluator.length,
    1,
  )
  const bodyRows = maxRows + 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Consumer Wages', leftTableX + (dateColWidth + valueColWidth) / 2, y, {
    align: 'center',
  })
  doc.text('Staff On-Site Evaluator', rightTableX + (dateColWidth + valueColWidth) / 2, y, {
    align: 'center',
  })
  y += 14

  drawTableGrid(doc, leftTableX, y, [dateColWidth, valueColWidth], bodyRows, tableRowHeight)
  drawTableGrid(doc, rightTableX, y, [dateColWidth, valueColWidth], bodyRows, tableRowHeight)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Date', leftTableX + dateColWidth / 2, y + 12, { align: 'center' })
  doc.text('Hours', leftTableX + dateColWidth + valueColWidth / 2, y + 12, { align: 'center' })
  doc.text('Date', rightTableX + dateColWidth / 2, y + 12, { align: 'center' })
  doc.text('Hours', rightTableX + dateColWidth + valueColWidth / 2, y + 12, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  for (let i = 0; i < maxRows; i++) {
    const rowY = y + tableRowHeight * (i + 1) + 12
    const consumer = data.consumerWages[i]
    const staff = data.staffEvaluator[i]

    if (consumer) {
      doc.text(consumer.dateLabel, leftTableX + dateColWidth / 2, rowY, { align: 'center' })
      doc.text(
        consumer.hours > 0 ? consumer.hours.toFixed(2).replace(/\.00$/, '') : '',
        leftTableX + dateColWidth + valueColWidth / 2,
        rowY,
        { align: 'center' },
      )
    }

    if (staff) {
      doc.text(staff.dateLabel, rightTableX + dateColWidth / 2, rowY, { align: 'center' })
      if (staff.hours != null && staff.hours > 0) {
        doc.text(
          staff.hours.toFixed(2).replace(/\.00$/, ''),
          rightTableX + dateColWidth + valueColWidth / 2,
          rowY,
          { align: 'center' },
        )
      }
    }
  }

  const totalRowY = y + tableRowHeight * (maxRows + 1) + 12
  doc.setFont('helvetica', 'bold')
  doc.text('Total:', leftTableX + 8, totalRowY)
  doc.text(
    data.consumerWagesTotal.toFixed(2).replace(/\.00$/, ''),
    leftTableX + dateColWidth + valueColWidth / 2,
    totalRowY,
    { align: 'center' },
  )
  doc.text('Total:', rightTableX + 8, totalRowY)
  doc.text(
    data.staffEvaluatorTotal.toFixed(2).replace(/\.00$/, ''),
    rightTableX + dateColWidth + valueColWidth / 2,
    totalRowY,
    { align: 'center' },
  )

  y += bodyRows * tableRowHeight + 24

  const reportTableWidth = dateColWidth + valueColWidth
  const reportX = 306 - reportTableWidth / 2
  const reportRows = Math.max(data.comprehensiveReport.length, 1) + 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Comprehensive Report', 306, y, { align: 'center' })
  y += 14

  drawTableGrid(doc, reportX, y, [dateColWidth, valueColWidth], reportRows, tableRowHeight)
  doc.text('Date', reportX + dateColWidth / 2, y + 12, { align: 'center' })
  doc.text('Units', reportX + dateColWidth + valueColWidth / 2, y + 12, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  for (let i = 0; i < Math.max(data.comprehensiveReport.length, 1); i++) {
    const row = data.comprehensiveReport[i]
    const rowY = y + tableRowHeight * (i + 1) + 12
    if (row) {
      doc.text(row.dateLabel, reportX + dateColWidth / 2, rowY, { align: 'center' })
      if (row.units > 0) {
        doc.text(
          String(row.units),
          reportX + dateColWidth + valueColWidth / 2,
          rowY,
          { align: 'center' },
        )
      }
    }
  }

  const reportTotalY = y + tableRowHeight * (Math.max(data.comprehensiveReport.length, 1) + 1) + 12
  doc.setFont('helvetica', 'bold')
  doc.text('Total unit:', reportX + 8, reportTotalY)
  doc.text(
    data.comprehensiveReportTotal.toFixed(2).replace(/\.00$/, ''),
    reportX + dateColWidth + valueColWidth / 2,
    reportTotalY,
    { align: 'center' },
  )
}

export function exportTallySheetPdf(data: TallySheetData, participantName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  drawTallySheetPage(doc, data)
  doc.save(`${safeFilename(participantName)}_tally_sheet.pdf`)
}

const thin = { style: 'thin', color: { rgb: '000000' } }
const medium = { style: 'medium', color: { rgb: '000000' } }
const gridBorder = { top: thin, bottom: thin, left: thin, right: thin }
const boxBorder = { top: medium, bottom: medium, left: medium, right: medium }
const underline = { bottom: thin }

function sheetFont(opts: { bold?: boolean; size?: number; italic?: boolean } = {}) {
  return {
    name: 'Calibri',
    sz: opts.size ?? 11,
    bold: !!opts.bold,
    italic: !!opts.italic,
  }
}

function putCell(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number,
  style?: XLSX.CellObject['s'],
) {
  const cell: XLSX.CellObject = {
    t: typeof value === 'number' ? 'n' : 's',
    v: value,
    s: style,
  }
  if (typeof value === 'number') cell.z = Number.isInteger(value) ? '0' : '0.##'
  ws[XLSX.utils.encode_cell({ r: row, c: col })] = cell
}

function displayTableDate(date: string): string {
  return date ? formatTallyTableDate(date) : ''
}

export function exportTallySheetExcel(data: TallySheetData, participantName: string): void {
  const ws: XLSX.WorkSheet = {}
  const merges: XLSX.Range[] = []
  const merge = (r1: number, c1: number, r2: number, c2: number) => {
    merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
  }

  const labelStyle = {
    font: sheetFont({ bold: true }),
    alignment: { vertical: 'center' },
  }
  const valueStyle = {
    font: sheetFont(),
    alignment: { vertical: 'center' },
    border: underline,
  }
  const headerStyle = {
    font: sheetFont({ bold: true }),
    alignment: { horizontal: 'center', vertical: 'center' },
    border: gridBorder,
  }
  const cellStyle = {
    font: sheetFont(),
    alignment: { horizontal: 'center', vertical: 'center' },
    border: gridBorder,
  }
  const totalLabelStyle = {
    font: sheetFont({ bold: true }),
    alignment: { horizontal: 'left', vertical: 'center' },
    border: gridBorder,
  }
  const totalValueStyle = {
    font: sheetFont({ bold: true }),
    alignment: { horizontal: 'center', vertical: 'center' },
    border: gridBorder,
  }
  const sectionStyle = {
    font: sheetFont({ bold: true, size: 12 }),
    alignment: { horizontal: 'center', vertical: 'center' },
  }

  putCell(ws, 0, 3, 'Authorization #:', {
    font: sheetFont({ bold: true }),
    alignment: { horizontal: 'right', vertical: 'center' },
  })
  putCell(ws, 0, 4, data.authNumber, {
    font: sheetFont({ bold: true, size: 12 }),
    alignment: { horizontal: 'center', vertical: 'center' },
    border: boxBorder,
  })

  putCell(ws, 2, 0, 'TALLY SHEET', {
    font: sheetFont({ bold: true, size: 16 }),
    alignment: { horizontal: 'center', vertical: 'center' },
  })
  merge(2, 0, 2, 4)

  putCell(ws, 3, 0, data.serviceLabel, {
    font: sheetFont({ bold: true, size: 13 }),
    alignment: { horizontal: 'center', vertical: 'center' },
  })
  merge(3, 0, 3, 4)

  const identity: [string, string][] = [
    ['Consumers Name:', data.consumerName],
    ['Staff Name:', data.staffName],
    ['DORS Counselor:', data.dorsCounselor],
  ]
  identity.forEach(([label, value], index) => {
    const row = 5 + index
    putCell(ws, row, 0, label, labelStyle)
    putCell(ws, row, 1, value, valueStyle)
    for (let col = 2; col <= 4; col++) putCell(ws, row, col, '', valueStyle)
    merge(row, 1, row, 4)
  })

  putCell(ws, 8, 0, '(Period of time authorization is covered)', {
    font: sheetFont({ italic: true, size: 9 }),
    alignment: { horizontal: 'center', vertical: 'center' },
  })
  merge(8, 0, 8, 4)

  putCell(
    ws,
    9,
    0,
    `From:  ${data.periodFromLabel}                    To:  ${data.periodToLabel}`,
    {
      font: sheetFont({ bold: true }),
      alignment: { horizontal: 'center', vertical: 'center' },
    },
  )
  merge(9, 0, 9, 4)

  putCell(ws, 11, 0, 'Consumer Wages', sectionStyle)
  merge(11, 0, 11, 1)
  putCell(ws, 11, 3, 'Staff On-Site Evaluator', sectionStyle)
  merge(11, 3, 11, 4)

  putCell(ws, 12, 0, 'Date', headerStyle)
  putCell(ws, 12, 1, 'Hours', headerStyle)
  putCell(ws, 12, 3, 'Date', headerStyle)
  putCell(ws, 12, 4, 'Hours', headerStyle)

  const hourRows = Math.max(data.consumerWages.length, data.staffEvaluator.length, 1)
  for (let i = 0; i < hourRows; i++) {
    const row = 13 + i
    const consumer = data.consumerWages[i]
    const staff = data.staffEvaluator[i]
    putCell(ws, row, 0, consumer ? displayTableDate(consumer.date) : '', cellStyle)
    putCell(ws, row, 1, consumer ? consumer.hours : '', cellStyle)
    putCell(
      ws,
      row,
      3,
      staff && staff.hours != null ? displayTableDate(staff.date) : '',
      cellStyle,
    )
    putCell(ws, row, 4, staff?.hours != null ? staff.hours : '', cellStyle)
  }

  const totalRow = 13 + hourRows
  putCell(ws, totalRow, 0, 'Total:', totalLabelStyle)
  putCell(ws, totalRow, 1, data.consumerWagesTotal, totalValueStyle)
  putCell(ws, totalRow, 3, 'Total:', totalLabelStyle)
  putCell(ws, totalRow, 4, data.staffEvaluatorTotal, totalValueStyle)

  const reportTitleRow = totalRow + 2
  putCell(ws, reportTitleRow, 0, 'Comprehensive Report', sectionStyle)
  merge(reportTitleRow, 0, reportTitleRow, 4)

  const reportHeaderRow = reportTitleRow + 1
  putCell(ws, reportHeaderRow, 1, 'Date', headerStyle)
  putCell(ws, reportHeaderRow, 2, 'Units', headerStyle)

  const reportCount = Math.max(data.comprehensiveReport.length, 1)
  for (let i = 0; i < reportCount; i++) {
    const row = reportHeaderRow + 1 + i
    const entry = data.comprehensiveReport[i]
    putCell(ws, row, 1, entry ? displayTableDate(entry.date) : '', cellStyle)
    putCell(ws, row, 2, entry ? entry.units : '', cellStyle)
  }

  const reportTotalRow = reportHeaderRow + 1 + reportCount
  putCell(ws, reportTotalRow, 1, 'Total unit:', totalLabelStyle)
  putCell(ws, reportTotalRow, 2, data.comprehensiveReportTotal, totalValueStyle)

  const rowHeights: XLSX.RowInfo[] = []
  for (let row = 0; row <= reportTotalRow; row++) rowHeights[row] = { hpt: 18 }
  rowHeights[0] = { hpt: 24 }
  rowHeights[1] = { hpt: 8 }
  rowHeights[2] = { hpt: 26 }
  rowHeights[3] = { hpt: 20 }
  rowHeights[10] = { hpt: 10 }

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: reportTotalRow, c: 4 },
  })
  ws['!merges'] = merges
  ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 26 }, { wch: 16 }]
  ws['!rows'] = rowHeights
  ws['!pageSetup'] = {
    orientation: 'portrait',
    paperSize: 1,
    fitToWidth: 1,
    fitToHeight: 1,
  }
  ws['!margins'] = {
    left: 0.5,
    right: 0.5,
    top: 0.5,
    bottom: 0.5,
    header: 0.25,
    footer: 0.25,
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Tally Sheet')
  XLSX.writeFile(wb, `${safeFilename(participantName)}_tally_sheet.xlsx`)
}
