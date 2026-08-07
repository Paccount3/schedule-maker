import { useCallback, useState } from 'react'
import type { Coach, Participant, Shift } from '../types'
import {
  buildTallySheet,
  createEmptyHourRow,
  createEmptyStaffRow,
  createEmptyUnitRow,
  recalculateTallySheet,
  type TallySheetData,
  type TallySheetHourRow,
  type TallySheetStaffRow,
  type TallySheetUnitRow,
} from '../lib/tallySheet'
import { exportTallySheetExcel, exportTallySheetPdf } from '../lib/tallySheetExport'
import { Modal } from './Modal'

interface TallySheetModalProps {
  participant: Participant
  shifts: Shift[]
  coaches: Coach[]
  startDate: string
  endDate: string
  onClose: () => void
}

const paperInput =
  'w-full border-b border-slate-400 bg-transparent px-1 py-0.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none'

const paperInputSmall =
  'w-full border-b border-slate-400 bg-transparent px-0.5 py-0 text-xs text-slate-900 focus:border-blue-600 focus:outline-none'

const tableHeaderClass =
  'grid grid-cols-[1fr_72px_28px] gap-1 border-b-2 border-slate-800 pb-1 text-[10px] font-bold uppercase'

const tableRowClass =
  'grid grid-cols-[1fr_72px_28px] gap-1 border-b border-slate-400 py-1.5 text-xs'

export function TallySheetModal({
  participant,
  shifts,
  coaches,
  startDate,
  endDate,
  onClose,
}: TallySheetModalProps) {
  const [data, setData] = useState<TallySheetData>(() =>
    buildTallySheet(participant, shifts, coaches, startDate, endDate),
  )

  const applyData = useCallback((next: TallySheetData) => {
    setData(recalculateTallySheet(next))
  }, [])

  const updateField = (patch: Partial<TallySheetData>) => {
    applyData({ ...data, ...patch })
  }

  const updateConsumerRow = (index: number, patch: Partial<TallySheetHourRow>) => {
    const consumerWages = data.consumerWages.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    )
    applyData({ ...data, consumerWages })
  }

  const updateStaffRow = (index: number, patch: Partial<TallySheetStaffRow>) => {
    const staffEvaluator = data.staffEvaluator.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    )
    applyData({ ...data, staffEvaluator })
  }

  const updateReportRow = (index: number, patch: Partial<TallySheetUnitRow>) => {
    const comprehensiveReport = data.comprehensiveReport.map((row, i) =>
      i === index ? { ...row, ...patch } : row,
    )
    applyData({ ...data, comprehensiveReport })
  }

  const participantName = participant.name || 'participant'

  return (
    <Modal
      wide
      extraWide
      title="Generate Tally Sheet"
      subtitle={`${participantName} · ${startDate} – ${endDate}`}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            Consumer hours:{' '}
            <span className="font-semibold tabular-nums text-slate-200">
              {data.consumerWagesTotal.toFixed(2)}
            </span>
            {' · '}
            Staff hours:{' '}
            <span className="font-semibold tabular-nums text-slate-200">
              {data.staffEvaluatorTotal.toFixed(2)}
            </span>
            {' · '}
            Report units:{' '}
            <span className="font-semibold tabular-nums text-slate-200">
              {data.comprehensiveReportTotal.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportTallySheetPdf(data, participantName)}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => exportTallySheetExcel(data, participantName)}
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
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <TallySheetPreview
          data={data}
          onFieldChange={updateField}
          onConsumerRowChange={updateConsumerRow}
          onStaffRowChange={updateStaffRow}
          onReportRowChange={updateReportRow}
          onAddConsumerRow={() =>
            applyData({ ...data, consumerWages: [...data.consumerWages, createEmptyHourRow()] })
          }
          onAddStaffRow={() =>
            applyData({
              ...data,
              staffEvaluator: [...data.staffEvaluator, createEmptyStaffRow()],
            })
          }
          onAddReportRow={() =>
            applyData({
              ...data,
              comprehensiveReport: [...data.comprehensiveReport, createEmptyUnitRow()],
            })
          }
          onRemoveConsumerRow={(index) =>
            applyData({
              ...data,
              consumerWages: data.consumerWages.filter((_, i) => i !== index),
            })
          }
          onRemoveStaffRow={(index) =>
            applyData({
              ...data,
              staffEvaluator: data.staffEvaluator.filter((_, i) => i !== index),
            })
          }
          onRemoveReportRow={(index) =>
            applyData({
              ...data,
              comprehensiveReport: data.comprehensiveReport.filter((_, i) => i !== index),
            })
          }
        />
      </div>
    </Modal>
  )
}

function TallySheetPreview({
  data,
  onFieldChange,
  onConsumerRowChange,
  onStaffRowChange,
  onReportRowChange,
  onAddConsumerRow,
  onAddStaffRow,
  onAddReportRow,
  onRemoveConsumerRow,
  onRemoveStaffRow,
  onRemoveReportRow,
}: {
  data: TallySheetData
  onFieldChange: (patch: Partial<TallySheetData>) => void
  onConsumerRowChange: (index: number, patch: Partial<TallySheetHourRow>) => void
  onStaffRowChange: (index: number, patch: Partial<TallySheetStaffRow>) => void
  onReportRowChange: (index: number, patch: Partial<TallySheetUnitRow>) => void
  onAddConsumerRow: () => void
  onAddStaffRow: () => void
  onAddReportRow: () => void
  onRemoveConsumerRow: (index: number) => void
  onRemoveStaffRow: (index: number) => void
  onRemoveReportRow: (index: number) => void
}) {
  return (
    <div className="mx-auto max-w-4xl rounded-lg border-4 border-double border-slate-700 bg-white p-8 text-slate-900 shadow-inner">
      <div className="flex justify-end">
        <label className="flex items-center gap-2 text-sm font-bold">
          Authorization #:
          <input
            className={`${paperInput} max-w-[140px] font-mono tracking-wider`}
            value={data.authNumber}
            onChange={(e) => onFieldChange({ authNumber: e.target.value })}
            maxLength={11}
          />
        </label>
      </div>

      <h4 className="mt-4 text-center text-lg font-bold tracking-wide">TALLY SHEET</h4>
      <input
        className={`${paperInput} mx-auto mt-2 block max-w-md text-center text-base font-bold`}
        value={data.serviceLabel}
        onChange={(e) => onFieldChange({ serviceLabel: e.target.value })}
      />

      <div className="mt-6 space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="shrink-0 font-bold">Consumers Name:</span>
          <input
            className={paperInput}
            value={data.consumerName}
            onChange={(e) => onFieldChange({ consumerName: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="shrink-0 font-bold">Staff Name:</span>
          <input
            className={paperInput}
            value={data.staffName}
            onChange={(e) => onFieldChange({ staffName: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="shrink-0 font-bold">DORS Counselor:</span>
          <input
            className={paperInput}
            value={data.dorsCounselor}
            onChange={(e) => onFieldChange({ dorsCounselor: e.target.value })}
          />
        </label>
      </div>

      <p className="mt-4 text-xs text-slate-600">(Period of time authorization is covered)</p>
      <p className="mt-2 text-center text-sm font-bold tabular-nums">
        From: {data.periodFromLabel} &nbsp;&nbsp; To: {data.periodToLabel}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h5 className="mb-2 text-center text-sm font-bold">Consumer Wages</h5>
          <div className={tableHeaderClass}>
            <span>Date</span>
            <span>Hours</span>
            <span />
          </div>
          {data.consumerWages.length === 0 ? (
            <p className="py-3 text-xs text-slate-500">No wage entries yet.</p>
          ) : (
            data.consumerWages.map((row, index) => (
              <div key={`consumer-${index}`} className={tableRowClass}>
                <span className="pt-1 tabular-nums">{row.dateLabel}</span>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  className={paperInputSmall}
                  value={row.hours}
                  onChange={(e) =>
                    onConsumerRowChange(index, { hours: Number(e.target.value) || 0 })
                  }
                />
                <button
                  type="button"
                  onClick={() => onRemoveConsumerRow(index)}
                  className="text-[10px] text-red-600 hover:text-red-800"
                  title="Remove row"
                >
                  ×
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={onAddConsumerRow}
            className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-900"
          >
            + Add row
          </button>
          <p className="mt-3 text-sm font-bold">
            Total: <span className="tabular-nums">{data.consumerWagesTotal.toFixed(2)}</span>
          </p>
        </section>

        <section>
          <h5 className="mb-2 text-center text-sm font-bold">Staff On-Site Evaluator</h5>
          <div className={tableHeaderClass}>
            <span>Date</span>
            <span>Hours</span>
            <span />
          </div>
          {data.staffEvaluator.length === 0 ? (
            <p className="py-3 text-xs text-slate-500">No evaluator entries yet.</p>
          ) : (
            data.staffEvaluator.map((row, index) => (
              <div key={`staff-${index}`} className={tableRowClass}>
                <span className="pt-1 tabular-nums">{row.dateLabel}</span>
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  className={paperInputSmall}
                  value={row.hours ?? ''}
                  placeholder="—"
                  onChange={(e) => {
                    const value = e.target.value
                    onStaffRowChange(index, {
                      hours: value === '' ? null : Number(value) || 0,
                    })
                  }}
                />
                <button
                  type="button"
                  onClick={() => onRemoveStaffRow(index)}
                  className="text-[10px] text-red-600 hover:text-red-800"
                  title="Remove row"
                >
                  ×
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={onAddStaffRow}
            className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-900"
          >
            + Add row
          </button>
          <p className="mt-3 text-sm font-bold">
            Total: <span className="tabular-nums">{data.staffEvaluatorTotal.toFixed(2)}</span>
          </p>
        </section>
      </div>

      <section className="mx-auto mt-8 max-w-sm">
        <h5 className="mb-2 text-center text-sm font-bold">Comprehensive Report</h5>
        <div className={tableHeaderClass}>
          <span>Date</span>
          <span>Units</span>
          <span />
        </div>
        {data.comprehensiveReport.length === 0 ? (
          <p className="py-3 text-xs text-slate-500">No report entries yet.</p>
        ) : (
          data.comprehensiveReport.map((row, index) => (
            <div key={`report-${index}`} className={tableRowClass}>
              <span className="pt-1 tabular-nums">{row.dateLabel}</span>
              <input
                type="number"
                min={0}
                step={1}
                className={paperInputSmall}
                value={row.units}
                onChange={(e) =>
                  onReportRowChange(index, { units: Number(e.target.value) || 0 })
                }
              />
              <button
                type="button"
                onClick={() => onRemoveReportRow(index)}
                className="text-[10px] text-red-600 hover:text-red-800"
                title="Remove row"
              >
                ×
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          onClick={onAddReportRow}
          className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-900"
        >
          + Add row
        </button>
        <p className="mt-3 text-center text-sm font-bold">
          Total unit:{' '}
          <span className="tabular-nums">{data.comprehensiveReportTotal.toFixed(2)}</span>
        </p>
      </section>
    </div>
  )
}
