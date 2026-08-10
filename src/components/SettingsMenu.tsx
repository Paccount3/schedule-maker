import { useEffect, useRef, useState } from 'react'
import { useSettings } from '../store/useSettings'

export function SettingsMenu() {
  const { settings, setSoundsFxEnabled } = useSettings()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100"
        aria-expanded={open}
        aria-haspopup="true"
      >
        Settings
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-slate-700 bg-slate-900 py-2 shadow-xl">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Preferences
          </p>
          <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70">
            <input
              type="checkbox"
              checked={settings.soundsFxEnabled}
              onChange={(event) => setSoundsFxEnabled(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40"
            />
            Sounds/FX
          </label>
        </div>
      )}
    </div>
  )
}
