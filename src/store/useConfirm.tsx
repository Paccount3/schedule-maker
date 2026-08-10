import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ConfirmDialog, type ConfirmDialogOptions } from '../components/ConfirmDialog'

interface ConfirmContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((next: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setOptions(next)
    })
  }, [])

  const finish = (result: boolean) => {
    setOptions(null)
    resolveRef.current?.(result)
    resolveRef.current = null
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <ConfirmDialog
          {...options}
          onConfirm={() => finish(true)}
          onCancel={() => finish(false)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }
  return ctx
}
