import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  extraWide?: boolean
}

export function Modal({ title, subtitle, children, footer, wide, extraWide }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl ${
          extraWide ? 'max-w-6xl' : wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="border-t border-slate-800 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}
