import { useState } from 'react'

interface CopyTextButtonProps {
  text: string
  disabled?: boolean
  className?: string
}

export function CopyTextButton({ text, disabled, className }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!text || disabled) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled || !text}
      className={
        className ??
        'rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
      }
    >
      {copied ? 'Copied!' : 'Copy to clipboard'}
    </button>
  )
}
