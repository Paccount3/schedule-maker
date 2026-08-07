import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import type { CheckRequestFormData, TimeCardBundle, WeeklyTimeCardData } from './timeCard'

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_') || 'participant'
}

function drawScriptSignature(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  if (!text.trim()) return
  doc.setFont('times', 'italic')
  doc.setFontSize(16)
  const lines = doc.splitTextToSize(text, maxWidth)
  doc.text(lines, x, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
}

function drawCheckRequestPage(doc: jsPDF, data: CheckRequestFormData): void {
  const margin = 48
  let y = margin

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Goodwill Western & Northern Connecticut', 306, y, { align: 'center' })
  y += 18
  doc.setFontSize(14)
  doc.text('PETTY CASH / CHECK REQUEST FORM', 306, y, { align: 'center' })
  y += 24

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Date: ${data.formDate}`, 520, margin)

  y += 10
  doc.text('PLEASE ISSUE PETTY CASH / CHECK IN THE AMOUNT OF', margin, y)
  doc.text(`$${data.amount.toFixed(2)}`, margin + 320, y)
  y += 22

  doc.text(`To: Name: ${data.name}`, margin, y)
  y += 16
  if (data.address1) {
    doc.text(data.address1, margin + 40, y)
    y += 14
  } else {
    doc.text('_________________________________________', margin + 40, y)
    y += 14
  }
  if (data.address2) {
    doc.text(data.address2, margin + 40, y)
    y += 14
  } else {
    doc.text('_________________________________________', margin + 40, y)
    y += 14
  }
  y += 4
  doc.text(`Authorization No.: ${data.authNumber}`, margin, y)
  y += 22

  doc.setFont('helvetica', 'bold')
  doc.text('REASON:', margin, y)
  doc.setFont('helvetica', 'normal')
  y += 16
  const reasonLines = doc.splitTextToSize(data.reason, 500)
  doc.text(reasonLines, margin, y)
  y += reasonLines.length * 14 + 20

  doc.rect(margin, y, 516, 130)
  doc.text(
    `Return Check to ${data.returnCheckTo || '_________________________'}`,
    margin + 10,
    y + 20,
  )
  doc.text(
    `Charge Account: ${data.chargeAccount || '_________________________'}`,
    margin + 10,
    y + 40,
  )
  doc.text(`Voucher No. ${data.voucherNo || '_________________________'}`, margin + 10, y + 60)
  doc.text('or Mail _________________________', margin + 280, y + 20)
  doc.text(`by Date: ${data.mailByDate || '_________________________'}`, margin + 280, y + 40)
  doc.text('Time _________________________', margin + 280, y + 60)
  doc.text(
    `Requested by: ${data.requestedBy || '_________________________'}`,
    margin + 10,
    y + 88,
  )
  if (data.requestedBySignature) {
    drawScriptSignature(doc, data.requestedBySignature, margin + 90, y + 108, 180)
  } else {
    doc.text('Signature: _________________________', margin + 10, y + 108)
  }
  doc.text('Approved by: _________________________', margin + 280, y + 108)
}

export function exportCheckRequestPdf(data: CheckRequestFormData, participantName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  drawCheckRequestPage(doc, data)
  doc.save(`${safeFilename(participantName)}_check_request.pdf`)
}

function drawWeeklyCard(
  doc: jsPDF,
  card: WeeklyTimeCardData,
  x: number,
  y: number,
  width: number,
): number {
  const rowH = 20
  const textBaselineOffset = 13

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(card.weekLabel, x, y)
  y += 14
  doc.setFontSize(8)
  doc.text(`Time Card ${card.weekIndex} of ${card.weekCount}`, x, y)
  y += 12
  doc.setFontSize(9)
  doc.text(`No. ${card.cardNumber || '___'}`, x, y)
  doc.text(`Week Ending ${card.weekEnding}`, x + width - 120, y)
  y += 14
  doc.text(`Name: ${card.name}`, x, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Day / Date', x, y)
  doc.text('IN', x + width * 0.42, y)
  doc.text('OUT', x + width * 0.55, y)
  doc.text('hours', x + width * 0.7, y)
  doc.text('pay $', x + width * 0.82, y)
  y += 6
  doc.setLineWidth(0.5)
  doc.line(x, y, x + width, y)
  y += rowH

  for (const day of card.days) {
    const textY = y - rowH + textBaselineOffset
    doc.text(`${day.dayLabel} ${day.dateLabel}`, x, textY)
    doc.text(day.inTime || '—', x + width * 0.42, textY)
    doc.text(day.outTime || '—', x + width * 0.55, textY)
    doc.text(day.hours > 0 ? day.hours.toFixed(2) : '0.00', x + width * 0.7, textY)
    doc.text(day.payAmount > 0 ? day.payAmount.toFixed(2) : '-', x + width * 0.82, textY)
    doc.setDrawColor(0)
    doc.setLineWidth(1.5)
    doc.line(x, y, x + width, y)
    y += rowH
  }

  y += 8
  doc.setFont('helvetica', 'bold')
  doc.text('Hours Total', x + width * 0.42, y)
  doc.text(card.hoursTotal.toFixed(2), x + width * 0.7, y)
  y += 16
  doc.text('Pay Amount Total $', x + width * 0.42, y)
  doc.text(card.payTotal.toFixed(2), x + width * 0.82, y)

  return y + 8
}

export function exportTimeCardsPdf(bundle: TimeCardBundle, participantName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' })
  appendTimeCardsToPdf(doc, bundle)
  doc.save(`${safeFilename(participantName)}_time_cards.pdf`)
}

function appendTimeCardsToPdf(doc: jsPDF, bundle: TimeCardBundle): void {
  const margin = 36
  const cardWidth = 360

  for (let i = 0; i < bundle.weeklyCards.length; i += 2) {
    if (i > 0) doc.addPage('letter', 'landscape')
    const left = bundle.weeklyCards[i]
    const right = bundle.weeklyCards[i + 1]

    drawWeeklyCard(doc, left, margin, margin, cardWidth)
    if (right) {
      drawWeeklyCard(doc, right, margin + cardWidth + 24, margin, cardWidth)
    }
  }

  const { totalHours, totalPay } = bundle.weeklyCards.reduce(
    (acc, c) => ({
      totalHours: acc.totalHours + c.hoursTotal,
      totalPay: acc.totalPay + c.payTotal,
    }),
    { totalHours: 0, totalPay: 0 },
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`Total Hrs: ${totalHours.toFixed(2)}`, 400, doc.internal.pageSize.getHeight() - 36)
  doc.text(
    `Pay Amount Total $: ${totalPay.toFixed(2)}`,
    520,
    doc.internal.pageSize.getHeight() - 36,
  )
}

export function exportReportPdf(bundle: TimeCardBundle, participantName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  drawCheckRequestPage(doc, bundle.checkRequest)

  if (bundle.weeklyCards.length > 0) {
    doc.addPage('letter', 'landscape')
    appendTimeCardsToPdf(doc, bundle)
  }

  doc.save(`${safeFilename(participantName)}_report.pdf`)
}

export function exportCheckRequestExcel(data: CheckRequestFormData, participantName: string): void {
  const wb = XLSX.utils.book_new()
  appendCheckRequestSheet(wb, data)
  XLSX.writeFile(wb, `${safeFilename(participantName)}_check_request.xlsx`)
}

function appendCheckRequestSheet(wb: XLSX.WorkBook, data: CheckRequestFormData): void {
  const rows = [
    ['Goodwill Western & Northern Connecticut'],
    ['PETTY CASH / CHECK REQUEST FORM'],
    [],
    ['Date', data.formDate],
    ['Amount', data.amount],
    ['Name', data.name],
    ['Address 1', data.address1],
    ['Address 2', data.address2],
    ['Authorization No.', data.authNumber],
    ['Service', data.service],
    ['Wage Rate', data.wageRate],
    ['Total Hours', data.totalHours],
    ['Reason', data.reason],
    ['Return Check To', data.returnCheckTo],
    ['Voucher No.', data.voucherNo],
    ['Charge Account', data.chargeAccount],
    ['Requested By (Printed)', data.requestedBy],
    ['Requested By (Signature)', data.requestedBySignature],
    ['Mail By Date', data.mailByDate],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 24 }, { wch: 48 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Check Request')
}

export function exportTimeCardsExcel(bundle: TimeCardBundle, participantName: string): void {
  const wb = XLSX.utils.book_new()
  appendTimeCardSheets(wb, bundle)
  XLSX.writeFile(wb, `${safeFilename(participantName)}_time_cards.xlsx`)
}

function appendTimeCardSheets(wb: XLSX.WorkBook, bundle: TimeCardBundle): void {
  for (const card of bundle.weeklyCards) {
    const rows: (string | number)[][] = [
      ['Week', card.weekLabel],
      ['Time Card', `${card.weekIndex} of ${card.weekCount}`],
      ['No.', card.cardNumber],
      ['Week Ending', card.weekEnding],
      ['Name', card.name],
      [],
      ['Day', 'Date', 'IN', 'OUT', 'Hours', 'Pay Amount'],
    ]

    for (const day of card.days) {
      rows.push([
        day.dayLabel,
        day.dateLabel,
        day.inTime,
        day.outTime,
        day.hours,
        day.payAmount,
      ])
    }

    rows.push([])
    rows.push(['Hours Total', '', '', '', card.hoursTotal, ''])
    rows.push(['Pay Total', '', '', '', '', card.payTotal])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }]
    const sheetName = `Week ${card.weekEnding}`.slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }
}

export function exportReportExcel(bundle: TimeCardBundle, participantName: string): void {
  const wb = XLSX.utils.book_new()
  appendCheckRequestSheet(wb, bundle.checkRequest)
  appendTimeCardSheets(wb, bundle)
  XLSX.writeFile(wb, `${safeFilename(participantName)}_report.xlsx`)
}
