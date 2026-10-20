import { useState } from 'react'
import {
  copyScheduleWriteupImage,
  downloadScheduleWriteupJpg,
  type ScheduleImageOptions,
} from '../lib/scheduleWriteupImage'

interface CopyScheduleImageButtonProps extends ScheduleImageOptions {
  filename: string
  disabled?: boolean
}

export function CopyScheduleImageButton({
  writeup,
  scheduleKind,
  personName,
  regionLabel,
  weekLabel,
  filename,
  disabled,
}: CopyScheduleImageButtonProps) {
  const [label, setLabel] = useState('Copy image')
  const options: ScheduleImageOptions = {
    writeup,
    scheduleKind,
    personName,
    regionLabel,
    weekLabel,
  }

  const copy = async () => {
    if (!writeup || disabled) return
    try {
      await copyScheduleWriteupImage(options)
      setLabel('Copied!')
    } catch {
      downloadScheduleWriteupJpg(options, filename)
      setLabel('Saved image')
    }
    window.setTimeout(() => setLabel('Copy image'), 1500)
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={disabled || !writeup}
      className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}
