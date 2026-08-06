import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  disabled?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }

    const timer = window.setTimeout(() => {
      window.addEventListener('mousedown', close)
      window.addEventListener('scroll', close, true)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[140px] rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            if (!item.disabled) item.onClick()
            onClose()
          }}
          className="block w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
