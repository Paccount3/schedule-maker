import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import type { TallySheetData } from './tallySheet'

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

export function exportTallySheetExcel(data: TallySheetData, participantName: string): void {
  const rows: (string | number)[][] = [
    ['TALLY SHEET'],
    [data.serviceLabel],
    ['Authorization #', data.authNumber],
    ['Consumers Name', data.consumerName],
    ['Staff Name', data.staffName],
    ['DORS Counselor', data.dorsCounselor],
    ['Period From', data.periodFromLabel],
    ['Period To', data.periodToLabel],
    [],
    ['Consumer Wages'],
    ['Date', 'Hours'],
  ]

  for (const row of data.consumerWages) {
    rows.push([row.dateLabel, row.hours])
  }
  rows.push(['Total', data.consumerWagesTotal])
  rows.push([])
  rows.push(['Staff On-Site Evaluator'])
  rows.push(['Date', 'Hours'])

  for (const row of data.staffEvaluator) {
    rows.push([row.dateLabel, row.hours ?? ''])
  }
  rows.push(['Total', data.staffEvaluatorTotal])
  rows.push([])
  rows.push(['Comprehensive Report'])
  rows.push(['Date', 'Units'])

  for (const row of data.comprehensiveReport) {
    rows.push([row.dateLabel, row.units])
  }
  rows.push(['Total unit', data.comprehensiveReportTotal])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Tally Sheet')
  XLSX.writeFile(wb, `${safeFilename(participantName)}_tally_sheet.xlsx`)
}
