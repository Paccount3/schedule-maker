import { useStore } from '../store/useStore'
import { formatWeekLabel } from '../lib/time'
import { playSound } from '../lib/sounds'
import { SettingsMenu } from './SettingsMenu'

export function MobileTopBar() {
  const { state, setSelectedRegionId, prevWeek, nextWeek, goToToday } = useStore()

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 md:hidden">
      <div className="flex items-center justify-between gap-2">
        <h1 className="truncate text-sm font-semibold tracking-tight text-slate-100">
          Schedule Maker Pro
        </h1>
        <SettingsMenu />
      </div>

      <label className="block">
        <span className="sr-only">Region</span>
        <select
          value={state.selectedRegionId}
          onChange={(e) => setSelectedRegionId(e.target.value)}
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {state.regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            playSound('weekNav')
            prevWeek()
          }}
          className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-300"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => {
            playSound('weekNav')
            goToToday()
          }}
          className="min-w-0 flex-1 truncate rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm font-medium text-slate-200"
        >
          {formatWeekLabel(state.weekStart)}
        </button>
        <button
          type="button"
          onClick={() => {
            playSound('weekNav')
            nextWeek()
          }}
          className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-300"
        >
          →
        </button>
      </div>
      <p className="text-[10px] text-slate-500">Pinch to zoom · tap a shift for details</p>
    </div>
  )
}
