import { useEffect, useRef, useState } from 'react'
import { loadOnCallPhone, saveOnCallPhone } from '../lib/scheduleWriteupSettings'

const inputClass =
  'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export function useOnCallPhone(regionId: string, weekStart: string): [string, (value: string) => void] {
  const [onCallPhone, setOnCallPhone] = useState('')
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    window.clearTimeout(saveTimer.current)
    setOnCallPhone('')
    void loadOnCallPhone(regionId, weekStart)
      .then((phone) => {
        if (!cancelled) setOnCallPhone(phone)
      })
      .catch((error) => {
        console.error('loadOnCallPhone', error)
      })
    return () => {
      cancelled = true
      window.clearTimeout(saveTimer.current)
    }
  }, [regionId, weekStart])

  const updateOnCallPhone = (value: string) => {
    setOnCallPhone(value)
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void saveOnCallPhone(regionId, weekStart, value).catch((error) => {
        console.error('saveOnCallPhone', error)
      })
    }, 400)
  }

  return [onCallPhone, updateOnCallPhone]
}

interface OnCallPhoneFieldProps {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function OnCallPhoneField({ value, onChange, readOnly = false }: OnCallPhoneFieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">Include On Call Phone Number</span>
      <input
        type="tel"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        placeholder="On call phone number for this week"
        className={`${inputClass} mt-1 ${readOnly ? 'cursor-default opacity-80' : ''}`}
      />
    </label>
  )
}
