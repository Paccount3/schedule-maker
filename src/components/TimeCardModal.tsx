import { useCallback, useMemo, useState } from 'react'
import type { Participant, Shift } from '../types'
import {
  applyCheckRequestHoursEdit,
  buildTimeCardBundle,
  combinedTimeCardTotals,
  recalculateTimeCardBundle,
  type CheckRequestFormData,
  type TimeCardBundle,
  type TimeCardDayEntry,
  type WeeklyTimeCardData,
} from '../lib/timeCard'
import {
  exportReportExcel,
  exportReportPdf,
} from '../lib/timeCardExport'
import { Modal } from './Modal'

interface TimeCardModalProps {
  participant: Participant
  shifts: Shift[]
  startDate: string
  endDate: string
  onClose: () => void
}

const paperInput =
  'w-full border-b border-slate-400 bg-transparent px-1 py-0.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none'

const paperInputSmall =
  'w-full border-b border-slate-400 bg-transparent px-0.5 py-0 text-xs text-slate-900 focus:border-blue-600 focus:outline-none'

const signatureScriptClass =
  "font-['Segoe_Script','Brush_Script_MT','Lucida_Handwriting',cursive] text-2xl leading-none text-slate-800"

function SignatureField({
  printedLabel,
  printedValue,
  signatureValue,
  onPrintedChange,
  onSignatureChange,
}: {
  printedLabel: string
  printedValue: string
  signatureValue: string
  onPrintedChange: (value: string) => void
  onSignatureChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        {printedLabel}
        <input
          className={`${paperInput} mt-1 font-sans text-sm`}
          value={printedValue}
          onChange={(e) => onPrintedChange(e.target.value)}
          placeholder="Printed name"
        />
      </label>
      <label className="block text-sm">
        Signature
        <input
          className={`${paperInput} mt-1 ${signatureScriptClass} text-xl`}
          value={signatureValue}
          onChange={(e) => onSignatureChange(e.target.value)}
          placeholder="Signature"
        />
        <div className={`mt-2 min-h-[2rem] border-b border-slate-400 pb-1 ${signatureScriptClass}`}>
          {signatureValue || printedValue || '\u00A0'}
        </div>
      </label>
    </div>
  )
}

export function TimeCardModal({
  participant,
  shifts,
  startDate,
  endDate,
  onClose,
}: TimeCardModalProps) {
  const [bundle, setBundle] = useState<TimeCardBundle>(() =>
    buildTimeCardBundle(participant, shifts, startDate, endDate),
  )

  const totals = useMemo(
    () => combinedTimeCardTotals(bundle.weeklyCards),
    [bundle.weeklyCards],
  )

  const applyBundle = useCallback((next: TimeCardBundle) => {
    setBundle(recalculateTimeCardBundle(next))
  }, [])

  const updateCheck = (patch: Partial<CheckRequestFormData>) => {
    setBundle((prev) => {
      let next: TimeCardBundle = { ...prev, checkRequest: { ...prev.checkRequest, ...patch } }
      if ('totalHours' in patch) {
        return applyCheckRequestHoursEdit(next, Number(patch.totalHours) || 0)
      }
      if ('wageRate' in patch) {
        return recalculateTimeCardBundle(next)
      }
      return next
    })
  }

  const updateWageRate = (wageRate: number) => {
    applyBundle({
      ...bundle,
      checkRequest: { ...bundle.checkRequest, wageRate: Number.isFinite(wageRate) ? wageRate : 0 },
    })
  }

  const updateCard = (cardIndex: number, card: WeeklyTimeCardData) => {
    const weeklyCards = bundle.weeklyCards.map((c, i) => (i === cardIndex ? card : c))
    applyBundle({ ...bundle, weeklyCards })
  }

  const updateDay = (
    cardIndex: number,
    dayIndex: number,
    patch: Partial<TimeCardDayEntry>,
  ) => {
    const card = bundle.weeklyCards[cardIndex]
    const days = card.days.map((d, i) => {
      if (i !== dayIndex) return d
      const next = { ...d, ...patch }
      if ('hours' in patch) {
        next.payAmount = Math.round(next.hours * bundle.checkRequest.wageRate * 100) / 100
      }
      if ('payAmount' in patch) {
        next.payAmount = Number(patch.payAmount) || 0
      }
      return next
    })
    const hoursTotal = Math.round(days.reduce((s, d) => s + d.hours, 0) * 100) / 100
    const payTotal = Math.round(days.reduce((s, d) => s + d.payAmount, 0) * 100) / 100
    applyBundle({
      ...bundle,
      weeklyCards: bundle.weeklyCards.map((c, i) =>
        i === cardIndex ? { ...card, days, hoursTotal, payTotal } : c,
      ),
    })
  }

  const participantName = participant.name || 'participant'

  return (
    <Modal
      wide
      extraWide
      title="Generate Report"
      subtitle={`${participantName} · ${startDate} – ${endDate}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <label className="flex items-center gap-2">
              Wage rate ($/hr)
              <input
                type="number"
                min={0}
                step={0.01}
                value={bundle.checkRequest.wageRate}
                onChange={(e) => updateWageRate(Number(e.target.value))}
                className="w-24 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm tabular-nums text-slate-100"
              />
            </label>
            <label className="flex items-center gap-2">
              Total hours
              <input
                type="number"
                min={0}
                step={0.25}
                value={bundle.checkRequest.totalHours}
                onChange={(e) => updateCheck({ totalHours: Number(e.target.value) || 0 })}
                className="w-24 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm tabular-nums text-slate-100"
              />
            </label>
            <span className="text-slate-500">
              {bundle.weeklyCards.length} weekly time card
              {bundle.weeklyCards.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportReportPdf(bundle, participantName)}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => exportReportExcel(bundle, participantName)}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Export Excel
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <div className="max-h-[70vh] space-y-8 overflow-y-auto pr-1">
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-300">Check Request Form</h3>
          <CheckRequestPreview data={bundle.checkRequest} onChange={updateCheck} />
        </section>
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-300">
            Weekly Time Cards ({bundle.weeklyCards.length})
          </h3>
          <WeeklyCardsPreview
            cards={bundle.weeklyCards}
            wageRate={bundle.checkRequest.wageRate}
            totals={totals}
            onUpdateDay={updateDay}
            onUpdateCard={updateCard}
          />
        </section>
      </div>
    </Modal>
  )
}

function CheckRequestPreview({
  data,
  onChange,
}: {
  data: CheckRequestFormData
  onChange: (patch: Partial<CheckRequestFormData>) => void
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg border-4 border-double border-slate-700 bg-white p-8 text-slate-900 shadow-inner">
      <p className="text-center text-sm font-bold">Goodwill Western &amp; Northern Connecticut</p>
      <h4 className="mt-2 text-center text-base font-bold tracking-wide">
        PETTY CASH / CHECK REQUEST FORM
      </h4>
      <div className="mt-4 flex justify-end text-sm">
        <span className="mr-2">Date:</span>
        <input
          className={`${paperInput} max-w-[120px]`}
          value={data.formDate}
          onChange={(e) => onChange({ formDate: e.target.value })}
        />
      </div>
      <p className="mt-6 text-sm">
        PLEASE ISSUE PETTY CASH / CHECK IN THE AMOUNT OF{' '}
        <input
          className={`${paperInput} inline-block max-w-[100px]`}
          value={data.amount.toFixed(2)}
          onChange={(e) => onChange({ amount: Number(e.target.value) || 0 })}
        />
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex gap-2">
          <span className="shrink-0">To: Name:</span>
          <input
            className={paperInput}
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <input
          className={paperInput}
          value={data.address1}
          onChange={(e) => onChange({ address1: e.target.value })}
          placeholder="Address line 1"
        />
        <input
          className={paperInput}
          value={data.address2}
          onChange={(e) => onChange({ address2: e.target.value })}
          placeholder="City, State ZIP"
        />
        <div className="flex gap-2">
          <span className="shrink-0">Authorization No.:</span>
          <input
            className={`${paperInput} max-w-[140px] font-mono tracking-wider`}
            value={data.authNumber}
            onChange={(e) => onChange({ authNumber: e.target.value })}
            maxLength={11}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">
          Wage rate ($/hr)
          <input
            type="number"
            min={0}
            step={0.01}
            className={`${paperInput} mt-1 tabular-nums`}
            value={data.wageRate}
            onChange={(e) => onChange({ wageRate: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="text-sm">
          Total hours
          <input
            type="number"
            min={0}
            step={0.25}
            className={`${paperInput} mt-1 tabular-nums`}
            value={data.totalHours}
            onChange={(e) => onChange({ totalHours: Number(e.target.value) || 0 })}
          />
        </label>
        <div className="flex items-end text-sm text-slate-600">
          Amount updates from hours × rate
        </div>
      </div>
      <div className="mt-6">
        <p className="text-sm font-bold">REASON:</p>
        <textarea
          className="mt-2 w-full resize-y border border-slate-400 bg-transparent p-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          rows={3}
          value={data.reason}
          onChange={(e) => onChange({ reason: e.target.value })}
        />
      </div>
      <div className="mt-6 grid gap-3 border border-slate-500 p-4 text-sm sm:grid-cols-2">
        <label className="block">
          Return Check to
          <input
            className={`${paperInput} mt-1`}
            value={data.returnCheckTo}
            onChange={(e) => onChange({ returnCheckTo: e.target.value })}
            placeholder="Leave blank"
          />
        </label>
        <label className="block">
          Voucher No.
          <input
            className={`${paperInput} mt-1`}
            value={data.voucherNo}
            onChange={(e) => onChange({ voucherNo: e.target.value })}
            placeholder="Leave blank"
          />
        </label>
        <label className="block">
          Charge Account
          <input
            className={`${paperInput} mt-1`}
            value={data.chargeAccount}
            onChange={(e) => onChange({ chargeAccount: e.target.value })}
          />
        </label>
        <label className="block">
          Mail by Date
          <input
            className={`${paperInput} mt-1`}
            value={data.mailByDate}
            onChange={(e) => onChange({ mailByDate: e.target.value })}
          />
        </label>
        <div className="sm:col-span-2">
          <SignatureField
            printedLabel="Requested by (printed)"
            printedValue={data.requestedBy}
            signatureValue={data.requestedBySignature}
            onPrintedChange={(requestedBy) => onChange({ requestedBy })}
            onSignatureChange={(requestedBySignature) => onChange({ requestedBySignature })}
          />
        </div>
      </div>
    </div>
  )
}

function WeeklyCardsPreview({
  cards,
  wageRate,
  totals,
  onUpdateDay,
  onUpdateCard,
}: {
  cards: WeeklyTimeCardData[]
  wageRate: number
  totals: { totalHours: number; totalPay: number }
  onUpdateDay: (cardIndex: number, dayIndex: number, patch: Partial<TimeCardDayEntry>) => void
  onUpdateCard: (cardIndex: number, card: WeeklyTimeCardData) => void
}) {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-slate-500">No weeks fall within the selected date range.</p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {cards.map((card, cardIndex) => (
          <div
            key={card.weekStart}
            className="rounded-lg border-2 border-slate-600 bg-white p-4 text-slate-900"
          >
            <div className="mb-3 border-b border-slate-300 pb-2">
              <h4 className="text-sm font-bold text-slate-900">{card.weekLabel}</h4>
              <p className="text-xs text-slate-600">
                Time card {card.weekIndex} of {card.weekCount}
              </p>
            </div>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2 text-xs">
              <label className="flex items-center gap-1">
                No.
                <input
                  className={`${paperInputSmall} w-12`}
                  value={card.cardNumber}
                  onChange={(e) =>
                    onUpdateCard(cardIndex, { ...card, cardNumber: e.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-1">
                Week Ending
                <input
                  className={`${paperInputSmall} w-24`}
                  value={card.weekEnding}
                  onChange={(e) =>
                    onUpdateCard(cardIndex, { ...card, weekEnding: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="mb-3 flex items-center gap-2 text-sm">
              Name
              <input
                className={paperInput}
                value={card.name}
                onChange={(e) => onUpdateCard(cardIndex, { ...card, name: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-[1fr_52px_52px_48px_56px] gap-1 border-b-2 border-slate-800 pb-1 text-[10px] font-bold uppercase">
              <span>Day</span>
              <span>IN</span>
              <span>OUT</span>
              <span>Hrs</span>
              <span>Pay $</span>
            </div>
            {card.days.map((day, dayIndex) => (
              <div
                key={day.date}
                className="grid grid-cols-[1fr_52px_52px_48px_56px] gap-1 border-b-4 border-slate-900 py-1.5 text-xs"
              >
                <span className="pt-1">
                  {day.dayLabel} {day.dateLabel}
                </span>
                <input
                  className={paperInputSmall}
                  value={day.inTime}
                  onChange={(e) =>
                    onUpdateDay(cardIndex, dayIndex, { inTime: e.target.value })
                  }
                />
                <input
                  className={paperInputSmall}
                  value={day.outTime}
                  onChange={(e) =>
                    onUpdateDay(cardIndex, dayIndex, { outTime: e.target.value })
                  }
                />
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  className={paperInputSmall}
                  value={day.hours}
                  onChange={(e) =>
                    onUpdateDay(cardIndex, dayIndex, {
                      hours: Number(e.target.value) || 0,
                    })
                  }
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={paperInputSmall}
                  value={day.payAmount}
                  onChange={(e) =>
                    onUpdateDay(cardIndex, dayIndex, {
                      payAmount: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm font-bold">
              <div>
                Hours Total{' '}
                <span className="tabular-nums">{card.hoursTotal.toFixed(2)}</span>
              </div>
              <div>
                Pay Total ${' '}
                <span className="tabular-nums">{card.payTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {cards.length > 1 && (
        <div className="rounded-md border border-slate-700 bg-slate-800/50 px-4 py-3 text-center text-sm text-slate-300">
          Combined total ({cards.length} weeks):{' '}
          <span className="font-semibold tabular-nums text-slate-100">
            {totals.totalHours.toFixed(2)} hrs
          </span>{' '}
          · Pay ${' '}
          <span className="font-semibold tabular-nums text-slate-100">
            {totals.totalPay.toFixed(2)}
          </span>{' '}
          <span className="text-slate-500">(@ ${wageRate.toFixed(2)}/hr)</span>
        </div>
      )}
    </div>
  )
}
