import { useEffect } from 'react'

export interface ConfirmDialogOptions {
  title: string
  message?: string
  impact: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  impact,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const impactBorder =
    variant === 'warning'
      ? 'border-amber-700/40 bg-amber-950/25'
      : 'border-red-800/50 bg-red-950/25'
  const impactTitle = variant === 'warning' ? 'text-amber-100' : 'text-red-100'
  const impactBody = variant === 'warning' ? 'text-amber-200/90' : 'text-red-200/90'
  const confirmClass =
    variant === 'warning'
      ? 'bg-amber-900/80 text-amber-50 hover:bg-amber-900'
      : 'bg-red-900/80 text-red-50 hover:bg-red-900'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-impact"
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <h3 id="confirm-dialog-title" className="text-lg font-semibold text-slate-100">
            {title}
          </h3>
        </div>

        <div className="space-y-4 p-5">
          {message && <p className="text-sm text-slate-300">{message}</p>}

          <div className={`rounded-lg border px-4 py-3 ${impactBorder}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${impactTitle}`}>
              Impact
            </p>
            <p id="confirm-dialog-impact" className={`mt-1.5 text-sm leading-relaxed ${impactBody}`}>
              {impact}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
